/* =========================================================
   schedule.js — ตารางการแข่งขัน (ผังกำหนดการ)
   อ่านจากแท็บ "ตารางการแข่งขัน" ในชีต: วันที่ / รายการแข่งขัน / ประเภท / รอบ / สาย / เวลา / ระหว่าง / สถานที่
   คอลัมน์ในหน้านี้เรียงตามชีตตรง ๆ คนกรอกชีตกับคนดูเว็บจะได้อ่านตารางหน้าตาเดียวกัน
   ไม่มีช่องผลหรือสถานะ — ผลอยู่หน้า "ผลการแข่งขัน" (ตัวตาราง/ตัวกรอง/แบ่งหน้าอยู่ใน fixture-table.js)
   โครงหน้าแบบเดียวกับหน้าผลการแข่งขัน: เมนูกีฬาคอลัมน์ซ้าย · ขวาเป็นการ์ดแนะนำกีฬา (เมื่อเลือก) · เลือกวัน · ตาราง
   ========================================================= */
import { mountFixtureTable, renderSportIntro, isSelfFor, orDash, TD_SUB, TD_TIME, TH_TEAMS, teamsHtml, venueHtml } from './fixture-table.js';
import { teamSides, dayLabel, esc } from './common.js';

/* ป้าย "รอบ"/"สาย" หน้าค่าบนจอแคบ (บนจอกว้างหัวคอลัมน์บอกอยู่แล้ว) — _ ในคลาสคือช่องว่าง
   เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var ROUND_BEFORE = " @max-[800px]:before:content-['รอบ_']";
var POOL_BEFORE = " @max-[800px]:before:content-['สาย_']";

/* ช่องประเภท: ช่อง "ระหว่าง" ไม่ตัดบรรทัด พอตารางกว้างเกินกล่อง เบราว์เซอร์จะบีบช่องที่ตัดบรรทัดได้จนแคบสุด
   ประเภทยาว ๆ ("วิ่ง 1,500 เมตร มัธยมศึกษาตอนต้น (หญิง)") แตกเป็นคำละบรรทัด — กันไว้ 160px (ขึ้นอย่างมากสามบรรทัด)
   ตารางอยู่คอลัมน์ขวาข้างเมนูกีฬา แคบกว่าเต็มจอ: กันกว้างกว่านี้ จอคอมทั่วไปต้องเลื่อนตารางด้านข้าง */
var TD_KIND = '@min-[800px]:min-w-[130px]';

/** รอบ/สายยังว่างทั้งชีตอยู่บ่อย บนจอแคบจึงซ่อนช่องที่ว่าง แทนที่จะมีบรรทัด "รอบ -" ทุกบล็อก */
function hideEmptyOnMobile(text) {
  return text ? '' : ' @max-[800px]:hidden';
}

/* คอลัมน์ต่อจาก วันแข่งขัน / รายการแข่งขัน
   จอแคบ: บรรทัด 2 ประเภท · บรรทัด 3 คู่แข่ง · บรรทัด 4 รอบ/สาย (ถ้ามี) · บรรทัด 5 สถานที่ (ถ้ามี)
   รอบ/สายที่ว่างทั้งชีตซ่อนทั้งคอลัมน์ — ตารางอยู่คอลัมน์ขวา (แคบกว่าเต็มจอ) ช่อง "ระหว่าง" จะได้ไม่ล้น */
/* จอกว้างไม่มีคอลัมน์ "รายการแข่งขัน" (ดู sportColCls) — ช่องประเภทในชีตขึ้นต้นด้วยชื่อกีฬาอยู่แล้ว ("เทนนิส : ทีม ...")
   แถวที่ประเภทไม่มีชื่อกีฬา เติมชื่อกีฬานำหน้าเฉพาะจอกว้าง (จอแคบบรรทัดหัวของบล็อกบอกกีฬาอยู่แล้ว) */
function kindHtml(r) {
  if (!r.kind || !r.sport || r.kind.indexOf(r.sport) > -1) return orDash(r.kind);
  return '<span class="hidden @min-[800px]:inline">' + esc(r.sport) + ' : </span>' + esc(r.kind);
}

var COLUMNS = [
  { head: 'ประเภท', cls: function () { return TD_KIND + ' @max-[800px]:col-[1/-1] @max-[800px]:row-start-2'; },
    cell: function (r) { return kindHtml(r); } },
  { head: 'รอบ', showIf: function (all) { return all.some(function (r) { return r.round; }); }, cls: function (r) { return TD_SUB + ROUND_BEFORE + ' @max-[800px]:col-start-1 @max-[800px]:row-start-4' + hideEmptyOnMobile(r.round); },
    cell: function (r) { return orDash(r.round); } },
  { head: 'สาย', showIf: function (all) { return all.some(function (r) { return r.pool; }); }, cls: function (r) { return TD_SUB + POOL_BEFORE + ' @max-[800px]:col-start-2 @max-[800px]:row-start-4' + hideEmptyOnMobile(r.pool); },
    cell: function (r) { return orDash(r.pool); } },
  { head: 'เวลา', cls: function () { return TD_TIME; },
    cell: function (r) { return orDash(r.time); } },
  { head: 'ระหว่าง', headCls: TH_TEAMS, cls: function (r) { return 'leading-[1.5] @max-[800px]:col-[1/-1] @max-[800px]:row-start-3' + hideEmptyOnMobile(r.teams); },
    cell: function (r) { return r.teamsHtml; } },
  /* สถานที่จากคอลัมน์ "สถานที่" ในชีต (ผู้ดูแลขอ ต.ค. 2569) — ไม่มีสักแถวก็ซ่อนทั้งคอลัมน์
     จอกว้างกันไว้ 110px ชื่อสนามยาว ๆ ("ยิมเนเซียม มรภ.เชียงราย") ตัดเป็นสองบรรทัดแทนการถ่างตาราง
     (เคยลองวางเป็นบรรทัดเล็กใต้คู่แข่งเพื่อประหยัดที่ ผู้ดูแลเห็นว่าผู้ชมจะงง จึงกลับมาเป็นคอลัมน์มีหัว) */
  { head: 'สถานที่', showIf: function (all) { return all.some(function (r) { return r.venue; }); },
    cls: function (r) { return 'fs-14.5 text-fg-soft @min-[800px]:min-w-[110px] @max-[800px]:col-[1/-1] @max-[800px]:row-start-5' + hideEmptyOnMobile(r.venue); },
    cell: venueHtml }
];

/** วันเวลาแข่งของแถว (ไม่มีเวลา = ท้ายวัน) — นับ "ยังไม่ถึงเวลาแข่ง" ในการ์ดแนะนำกีฬา */
function rowTime(r) {
  var t = /^(\d{1,2})[:.](\d{2})/.exec(r.time || '');
  return new Date((r.day && r.day.iso || '9999-12-31') + 'T' + (t ? ('0' + t[1]).slice(-2) + ':' + t[2] : '23:59') + ':00');
}

mountFixtureTable({
  page: 'schedule',
  // เมนูกีฬาเป็นคอลัมน์ซ้าย (มาสคอต + ชื่อ) แบบเดียวกับหน้าผลการแข่งขัน
  sportMenu: true,
  sportAllLabel: 'ตารางแข่งขันทั้งหมด',
  // จอกว้างซ่อนคอลัมน์ "รายการแข่งขัน" (ซ้ำกับช่องประเภท) ให้คอลัมน์สถานที่มีที่ และตารางพอดีกล่องไม่ต้องเลื่อนซ้ายขวา
  // จอแคบยังใช้ช่องนี้เป็นบรรทัดหัวของบล็อก "24 ต.ค. · เทนนิส"
  sportColCls: ' @min-[800px]:hidden',
  // ช่องวันแข่งขันเป็นวันที่ล้วน ("24 ต.ค.") ไม่มีชื่อวัน — ผู้ดูแลไม่เอาชื่อวัน และตารางอยู่คอลัมน์ขวาที่แคบกว่าเต็มจอ
  dayText: function (day) { return day.date || dayLabel(day); },
  onRender: function (ctx) {
    var isSelf = isSelfFor(ctx.data);
    renderSportIntro(ctx, function (rows) {
      return [
        { n: rows.length, label: 'รายการทั้งหมด' },
        { n: rows.filter(function (r) { return teamSides(r.teams).some(isSelf); }).length, label: 'โรงเรียนเราลงแข่ง' },
        { n: rows.filter(function (r) { return rowTime(r) >= new Date(); }).length, label: 'ยังไม่ถึงเวลาแข่ง' }
      ];
    }, [
      { href: 'matches.html?sport=' + encodeURIComponent(ctx.sportId || ''), label: 'ผลการแข่งขัน' },
      { href: 'gallery.html?sport=' + encodeURIComponent(ctx.sportId || ''), label: 'ภาพทั้งหมด' }
    ]);
  },
  // ผังจากแท็บของตัวเอง ถ้าชีตยังไม่มีแท็บนี้ ให้ถอยไปใช้ตารางผลการแข่งขันเดิม
  days: function (data) {
    var plan = data.schedule || [];
    return plan.length ? plan : (data.days || []);
  },
  fields: function (i, data) {
    return { round: i.round || '', pool: i.pool || '', teams: i.teams || '', venue: i.venue || '', teamsHtml: teamsHtml(data, i.teams) };
  },
  searchText: function (r) { return r.round + ' ' + r.pool + ' ' + r.teams + ' ' + r.venue; },
  emptyText: 'ยังไม่มีข้อมูลในแท็บ "ตารางการแข่งขัน" ของชีต',
  columns: COLUMNS
});
