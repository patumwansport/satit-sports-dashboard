/* =========================================================
   home.js — หน้าหลัก (ตามภาพแบบที่ผู้ดูแลส่งมา ต.ค. 2569)
   แถบสรุปเหรียญของโรงเรียนเรา (ลอยทับขอบล่างแบนเนอร์)
   → [โปรแกรมการแข่งขันวันนี้ (ตัวกรองกีฬา) + สรุปผลที่ชนะของวันนี้ | เมนูลัด · สรุปผลของวัน · สนามแข่งขันของวัน]
   → แถบโปรแกรมวันแข่งขันถัดไป (ลิงก์โฟลเดอร์ของวันใน Drive) → ข่าวสารและไฮไลต์ (ประกาศจาก CMS)
   ทุกส่วนวาดจากข้อมูลก้อนเดียวที่ loadData() ให้มา ส่วนไหนยังไม่มีข้อมูลบอกตรง ๆ ว่ายังไม่มี ไม่ใส่ตัวเลขสมมุติ
   (ภาพแบบมี "ข่าวสาร" กับ "รูปสนาม" และปุ่ม Facebook แต่ชีตไม่มีข้อมูลเหล่านี้
    ข่าวสารจึงดึงจากประกาศใน CMS · สนามเป็นการ์ดรูปสนาม + ชื่อ + จำนวนรายการ กดแล้วนำทางด้วย Google Maps (venues.js) · เมนูลัดชี้ไปหน้าในเว็บแทน)
   ========================================================= */
import {
  esc, setText, paintUiIcons, loadData, onFreshData, initChrome, sportName, resultStatusOf, resultLabel, RESULT_STATUS,
  isToday, teamSides, schoolByText, schoolCrest, scoreStrip, eventParts, EMPTY_TEXT, showLoadError, selfSideTester,
  matchOutcome, LIVE_DOT, sportMascot
} from './common.js';
import { total } from './charts.js';
import { MONTHS_TH, WEEKDAYS_TH, isoDate, roundPoolLabel } from './format.js';
import { dayFolder, driveFolderUrl } from './day-files.js';
import { venueInfo } from './venues.js';
import { loadNews, newsCard } from './news.js';
import { programStatusKey, programStatus, programDateLabel, programDateAt, programTitleAt, watchProgramDate } from './program-settings.js';
import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from '../admin/config.js';

var chrome = initChrome('home');
var NEWS_SLOTS = 5;    // กล่องเทาจองที่ระหว่างโหลดแถบข่าวสาร (แถวเดียว 5 ใบตามภาพแบบ)
var MONTHS_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** กล่องข้อความ "ยังไม่มีข้อมูล" — พื้นอ่อนให้เห็นว่าเป็นพื้นที่ของส่วนนั้น */
var EMPTY_BOX = 'w-full rounded-[16px] bg-surface-soft ' + EMPTY_TEXT;

/** days = ทุกวันในแท็บ "ตารางการแข่งขัน" (แถบวันแข่งขันถัดไปใช้) · day = วันนี้ตามปฏิทิน
    ตัวกรองกีฬาที่ผู้ดูเลือกค้างไว้ ข้อมูลชุดใหม่ (onFreshData) วาดใหม่ตามตัวเลือกเดิม */
var state = { data: null, days: [], day: null, sportId: 'all', schedAll: false };

function selfRow(data) { return (data.medalTable || []).filter(function (m) { return m.isSelf; })[0] || null; }

/* ===================== วันแข่งขัน =====================
   โปรแกรมการแข่งขัน = แท็บ "ตารางการแข่งขัน" ในชีตเท่านั้น (ผู้ดูแลขอ ต.ค. 2569) แยกตามวันที่ในปฏิทิน (iso)
   วันและรายการมาจากแท็บนี้แท็บเดียว — แถว/วันที่มีแค่ในแท็บ "ผลการแข่งขัน" ไม่ถูกเพิ่มเข้ามา
   แท็บผลใช้แค่เติมสถานะ/สกอร์ให้แถวที่ตรงกันพอดี (วันที่ กีฬา ประเภท เวลา คู่แข่งขัน เดียวกัน) ป้ายสถานะ/สรุปผลจึงยังบอกได้ว่าจบหรือยัง */
/* คู่แข่งขันเทียบแบบไม่สนลำดับทีม: สองแท็บพิมพ์คู่เดียวกันสลับข้างได้ (บาสฯ หญิง 24 ต.ค. ผัง "มศว พบ ม.เกษตร" ผล "ม.เกษตร พบ มศว") */
function teamKey(teams) { return teamSides(teams).sort().join('|'); }
function samePairing(a, b) {
  return a.sportId === b.sportId && a.event === b.event && teamKey(a.teams) === teamKey(b.teams);
}
function sameMatch(a, b) { return samePairing(a, b) && a.time === b.time; }
/* แถวในแท็บตารางที่ตรงกับแถวผล r: ตรงทุกช่องก่อน · ไม่เจอ = ยอมให้เวลาต่างกันได้ ถ้าคู่ (กีฬา ประเภท ทีม) นี้มีแถวเดียวในวันนั้น
   สองแท็บกรอกเวลาไม่ตรงกันบ่อย (เทเบิลเทนนิส ม.ปลาย 24 ต.ค. ตาราง 10:30 ผล 12:00 · ฟุตบอลแท็บผลเว้นช่องเวลา)
   ถ้ายึดเวลาอย่างเดียว ผลไม่ถูกเติม การ์ดผลที่ชนะ/สรุปผลจะขาดนัดนั้นไปเงียบ ๆ */
function matchIndex(items, r) {
  for (var k = 0; k < items.length; k++) if (sameMatch(items[k], r)) return k;
  if (!teamKey(r.teams)) return -1;
  var hits = [];
  items.forEach(function (p, i) { if (samePairing(p, r)) hits.push(i); });
  return hits.length === 1 ? hits[0] : -1;
}
function mergedDays(data) {
  var map = {};
  var list = (data.schedule || []).filter(function (d) { return d.iso; }).map(function (d) {
    return (map[d.iso] = { key: d.iso, iso: d.iso, date: d.date || '', weekday: d.weekday || '', items: (d.items || []).slice() });
  });
  (data.days || []).forEach(function (d) {
    var t = map[d.iso];
    if (!t) return;
    (d.items || []).forEach(function (r) {
      var k = matchIndex(t.items, r);
      if (k < 0) return;
      var p = t.items[k];
      // teams ใช้ของแท็บผล (r) เสมอ: สกอร์ "15 : 69" เรียงตามลำดับทีมของแท็บนั้น การ์ดสรุปผลจับคู่เลขกับฝั่งจากลำดับนี้
      // แถวในแท็บผลที่ยังไม่กรอกสถานะ/ผล ไม่ลบสถานะที่กรอกไว้ในแท็บตาราง ("เสร็จสิ้น" ในแท็บตารางยังขึ้นว่าจบ)
      // เวลา: แท็บผลเว้นช่องเวลาไว้ = ใช้เวลาของแท็บตาราง
      var keep = !r.statusText && !r.score && (p.statusText || p.status === 'done')
        ? { status: p.status, statusText: p.statusText, unofficial: p.unofficial } : {};
      t.items[k] = Object.assign({}, p, r, keep, { time: r.time || p.time, liveUrl: p.liveUrl || r.liveUrl, venue: p.venue || r.venue });
    });
  });
  return list.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
}
/** แผงโปรแกรม/สรุปผล/สนาม/ผลที่ชนะ ขึ้นเฉพาะวันนี้ตามปฏิทิน ไม่มีแถบเลือกวันอื่น (ผู้ดูแลขอ ต.ค. 2569)
    วันนี้ไม่มีในตาราง (ก่อนงาน/วันเว้น/งานจบแล้ว) = วันว่าง แผงจะบอกว่าไม่มีรายการวันนี้ */
function todayDay(days) {
  var now = isoDate(new Date());
  return days.filter(function (d) { return d.iso === now; })[0] || { key: now, iso: now, date: '', weekday: '', items: [] };
}
function selectedDay() { return state.day; }

function isoToDate(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
/** "24 ต.ค." */
function tabLabel(d) { var t = isoToDate(d.iso); return t ? t.getDate() + ' ' + MONTHS_TH[t.getMonth()] : d.date; }
/** Date → "24 ตุลาคม 2569" */
function fullDateOf(t) { return t.getDate() + ' ' + MONTHS_FULL_TH[t.getMonth()] + ' ' + (t.getFullYear() + 543); }
function fullDate(d) { var t = isoToDate(d.iso); return t ? fullDateOf(t) : d.date; }
/** "วันเสาร์ที่ 24 ตุลาคม 2569" */
function longDayLabel(d) {
  var t = isoToDate(d.iso);
  return t ? 'วัน' + WEEKDAYS_TH[t.getDay()] + 'ที่ ' + fullDate(d) : [d.weekday, d.date].filter(Boolean).join(' ');
}
function timeMin(t) {
  var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t || ''));
  return m ? +m[1] * 60 + +m[2] : Infinity;
}
function byTime(a, b) { return timeMin(a.time) - timeMin(b.time); }

/** รายการของวันที่เลือก (กรองตามกีฬาที่เลือก) เรียงตามเวลา */
function rowsOf(day, sportId) {
  if (!day) return [];
  return day.items.filter(function (i) { return sportId === 'all' || i.sportId === sportId; }).slice().sort(byTime);
}

/* ===================== แถบสรุปของโรงเรียนเรา =====================
   การ์ดเดียวแบบป้ายคะแนน: ตรา+ชื่อ · อันดับปัจจุบัน (ชมพู) · ทอง · เงิน · ทองแดง · รวม · วันที่วันนี้ (กรมท่า)
   ช่องเรียงตามลำดับนี้ใน DOM แล้วให้กริดของ #statStrip (index.html) จัดเป็นแถวเดียว / สามแถวตามความกว้างจอ
   ตัวเลขตามชีตตรง ๆ (แถวที่ติ๊ก "โรงเรียนของเรา" ในตารางเหรียญ) */
/** ช่องเหรียญ: คั่นด้วยเส้นซ้าย · จอ ≤1180px ขึ้นแถวที่สองจึงมีเส้นบน และช่องแรกของแถวไม่มีเส้นซ้าย */
function medalTile(img, label, value, labelCls, first) {
  // จอมือถือ: ภาพเหรียญอยู่บน ชื่อ/ตัวเลขอยู่ล่างกึ่งกลาง (วางข้างกันแล้ว "ทองแดง" ล้นไปชนช่องข้าง ๆ)
  return '<div class="flex min-w-0 items-center justify-center gap-3 border-l border-line px-3 py-4 max-[1180px]:border-t max-[1180px]:py-3.5 max-[560px]:flex-col max-[560px]:gap-1 max-[560px]:px-1 max-[560px]:py-3' +
      (first ? ' max-[1180px]:border-l-0' : '') + '">' +
    '<img class="h-14 w-auto flex-none object-contain max-[560px]:h-9" src="' + img + '" alt="" decoding="async" />' +
    '<span class="flex min-w-0 flex-col max-[560px]:items-center"><span class="fs-14 leading-[1.2] font-semibold whitespace-nowrap max-[560px]:fs-12.5 ' + labelCls + '">' + label + '</span>' +
      '<span class="font-display fs-36 leading-[1.05] text-brand-strong tabular-nums max-[560px]:fs-26">' + value + '</span></span>' +
  '</div>';
}
/* ภาพเหรียญ = เหรียญคำมอกหลวงเกมส์ของจริง (ภาพที่ผู้ดูแลส่งมา ต.ค. 2569) ครอปเหลือปลายสาย + ตัวเหรียญ สูง 168px (assets/summary/medal-*.webp) มีข้อความกำกับเสมอ
   รวม = ภาพถ้วยที่ผู้ดูแลเลือก (pngtree, assets/summary/trophy.webp) */
function renderStrip() {
  var data = state.data, s = data.school, me = selfRow(data) || { gold: 0, silver: 0, bronze: 0 };
  var rank = s.rank || '—';
  document.getElementById('statStrip').innerHTML =
    // ตรา + ชื่อ
    '<div class="flex min-w-0 items-center gap-3.5 px-5 py-4 max-[1180px]:col-span-3 max-[560px]:gap-2.5 max-[560px]:px-3 max-[560px]:py-3">' +
      schoolCrest(me.fullName ? me : s, 'size-16 flex-none p-[2px]! max-[560px]:size-12') +
      '<p class="m-0 line-clamp-2 font-display fs-21 leading-[1.25] text-brand-strong max-[560px]:fs-17">' + esc(s.fullName && s.fullName.length < 34 ? s.fullName : s.name) + '</p>' +
    '</div>' +
    // อันดับ — ชมพูเต็มความสูงของแถว
    '<div class="flex flex-col items-center justify-center bg-[linear-gradient(135deg,oklch(62%_0.23_357),oklch(52%_0.22_350))] px-7 py-3 text-white max-[560px]:px-3" aria-label="อันดับปัจจุบัน ' + esc(rank) + ' จาก ' + esc(s.totalSchools || '—') + ' โรงเรียน">' +
      '<span class="fs-13.5 leading-[1.2] whitespace-nowrap text-white/90 max-[560px]:fs-12" aria-hidden="true">อันดับปัจจุบัน</span>' +
      '<span class="font-display fs-44 leading-none tabular-nums max-[560px]:fs-34" aria-hidden="true">' + esc(rank) + '</span>' +
      '<span class="fs-12 leading-[1.3] whitespace-nowrap text-white/80 max-[560px]:fs-11" aria-hidden="true">จาก ' + esc(s.totalSchools || '—') + ' โรงเรียน</span>' +
    '</div>' +
    medalTile('assets/summary/medal-gold.webp', 'ทอง', me.gold || 0, 'text-gold-ink', true) +
    medalTile('assets/summary/medal-silver.webp', 'เงิน', me.silver || 0, 'text-silver-ink') +
    medalTile('assets/summary/medal-bronze.webp', 'ทองแดง', me.bronze || 0, 'text-bronze-ink') +
    medalTile('assets/summary/trophy.webp', 'รวม', total(me), 'text-brand-ink') +
    // วันที่วันนี้ — จอใหญ่ปิดท้ายแถว · จอ ≤1180px เป็นแถบบางเต็มความกว้างใต้เหรียญ
    '<div class="flex min-w-0 items-center gap-3 bg-[linear-gradient(135deg,var(--color-navy),var(--color-navy-2))] px-5 text-white max-[1180px]:col-span-4 max-[1180px]:justify-center max-[1180px]:py-2.5">' +
      '<i class="icon-mask size-[26px] flex-none text-white/85 max-[1180px]:size-[18px]" data-ic="calendar"></i>' +
      '<span class="flex min-w-0 flex-col max-[1180px]:flex-row max-[1180px]:items-baseline max-[1180px]:gap-2"><span class="fs-14 leading-[1.2] text-white/80">วันนี้</span>' +
        '<span class="font-display fs-23 leading-[1.2] whitespace-nowrap text-[oklch(88%_0.13_88)] max-[1400px]:fs-20 max-[1180px]:fs-18">' + esc(fullDateOf(new Date())) + '</span></span>' +
    '</div>';
}

/* ===================== ตัวกรองประเภทกีฬา ===================== */
function renderSportFilter() {
  var sel = document.getElementById('sportFilter');
  sel.innerHTML = '<option value="all">ทุกประเภทกีฬา</option>' + (state.data.sports || []).map(function (s) {
    return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
  }).join('');
  sel.value = state.sportId;
}
document.getElementById('sportFilter').addEventListener('change', function () {
  state.sportId = this.value;
  state.schedAll = false;
  renderSchedule();
});

/* ===================== ตารางโปรแกรมการแข่งขัน =====================
   คอลัมน์: เวลา · ประเภทกีฬา · รายการ · คู่แข่งขัน · สนาม · สถานะ · ›
   แบบมินิมอล (ผู้ดูแลขอ ต.ค. 2569): ไม่มีภาพมาสคอต/แถบสีข้างแถว/ป้ายพื้นทึบ — สถานะเป็นจุดสี + ข้อความ
   (กำลังแข่ง = ชมพู · จบแล้ว = เขียว · รอแข่ง = เทา) แถวที่กำลังแข่งพื้นชมพูอ่อน
   วัดจากความกว้างแผง (@container) ไม่ใช่ความกว้างจอ:
   ≥1000px ครบทุกคอลัมน์ · 640–999px รวมรายการ/สนามไว้ใต้ชื่อกีฬา
   <640px (มือถือ) แถวกระชับ: บรรทัดแรก เวลา · กีฬา/รายการ/สนาม · สถานะชิดขวา · บรรทัดสอง คู่แข่งขัน (ไม่มีคู่แข่ง = ไม่มีบรรทัดนี้)
   และแสดงก่อน MOBILE_PREVIEW รายการ ที่เหลือกด "ดูอีก N รายการ" (วันละเกือบร้อยรายการ หน้ายาวจนหาแผงอื่นไม่เจอ — ผู้ดูแลขอ ต.ค. 2569) */
var MOBILE_PREVIEW = 6;
var ROW = 'relative grid items-center gap-x-3 py-2.5 pr-2 pl-4 grid-cols-[62px_minmax(96px,.75fr)_minmax(0,1.7fr)_minmax(0,2fr)_minmax(0,.9fr)_124px_32px]' +
  ' @max-[999px]:grid-cols-[58px_minmax(0,1.4fr)_minmax(0,2fr)_124px_32px]' +
  ' @max-[639px]:grid-cols-[46px_minmax(0,1fr)_auto] @max-[639px]:items-start @max-[639px]:gap-x-2.5 @max-[639px]:gap-y-2 @max-[639px]:py-3 @max-[639px]:pr-3 @max-[639px]:pl-3';
var C_TIME = ' @max-[639px]:col-start-1 @max-[639px]:row-start-1 @max-[639px]:pt-px @max-[639px]:fs-14.5';
var C_SPORT = ' @max-[639px]:col-start-2 @max-[639px]:row-start-1';
var C_EVENT = ' @max-[999px]:hidden';
var C_TEAMS = ' @max-[639px]:col-[1/-1] @max-[639px]:row-start-2 @max-[639px]:pt-0.5';
var C_VENUE = ' @max-[999px]:hidden';
var C_STATUS = ' @max-[639px]:col-start-3 @max-[639px]:row-start-1 @max-[639px]:flex-col @max-[639px]:items-end @max-[639px]:gap-1 @max-[639px]:pt-0.5';
var C_GO = ' @max-[639px]:hidden';
var HEAD = '<div class="' + ROW + ' rounded-[12px] bg-surface-soft py-2 fs-13.5 text-fg-soft @max-[639px]:hidden" role="row">' +
  '<span role="columnheader">เวลา</span><span role="columnheader">ประเภทกีฬา</span>' +
  '<span class="' + C_EVENT + '" role="columnheader">รายการ</span><span class="text-center" role="columnheader">คู่แข่งขัน</span>' +
  '<span class="' + C_VENUE + '" role="columnheader">สนาม</span><span role="columnheader">สถานะ</span><span role="columnheader"><span class="sr-only">รายละเอียด</span></span></div>';

/** สีตามสถานะ — เขียนชื่อคลาสเต็มทุกตัว (Tailwind อ่านสตริงในไฟล์นี้)
    แถวกำลังแข่งพื้นขาวเหมือนแถวอื่น (ผู้ดูแลขอ ต.ค. 2569 — เดิมพื้นชมพู) บอกด้วยเวลาสีชมพู + ป้าย "กำลังแข่งขัน" */
var TONE = {
  live:     { time: 'text-brand-ink', row: '' },
  done:     { time: 'text-fg', row: '' },
  upcoming: { time: 'text-fg', row: '' }
};
/** จุดสี + ข้อความ · hollow = วงกลมเส้น (รอแข่ง) */
function statusText(cls, label, dot) {
  return '<span class="inline-flex items-center gap-1.5 fs-13.5 whitespace-nowrap ' + cls + '">' + dot + label + '</span>';
}
var DOT = '<span class="size-2 flex-none rounded-full bg-current" aria-hidden="true"></span>';
var DOT_HOLLOW = '<span class="size-2 flex-none rounded-full ring-[1.5px] ring-current ring-inset" aria-hidden="true"></span>';
/** ลิงก์ถ่ายทอดสด (ผ่าน webLink() ใน sheets.js มาแล้ว = http/https เท่านั้น) — ป้ายเส้นเล็ก ๆ ไม่ใช่พื้นทึบ */
function liveLink(url) {
  return '<a class="inline-flex h-6 items-center rounded-full px-2 fs-12 font-semibold text-brand-ink no-underline ring-1 ring-current ring-inset hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" href="' + esc(url) +
    '" target="_blank" rel="noopener noreferrer" title="ดูถ่ายทอดสด" aria-label="ดูถ่ายทอดสด">LIVE</a>';
}
/* โปรแกรมบอกแค่ว่าแข่งแล้วหรือยัง: จบแล้วทุกแบบ (จบการแข่งขัน / เสร็จสิ้น / ยังไม่เป็นทางการ) ขึ้น "เสร็จสิ้น" สีเขียว ตัวหนาเท่า "กำลังแข่งขัน" (ผู้ดูแลขอ ต.ค. 2569)
   ผลเป็นทางการหรือยังเป็นรายละเอียดของหน้าผลการแข่งขัน (resultChip ใน matches.js ยังแยกสามแบบ)
   ยกเว้น "รอยืนยัน…" ขึ้นข้อความตามที่กรอกในชีต สีส้มตัวหนา (ผู้ดูแลขอ ต.ค. 2569)
   ตัดบรรทัดได้ (ไม่ nowrap) — ข้อความยาวกว่าช่องสถานะ 124px จะได้ไม่ดันลูกศรท้ายแถวหาย */
function statusPill(i) {
  var out = i.status === 'live' ? statusText('font-semibold text-brand-ink', 'กำลังแข่งขัน', LIVE_DOT.replace('size-1.5', 'size-2'))
    : resultStatusOf(i) === 'pending' ? '<span class="inline-flex items-center gap-1.5 fs-13.5 leading-[1.25] font-semibold text-pending">' + DOT + '<span>' + esc(resultLabel(i)) + '</span></span>'
    : resultStatusOf(i) ? statusText('font-semibold text-done-ink', RESULT_STATUS.finished.label, DOT)
    : statusText('text-fg-mute', 'รอแข่งขัน', DOT_HOLLOW);
  return out + (i.liveUrl && i.status !== 'done' ? liveLink(i.liveUrl) : '');
}
function toneOf(i) { return i.status === 'live' ? 'live' : i.status === 'done' ? 'done' : 'upcoming'; }

/** "ชื่อ ตรา  VS  ตรา ชื่อ" — ฝั่งแรกชิดขวาเข้าหากลาง · ชื่อโรงเรียนเราสีชมพู · อีกฝั่งสีเข้ม
    ไม่แสดงสกอร์ (ผู้ดูแลขอ ต.ค. 2569): แถวที่จบแล้วบอกด้วยป้ายสถานะ สกอร์อยู่ที่ "สรุปผลการแข่งขันที่ชนะวันนี้"
    และหน้าผลการแข่งขันแล้ว ขึ้นซ้ำในโปรแกรมอีกที่ดูซ้ำซ้อน */
function teamsCell(i, isSelf) {
  var sides = teamSides(i.teams);
  if (sides.length !== 2) {
    return '<span class="block line-clamp-2 text-center fs-14.5 text-fg-soft @max-[639px]:text-left">' + (i.teams ? esc(i.teams) : '-') + '</span>';
  }
  var mine = sides.map(isSelf);
  function side(k) {
    var m = schoolByText(state.data, sides[k]) || { school: sides[k] };
    var crest = schoolCrest(m, 'size-10 flex-none p-[1px]! @max-[639px]:size-8');
    var label = '<span class="line-clamp-2 fs-14.5 leading-[1.3] @max-[639px]:fs-13.5 ' + (mine[k] ? 'font-semibold text-brand-ink' : 'text-fg') + '">' + esc(sides[k]) + '</span>';
    return '<span class="flex min-w-0 items-center gap-2' + (k === 0 ? ' justify-end text-right' : '') + '" title="' + esc(sides[k]) + '">' +
      (k === 0 ? label + crest : crest + label) + '</span>';
  }
  return '<span class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 @max-[639px]:gap-2 @max-[639px]:rounded-[12px] @max-[639px]:bg-surface-soft @max-[639px]:px-2.5 @max-[639px]:py-2">' +
    side(0) + '<span class="font-display fs-15 text-brand-ink">VS</span>' + side(1) + '</span>';
}

function rowHtml(i, isSelf, extra) {
  var tone = TONE[toneOf(i)];
  var kind = eventParts(sportName(state.data, i.sportId), i.event).kind;
  var sub = roundPoolLabel(i.round, i.pool);
  var sport = sportName(state.data, i.sportId) || eventParts('', i.event).sport || '-';
  var href = (i.status === 'live' || i.status === 'done' ? 'matches.html' : 'schedule.html') + (i.sportId ? '?sport=' + encodeURIComponent(i.sportId) : '');
  return '<div class="' + ROW + ' border-t border-line first:border-t-0 ' + tone.row + (extra || '') + '" role="row">' +
    '<span class="font-mono fs-15.5 tabular-nums ' + (i.time ? tone.time : 'text-fg-mute') + C_TIME + '" role="cell">' + esc(i.time || '-') + '</span>' +
    '<span class="min-w-0' + C_SPORT + '" role="cell">' +
      '<span class="block line-clamp-2 fs-15.5 leading-[1.3] font-semibold text-brand-strong">' + esc(sport) + '</span>' +
        // แผงแคบ: รายการ + สนาม ต่อใต้ชื่อกีฬา (คอลัมน์ของมันซ่อนไป)
        '<span class="hidden fs-13.5 leading-[1.35] text-fg-soft @max-[999px]:block">' + esc([kind, sub].filter(Boolean).join(' · ') || '') + '</span>' +
        (i.venue ? '<span class="hidden truncate fs-13 text-fg-mute @max-[999px]:flex @max-[999px]:items-center @max-[999px]:gap-1"><i class="icon-mask size-[13px] flex-none" data-ic="pin"></i><span class="truncate">' + esc(i.venue) + '</span></span>' : '') +
      '</span>' +
    '<span class="min-w-0' + C_EVENT + '" role="cell"><span class="block line-clamp-2 fs-14.5 leading-[1.35] text-fg-soft">' + esc(kind || '-') + '</span>' +
      (sub ? '<span class="block truncate fs-13 text-fg-mute">' + esc(sub) + '</span>' : '') + '</span>' +
    '<span class="min-w-0' + C_TEAMS + (i.teams ? '' : ' @max-[639px]:hidden') + '" role="cell">' + teamsCell(i, isSelf) + '</span>' +
    '<span class="flex min-w-0 items-center gap-1.5 fs-14 text-fg-soft' + C_VENUE + '" role="cell" title="' + esc(i.venue || '') + '">' +
      (i.venue ? '<span class="line-clamp-2">' + esc(i.venue) + '</span>' : '<span class="text-fg-mute">-</span>') + '</span>' +
    '<span class="flex flex-wrap items-center gap-1.5' + C_STATUS + '" role="cell">' + statusPill(i) + '</span>' +
    '<span class="' + C_GO + '" role="cell"><a class="flex size-8 items-center justify-center rounded-full text-fg-mute hover:bg-surface-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand" href="' + href + '" aria-label="ดูรายละเอียด ' + esc(sport + ' ' + (kind || '')) + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a></span>' +
  '</div>';
}

function renderSchedule() {
  var data = state.data, host = document.getElementById('schedRows'), day = selectedDay();
  var today = isToday(day);
  var sport = state.sportId === 'all' ? '' : sportName(data, state.sportId);
  setText('schedTitle', today ? 'โปรแกรมการแข่งขันวันนี้' : 'โปรแกรมการแข่งขัน');
  var rows = rowsOf(day, state.sportId);
  setText('schedSub', day ? longDayLabel(day) + ' · ' + (sport ? sport + ' ' : '') + rows.length + ' รายการ' : '');
  if (!rows.length) {
    var text = !state.days.length ? 'ยังไม่มีตารางการแข่งขัน'
      : (today ? 'วันนี้' : '') + 'ไม่มีรายการแข่งขัน' + (sport || '') + (today ? '' : 'ใน' + longDayLabel(day));
    host.innerHTML = '<div class="' + EMPTY_BOX + ' flex-1">' + esc(text) + '</div>';
    return;
  }
  var isSelf = selfSideTester(data);
  var more = rows.length - MOBILE_PREVIEW;
  // ปุ่มดูเพิ่ม/ย่อ มีเฉพาะแผงแคบ (มือถือ) — จอใหญ่เลื่อนดูในแผงอยู่แล้ว
  var toggle = more > 0
    ? '<button class="mt-3 hidden h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line-strong bg-surface font-body fs-14.5 font-semibold text-brand-strong hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand @max-[639px]:flex" type="button" id="schedMore" aria-expanded="' + state.schedAll + '">' +
        (state.schedAll ? 'ย่อรายการ' : 'ดูอีก ' + more + ' รายการ') +
        '<svg class="' + (state.schedAll ? 'rotate-180' : '') + '" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
    : '';
  host.innerHTML = '<div class="flex min-h-0 flex-1 flex-col" role="table" aria-label="โปรแกรมการแข่งขัน">' + HEAD +
    '<div class="min-[1181px]:-mr-3 min-[1181px]:min-h-0 min-[1181px]:flex-1 min-[1181px]:overflow-y-auto min-[1181px]:overscroll-contain min-[1181px]:pr-3 min-[1181px]:[scrollbar-width:thin]" role="rowgroup" tabindex="0" aria-label="รายการแข่งขัน">' +
      rows.map(function (i, n) { return rowHtml(i, isSelf, n >= MOBILE_PREVIEW && !state.schedAll ? ' @max-[639px]:hidden' : ''); }).join('') + '</div></div>' + toggle;
  paintUiIcons(host);
}
document.getElementById('schedRows').addEventListener('click', function (e) {
  if (!e.target.closest('#schedMore')) return;
  state.schedAll = !state.schedAll;
  renderSchedule();
  var btn = document.getElementById('schedMore');
  if (btn) {
    btn.focus();
    // ย่อแล้วเลื่อนกลับมาที่หัวแผง ไม่ทิ้งผู้ชมไว้กลางหน้าที่ว่างลง
    if (!state.schedAll) document.getElementById('schedTitle').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
});

/* ===================== สรุปผลของวัน (คอลัมน์ขวา) =====================
   นับจากรายการทุกกีฬาของวันที่เลือก: แข่งทั้งหมด · จบแล้ว · กำลังแข่งขัน · รอการแข่งขัน
   ไม่มีกล่อง — ภาพไอคอน + ข้อความ */
/* ภาพไอคอนที่ผู้ดูแลเลือกเอง (ต.ค. 2569) ที่ assets/summary/*.webp (160px) — ไม่มีกล่อง
   total = ALL (Flaticon) · done = FINISH (Vecteezy, ตัดพื้นเป็นวงกลม) · live = LIVE (Freepik/Magnific, ตัดพื้นขาว) · waiting = นาฬิกาทราย (Flaticon) */
function sumTile(key, label, n) {
  return '<div class="flex min-w-0 items-center gap-3 py-1">' +
    '<img class="size-12 flex-none object-contain" src="assets/summary/' + key + '.webp" alt="" width="160" height="160" decoding="async" />' +
    '<span class="flex min-w-0 flex-col"><span class="truncate fs-13.5 leading-[1.3] text-fg-soft">' + label + '</span>' +
      '<span class="fs-14 whitespace-nowrap text-fg-soft"><span class="font-display fs-26 leading-[1.1] text-brand-strong tabular-nums">' + n + '</span> รายการ</span></span>' +
  '</div>';
}
function renderSummary() {
  var day = selectedDay(), items = day ? day.items : [];
  setText('sumTitle', !day || isToday(day) ? 'สรุปผลวันนี้' : 'สรุปผลวันที่ ' + tabLabel(day));
  var done = 0, live = 0;
  items.forEach(function (i) { if (i.status === 'done') done++; else if (i.status === 'live') live++; });
  document.getElementById('daySummary').innerHTML =
    sumTile('total', 'ทั้งหมด', items.length) +
    sumTile('done', 'จบแล้ว', done) +
    sumTile('live', 'กำลังแข่งขัน', live) +
    sumTile('waiting', 'รอการแข่งขัน', items.length - done - live);
}

/* ===================== สนามแข่งขันของวัน =====================
   ชื่อสนามจากรายการของวันที่เลือก + จำนวนรายการ (มีแมตช์กำลังแข่ง = ป้าย "กำลังแข่ง") · แผงแสดงเสมอ ไม่มีชื่อสนาม = ข้อความในแผง
   จอ >1180px แผงยืดเต็มความสูงที่เหลือของคอลัมน์ขวา สนามที่เกินเลื่อนดูในแผง
   การ์ดละสนาม: รูปสนามจริง (public/assets/venue/ ตั้งใน venues.js) · กดทั้งการ์ด = เปิด Google Maps นำทางไปสนาม (แท็บใหม่)
   ยังไม่มีรูป = พื้นสีกับหมุด ไม่ใส่รูปประกอบที่ไม่ใช่สนามจริง */
/** สนามของวัน: { name, n, live, sports: [ชื่อกีฬา] } — กำลังแข่งก่อน แล้วเรียงตามจำนวนรายการ */
function venuesOf(day) {
  var map = {}, list = [];
  (day ? day.items : []).forEach(function (i) {
    var v = String(i.venue || '').trim();
    if (!v) return;
    if (!map[v]) { map[v] = { name: v, n: 0, live: 0, sports: [], bySport: {} }; list.push(map[v]); }
    map[v].n++;
    if (i.status === 'live') map[v].live++;
    var sp = sportName(state.data, i.sportId) || eventParts('', i.event).sport;
    if (sp && map[v].sports.indexOf(sp) < 0) map[v].sports.push(sp);
    if (i.sportId) map[v].bySport[i.sportId] = (map[v].bySport[i.sportId] || 0) + 1;
  });
  list.forEach(function (v) {
    // กีฬาหลักของสนาม (รายการมากสุด) — ใช้มาสคอตของกีฬานี้แทนรูปสนามที่ยังไม่มี
    v.mainSport = Object.keys(v.bySport).sort(function (a, b) { return v.bySport[b] - v.bySport[a]; })[0] || '';
  });
  return list.sort(function (a, b) { return (b.live - a.live) || (b.n - a.n); });
}

/** ภาพของสนาม: รูปสนามจริง (venues.js) ทับบนมาสคอตกีฬาหลัก · รูปยังไม่มี/โหลดไม่ได้ = เห็นมาสคอต · ไม่มีมาสคอต = หมุด
    มาสคอตเป็นภาพประจำกีฬา ไม่ได้อ้างว่าเป็นรูปสนาม — ผู้ดูแลยังรอรูปสนามจากเจ้าภาพ (ต.ค. 2569) */
function venueVisual(v, pinCls) {
  var info = venueInfo(v.name), mascot = sportMascot(v.mainSport);
  return (mascot
      ? '<img class="absolute inset-0 m-auto h-[88%] w-auto object-contain" src="' + esc(mascot) + '" alt="" loading="lazy" decoding="async" />'
      : '<span class="absolute inset-0 flex items-center justify-center text-brand/60"><i class="icon-mask ' + pinCls + '" data-ic="pin"></i></span>') +
    (info.photo ? '<img class="absolute inset-0 size-full object-cover" src="' + esc(info.photo) + '" alt="" loading="lazy" decoding="async" data-venue-img />' : '');
}
/** "ว่ายน้ำ · บาสเกตบอล +2" */
function sportsText(v, max) {
  return v.sports.slice(0, max).join(' · ') + (v.sports.length > max ? ' +' + (v.sports.length - max) : '');
}
/* ไอคอนนำทาง (ลูกศรแบบเข็มทิศ) */
var NAV_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M20.5 3.5L3.8 10.4l7 2.8 2.8 7 6.9-16.7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

function renderVenues() {
  var day = selectedDay(), list = venuesOf(day);
  document.getElementById('venueAll').hidden = !list.length;
  setText('venueTitle', !day || isToday(day) ? 'สนามแข่งขันวันนี้' : 'สนามแข่งขันวันที่ ' + tabLabel(day));
  var host = document.getElementById('venues');
  if (!list.length) {
    host.innerHTML = '<div class="col-span-full w-full rounded-[16px] bg-surface-soft/70 p-[26px] text-center fs-14.5 text-fg-mute">' + (day ? 'ยังไม่มีข้อมูลสนามของวันนี้' : 'ยังไม่มีตารางการแข่งขัน') + '</div>';
    return;
  }
  host.innerHTML = list.map(function (v) {
    var info = venueInfo(v.name);
    /* แถวละสนาม (ผู้ดูแลขอ ต.ค. 2569): ภาพเล็กซ้าย · ชื่อ (ไม่ตัดคำ) + จำนวนรายการ · กีฬา · ไอคอนนำทางขวา
       หน้าตาแบบเดียวกับการ์ด "สรุปผลการแข่งขันที่ชนะ" (พื้นเทาอ่อน · ชื่อสีกรม · ไอคอนสีแบรนด์ไม่มีวงกลม) — เดิมโทนชมพู + ปุ่มกลมทึบ
       เดิมเป็นการ์ดสองคอลัมน์ บนมือถือชื่อสนามกับคำว่า "นำทาง" ล้นขอบจนถูกตัด */
    return '<a class="group flex min-w-0 items-center gap-3 rounded-[16px] bg-surface-soft/70 p-2 pr-3 no-underline ring-1 ring-transparent transition-shadow duration-150 hover:ring-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none" href="' + esc(info.mapUrl) +
        '" target="_blank" rel="noopener noreferrer" aria-label="นำทางไป ' + esc(v.name) + ' ด้วย Google Maps (' + v.n + ' รายการ' + (v.live ? ' กำลังแข่ง' : '') + ')">' +
      '<span class="relative block size-[60px] flex-none overflow-hidden rounded-[10px] bg-surface">' + venueVisual(v, 'size-6') + '</span>' +
      '<span class="flex min-w-0 flex-1 flex-col gap-0.5">' +
        '<span class="fs-14.5 leading-[1.3] font-semibold text-brand-strong">' + esc(v.name) + '</span>' +
        '<span class="flex min-w-0 items-center gap-1.5 fs-13 text-fg-mute">' +
          (v.live ? '<span class="inline-flex flex-none items-center gap-1 font-semibold text-brand-ink">' + LIVE_DOT + 'กำลังแข่ง</span><span aria-hidden="true">·</span>' : '') +
          '<span class="flex-none whitespace-nowrap">' + v.n + ' รายการ</span>' +
          (v.sports.length ? '<span aria-hidden="true">·</span><span class="truncate">' + esc(sportsText(v, 2)) + '</span>' : '') +
        '</span>' +
      '</span>' +
      '<span class="flex flex-none text-brand-ink transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">' + NAV_SVG + '</span>' +
    '</a>';
  }).join('');
  paintUiIcons(host);
}

/* รูปสนามที่ยังไม่มีไฟล์ — เอา <img> ออกให้เห็นพื้นสีกับหมุดแทนไอคอนรูปแตก (error ไม่ bubble จึงจับแบบ capture) */
function dropBrokenVenueImg(e) {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-venue-img')) e.target.remove();
}
document.getElementById('venues').addEventListener('error', dropBrokenVenueImg, true);

/* ===================== ป๊อปอัป "ดูทั้งหมด" ของสนามแข่งขัน =====================
   ผู้ดูแลขอ ต.ค. 2569: กด "ดูทั้งหมด" แล้วเปิดกล่องทับหน้า พื้นหลังเบลอ แทนการพาไปหน้าตารางแข่งขัน
   <dialog> แบบเดียวกับป๊อปอัปถ่ายทอดสด (live-popup.js): Esc ปิดได้ · โฟกัสไม่หลุดออกนอกกล่อง · คลิกพื้นเบลอ = ปิด
   การ์ดใหญ่กว่าในแผง: รูปสนาม · ชื่อ · จำนวนรายการ · กีฬาที่แข่งที่สนามนั้น · ปุ่มนำทาง Google Maps */
var FLOAT = 'rounded-[20px] bg-surface shadow-[0_10px_30px_oklch(20%_0.06_270/.18)] dark:border dark:border-line';
var venueModal = null, venueTrigger = null;

function ensureVenueModal() {
  if (venueModal) return venueModal;
  // m-auto ต้องมี: preflight ของ Tailwind ล้าง margin ของ <dialog> ทิ้ง กล่องจะไปกองมุมซ้ายบน
  venueModal = document.createElement('dialog');
  venueModal.className = 'm-auto w-[min(760px,calc(100vw-24px))] max-w-none overflow-visible border-0 bg-transparent p-0 text-fg backdrop:bg-[oklch(24%_0.03_260/.35)] backdrop:backdrop-blur-md';
  venueModal.id = 'venueModal';
  venueModal.setAttribute('aria-labelledby', 'venueModalTitle');
  venueModal.innerHTML =
    '<div class="motion-ok flex max-h-[calc(100dvh-32px)] flex-col gap-3 motion-safe:animate-pop-in">' +
      '<div class="relative flex-none px-5 py-4 ' + FLOAT + '">' +
        '<div class="min-w-0 pr-11">' +
          '<h2 class="m-0 font-display fs-28 leading-[1.2] font-normal text-brand-strong" id="venueModalTitle">สนามแข่งขันวันนี้</h2>' +
          '<p class="m-0 mt-0.5 fs-13.5 text-fg-mute" data-sub></p>' +
        '</div>' +
        '<button class="absolute top-3 right-3 flex size-[38px] cursor-pointer items-center justify-center rounded-full text-fg-mute hover:bg-surface-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="button" data-close aria-label="ปิดหน้าต่างสนามแข่งขัน">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +
      // p-1: เผื่อที่ให้เงาการ์ด ไม่ถูกขอบกล่องเลื่อนตัดทิ้ง · ช่องว่างระหว่างการ์ดนับเป็นพื้นเบลอ (คลิกแล้วปิด)
      '<div class="-m-1 grid auto-rows-max grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain p-1 max-[600px]:grid-cols-1" data-scroll></div>' +
    '</div>';
  document.body.appendChild(venueModal);
  venueModal.addEventListener('error', dropBrokenVenueImg, true);
  venueModal.addEventListener('click', function (e) {
    var t = e.target;
    if (t === venueModal || t.hasAttribute('data-scroll') || (t.closest && t.closest('[data-close]'))) venueModal.close();
  });
  venueModal.addEventListener('close', function () {
    if (venueTrigger && document.contains(venueTrigger)) venueTrigger.focus();
    venueTrigger = null;
  });
  return venueModal;
}

function venueModalCard(v) {
  var info = venueInfo(v.name);
  return '<article class="flex min-w-0 flex-col overflow-hidden ' + FLOAT + '">' +
    '<span class="relative block aspect-[16/9] flex-none overflow-hidden bg-brand-100 max-[600px]:aspect-[2/1]">' + venueVisual(v, 'size-11') +
      (v.live ? '<span class="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-0.5 fs-13 font-semibold text-brand-ink">' + LIVE_DOT + 'กำลังแข่ง ' + v.live + ' รายการ</span>' : '') +
    '</span>' +
    '<div class="flex flex-1 flex-col gap-2.5 px-4 pt-3 pb-4">' +
      '<div class="flex items-start justify-between gap-3">' +
        '<h3 class="m-0 min-w-0 fs-17 leading-[1.35] font-semibold text-brand-ink">' + esc(v.name) + '</h3>' +
        '<span class="flex-none fs-13.5 whitespace-nowrap text-fg-soft"><span class="font-display fs-22 leading-none text-brand-strong tabular-nums">' + v.n + '</span> รายการ</span>' +
      '</div>' +
      (v.sports.length ? '<ul class="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="กีฬาที่แข่งที่สนามนี้">' + v.sports.map(function (sp) {
        return '<li class="rounded-full bg-surface-soft px-2.5 py-0.5 fs-13 text-fg-soft">' + esc(sp) + '</li>';
      }).join('') + '</ul>' : '') +
      '<a class="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 fs-14.5 font-semibold text-white no-underline hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" href="' + esc(info.mapUrl) +
        '" target="_blank" rel="noopener noreferrer" aria-label="นำทางไป ' + esc(v.name) + ' ด้วย Google Maps"><i class="icon-mask size-[17px]" data-ic="pin"></i>นำทางด้วย Google Maps</a>' +
    '</div>' +
  '</article>';
}

function paintVenueModal() {
  var day = selectedDay(), list = venuesOf(day);
  setText('venueModalTitle', !day || isToday(day) ? 'สนามแข่งขันวันนี้' : 'สนามแข่งขันวันที่ ' + tabLabel(day));
  venueModal.querySelector('[data-sub]').textContent = (day ? longDayLabel(day) + ' · ' : '') + list.length + ' สนาม';
  var body = venueModal.querySelector('[data-scroll]');
  body.innerHTML = list.length ? list.map(venueModalCard).join('')
    : '<div class="col-span-full ' + FLOAT + ' p-6 text-center fs-14.5 text-fg-mute">ยังไม่มีข้อมูลสนามของวันนี้</div>';
  paintUiIcons(body);
}

document.getElementById('venueAll').addEventListener('click', function () {
  ensureVenueModal();
  venueTrigger = this;
  paintVenueModal();
  venueModal.querySelector('[data-scroll]').scrollTop = 0;
  if (!venueModal.open) venueModal.showModal();
});

/* ===================== สรุปผลที่ชนะของวันที่เลือก =====================
   นับเฉพาะแมตช์ที่จบแล้วและโรงเรียนเราแต้มมากกว่า หรือช่องผลเขียนว่า "ชนะ" (matchOutcome = 'win') — ผลข้อความแบบอื่น เช่น ประกาศอันดับ ไม่นับ ไม่เดา
   การ์ด: ชื่อกีฬา/ประเภท (ไม่มีภาพมาสคอต) · ป้าย "ชนะ" · แถบสกอร์ scoreStrip() "PDS (ตรา) 69 - 15 (ตรา) KUS" (ฝั่งเราก่อน · ใช้ร่วมกับหน้าผลการแข่งขัน)
   กดการ์ด = หน้าผลการแข่งขันที่กรองกีฬานั้นไว้ (เปิดมาที่วันนี้เอง) ดูรายชื่อนักกีฬา/รายละเอียดต่อได้ (ผู้ดูแลขอ ต.ค. 2569)
   ท้ายการ์ดมีบรรทัด "ดูผลและรายชื่อนักกีฬา ›" เห็นตลอด — ขอบจางตอนชี้เมาส์อย่างเดียวคนไม่รู้ว่ากดได้ และจอสัมผัสไม่มีการชี้
   ไม่มีปุ่มดาวน์โหลด CSV แล้ว (ผู้ดูแลขอเอาออก ต.ค. 2569)
   แถวเดียวเลื่อนเองแบบแถบข่าว (autoScrollRow) — เดิมเลื่อนได้แต่แถบเลื่อนถูกซ่อน ผู้ดูแลเห็นแค่ 2 ใบนึกว่าขึ้นไม่ครบ (ต.ค. 2569) */
function winsOf(d, isSelf) {
  return d ? d.items.filter(function (i) { return matchOutcome(i, isSelf) === 'win'; }).sort(byTime) : [];
}
function winCard(i, isSelf) {
  var data = state.data, p = eventParts(sportName(data, i.sportId), i.event);
  var href = 'matches.html' + (i.sportId ? '?sport=' + encodeURIComponent(i.sportId) : '');
  return '<a class="flex w-[min(380px,100%)] min-w-0 flex-none snap-start flex-col justify-between gap-3 rounded-[16px] bg-surface-soft p-4 text-fg no-underline ring-1 ring-line transition-shadow duration-150 hover:ring-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none group/win" href="' + href + '">' +
    '<div class="flex items-start gap-2">' +
      '<span class="min-w-0 flex-1"><span class="block truncate fs-15.5 font-semibold text-brand-strong">' + esc(p.sport || sportName(data, i.sportId) || '-') + '</span>' +
        '<span class="block truncate fs-13 text-fg-mute" title="' + esc(p.kind) + '">' + esc(p.kind || i.time || '') + '</span></span>' +
      '<span class="inline-flex flex-none items-center gap-1 fs-13 font-semibold text-brand-ink"><span class="size-2 rounded-full bg-current" aria-hidden="true"></span>ชนะ</span></div>' +
    scoreStrip(data, i.teams, i.score, isSelf) +
    '<span class="flex items-center justify-between gap-2 border-t border-line pt-2.5 fs-13.5 font-semibold text-brand-ink group-hover/win:underline">ดูผลและรายชื่อนักกีฬา' +
      '<svg class="flex-none transition-transform duration-150 group-hover/win:translate-x-0.5 motion-reduce:transition-none" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
  '</a>';
}
/** ยังไม่มีรายการที่ชนะ: ภาพเหรียญ (Flat UI) + ข้อความ กลางพื้นที่ ไม่มีกล่องเทา */
function winsEmpty(title, sub) {
  return '<div class="flex w-full flex-col items-center justify-center gap-2 py-4 text-center">' +
    '<img class="size-14 object-contain" src="assets/summary/medal.svg" alt="" width="56" height="56" decoding="async" />' +
    '<p class="m-0 fs-15.5 font-semibold text-brand-strong">' + title + '</p>' +
    '<p class="m-0 fs-13.5 text-fg-mute">' + sub + '</p></div>';
}
function renderWins() {
  var data = state.data, day = selectedDay(), isSelf = selfSideTester(data);
  var wins = winsOf(day, isSelf);
  setText('winsTitle', 'สรุปผลการแข่งขันที่ชนะ' + (isToday(day) ? 'วันนี้' : ''));
  setText('winsDate', day ? longDayLabel(day) : 'ยังไม่มีตารางการแข่งขัน');
  setText('winsCount', String(wins.length));
  var now = isoDate(new Date());
  document.getElementById('winsList').innerHTML = wins.length ? wins.map(function (i) { return winCard(i, isSelf); }).join('')
    : day && day.iso && day.iso > now ? winsEmpty('ยังไม่ถึงวันแข่งขัน', 'ผลที่โรงเรียนเราชนะจะขึ้นที่นี่เมื่อจบการแข่งขัน')
    : winsEmpty('ยังไม่มีรายการที่ชนะ', 'ผลที่โรงเรียนเราชนะจะขึ้นที่นี่เมื่อจบการแข่งขัน');
  if (wins.length) autoScrollRow(document.getElementById('winsList'));
}
/* ===================== โปรแกรมรายวัน: เปลี่ยนวันตอน 12:01 น. เวลาไทย =====================
   ไม่เลือกวันจากชีต/โฟลเดอร์ที่อยู่ใกล้ที่สุด วันที่ ป้ายสถานะ และลิงก์ต้องเป็นวันเดียวกันเสมอ */
var nextIso = null;
var nextFolderReady = false;
var nextFolderLoading = false;
var nextFolderRequest = 0;
function renderNext() { var now = new Date(); showNext(programDateAt(now), false, now); }
/** อ่านเฉพาะสถานะของวันในแบนเนอร์ หากอ่านไม่ได้ไม่แสดงว่าเป็น Final */
async function loadNextProgramStatus(iso) {
  var badge = document.getElementById('nextStatus');
  var value = 'pending';
  try {
    if (hasSupabase()) {
      var response = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/site_settings?select=value&key=eq.' + encodeURIComponent(programStatusKey(iso)), {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, cache: 'no-store'
      });
      if (!response.ok) throw new Error('อ่านสถานะโปรแกรมไม่สำเร็จ');
      var rows = await response.json();
      value = programStatus(rows[0] && rows[0].value);
    }
  } catch (err) { console.error('สถานะโปรแกรมการแข่งขัน:', err.message); }
  var band = document.getElementById('nextBand');
  if (band.hidden || band.dataset.programDate !== iso) return;
  badge.dataset.status = value;
  badge.textContent = value === 'final' ? 'Final' : 'ยังไม่เป็นทางการ';
  badge.hidden = false;
}
/** วาดแถบให้ชี้วัน iso · เปลี่ยนวันที่พร้อมรีเซ็ตลิงก์และสถานะ ไม่ให้ข้อมูลวันเก่าติดมา */
function showNext(iso, retry, now = new Date()) {
  // หัวข้อเปลี่ยนกลับเป็นวันนี้ตอนข้ามเที่ยงคืน แม้วันที่เป้าหมายยังเป็นวันเดิม
  setText('nextTitle', programTitleAt(now));
  var band = document.getElementById('nextBand');
  var link = document.getElementById('nextDl');
  var caption = document.getElementById('nextLinkCaption');
  var changed = nextIso !== iso;
  if (!changed && (!retry || nextFolderReady || nextFolderLoading)) return;
  if (changed) {
    nextIso = iso;
    nextFolderReady = nextFolderLoading = false;
    band.hidden = false;
    band.dataset.programDate = iso;
    setText('nextDate', programDateLabel(iso));
    document.getElementById('nextDate').dateTime = iso;
    var badge = document.getElementById('nextStatus');
    badge.dataset.status = 'pending';
    badge.textContent = 'ยังไม่เป็นทางการ';
    badge.hidden = false;
    loadNextProgramStatus(iso);
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('aria-label', 'ดูโปรแกรมการแข่งขัน ' + programDateLabel(iso));
    caption.textContent = 'กำลังโหลดโปรแกรม…';
  }
  var request = ++nextFolderRequest;
  nextFolderLoading = true;
  // ไม่ใช้รายชื่อเก่าที่โหลดก่อนเที่ยง เพราะผู้ดูแลอาจเพิ่งสร้างโฟลเดอร์ของวันใหม่
  dayFolder(iso, true).then(function (folder) {
    if (request !== nextFolderRequest || nextIso !== iso) return;
    if (folder) {
      nextFolderReady = true;
      link.href = driveFolderUrl(folder.id);
      link.removeAttribute('aria-disabled');
      caption.textContent = 'คลิกเพื่อดูรายละเอียด';
    } else caption.textContent = 'กำลังเตรียมโปรแกรม';
  }).catch(function (err) {
    if (request !== nextFolderRequest || nextIso !== iso) return;
    caption.textContent = 'โหลดไม่สำเร็จ กำลังลองใหม่';
    console.error('โฟลเดอร์โปรแกรมรายวัน:', err.message);
  }).finally(function () {
    if (request === nextFolderRequest) nextFolderLoading = false;
  });
}

/* ===================== ข่าวสารและไฮไลต์ =====================
   ประกาศที่ผู้ดูแลลงไว้ใน CMS (ตาราง banners ผ่าน news.js — ชุดเดียวกับแบนเนอร์ประกาศ) ผู้ดูแลขอ ต.ค. 2569
   การ์ดแนวตั้งรูปเต็มใบ วันที่/หัวข้อ/อ่านเพิ่มเติม ทับบนรูป · ไม่มีรูป = พื้นกรมท่า · มีลิงก์ = กดการ์ดแล้วไปตามลิงก์ (newsCard ใน news.js)
   หน้าหลักจึงไม่ขึ้นแบนเนอร์ซ้ำบนสุดอีก (admin/site.js ข้ามเมื่อเจอ #newsGrid)
   แถบแสดงเสมอ: ระหว่างโหลด = กล่องเทาจองที่ · ไม่มีประกาศ / ยังไม่ตั้ง CMS = ข้อความในแถบ · วาดครั้งเดียวตอนเปิดหน้า */
var newsDrawn = false;

function skeletonCards(n) {
  var one = '<span class="skeleton block aspect-[3/4] w-[calc((100%-4rem)/5)] flex-none rounded-[16px] max-[1180px]:w-[260px] max-[560px]:w-[220px]" aria-hidden="true"></span>';
  var out = '';
  for (var i = 0; i < n; i++) out += one;
  return out;
}
function gridEmpty(id, text) {
  document.getElementById(id).innerHTML = '<div class="' + EMPTY_BOX + ' col-span-full flex min-h-[240px] w-full items-center justify-center">' + text + '</div>';
}
/** แถวการ์ดเลื่อนเองทีละใบทุก NEWS_AUTO_MS เมื่อการ์ดล้นแถว · ถึงใบสุดท้ายแล้ววนกลับใบแรก (แถบข่าว + ผลที่ชนะ)
    หยุดชั่วคราวเมื่อเมาส์ชี้/โฟกัสอยู่ในแถว หรือผู้ชมแตะ/ปัดเอง (กลับมาเลื่อนต่อหลังปล่อยมือสักพัก)
    ไม่เลื่อนเมื่อแท็บถูกซ่อน · ผู้ชมตั้ง "ลดการเคลื่อนไหว" ในเครื่อง = ไม่เลื่อนเอง (ยังปัดดูเองได้)
    เรียกซ้ำกับแถวเดิมได้ (ผลที่ชนะวาดใหม่ทุกรอบข้อมูล) — ผูกตัวจับเวลาครั้งเดียว อ่านการ์ดใหม่ทุกรอบเลื่อน */
var NEWS_AUTO_MS = 4000;
function autoScrollRow(grid) {
  if (grid.dataset.auto || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  grid.dataset.auto = '1';
  var hover = false, focus = false, touchUntil = 0;
  grid.addEventListener('mouseenter', function () { hover = true; });
  grid.addEventListener('mouseleave', function () { hover = false; });
  grid.addEventListener('focusin', function () { focus = true; });
  grid.addEventListener('focusout', function () { focus = false; });
  grid.addEventListener('touchstart', function () { touchUntil = Date.now() + 8000; }, { passive: true });
  setInterval(function () {
    if (hover || focus || Date.now() < touchUntil || document.hidden) return;
    var max = grid.scrollWidth - grid.clientWidth;
    if (max <= 2 || grid.children.length < 2) return;
    if (grid.scrollLeft >= max - 2) { grid.scrollTo({ left: 0, behavior: 'smooth' }); return; }
    var step = grid.children[1].offsetLeft - grid.children[0].offsetLeft;   // กว้างการ์ด + ช่องว่าง
    grid.scrollBy({ left: step, behavior: 'smooth' });
  }, NEWS_AUTO_MS);
}
function renderNews() {
  if (newsDrawn) return;
  newsDrawn = true;
  var grid = document.getElementById('newsGrid');
  grid.innerHTML = skeletonCards(NEWS_SLOTS);
  loadNews().then(function (list) {
    if (!list.length) return gridEmpty('newsGrid', 'ยังไม่มีประกาศ');
    grid.innerHTML = list.map(newsCard).join('');
    paintUiIcons(grid);
    autoScrollRow(grid);
  }).catch(function (err) {
    console.error('แถบข่าวสารและไฮไลต์:', err.message);
    gridEmpty('newsGrid', 'โหลดประกาศไม่สำเร็จ');
  });
}

/** ส่วนที่ขึ้นกับวันนี้ */
function renderDayParts() {
  renderSchedule();
  renderSummary();
  renderVenues();
  renderWins();
  if (venueModal && venueModal.open) paintVenueModal();   // ข้อมูลรอบใหม่มาระหว่างเปิดป๊อปอัปอยู่
}

function renderAll(data) {
  state.data = data;
  state.days = mergedDays(data);
  state.day = todayDay(state.days);
  if (state.sportId !== 'all' && !(data.sports || []).some(function (s) { return s.id === state.sportId; })) state.sportId = 'all';
  renderStrip();
  renderSportFilter();
  renderDayParts();
  renderNext();
  renderNews();
  paintUiIcons(document.getElementById('main'));
  chrome.onData(data);
}

watchProgramDate(function (iso, now) { showNext(iso, true, now); });

loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
