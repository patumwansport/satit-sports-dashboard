/* =========================================================
   sheets.js — ดึง Google Sheets แล้วแปลงเป็น JSON ก้อนเดียว "ในเบราว์เซอร์"

   เดิมงานนี้อยู่ฝั่งเซิร์ฟเวอร์ (lib/dashboard.js บน Express / Netlify function)
   แต่เว็บย้ายมาอยู่บน GitHub Pages ซึ่งเสิร์ฟได้แค่ไฟล์นิ่ง ๆ ไม่มีที่ให้รันโค้ดฝั่งเซิร์ฟเวอร์
   จึงย้ายตรรกะทั้งหมดมารันในเบราว์เซอร์แทน — ทำได้เพราะ gviz ของ Google ตอบ
   Access-Control-Allow-Origin ให้ทุกโดเมน (ตรวจแล้ว) ไม่ต้องมีตัวกลาง ไม่ต้องใช้ API key

   ใช้กับชีตที่แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" เท่านั้น
   ========================================================= */

import { WEEKDAYS_TH, MONTHS_TH, SELF_SCHOOL_NAME, pad2, isoDate, shortSchoolName, directImageUrl, parseThaiDate } from './format.js';

const SHEET_ID = '1BVnQOOoihXIPncU0JWPLL1YcR_Sk3bJTMwtoRDSqQzM';
/**
 * แท็บ "สถิติเหรียญรางวัล" — ตารางเหรียญรายโรงเรียน: โรงเรียน / ทอง / เงิน / ทองแดง / รวม
 * อ้างด้วย gid ไม่ใช่ชื่อแท็บ: ชื่อแท็บในไฟล์นี้ขึ้นต้นด้วย "🔒 " (ตั้งชื่อให้รู้ว่าเป็นแท็บล็อกไว้)
 * ชื่อแบบนี้แก้กันพลาดง่าย และถ้าชื่อไม่ตรง gviz จะเงียบ ๆ ส่งแท็บแรกกลับมาแทน ไม่ได้แจ้ง error
 * gid ของแท็บไม่เปลี่ยนตามชื่อหรือลำดับแท็บ — buildMedalTable() ยังตรวจหัวคอลัมน์ก่อนใช้ทุกครั้งกันพลาด
 */
const SHEET_MEDAL_TABLE = '1195929060';
const GID_SPORT_MEDALS = '1253612074'; // แท็บ "รวมเหรียญ": ประเภทกีฬา / ทอง / เงิน / ทองแดง / รวม (หาคอลัมน์จากหัว ดู sportMedalColumns)
const GID_SCHEDULE = '2119468784';     // แท็บ "ผลการแข่งขัน": วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ / รายชื่อนักกีฬา
/**
 * แท็บ "ตารางการแข่งขัน" — ผังกำหนดการทั้งรายการ:
 *   วันที่ / รายการแข่งขัน (ชนิดกีฬา) / ประเภท / รอบ / สาย / เวลา / ระหว่าง (ทีม A · VS · ทีม B สามช่อง)
 * ลำดับคอลัมน์ต่างจากแท็บผลการแข่งขัน (มีรอบกับสายแทรกก่อนเวลา) จึงหาคอลัมน์จากชื่อหัวตาราง
 * ไม่ใช่ตำแหน่งตายตัว — ย้ายคอลัมน์ในชีตทีหลังหน้าเว็บก็ยังอ่านถูก ดู planColumns()
 * แท็บนี้ไม่มีช่องผล/สถานะ — ทุกรายการจึงออกมาเป็น "รอเริ่ม" ตามความจริงของผัง
 */
const GID_SCHEDULE_PLAN = '1146003336';
/**
 * แท็บภาพบรรยากาศ (หน้า "ประมวลภาพ") — อ้างด้วย "ชื่อแท็บ" ไม่ใช่ gid เพราะแท็บนี้สร้าง/ลบบ่อยกว่าแท็บอื่น
 * แถวละ 1 รูป แถวแรกเป็นหัวตาราง คอลัมน์หาจากชื่อหัว (สลับลำดับได้ ไม่มีคอลัมน์ไหนก็ได้):
 *   วันที่ | ลิงก์รูป | คำบรรยาย | กีฬา
 * ลิงก์รูปอยู่ช่องไหนก็ได้ในแถว (Google Drive แบบแชร์ลิงก์ หรือ URL รูปตรง ๆ)
 * ไม่มีวันที่ = ไปอยู่กลุ่ม "ภาพอื่น ๆ" · เว้นค่านี้เป็น '' = ปิดระบบภาพทั้งหมด
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
export function sportIdOf(name) {
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
 * cache: 'no-store' เพื่อเอาคะแนนล่าสุด ไม่ใช่ของที่เบราว์เซอร์แคชไว้ (แคชที่ตั้งใจมีชั้นเดียวคือ CDN ของตัวกลาง)
 * @param {number} [headers] - จำนวนแถวหัวตาราง ส่งให้ gviz ตรง ๆ แทนให้มันเดาเอง
 *   gviz เดาหัวตารางจาก "ชนิดข้อมูลต่างจากแถวล่าง" แท็บที่ยังเป็นข้อความล้วน
 *   (เช่นตารางเหรียญก่อนเริ่มแข่ง ช่องตัวเลขยังว่างทั้งหมด) จะเดาไม่ออก แล้วคืนหัวตารางมาเป็นแถวข้อมูลแถวแรก
 */
/* gviz ตอบช้าไม่สม่ำเสมอ (วัดจริง 0.4–6 วินาทีต่อแท็บ) และบางครั้งค้างไม่ตอบเลย
   ถ้าไม่ตัด หน้าเว็บจะรอไม่มีวันจบ — เกินเวลานี้ถือว่าล้มเหลว แล้ว common.js จะใช้ข้อมูลชุดล่าสุดแทน */
const FETCH_TIMEOUT_MS = 8000;

/* ตัวกลางแคชบน Vercel (api/gviz.js): ผู้ชมทุกคนได้สำเนาเดียวกันจาก CDN แทนต่างคนต่างยิง Google
   คนดูเยอะพร้อมกันเท่าไรก็ไม่ไปถึงชีต · ตัวกลางล่ม/ยังไม่ได้ deploy = ถอยไปยิง Google ตรงแบบเดิม
   บนเครื่องตัวเองกับบน Vercel ใช้ /api/gviz ของโดเมนเดียวกัน (server.js เสิร์ฟให้) ที่อื่น (GitHub Pages) ข้ามไป Vercel
   สคริปต์ Node (import-sheets.mjs) ไม่มี location → ยิง Google ตรง */
const GVIZ_PROXY = typeof location === 'undefined' ? '' :
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /\.vercel\.app$/.test(location.hostname))
    ? location.origin + '/api/gviz'
    : 'https://satit-sports-dashboard-one.vercel.app/api/gviz';

async function fetchText(url, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(label + ' ตอบกลับ ' + res.status);
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(label + ' ไม่ตอบภายใน ' + (FETCH_TIMEOUT_MS / 1000) + ' วินาที');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGvizTable(source, headers) {
  const key = /^\d+$/.test(String(source)) ? 'gid' : 'sheet';
  const query = key + '=' + encodeURIComponent(source) + (headers != null ? '&headers=' + headers : '');
  const label = 'gviz ' + key + '=' + source;
  let raw;
  if (GVIZ_PROXY) {
    try {
      raw = await fetchText(GVIZ_PROXY + '?' + query, label + ' (ตัวกลาง)');
      // Vercel ที่ยังไม่มีฟังก์ชันนี้ตอบหน้า index.html กลับมาพร้อม 200 — ไม่ใช่คำตอบของ gviz ก็ถือว่าตัวกลางใช้ไม่ได้
      if (!/setResponse\(/.test(raw)) { raw = null; throw new Error(label + ' (ตัวกลาง) ไม่ได้ตอบเป็นข้อมูลชีต'); }
    } catch (err) {
      console.warn(err.message + ' — ดึงจาก Google ตรงแทน');
    }
  }
  if (raw == null) {
    raw = await fetchText('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&' + query, label);
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
      'แท็บสถิติเหรียญรางวัล (gid ' + SHEET_MEDAL_TABLE + ') ไม่ใช่ตารางเหรียญรายโรงเรียน ' +
      '(คอลัมน์แรกคือ "' + head + '" ไม่ใช่ "โรงเรียน") — ตรวจว่าแท็บถูกลบ หรือคอลัมน์ถูกย้ายหรือไม่');
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

/**
 * ตำแหน่งคอลัมน์ของแท็บ "รวมเหรียญ" หาจากแถวหัวตาราง (แถวที่มีคำว่า ทอง / เงิน / ทองแดง)
 * ผังเปลี่ยนมาแล้วครั้งหนึ่ง: ชีตเก่า ทอง·เงิน·ทองแดง·รวม·ชนิดกีฬา → ชีตปัจจุบัน ประเภทกีฬา·ทอง·เงิน·ทองแดง·รวม
 * และหัวตารางไม่ได้อยู่แถวแรก (มีแถวสรุปยอดรวมอยู่ข้างบน) จึงไล่หาทุกแถว ไม่ยึดตำแหน่งตายตัว
 * ระวัง: gviz ทิ้งข้อความในคอลัมน์ที่มันถือเป็นตัวเลข หัว "ทอง/เงิน/ทองแดง" จึงมักหายไปทั้งแถว
 * หาหัวไม่เจอ → ดูจากคอลัมน์ที่มีชื่อกีฬา: อยู่ซ้ายสุด = เหรียญตามมาทางขวา (ผังปัจจุบัน)
 * อยู่ที่อื่น = เหรียญอยู่สามช่องแรก (ผังชีตเก่า)
 */
function sportMedalColumns(rows) {
  for (let i = 0; i < rows.length; i++) {
    const labels = (rows[i].c || []).map(cellText);
    const at = function (re) { return labels.findIndex(function (l) { return re.test(l); }); };
    const cols = { name: at(/กีฬา/), gold: at(/ทอง(?!แดง)/), silver: at(/เงิน/), bronze: at(/ทองแดง/) };
    if (cols.name > -1 && cols.gold > -1 && cols.silver > -1 && cols.bronze > -1) return cols;
  }
  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i].c || []).map(cellText).findIndex(sportIdOf);
    if (name === 0) return { name: 0, gold: 1, silver: 2, bronze: 3 };
    if (name > 0) return { name: name, gold: 0, silver: 1, bronze: 2 };
  }
  return { name: 4, gold: 0, silver: 1, bronze: 2 };
}

function buildSports(table) {
  // อ่านด้วย headers=0 — ทุกแถวรวมแถวหัวตารางมาเป็นข้อมูล ให้ sportMedalColumns() หาหัวเอง
  const rows = (table.cols || []).some(function (c) { return c.label; })
    ? [{ c: table.cols.map(function (c) { return { v: c.label }; }) }].concat(table.rows || [])
    : (table.rows || []);
  const cols = sportMedalColumns(rows);
  return rows
    .map(function (r) {
      const c = r.c || [];
      const name = cellText(c[cols.name]);
      // แถวหัวตาราง แถวยอด "รวมทั้งหมด" และแถวว่าง ไม่ใช่ชื่อกีฬาที่รู้จัก — ตกไปเองตรงนี้
      if (!name || isSportNotEntered(name) || !sportIdOf(name)) return null;
      const gold = cellNum(c[cols.gold]), silver = cellNum(c[cols.silver]), bronze = cellNum(c[cols.bronze]);
      return {
        id: sportIdOf(name), name: name,
        status: (gold + silver + bronze) > 0 ? 'done' : 'upcoming',
        gold: gold, silver: silver, bronze: bronze
      };
    })
    .filter(Boolean);
}

/**
 * แท็บ "รวมเหรียญ" ยังว่าง (ช่วงก่อนเริ่มแข่ง ชีตยังไม่ได้กรอกเหรียญรายกีฬา) — ถ้าคืนลิสต์ว่างไปตรง ๆ
 * หน้าชนิดกีฬาจะหายทั้งหน้า ทั้งที่ตารางแข่งมีกีฬาครบแล้ว จึงสร้างลิสต์จากกีฬาที่อยู่ในตาราง/ผลการแข่งขันแทน
 * เหรียญเป็น 0 ทั้งหมดจนกว่าแท็บจะกรอก · เรียงตามลำดับใน SPORT_IDS ให้ตรงกับลำดับเดิมของชีต
 */
function sportsFromDays(dayLists) {
  const seen = {};
  dayLists.forEach(function (days) {
    days.forEach(function (d) { d.items.forEach(function (it) { if (it.sportId) seen[it.sportId] = 1; }); });
  });
  return Object.keys(SPORT_IDS)
    .filter(function (name) { return seen[SPORT_IDS[name]]; })
    .map(function (name) {
      return { id: SPORT_IDS[name], name: name, status: 'upcoming', gold: 0, silver: 0, bronze: 0 };
    });
}

/* ---------- ตารางแข่งขัน/ผลการแข่งขัน จัดกลุ่มตามวัน ---------- */

/* ตำแหน่งคอลัมน์ของแท็บ "ผลการแข่งขัน":
   วันที่ / กีฬา / ประเภท / เวลา / ทีม A / VS / ทีม B / ผล / สถานะ */
const RESULT_COLUMNS = { date: 0, sport: 1, kind: 2, time: 3, teamA: 4, teamB: 6, score: 7, status: 8, round: -1, pool: -1 };

/** คอลัมน์ลิงก์ถ่ายทอดสด (หัว "Live") — มีลิงก์ = หน้าเว็บขึ้นป้าย LIVE ที่กดไปดูได้ */
const LIVE_HEADER = /^live$|ถ่ายทอด|ไลฟ์/i;
/** รับเฉพาะลิงก์เว็บจริง (http/https) — ข้อความอื่นที่พิมพ์ไว้ในช่อง เช่น "รอลิงก์" หรือ javascript: ไม่เอามาทำเป็นลิงก์ */
function webLink(text) {
  return /^https?:\/\/\S+$/i.test(text) ? text : '';
}

/** ตำแหน่งคอลัมน์ที่ไม่บังคับ หาจากชื่อหัวตาราง — ไม่มีหัวนั้นในแท็บ = -1 (ช่องนั้นว่างทุกแถว) */
function headerIndex(table, pattern) {
  return (table.cols || []).findIndex(function (c) { return pattern.test(String(c.label || '').trim()); });
}

/**
 * แท็บผลการแข่งขัน: คอลัมน์หลักอยู่ตำแหน่งตายตัวตามผังชีต
 * ส่วน "นักกีฬา" เป็นคอลัมน์เสริม เพิ่มไว้ตรงไหนของแท็บก็ได้ ขอแค่หัวคอลัมน์มีคำว่า "นักกีฬา"
 */
function resultColumns(table) {
  return Object.assign({}, RESULT_COLUMNS, { athletes: headerIndex(table, /นักกีฬา/), live: headerIndex(table, LIVE_HEADER) });
}

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
    teamA: teamA, teamB: teamA + 2, score: -1, status: -1,
    athletes: headerIndex(table, /นักกีฬา/),
    live: headerIndex(table, LIVE_HEADER)
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
      score: score,
      // ชื่อนักกีฬาตามที่พิมพ์ในชีต หลายคนคั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่ในช่องเดียวกันก็ได้
      athletes: cellText(cell(c, cols.athletes)),
      liveUrl: webLink(cellText(cell(c, cols.live)))
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

/* ---------- ภาพบรรยากาศ (หน้าประมวลภาพ + แถบสไลด์บนหน้าหลัก) ---------- */

export function buildPhotos(table) {
  const labels = (table.cols || []).map(function (c) { return String(c.label || '').trim(); });
  const rows = (table.rows || []).slice();

  // ขอ headers=1 แล้ว แต่แท็บที่ไม่มีแถวหัว (ลิงก์ตั้งแต่แถวแรก) รูปแรกจะกลายเป็นชื่อหัวคอลัมน์ไป
  // — เอากลับมาเป็นแถวข้อมูล ไม่ให้รูปแรกหายเงียบ ๆ
  if (labels.some(function (l) { return /^https?:\/\//i.test(l); })) {
    rows.unshift({ c: labels.map(function (l) { return { v: l }; }) });
  }
  function col(pattern) { return labels.findIndex(function (l) { return pattern.test(l); }); }
  const iDate = col(/วัน/);
  const iCaption = col(/คำบรรยาย|คำอธิบาย|รายละเอียด|หัวข้อ|caption/i);
  const iSport = col(/กีฬา/);

  return rows
    .map(function (r, idx) {
      const c = r.c || [];
      // หยิบ URL จากช่องไหนก็ได้ในแถว — แถวหัวตารางกับช่องว่างจะไม่ผ่านเงื่อนไขนี้เอง
      const link = c.map(cellText).filter(function (t) { return /^https?:\/\//i.test(t); })[0];
      if (!link) return null;

      // วันที่: ช่องที่ตั้งรูปแบบเป็นวันที่ gviz ส่ง Date(…) มา · ช่องข้อความพิมพ์ได้หลายแบบ (ดู parseThaiDate)
      const dateCell = iDate > -1 ? c[iDate] : null;
      const asDate = parseSheetDate(dateCell);
      const iso = asDate ? isoDate(asDate) : parseThaiDate(cellText(dateCell));
      const sportText = iSport > -1 ? cellText(c[iSport]) : '';

      return {
        id: 'p' + idx,
        src: directImageUrl(link),
        link: link,
        iso: iso,
        caption: iCaption > -1 ? cellText(c[iCaption]) : '',
        sportId: sportIdOf(sportText),
        sportText: sportText
      };
    })
    .filter(Boolean);
}

/** อ่านแท็บภาพแยกจากแท็บหลัก: แท็บนี้พังไม่ควรทำให้ทั้งแดชบอร์ดตกไปใช้ข้อมูลตัวอย่าง */
export async function loadPhotos() {
  if (!SHEET_PHOTOS) return [];
  try {
    return buildPhotos(await fetchGvizTable(SHEET_PHOTOS, 1));
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
    fetchGvizTable(GID_SPORT_MEDALS, 0),
    fetchGvizTable(GID_SCHEDULE),
    fetchGvizTable(GID_SCHEDULE_PLAN)
  ]);
  mainDone = true;
  const photos = freshPhotos || opts.prevPhotos || [];

  const medals = buildMedalTable(medalTable);
  const self = medals.filter(function (m) { return m.isSelf; })[0] || null;
  const leader = medals[0] || null;
  const days = buildDays(scheduleTable, resultColumns(scheduleTable));
  const schedule = buildDays(planTable, planColumns(planTable));
  const sportsWithMedals = buildSports(sportTable);

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
    sports: sportsWithMedals.length ? sportsWithMedals : sportsFromDays([schedule, days]),
    days: days,
    schedule: schedule,
    photos: photos,
    syncedAt: new Date().toISOString(),
    source: 'sheets'
  };
}
