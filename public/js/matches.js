/* =========================================================
   matches.js — ผลการแข่งขัน
   อ่านจากแท็บ "ผลการแข่งขันประจำวัน" ในชีต: วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ
   หน้าตาเดียวกับหน้าตารางการแข่งขัน (ตัวตาราง/ตัวกรอง/แบ่งหน้าอยู่ใน fixture-table.js)
   คอลัมน์เรียงตามชีตตรง ๆ ไม่มีไอคอน ไม่แบ่งสี — ผลกับสถานะแสดงเป็นข้อความตามที่กรอกในชีต
   ========================================================= */
import { STATUS } from './common.js';
import { mountFixtureTable, orDash, TD_SUB, TD_TIME } from './fixture-table.js';

/* ป้าย "ผล" หน้าสกอร์บนจอแคบ (บนจอกว้างหัวคอลัมน์บอกอยู่แล้ว) — _ ในคลาสคือช่องว่าง
   เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var SCORE_BEFORE = " @max-[800px]:before:content-['ผล_']";

/** สถานะใช้คำในชีตก่อน ("เสร็จสิ้น" / "ไม่เป็นทางการ") ชีตเว้นว่างไว้ค่อยใช้คำที่ระบบอนุมานจากผล */
function statusText(r) {
  return r.statusText || (STATUS[r.status] || STATUS.upcoming).label;
}

mountFixtureTable({
  page: 'matches',
  days: function (data) { return data.days || []; },
  fields: function (i) {
    return { teams: i.teams || '', score: i.score || '', status: i.status || '', statusText: i.statusText || '' };
  },
  searchText: function (r) { return r.teams + ' ' + r.score + ' ' + statusText(r); },
  emptyText: 'ยังไม่มีผลการแข่งขันในชีต',
  // จอแคบ: บรรทัด 2 ประเภท · บรรทัด 3 คู่แข่ง · บรรทัด 4 ผล กับสถานะ
  columns: [
    { head: 'ประเภท', cls: function () { return '@max-[800px]:col-[1/-1] @max-[800px]:row-start-2'; },
      cell: function (r) { return orDash(r.kind); } },
    { head: 'เวลา', cls: function () { return TD_TIME; },
      cell: function (r) { return orDash(r.time); } },
    { head: 'ระหว่าง', cls: function () { return 'leading-[1.5] @max-[800px]:col-[1/-1] @max-[800px]:row-start-3'; },
      cell: function (r) { return orDash(r.teams); } },
    { head: 'ผลการแข่งขัน', cls: function () { return 'font-mono whitespace-nowrap tabular-nums @max-[800px]:col-start-1 @max-[800px]:row-start-4 @max-[800px]:mt-1' + SCORE_BEFORE; },
      cell: function (r) { return orDash(r.score); } },
    { head: 'สถานะ', cls: function () { return TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-2 @max-[800px]:row-start-4 @max-[800px]:mt-1'; },
      cell: function (r) { return orDash(statusText(r)); } }
  ]
});
