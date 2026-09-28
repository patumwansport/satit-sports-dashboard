/* =========================================================
   sheets.js — ดึง Google Sheets แล้วแปลงเป็น JSON ก้อนเดียว "ในเบราว์เซอร์"

   เดิมงานนี้อยู่ฝั่งเซิร์ฟเวอร์ (lib/dashboard.js บน Express / Netlify function)
   แต่เว็บย้ายมาอยู่บน GitHub Pages ซึ่งเสิร์ฟได้แค่ไฟล์นิ่ง ๆ ไม่มีที่ให้รันโค้ดฝั่งเซิร์ฟเวอร์
   จึงย้ายตรรกะทั้งหมดมารันในเบราว์เซอร์แทน — ทำได้เพราะ gviz ของ Google ตอบ
   Access-Control-Allow-Origin ให้ทุกโดเมน (ตรวจแล้ว) ไม่ต้องมีตัวกลาง ไม่ต้องใช้ API key

   ใช้กับชีตที่แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" เท่านั้น
   ========================================================= */

import { WEEKDAYS_TH, MONTHS_TH, SELF_SCHOOL_NAME, pad2, isoDate, shortSchoolName, directImageUrl } from './format.js';

const SHEET_ID = '1-gVKoQrOLBcv5fufZzOMrdrRuG9pB__vpb84SDrfeXE';
/**
 * แท็บ "สถิติเหรียญรางวัล" — ตารางเหรียญรายโรงเรียน: โรงเรียน / ทอง / เงิน / ทองแดง / รวม
 * อ้างด้วย "ชื่อแท็บ" ไม่ใช่ gid เพราะ gid=0 (แท็บแรกของไฟล์) เคยชี้มาที่ตารางนี้
 * แล้วต่อมากลายเป็นแท็บเหรียญรายกีฬา จนชื่อโรงเรียนออกมาเป็นตัวเลข
 * ระวัง: ถ้าแท็บถูกเปลี่ยนชื่อ gviz จะเงียบ ๆ ส่งแท็บแรกกลับมาแทน ไม่ได้แจ้ง error
 * buildMedalTable() จึงตรวจหัวคอลัมน์ก่อนใช้ทุกครั้ง
 */
const SHEET_MEDAL_TABLE = 'สถิติเหรียญรางวัล';
const GID_SPORT_MEDALS = '771077705'; // แท็บ: ทอง / เงิน / ทองแดง / รวมเหรียญ / ชนิดกีฬา
const GID_SCHEDULE = '266724596';     // แท็บ "ผลการแข่งขันประจำวัน": วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ
/**
 * แท็บ "ตารางการแข่งขัน" — ผังกำหนดการทั้งรายการ:
 *   วันที่ / รายการแข่งขัน (ชนิดกีฬา) / ประเภท / รอบ / สาย / เวลา / ระหว่าง (ทีม A · VS · ทีม B สามช่อง)
 * ลำดับคอลัมน์ต่างจากแท็บผลการแข่งขัน (มีรอบกับสายแทรกก่อนเวลา) จึงหาคอลัมน์จากชื่อหัวตาราง
 * ไม่ใช่ตำแหน่งตายตัว — ย้ายคอลัมน์ในชีตทีหลังหน้าเว็บก็ยังอ่านถูก ดู planColumns()
 * แท็บนี้ไม่มีช่องผล/สถานะ — ทุกรายการจึงออกมาเป็น "รอเริ่ม" ตามความจริงของผัง
 */
const GID_SCHEDULE_PLAN = '103481153';
/**
 * แท็บภาพบรรยากาศ (ไม่บังคับ) — อ้างด้วย "ชื่อแท็บ" ไม่ใช่ gid เพราะแท็บนี้สร้าง/ลบบ่อยกว่าแท็บอื่น
 * รูปแบบ: แถวละ 1 รูป ใส่ลิงก์ไว้ช่องไหนก็ได้ (Google Drive แบบแชร์ลิงก์ หรือ URL รูปตรง ๆ)
 * แถวหัวตารางกับช่องว่างระบบข้ามให้เอง · เว้นค่านี้เป็น '' = ปิดแถบภาพบนหน้าหลัก
 */
const SHEET_PHOTOS = 'img';

// คำเฉพาะท้ายชื่อ ใช้จับคู่ชื่อย่อในตารางแข่งขัน (แต่ละแท็บสะกดชื่อโรงเรียนไม่ตรงกัน)
const SELF_SCHOOL_KEYWORD = SELF_SCHOOL_NAME.trim().split(/\s+/).pop();

const SPORT_IDS = {
  'กรีฑา': 'athletics', 'กอล์ฟ': 'golf', 'เทนนิส': 'tennis', 'เทเบิลเทนนิส': 'tabletennis',
  'บาสเกตบอล': 'basketball', 'บาสเกตบอล 3X3': 'basketball3x3', 'แบดมินตัน': 'badminton',
  'เปตอง': 'petanque', 'ฟุตบอล': 'football', 'ลีลาศ': 'dancesport', 'ว่ายน้ำ': 'swimming',
  'หมากกระดาน': 'boardgame', 'แฮนด์บอล': 'handball', 'วอลเลย์บอล': 'volleyball'
};

/* แต่ละแท็บในชีตพิมพ์ชื่อกีฬาไม่ตรงกันเป๊ะ ("บาสเกตบอล 3x3" ในตารางแข่งขัน กับ "บาสเกตบอล 3X3"
   ในตารางเหรียญ) เทียบแบบตรงตัวจะได้ id ว่าง แล้วหน้าเว็บจะขึ้นไอคอนกลางแทนไอคอนกีฬานั้น
   จึงเทียบด้วยชื่อที่ตัดช่องว่างซ้ำและแปลงเป็นตัวพิมพ์เล็กก่อน */
const SPORT_IDS_NORM = Object.keys(SPORT_IDS).reduce(function (map, name) {
  map[normSportName(name)] = SPORT_IDS[name];
  return map;
}, {});
function normSportName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function sportIdOf(name) {
  return SPORT_IDS_NORM[normSportName(name)] || '';
}

/**
 * กีฬาที่ไม่ได้ส่งแข่ง — ตัดออกทั้งหน้าชนิดกีฬาและตารางแข่งขัน แม้ชีตจะยังมีแถวของกีฬานั้นอยู่
 * เทียบแบบ "มีคำนี้อยู่ในชื่อ" เพราะชีตเขียนชื่อประเภทต่อท้ายบ้าง (เช่น "อีสปอร์ต (RoV)")
 */
const SPORTS_NOT_ENTERED = ['อีสปอร์ต'];
function isSportNotEntered(name) {
  const text = String(name || '');
  return SPORTS_NOT_ENTERED.some(function (word) { return text.indexOf(word) > -1; });
}

function cellText(cell) {
  if (!cell) return '';
  return String(cell.f != null ? cell.f : cell.v != null ? cell.v : '').trim();
}
function cellNum(cell) {
  if (!cell || cell.v == null) return 0;
  const n = Number(cell.v);
  return isNaN(n) ? 0 : n;
}

/**
 * ดึงและแปลง JSON จาก Google Visualization API (gviz)
 * รับได้ทั้ง gid (ตัวเลข) และชื่อแท็บ — ระวังว่า gviz ตอบชีตแรกกลับมาเงียบ ๆ เมื่อชื่อแท็บไม่มีจริง
 * cache: 'no-store' เพราะเราโพลซ้ำทุกครึ่งนาทีเพื่อเอาคะแนนล่าสุด ไม่ใช่ของที่เบราว์เซอร์แคชไว้
 * @param {number} [headers] - จำนวนแถวหัวตาราง ส่งให้ gviz ตรง ๆ แทนให้มันเดาเอง
 *   gviz เดาหัวตารางจาก "ชนิดข้อมูลต่างจากแถวล่าง" แท็บที่ยังเป็นข้อความล้วน
 *   (เช่นตารางเหรียญก่อนเริ่มแข่ง ช่องตัวเลขยังว่างทั้งหมด) จะเดาไม่ออก แล้วคืนหัวตารางมาเป็นแถวข้อมูลแถวแรก
 */
/* gviz ตอบช้าไม่สม่ำเสมอ (วัดจริง 0.4–6 วินาทีต่อแท็บ) และบางครั้งค้างไม่ตอบเลย
   ถ้าไม่ตัด หน้าเว็บจะรอไม่มีวันจบ — เกินเวลานี้ถือว่าล้มเหลว แล้ว common.js จะใช้ข้อมูลชุดล่าสุดแทน */
const FETCH_TIMEOUT_MS = 8000;

async function fetchGvizTable(source, headers) {
  const key = /^\d+$/.test(String(source)) ? 'gid' : 'sheet';
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&' + key + '=' + encodeURIComponent(source) +
    (headers != null ? '&headers=' + headers : '');
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
  let raw;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('gviz ' + key + '=' + source + ' ตอบกลับ ' + res.status);
    raw = await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('gviz ' + key + '=' + source + ' ไม่ตอบภายใน ' + (FETCH_TIMEOUT_MS / 1000) + ' วินาที');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const match = raw.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error('gviz ' + key + '=' + source + ' รูปแบบข้อมูลไม่ถูกต้อง');
  const json = JSON.parse(match[1]);
  if (json.status !== 'ok') throw new Error('gviz ' + key + '=' + source + ' status=' + json.status);
  return json.table;
}

function parseSheetDate(cell) {
  if (!cell || cell.v == null) return null;
  const m = /^Date\((\d+),(\d+),(\d+)\)/.exec(cell.v);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), Number(m[3]));
}

function formatTimeValue(cell) {
  if (!cell || cell.v == null) return '';
  // ช่องที่ตั้งรูปแบบเป็น datetime ส่งมาเป็นสตริง "Date(2026,9,20,9,0,0)"
  const d = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+))?/.exec(String(cell.v));
  if (d) return pad2(Number(d[4] || 0)) + ':' + pad2(Number(d[5] || 0));
  const v = Number(cell.v);
  // เติมศูนย์หน้าชั่วโมงหลักเดียวเสมอ ไม่ใช่แค่ให้สวย — ตารางเรียงเวลาด้วยการเทียบข้อความ
  // ถ้าปล่อยเป็น "9:00" มันจะถูกจัดไปอยู่หลัง "19:00"
  if (isNaN(v)) {
    const t = /^(\d{1,2}):(\d{2})/.exec(cellText(cell));
    return t ? pad2(Number(t[1])) + ':' + t[2] : cellText(cell);
  }
  if (v > 0 && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    return pad2(Math.floor(totalMin / 60)) + ':' + pad2(totalMin % 60);
  }
  if (v >= 100) return pad2(Math.floor(v / 100)) + ':' + pad2(v % 100);
  return pad2(Math.floor(v)) + ':00';
}

/**
 * สถานะของรายการแข่ง
 * ช่อง "สถานะ" ในชีตกรอกได้หลายแบบ (เสร็จสิ้น / ไม่เป็นทางการ / เว้นว่าง) จึงยึด
 * "มีผลการแข่งขันกรอกไว้แล้วหรือยัง" เป็นหลัก: มีสกอร์ = แข่งจบและประกาศผลแล้ว
 * ยกเว้นชีตระบุว่ากำลังแข่งอยู่ ซึ่งสกอร์คือคะแนนสด
 */
function normalizeStatus(raw, score) {
  const s = String(raw || '').trim();
  if (/สด|กำลัง|live/i.test(s)) return 'live';
  if (/จบ|เสร็จ|done|เรียบร้อย/i.test(s)) return 'done';
  if (String(score || '').trim()) return 'done';
  return 'upcoming';
}
/** ชีตทำเครื่องหมายไว้ว่าผลยังไม่เป็นทางการ ต้องบอกผู้อ่านด้วย ไม่กลืนไปกับผลที่รับรองแล้ว */
function isUnofficial(raw) {
  return /ไม่เป็นทางการ|unofficial/i.test(String(raw || ''));
}

/* ---------- ตารางเหรียญรวมรายโรงเรียน ---------- */
function buildMedalTable(table) {
  // gviz ไม่แจ้ง error เวลาหาแท็บตามชื่อไม่เจอ แต่ส่ง "แท็บแรกของไฟล์" กลับมาแทนเงียบ ๆ
  // ถ้าไม่ตรวจ ตารางเหรียญจะกลายเป็นข้อมูลของแท็บอื่นโดยที่หน้าเว็บยังขึ้นเป็นปกติ
  const head = ((table.cols || [])[0] || {}).label || '';
  if (!/โรงเรียน/.test(head)) {
    throw new Error(
      'แท็บ "' + SHEET_MEDAL_TABLE + '" ไม่ใช่ตารางเหรียญรายโรงเรียน ' +
      '(คอลัมน์แรกคือ "' + head + '" ไม่ใช่ "โรงเรียน") — ตรวจว่าแท็บถูกเปลี่ยนชื่อหรือลบไปหรือไม่');
  }

  const rows = (table.rows || [])
    .map(function (r) {
      const c = r.c || [];
      const fullName = cellText(c[0]);
      if (!fullName) return null;
      return {
        fullName: fullName,
        school: shortSchoolName(fullName),
        isSelf: fullName === SELF_SCHOOL_NAME,
        gold: cellNum(c[1]), silver: cellNum(c[2]), bronze: cellNum(c[3])
      };
    })
    .filter(Boolean)
    .sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });

  rows.forEach(function (r, i) { r.rank = i + 1; });
  return rows;
}

/* ---------- เหรียญแยกตามชนิดกีฬา ---------- */
function buildSports(table) {
  return (table.rows || [])
    .map(function (r) {
      const c = r.c || [];
      const name = cellText(c[4]);
      if (!name || isSportNotEntered(name) || !sportIdOf(name)) return null;
      const gold = cellNum(c[0]), silver = cellNum(c[1]), bronze = cellNum(c[2]);
      return {
        id: sportIdOf(name), name: name,
        status: (gold + silver + bronze) > 0 ? 'done' : 'upcoming',
        gold: gold, silver: silver, bronze: bronze
      };
    })
    .filter(Boolean);
}

/* ---------- ตารางแข่งขัน/ผลการแข่งขัน จัดกลุ่มตามวัน ---------- */

/* ตำแหน่งคอลัมน์ของแท็บ "ผลการแข่งขันประจำวัน":
   วันที่ / กีฬา / ประเภท / เวลา / ทีม A / VS / ทีม B / ผล / สถานะ */
const RESULT_COLUMNS = { date: 0, sport: 1, kind: 2, time: 3, teamA: 4, teamB: 6, score: 7, status: 8, round: -1, pool: -1 };

/**
 * ตำแหน่งคอลัมน์ของแท็บ "ตารางการแข่งขัน" หาจากชื่อหัวตาราง
 * "ระหว่าง" เป็นหัวที่ผสานสามช่อง (ทีม A · VS · ทีม B) gviz ให้ชื่อหัวแค่ช่องแรก ทีม B จึงอยู่ถัดไปสองช่อง
 * หาหัวไหนไม่เจอก็ถอยไปใช้ตำแหน่งตามผังปัจจุบันของชีต
 */
function planColumns(table) {
  const labels = (table.cols || []).map(function (c) { return String(c.label || '').trim(); });
  function at(pattern, fallback) {
    const i = labels.findIndex(function (l) { return pattern.test(l); });
    return i > -1 ? i : fallback;
  }
  const teamA = at(/ระหว่าง/, 6);
  return {
    date: at(/วันที่/, 0), sport: at(/รายการ|กีฬา/, 1), kind: at(/ประเภท/, 2),
    round: at(/รอบ/, 3), pool: at(/สาย/, 4), time: at(/เวลา/, 5),
    teamA: teamA, teamB: teamA + 2, score: -1, status: -1
  };
}

/** @param {object} cols - ตำแหน่งคอลัมน์ (-1 = แท็บนี้ไม่มีคอลัมน์นั้น) */
function buildDays(table, cols) {
  const byDate = new Map();
  function cell(c, i) { return i > -1 ? c[i] : null; }

  (table.rows || []).forEach(function (r) {
    const c = r.c || [];
    const date = parseSheetDate(cell(c, cols.date));
    const sportName = cellText(cell(c, cols.sport));
    if (!date || !sportName || isSportNotEntered(sportName)) return;

    const key = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: date,
        weekday: WEEKDAYS_TH[date.getDay()],
        label: date.getDate() + ' ' + MONTHS_TH[date.getMonth()],
        items: []
      });
    }

    const teamA = cellText(cell(c, cols.teamA));
    const teamB = cellText(cell(c, cols.teamB));
    const statusText = cellText(cell(c, cols.status));
    const score = cellText(cell(c, cols.score));

    byDate.get(key).items.push({
      time: formatTimeValue(cell(c, cols.time)),
      sportId: sportIdOf(sportName),
      event: [sportName, cellText(cell(c, cols.kind))].filter(Boolean).join(' — '),
      round: cellText(cell(c, cols.round)),
      pool: cellText(cell(c, cols.pool)),
      teams: [teamA, teamB].filter(Boolean).join(' พบ '),
      status: normalizeStatus(statusText, score),
      // ข้อความสถานะตามที่กรอกในชีต ("เสร็จสิ้น" / "ไม่เป็นทางการ") ตารางผลแสดงคำนี้ตรง ๆ
      statusText: statusText,
      unofficial: isUnofficial(statusText),
      score: score
    });
  });

  return Array.from(byDate.values())
    .sort(function (a, b) { return a.date - b.date; })
    .map(function (d, i) {
      d.items.sort(function (a, b) { return a.time.localeCompare(b.time); });
      // iso = วันที่เต็มพร้อมปี ใช้เทียบ "วันนี้" กับปฏิทินจริง (date เป็นแค่ป้าย "21 ต.ค." ไม่มีปี)
      return { id: i + 1, weekday: d.weekday, date: d.label, iso: isoDate(d.date), note: '', items: d.items };
    });
}

/* ---------- ภาพบรรยากาศ (แถบสไลด์บนหน้าหลัก) ---------- */

function buildPhotos(table) {
  return (table.rows || [])
    .map(function (r, idx) {
      // หยิบ URL จากช่องไหนก็ได้ในแถว — แถวหัวตาราง ("img link") กับช่องว่างจะไม่ผ่านเงื่อนไขนี้เอง
      const src = (r.c || []).map(cellText).filter(function (t) { return /^https?:\/\//i.test(t); })[0];
      if (!src) return null;
      return { id: 'p' + idx, src: directImageUrl(src) };
    })
    .filter(Boolean);
}

/** อ่านแท็บภาพแยกจากแท็บหลัก: แท็บนี้พังไม่ควรทำให้ทั้งแดชบอร์ดตกไปใช้ข้อมูลตัวอย่าง */
async function loadPhotos() {
  if (!SHEET_PHOTOS) return [];
  try {
    return buildPhotos(await fetchGvizTable(SHEET_PHOTOS));
  } catch (err) {
    console.error('อ่านแท็บภาพ (' + SHEET_PHOTOS + ') ไม่สำเร็จ:', err.message);
    return [];
  }
}

/* ---------- ประกอบเป็นก้อนเดียว schema เดียวกับ data/mock.json ----------
   แท็บภาพไม่อยู่ใน Promise.all ของแท็บหลัก: มันเป็นแท็บที่ตอบช้าที่สุด (วัดได้ 2–6 วินาที)
   แต่ใช้แค่แถบภาพบนหน้าหลัก — ถ้ารอด้วย ทุกหน้าต้องช้าตามมันไปหมด
   ภาพมาทันก็ใส่ไปเลย มาไม่ทันก็ใช้ชุดเดิม (opts.prevPhotos) แล้วส่งชุดใหม่ตามไปทีหลังผ่าน opts.onLatePhotos

   @param {{prevPhotos?: Array, onLatePhotos?: function(Array)}} [opts] */
export async function loadFromSheets(opts) {
  opts = opts || {};
  let mainDone = false;
  let freshPhotos = null;
  loadPhotos().then(function (p) {   // loadPhotos ไม่ throw — พังก็คืน []
    freshPhotos = p;
    if (mainDone && opts.onLatePhotos) opts.onLatePhotos(p);
  });

  const [medalTable, sportTable, scheduleTable, planTable] = await Promise.all([
    fetchGvizTable(SHEET_MEDAL_TABLE, 1),
    fetchGvizTable(GID_SPORT_MEDALS),
    fetchGvizTable(GID_SCHEDULE),
    fetchGvizTable(GID_SCHEDULE_PLAN)
  ]);
  mainDone = true;
  const photos = freshPhotos || opts.prevPhotos || [];

  const medals = buildMedalTable(medalTable);
  const self = medals.filter(function (m) { return m.isSelf; })[0] || null;
  const leader = medals[0] || null;

  return {
    meta: {
      title: 'กีฬาสาธิตสามัคคี',
      subtitle: 'การแข่งขันกีฬานักเรียนสาธิตสัมพันธ์แห่งประเทศไทย'
    },
    school: self ? {
      name: self.school, fullName: self.fullName, rank: self.rank, totalSchools: medals.length,
      gold: self.gold, silver: self.silver, bronze: self.bronze, keyword: SELF_SCHOOL_KEYWORD
    } : { name: shortSchoolName(SELF_SCHOOL_NAME), fullName: SELF_SCHOOL_NAME, rank: 0, totalSchools: medals.length, gold: 0, silver: 0, bronze: 0, keyword: SELF_SCHOOL_KEYWORD },
    leaderName: leader ? leader.school : '',
    medalTable: medals,
    sports: buildSports(sportTable),
    days: buildDays(scheduleTable, RESULT_COLUMNS),
    schedule: buildDays(planTable, planColumns(planTable)),
    photos: photos,
    syncedAt: new Date().toISOString(),
    source: 'sheets'
  };
}
