/* =========================================================
   admin/sheets-sync.js — แปลงข้อมูลที่อ่านจาก Google Sheets เป็นแถวของตาราง Supabase

   ใช้สองที่: ปุ่ม "ดึงจาก Google Sheets" ในหน้า admin/ (ผู้ดูแลล็อกอินแล้ว RLS ยอมให้เขียน)
   และ scripts/import-sheets.mjs (รันจากเครื่องด้วย service_role key)
   เก็บกฎการแปลงไว้ที่เดียว ทั้งสองทางจึงได้ข้อมูลหน้าตาเดียวกันเสมอ

   อ่านชีตด้วย loadFromSheets() ตัวเดียวกับหน้าเว็บ ผลจึงตรงกับที่เว็บแสดงอยู่เป๊ะ
   ========================================================= */

var MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/**
 * วันของรายการ → "YYYY-MM-DD"
 * ใช้ day.iso ที่ sheets.js คำนวณปีมาให้แล้วเป็นหลัก ถ้าไม่มีค่อยเดาปีจากป้าย "20 ต.ค."
 * (รายการจัดปีละครั้ง: ถ้าวันนั้นผ่านมาเกินครึ่งปีแล้ว ถือว่าเป็นของปีหน้า)
 */
export function dayIso(day, now) {
  if (day.iso) return day.iso;
  now = now || new Date();
  var m = /^(\d{1,2})\s+(.+)$/.exec(String(day.date || '').trim());
  if (!m) return null;
  var d = Number(m[1]);
  var month = MONTHS_TH.indexOf(m[2].trim());
  if (month < 0) return null;

  var year = now.getFullYear();
  if (now - new Date(year, month, d) > 182 * 24 * 60 * 60 * 1000) year += 1;
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/** "ฟุตบอล — ชาย รอบชิง" → "ชาย รอบชิง" (ชื่อกีฬาเก็บแยกในคอลัมน์ sport_id แล้ว) */
function eventTypeOf(event) {
  var cut = String(event || '').indexOf(' — ');
  return cut > -1 ? event.slice(cut + 3).trim() : '';
}

/** "A พบ B" → { team_a, team_b } */
function teamsOf(teams) {
  var sides = String(teams || '').split(/\s+พบ\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return { team_a: sides[0] || '', team_b: sides[1] || '' };
}

function flattenDays(days, kind, skipped) {
  var out = [];
  days.forEach(function (day) {
    var date = dayIso(day);
    if (!date) { skipped.push(day.date); return; }
    day.items.forEach(function (i) {
      out.push(Object.assign({
        kind: kind,
        match_date: date,
        sport_id: i.sportId || null,
        event_type: eventTypeOf(i.event),
        start_time: i.time || null,
        score: kind === 'result' ? (i.score || '') : '',
        status: kind === 'result' ? (i.status || 'upcoming') : 'upcoming',
        unofficial: kind === 'result' ? Boolean(i.unofficial) : false,
        note: ''
      }, teamsOf(i.teams)));
    });
  });
  return out;
}

/**
 * ผลของ loadFromSheets() → แถวที่พร้อมเขียนลงแต่ละตาราง
 * @returns {{settings:object[], schools:object[], sports:object[], matches:object[], photos:object[], skippedDays:string[]}}
 */
/**
 * ฐานข้อมูลที่ยังไม่ได้รัน migration 20261008000001_photo_days.sql จะไม่มีคอลัมน์ taken_on / sport_id
 * — ตัดสองช่องนี้ออกแล้วเขียนใหม่ได้ ซิงก์จะได้ไม่ล้มทั้งรอบเพราะภาพ (ภาพเข้าครบ แค่ยังไม่รู้วัน)
 */
export function isMissingPhotoColumns(message) {
  return /taken_on|sport_id/.test(String(message || '')) && /column|schema cache/i.test(String(message || ''));
}
export function withoutPhotoDays(photos) {
  return photos.map(function (p) { return { url: p.url, caption: p.caption, sort_order: p.sort_order }; });
}

export function sheetRows(data) {
  var skipped = [];
  var sportIds = {};
  data.sports.forEach(function (s) { if (s.id) sportIds[s.id] = 1; });
  return {
    settings: [
      { key: 'title', value: data.meta.title },
      { key: 'subtitle', value: data.meta.subtitle }
    ],
    schools: data.medalTable.map(function (m) {
      return {
        full_name: m.fullName,
        short_name: m.school || '',
        abbr: m.abbr || '',
        logo: m.logo || '',
        is_self: Boolean(m.isSelf),
        gold: m.gold, silver: m.silver, bronze: m.bronze
      };
    }),
    // กีฬาที่ชื่อในชีตจับคู่รหัสไม่ได้ (id ว่าง) ข้ามไป — id คือกุญแจหลัก เขียนค่าว่างลงไม่ได้
    sports: data.sports.filter(function (s) { return s.id; }).map(function (s, i) {
      return {
        id: s.id, name: s.name, entered: true,
        gold: s.gold, silver: s.silver, bronze: s.bronze,
        sort_order: i + 1
      };
    }),
    matches: flattenDays(data.days, 'result', skipped).concat(flattenDays(data.schedule, 'plan', skipped)),
    // ชีตเก็บลิงก์รูปดิบ แต่ loadFromSheets() แปลงเป็นลิงก์ thumbnail ให้แล้ว เก็บตามนั้นได้เลย
    // sport_id ต้องเป็นกีฬาที่มีในตาราง sports (foreign key) — ชื่อกีฬาที่จับคู่รหัสไม่ได้ให้เป็น null
    photos: data.photos.map(function (p, i) {
      return {
        url: p.link || p.src, caption: p.caption || '', sort_order: i + 1,
        taken_on: p.iso || null, sport_id: (p.sportId && sportIds[p.sportId]) ? p.sportId : null
      };
    }),
    skippedDays: skipped
  };
}
