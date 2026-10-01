/* =========================================================
   matches.js — ผลการแข่งขัน
   อ่านจากแท็บ "ผลการแข่งขันประจำวัน" ในชีต: วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ
   หน้าตาเดียวกับหน้าตารางการแข่งขัน (ตัวตาราง/ตัวกรอง/แบ่งหน้าอยู่ใน fixture-table.js)
   คอลัมน์เรียงตามชีตตรง ๆ ไม่มีไอคอน ไม่แบ่งสี — ผลกับสถานะแสดงเป็นข้อความตามที่กรอกในชีต
   ========================================================= */
import { STATUS, esc } from './common.js';
import { mountFixtureTable, orDash, TD_SUB, TD_TIME } from './fixture-table.js';

/* ป้าย "ผล" หน้าสกอร์บนจอแคบ (บนจอกว้างหัวคอลัมน์บอกอยู่แล้ว) — _ ในคลาสคือช่องว่าง
   เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var SCORE_BEFORE = " @max-[800px]:before:content-['ผล_']";
var ATHLETES_BEFORE = " @max-[800px]:before:content-['นักกีฬา_']";

/** รายชื่อนักกีฬา: ชีตเก็บเป็น "ชื่อ1, ชื่อ2, …" (ช่องแบบเลือกหลายชื่อ) หรือขึ้นบรรทัดใหม่ในช่อง
    แสดงคนละบรรทัด อ่านง่ายกว่ายาวต่อกันเป็นพืด · ช่องว่างซ้อนในชื่อ (ชื่อ␣␣สกุล) ยุบเหลือช่องเดียว */
function athleteList(text) {
  var names = String(text || '').split(/\s*[,\n]\s*/).map(function (n) { return n.trim().replace(/\s+/g, ' '); }).filter(Boolean);
  return names.length ? names.map(esc).join('<br>') : orDash('');
}

/** สถานะใช้คำในชีตก่อน ("เสร็จสิ้น" / "ไม่เป็นทางการ") ชีตเว้นว่างไว้ค่อยใช้คำที่ระบบอนุมานจากผล */
function statusText(r) {
  return r.statusText || (STATUS[r.status] || STATUS.upcoming).label;
}

mountFixtureTable({
  page: 'matches',
  days: function (data) { return data.days || []; },
  fields: function (i) {
    return { teams: i.teams || '', athletes: i.athletes || '', score: i.score || '', status: i.status || '', statusText: i.statusText || '' };
  },
  // ค้นหาด้วยชื่อนักกีฬาได้ด้วย
  searchText: function (r) { return r.teams + ' ' + r.athletes + ' ' + r.score + ' ' + statusText(r); },
  emptyText: 'ยังไม่มีผลการแข่งขันในชีต',
  // จอแคบ: บรรทัด 2 ประเภท · บรรทัด 3 คู่แข่ง · บรรทัด 4 ผล กับสถานะ · บรรทัด 5 นักกีฬา
  columns: [
    { head: 'ประเภท', cls: function () { return '@max-[800px]:col-[1/-1] @max-[800px]:row-start-2'; },
      cell: function (r) { return orDash(r.kind); } },
    { head: 'เวลา', cls: function () { return TD_TIME; },
      cell: function (r) { return orDash(r.time); } },
    { head: 'ระหว่าง', cls: function () { return 'leading-[1.5] @max-[800px]:col-[1/-1] @max-[800px]:row-start-3'; },
      cell: function (r) { return orDash(r.teams); } },
    /* คอลัมน์นักกีฬามาจากคอลัมน์ "นักกีฬา" ในชีต — ชีตยังไม่มีชื่อเลยสักแถวก็ซ่อนทั้งคอลัมน์
       ไม่ปล่อยให้เป็นขีดว่างทั้งตาราง · ขึ้นบรรทัดใหม่ในช่องของชีตก็ขึ้นบรรทัดใหม่บนเว็บด้วย */
    { head: 'นักกีฬา',
      showIf: function (all) { return all.some(function (r) { return r.athletes; }); },
      cls: function (r) { return 'leading-[1.5] text-fg-soft @min-[800px]:whitespace-nowrap @max-[800px]:col-[1/-1] @max-[800px]:row-start-5 @max-[800px]:mt-1 @max-[800px]:min-w-0 @max-[800px]:text-[14.5px]' + ATHLETES_BEFORE + (r.athletes ? '' : ' @max-[800px]:hidden'); },
      cell: function (r) { return athleteList(r.athletes); } },
    { head: 'ผลการแข่งขัน', cls: function () { return 'font-mono whitespace-nowrap tabular-nums @max-[800px]:col-start-1 @max-[800px]:row-start-4 @max-[800px]:mt-1' + SCORE_BEFORE; },
      cell: function (r) { return orDash(r.score); } },
    { head: 'สถานะ', cls: function () { return TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-2 @max-[800px]:row-start-4 @max-[800px]:mt-1'; },
      cell: function (r) { return orDash(statusText(r)); } }
  ]
});
