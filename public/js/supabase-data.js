/* =========================================================
   supabase-data.js — อ่านข้อมูลจาก Supabase แล้วประกอบเป็น JSON ก้อนเดียว

   คืน schema "เหมือน sheets.js เป๊ะ" โดยตั้งใจ — หน้าเว็บทั้งหกหน้าไม่ต้องรู้เลยว่า
   วันนี้ข้อมูลมาจาก Supabase หรือ Google Sheets เปลี่ยนแหล่งได้โดยไม่ต้องแตะไฟล์อื่น

   ใช้ fetch ธรรมดายิง PostgREST ไม่โหลดไลบรารี supabase-js
   หน้าสาธารณะต้องการแค่ "อ่าน" ซึ่ง REST ทำได้ครบ ไม่คุ้มกับการให้คนอ่านเว็บโหลด
   JS เพิ่มอีกร่วมแสนไบต์ (หน้า CMS ที่ต้องล็อกอินค่อยโหลดไลบรารีเต็ม)
   ========================================================= */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { SELF_SCHOOL_NAME, shortSchoolName, directImageUrl, dayLabel, pad2, isoDate } from './format.js';

/**
 * ยิง PostgREST หนึ่งตาราง
 * key ต้องส่งสองที่: apikey บอกว่าโปรเจกต์ไหน, Authorization บอกว่าใช้สิทธิ์ระดับไหน
 * ไม่ส่ง Authorization จะโดนปฏิเสธด้วย 401 แม้ RLS จะเปิดให้ anon อ่านได้ก็ตาม
 */
async function select(table, query) {
  var url = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + table + (query ? '?' + query : '');
  var res = await fetch(url, {
    cache: 'no-store',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  if (!res.ok) throw new Error('Supabase ' + table + ' ตอบกลับ ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

/* ---------- ตารางเหรียญรวมรายโรงเรียน ---------- */
function buildMedalTable(rows) {
  var list = rows.map(function (r) {
    return {
      fullName: r.full_name,
      // ช่องชื่อย่อเว้นว่างได้ในหน้า CMS — ว่างแล้วให้ตัวย่อมาตรฐานทำงานแทน
      // จะได้ไม่ต้องพิมพ์ชื่อย่อเองทั้ง 20 กว่าโรงเรียนเพียงเพื่อให้ได้ผลเดิม
      school: r.short_name || shortSchoolName(r.full_name),
      abbr: r.abbr || '',
      logo: r.logo || '',
      isSelf: Boolean(r.is_self),
      gold: r.gold || 0, silver: r.silver || 0, bronze: r.bronze || 0
    };
  });

  // อันดับคำนวณตอนอ่านเสมอ ไม่เก็บในฐานข้อมูล: ทอง → เงิน → ทองแดง
  list.sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });
  list.forEach(function (r, i) { r.rank = i + 1; });
  return list;
}

/* ---------- เหรียญแยกตามชนิดกีฬา ---------- */
function buildSports(rows) {
  return rows.map(function (r) {
    var gold = r.gold || 0, silver = r.silver || 0, bronze = r.bronze || 0;
    return {
      id: r.id, name: r.name,
      // "ประกาศแล้ว" ผูกกับการมีเหรียญ ไม่ใช่ช่องสถานะแยก — คนกรอกจะได้ไม่ต้องจำว่า
      // กรอกเหรียญแล้วต้องไปสลับสถานะอีกที่หนึ่งด้วย
      status: (gold + silver + bronze) > 0 ? 'done' : 'upcoming',
      gold: gold, silver: silver, bronze: bronze
    };
  });
}

/**
 * แถว matches → โครง "วัน" ที่หน้าเว็บใช้
 * @param {object[]} rows แถวจากตาราง matches (กรอง kind มาแล้ว)
 * @param {Map<string,object>} sportById ใช้เติมชื่อกีฬาไทยจาก sport_id
 */
function buildDays(rows, sportById) {
  var byDate = new Map();

  rows.forEach(function (r) {
    if (!r.match_date) return;
    // 'YYYY-MM-DD' ส่งเข้า new Date() ตรง ๆ จะถูกอ่านเป็น UTC แล้วเพี้ยนไปหนึ่งวัน
    // ในโซนเวลาไทย (UTC+7) เพราะเที่ยงคืน UTC คือ 7 โมงเช้าของวันเดียวกัน แต่ย้อนกลับ
    // ไม่ได้เมื่อ toLocale… — แยกเลขเองแล้วสร้างเป็นเวลาท้องถิ่นจึงตรงเสมอ
    var p = r.match_date.split('-');
    var date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));

    var sport = r.sport_id ? sportById.get(r.sport_id) : null;
    if (sport && sport.entered === false) return;   // กีฬาที่ปีนี้ไม่ได้ส่งแข่ง ตัดทิ้งทั้งเว็บ

    var key = r.match_date;
    if (!byDate.has(key)) {
      var lbl = dayLabel(date);
      byDate.set(key, { date: date, weekday: lbl.weekday, label: lbl.label, items: [] });
    }

    var sportName = sport ? sport.name : '';
    byDate.get(key).items.push({
      // ตัดวินาทีออกจาก 'HH:MM:SS' ของ Postgres — และต้องเป็น 2 หลักเสมอ
      // เพราะตารางเรียงเวลาด้วยการเทียบข้อความ "9:00" จะไปอยู่หลัง "19:00"
      time: r.start_time ? String(r.start_time).slice(0, 5).split(':').map(function (n) { return pad2(Number(n)); }).join(':') : '',
      sportId: r.sport_id || '',
      event: [sportName, r.event_type].filter(Boolean).join(' — '),
      teams: [r.team_a, r.team_b].filter(Boolean).join(' พบ '),
      status: r.status || 'upcoming',
      unofficial: Boolean(r.unofficial),
      score: r.score || ''
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

/* ---------- ประกอบเป็นก้อนเดียว schema เดียวกับ data/mock.json ---------- */
export async function loadFromSupabase() {
  var results = await Promise.all([
    select('site_settings', 'select=key,value'),
    select('schools', 'select=*'),
    select('sports', 'select=*&order=sort_order.asc'),
    // เรียงต่อด้วย sport_id/event_type/id ไม่ใช่แค่วันกับเวลา — หลายรายการเริ่มเวลาเดียวกัน
    // ถ้าไม่มีตัวตัดสินต่อท้าย Postgres จะคืนลำดับของคู่ที่เวลาชนกันไม่เหมือนกันทุกครั้ง
    // แล้วตารางบนหน้าเว็บจะสลับแถวไปมาเองทุกครั้งที่ดึงข้อมูลใหม่ทุก 30 วินาที
    select('matches', 'select=*&order=match_date.asc,start_time.asc,sport_id.asc,event_type.asc,id.asc'),
    select('photos', 'select=*&order=taken_on.asc.nullslast,sort_order.asc')
  ]);
  var settingRows = results[0], schoolRows = results[1], sportRows = results[2],
      matchRows = results[3], photoRows = results[4];

  var settings = {};
  settingRows.forEach(function (r) { settings[r.key] = r.value; });

  var sportById = new Map(sportRows.map(function (s) { return [s.id, s]; }));
  var entered = sportRows.filter(function (s) { return s.entered !== false; });

  var medals = buildMedalTable(schoolRows);
  var self = medals.filter(function (m) { return m.isSelf; })[0] || null;
  var leader = medals[0] || null;

  var selfFullName = self ? self.fullName : SELF_SCHOOL_NAME;

  return {
    meta: {
      title: settings.title || 'กีฬาสาธิตสามัคคี ครั้งที่ 49 “คำมอกหลวงเกมส์”',
      subtitle: settings.subtitle || 'การแข่งขันกีฬานักเรียนสาธิตสัมพันธ์แห่งประเทศไทย'
    },
    school: {
      name: self ? self.school : shortSchoolName(selfFullName),
      fullName: selfFullName,
      rank: self ? self.rank : 0,
      totalSchools: medals.length,
      gold: self ? self.gold : 0,
      silver: self ? self.silver : 0,
      bronze: self ? self.bronze : 0,
      // คำท้ายชื่อ ("ปทุมวัน") ใช้จับคู่ชื่อย่อที่เขียนไม่เหมือนกันในช่องทีม
      keyword: selfFullName.trim().split(/\s+/).pop()
    },
    leaderName: leader ? leader.school : '',
    medalTable: medals,
    sports: buildSports(entered),
    days: buildDays(matchRows.filter(function (m) { return m.kind === 'result'; }), sportById),
    schedule: buildDays(matchRows.filter(function (m) { return m.kind === 'plan'; }), sportById),
    photos: photoRows.map(function (p, i) {
      return {
        id: p.id || ('p' + i), src: directImageUrl(p.url), link: p.url, caption: p.caption || '',
        iso: p.taken_on || '', sportId: p.sport_id || '', sportText: ''
      };
    }),
    syncedAt: new Date().toISOString(),
    source: 'supabase'
  };
}
