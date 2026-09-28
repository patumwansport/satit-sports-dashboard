/* =========================================================
   schedule.js — ตารางการแข่งขัน (ผังกำหนดการ)
   อ่านจากแท็บ "ตารางการแข่งขัน" ในชีต: วันที่ / รายการแข่งขัน / ประเภท / รอบ / สาย / เวลา / ระหว่าง
   คอลัมน์ในหน้านี้เรียงตามชีตตรง ๆ คนกรอกชีตกับคนดูเว็บจะได้อ่านตารางหน้าตาเดียวกัน
   ไม่มีช่องผลหรือสถานะ — ผลอยู่หน้า "ผลการแข่งขัน" (ตัวตาราง/ตัวกรอง/แบ่งหน้าอยู่ใน fixture-table.js)
   ========================================================= */
import { mountFixtureTable, orDash, TD_SUB, TD_TIME } from './fixture-table.js';

/* ป้าย "รอบ"/"สาย" หน้าค่าบนจอแคบ (บนจอกว้างหัวคอลัมน์บอกอยู่แล้ว) — _ ในคลาสคือช่องว่าง
   เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var ROUND_BEFORE = " @max-[800px]:before:content-['รอบ_']";
var POOL_BEFORE = " @max-[800px]:before:content-['สาย_']";

/** รอบ/สายยังว่างทั้งชีตอยู่บ่อย บนจอแคบจึงซ่อนช่องที่ว่าง แทนที่จะมีบรรทัด "รอบ -" ทุกบล็อก */
function hideEmptyOnMobile(text) {
  return text ? '' : ' @max-[800px]:hidden';
}

mountFixtureTable({
  page: 'schedule',
  // ผังจากแท็บของตัวเอง ถ้าชีตยังไม่มีแท็บนี้ ให้ถอยไปใช้ตารางผลการแข่งขันเดิม
  days: function (data) {
    var plan = data.schedule || [];
    return plan.length ? plan : (data.days || []);
  },
  fields: function (i) {
    return { round: i.round || '', pool: i.pool || '', teams: i.teams || '' };
  },
  searchText: function (r) { return r.round + ' ' + r.pool + ' ' + r.teams; },
  emptyText: 'ยังไม่มีข้อมูลในแท็บ "ตารางการแข่งขัน" ของชีต',
  // จอแคบ: บรรทัด 2 ประเภท · บรรทัด 3 คู่แข่ง · บรรทัด 4 รอบ/สาย (ถ้ามี)
  columns: [
    { head: 'ประเภท', cls: function () { return '@max-[800px]:col-[1/-1] @max-[800px]:row-start-2'; },
      cell: function (r) { return orDash(r.kind); } },
    { head: 'รอบ', cls: function (r) { return TD_SUB + ROUND_BEFORE + ' @max-[800px]:col-start-1 @max-[800px]:row-start-4' + hideEmptyOnMobile(r.round); },
      cell: function (r) { return orDash(r.round); } },
    { head: 'สาย', cls: function (r) { return TD_SUB + POOL_BEFORE + ' @max-[800px]:col-start-2 @max-[800px]:row-start-4' + hideEmptyOnMobile(r.pool); },
      cell: function (r) { return orDash(r.pool); } },
    { head: 'เวลา', cls: function () { return TD_TIME; },
      cell: function (r) { return orDash(r.time); } },
    { head: 'ระหว่าง', cls: function (r) { return 'leading-[1.5] @max-[800px]:col-[1/-1] @max-[800px]:row-start-3' + hideEmptyOnMobile(r.teams); },
      cell: function (r) { return orDash(r.teams); } }
  ]
});
