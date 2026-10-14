/* =========================================================
   home.js — หน้าหลัก (แดชบอร์ดสามคอลัมน์ ตามภาพแบบ ต.ค. 2569)
   [เมนูกีฬา | ผลการแข่งขันแยกตามกีฬา + แท็บวัน | เหรียญรางวัลแยกประเภทกีฬา + อันดับย่อ]
   → สรุปผลที่ชนะแยกตามวัน (ดาวน์โหลด CSV) → ภาพบรรยากาศ
   ทุกส่วนวาดจากข้อมูลก้อนเดียวที่ loadData() ให้มา ส่วนไหนยังไม่มีข้อมูลบอกตรง ๆ ว่ายังไม่มี ไม่ใส่ตัวเลขสมมุติ
   (ภาพแบบมีกล่อง "นักกีฬายอดเยี่ยม (MVP)" แต่ชีตไม่มีข้อมูลนี้ จึงใช้ตารางอันดับย่อแทน)
   ========================================================= */
import {
  esc, setText, paintUiIcons, loadData, onFreshData, initChrome, sportName, sportIcon, sportMascotImg, statusChip, resultStatusOf, RESULT_STATUS,
  isToday, teamSides, splitScore, schoolByText, schoolCrest, schoolId, schoolKey, schoolNickname,
  eventParts, eventDateRange, EMPTY_TEXT, showLoadError, selfSideTester, matchOutcome, scrollToContent
} from './common.js';
import { MEDALS, total } from './charts.js';
import { MONTHS_TH, WEEKDAYS_TH, isoDate, imageUrlAt, imageFallbackAt, photoDayNow, pickRandom } from './format.js';
import { photoUnits, photosOfDay, photoDates } from './day-photos.js';

var chrome = initChrome('home');
var GROUP_TOP = 6;     // แถวต่อกีฬาในแผงผลการแข่งขัน ตอนดูทุกกีฬา (เลือกกีฬาเดียว = แสดงครบ) ที่เหลือดูต่อในหน้าผล/ตาราง
var STAND_TOP = 5;     // แถวในตารางอันดับย่อ (โรงเรียนเราอยู่นอก 5 อันดับ = ตรึงต่อท้าย)
var PHOTO_TOP = 16;    // ภาพในแถบภาพบรรยากาศ (สองแถว แถวละ 8 ภาพ)
var MONTHS_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** กล่องข้อความ "ยังไม่มีข้อมูล" — พื้นอ่อนให้เห็นว่าเป็นพื้นที่ของส่วนนั้น */
var EMPTY_BOX = 'w-full rounded-[16px] bg-surface-soft ' + EMPTY_TEXT;

/** ตัวเลือกที่ผู้ดูกดค้างไว้ — ข้อมูลชุดใหม่ (onFreshData) วาดใหม่ตามตัวเลือกเดิม ไม่เด้งกลับวันตั้งต้น */
var state = { data: null, days: [], dayKey: null, sportId: 'all' };

function selfRow(data) { return (data.medalTable || []).filter(function (m) { return m.isSelf; })[0] || null; }

/* ===================== วันแข่งขัน =====================
   ยึดแท็บ "ตารางการแข่งขัน" (ผังทั้งรายการ มีลิงก์ Live) เป็นหลัก แล้วเติมผล/สถานะจากแท็บ "ผลการแข่งขัน" ของแถวที่ตรงกัน
   ผลที่ไม่มีในผัง (หรือวันที่ผังไม่มี) ต่อท้ายวันนั้น · จับคู่วันด้วยวันที่เต็ม (iso) ไม่มี iso ใช้ป้าย "24 ต.ค." */
function sameMatch(a, b) {
  return a.sportId === b.sportId && a.event === b.event && a.time === b.time && a.teams === b.teams;
}
function dayKeyOf(d) { return d.iso || d.date || String(d.id); }
function mergedDays(data) {
  var map = {}, list = [];
  function slot(d) {
    var k = dayKeyOf(d);
    if (!map[k]) { map[k] = { key: k, iso: d.iso || '', date: d.date || '', weekday: d.weekday || '', items: [] }; list.push(map[k]); }
    return map[k];
  }
  (data.schedule || []).forEach(function (d) { var t = slot(d); t.items = t.items.concat(d.items || []); });
  (data.days || []).forEach(function (d) {
    var t = slot(d);
    (d.items || []).forEach(function (r) {
      for (var k = 0; k < t.items.length; k++) {
        var p = t.items[k];
        if (sameMatch(p, r)) {
          t.items[k] = Object.assign({}, p, r, { liveUrl: p.liveUrl || r.liveUrl, venue: r.venue || p.venue });
          return;
        }
      }
      t.items.push(r);
    });
  });
  if (list.every(function (d) { return d.iso; })) list.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
  return list;
}
/** วันที่เปิดมาเจอ: วันนี้ > วันที่มีแมตช์สด > วันแข่งถัดไป > วันสุดท้าย */
function defaultDayKey(days) {
  var pick = days.filter(isToday)[0] ||
    days.filter(function (d) { return d.items.some(function (i) { return i.status === 'live'; }); })[0];
  if (!pick) {
    var now = isoDate(new Date());
    pick = days.filter(function (d) { return d.iso && d.iso > now; })[0] || days[days.length - 1];
  }
  return pick ? pick.key : 'all';
}

function isoToDate(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
/** "24 ต.ค." บนแท็บวัน */
function tabLabel(d) { var t = isoToDate(d.iso); return t ? t.getDate() + ' ' + MONTHS_TH[t.getMonth()] : d.date; }
/** "24 ตุลาคม 2569" */
function fullDate(d) { var t = isoToDate(d.iso); return t ? t.getDate() + ' ' + MONTHS_FULL_TH[t.getMonth()] + ' ' + (t.getFullYear() + 543) : d.date; }
/** "วันเสาร์ที่ 24 ตุลาคม 2569" */
function longDayLabel(d) {
  var t = isoToDate(d.iso);
  return t ? 'วัน' + WEEKDAYS_TH[t.getDay()] + 'ที่ ' + fullDate(d) : [d.weekday, d.date].filter(Boolean).join(' ');
}
function timeMin(t) {
  var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t || ''));
  return m ? +m[1] * 60 + +m[2] : Infinity;
}

/** รายการตามวัน ('all' = ทุกวัน) และกีฬาที่เลือก — คืน { item, day } เรียงตามวันแล้วตามเวลา */
function rowsOf(dayKey, sportId) {
  var rows = [];
  state.days.forEach(function (d, di) {
    if (dayKey !== 'all' && d.key !== dayKey) return;
    d.items.forEach(function (i) { if (sportId === 'all' || i.sportId === sportId) rows.push({ item: i, day: d, di: di }); });
  });
  return rows.sort(function (a, b) { return (a.di - b.di) || (timeMin(a.item.time) - timeMin(b.item.time)); });
}

/* ===================== ภาพประจำกีฬา =====================
   ใช้ตัวละครมาสคอตของงาน (assets/sport_mascot/web) ไม่ใช้ไอคอนแบบอิโมจิ (ผู้ดูแลขอ)
   กีฬาที่ยังไม่มีภาพมาสคอต = ไอคอนเส้นของเว็บ (sportIcon) ในกรอบขนาดเท่ากัน
   size = คลาสขนาดกรอบ (เช่น 'size-10') ภาพมาสคอตย่อให้พอดีกรอบโดยไม่ครอป */
function sportArt(id, size) {
  return '<span class="flex flex-none items-center justify-center ' + size + '">' +
    (sportMascotImg(id, 'size-full object-contain') || sportIcon(id, 'size-[70%] text-brand-strong')) + '</span>';
}
var CHEVRON = '<svg class="ml-auto flex-none opacity-50 max-[1180px]:hidden" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ===================== เมนูกีฬา (คอลัมน์ซ้าย) =====================
   กดแล้วกรองแผงผลการแข่งขันตรงกลาง ไม่เปลี่ยนหน้า · ที่เลือกอยู่พื้นชมพูทึบ
   จอ ≤1180px กลายเป็นแถบชิปเลื่อนแนวนอนเหนือแผงผล */
var NAV_ITEM = 'flex w-full cursor-pointer items-center gap-3 rounded-[12px] border-0 bg-transparent px-3 py-2 text-left font-body fs-15.5 text-fg hover:bg-surface-soft' +
  ' focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand aria-pressed:bg-brand aria-pressed:text-white aria-pressed:hover:bg-brand' +
  ' max-[1180px]:w-auto max-[1180px]:flex-none max-[1180px]:gap-2 max-[1180px]:py-1.5 max-[1180px]:pr-4 max-[1180px]:pl-2 max-[1180px]:fs-15';

function renderSportNav() {
  var data = state.data, host = document.getElementById('sportNav');
  function item(id, icon, label) {
    return '<button class="' + NAV_ITEM + '" type="button" data-sport="' + esc(id) + '" aria-pressed="' + (state.sportId === id) + '">' +
      icon + '<span class="min-w-0 truncate">' + esc(label) + '</span>' + CHEVRON + '</button>';
  }
  host.innerHTML = '<div class="flex flex-col gap-0.5 max-[1180px]:flex-row max-[1180px]:gap-1.5 max-[1180px]:overflow-x-auto max-[1180px]:[scrollbar-width:none] max-[1180px]:[&::-webkit-scrollbar]:hidden">' +
    item('all', '<span class="flex size-10 flex-none items-center justify-center max-[1180px]:size-8"><i class="icon-mask size-[22px]" data-ic="sports"></i></span>', 'ทุกประเภทกีฬา') +
    (data.sports || []).map(function (s) { return item(s.id, sportArt(s.id, 'size-10 max-[1180px]:size-8'), s.name); }).join('') +
  '</div>';
}
document.getElementById('sportNav').addEventListener('click', function (e) {
  var b = e.target.closest('[data-sport]');
  if (!b) return;
  state.sportId = b.getAttribute('data-sport');
  // สลับสถานะในที่ ไม่วาดเมนูใหม่ โฟกัสคีย์บอร์ดจึงยังอยู่ที่ปุ่มเดิม
  this.querySelectorAll('[data-sport]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  syncDayTabs();
  renderGroups();
  scrollToContent();
});

/* ===================== แท็บวัน =====================
   ปุ่มเรียงเป็นกริดตัดบรรทัด เห็นครบทุกวันโดยไม่ต้องเลื่อนข้าง (แถบเลื่อนแนวนอนเดิมถูกตัดขอบ ผู้ดูแลว่าดูแปลก)
   ปุ่มละสองบรรทัดแบบปฏิทิน: ชื่อวันย่อ (วันนี้ = คำว่า "วันนี้" สีชมพู) · วันที่
   วันที่มีแมตช์กำลังแข่ง มีจุดฟ้าที่มุมขวาบน (ข้อความ "มีการแข่งขันสด" อยู่ใน aria-label) */
var TAB = 'group relative flex h-[52px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[12px] border border-line bg-surface px-1.5 font-body whitespace-nowrap text-fg' +
  ' hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' +
  ' aria-pressed:border-transparent aria-pressed:bg-brand aria-pressed:text-white max-[560px]:h-12';
var WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function renderDayTabs() {
  var host = document.getElementById('dayTabs');
  host.innerHTML = '<button class="' + TAB + '" type="button" data-day="all"><span class="fs-15 leading-tight max-[560px]:fs-14">ทุกวัน</span></button>' +
    state.days.map(function (d) {
      var t = isoToDate(d.iso), today = isToday(d);
      var live = d.items.some(function (i) { return i.status === 'live'; });
      var top = today ? '<span class="fs-12 leading-none text-brand-ink group-aria-pressed:text-white">วันนี้</span>'
        : '<span class="fs-12 leading-none text-fg-mute group-aria-pressed:text-white/85">' + esc(t ? WEEKDAYS_SHORT[t.getDay()] : WEEKDAYS_SHORT[WEEKDAYS_TH.indexOf(d.weekday)] || d.weekday || '') + '</span>';
      return '<button class="' + TAB + '" type="button" data-day="' + esc(d.key) + '" aria-label="' + esc(longDayLabel(d)) +
          (today ? ' (วันนี้)' : '') + (live ? ' มีการแข่งขันสด' : '') + '">' + top +
        '<span class="fs-15 leading-tight tabular-nums max-[560px]:fs-14">' + esc(tabLabel(d)) + '</span>' +
        (live ? '<span class="absolute top-1.5 right-1.5 size-2 rounded-full bg-live ring-2 ring-surface group-aria-pressed:ring-brand motion-safe:animate-blink" aria-hidden="true"></span>' : '') +
      '</button>';
    }).join('');
  syncDayTabs();
}
/** สถานะแท็บ: ที่เลือกอยู่ + วันที่กีฬาที่เลือกไม่มีรายการจางลง (ยังกดได้) */
function syncDayTabs() {
  document.querySelectorAll('#dayTabs [data-day]').forEach(function (b) {
    var k = b.getAttribute('data-day');
    b.setAttribute('aria-pressed', String(k === state.dayKey));
    b.classList.toggle('opacity-45', k !== 'all' && !rowsOf(k, state.sportId).length);
  });
}
document.getElementById('dayTabs').addEventListener('click', function (e) {
  var b = e.target.closest('[data-day]');
  if (!b) return;
  state.dayKey = b.getAttribute('data-day');
  syncDayTabs();
  renderGroups();
});

/* ===================== แผงผลการแข่งขัน: ตารางแยกตามกีฬา =====================
   คอลัมน์: เวลา · ประเภท · คู่แข่งขัน · ผลการแข่งขัน · สนาม · สถานะ
   วัดจากความกว้างแผง (@container) ไม่ใช่ความกว้างจอ: แผง <860px ซ่อนสนาม · <680px แต่ละแถวพับเป็นบล็อก
   (บรรทัดแรก เวลา · ประเภท · สถานะ · บรรทัดสองเป็นป้ายคะแนนเต็มแถว) · เป็นกริดไม่ใช่ <table> เพื่อให้ชื่อยาวตัดด้วย … ได้ทุกแถวเท่ากัน */
var ROW = 'grid items-center gap-x-3 px-4 py-2.5 grid-cols-[54px_minmax(0,1fr)_minmax(0,2fr)_76px_minmax(0,.8fr)_116px]' +
  ' @max-[859px]:grid-cols-[50px_minmax(0,1fr)_minmax(0,2fr)_72px_112px]' +
  ' @max-[679px]:grid-cols-[50px_minmax(0,1fr)_auto] @max-[679px]:gap-y-1 @max-[679px]:px-3 @max-[679px]:py-2.5';
var C_TIME = ' @max-[679px]:col-start-1 @max-[679px]:row-start-1 @max-[679px]:self-start';
var C_KIND = ' @max-[679px]:col-start-2 @max-[679px]:row-start-1';
var C_TEAMS = ' @max-[679px]:col-span-3 @max-[679px]:col-start-1 @max-[679px]:row-start-2';
var C_SCORE = ' @max-[679px]:col-span-2 @max-[679px]:col-start-2 @max-[679px]:row-start-3 @max-[679px]:justify-self-start';
var C_VENUE = ' @max-[859px]:hidden';
var C_STATUS = ' @max-[679px]:col-start-3 @max-[679px]:row-start-1 @max-[679px]:justify-self-end';
var HEAD = '<div class="' + ROW + ' bg-surface-soft py-2 fs-13.5 text-fg-soft @max-[679px]:hidden" role="row">' +
  '<span role="columnheader">เวลา</span><span role="columnheader">ประเภท</span>' +
  '<span class="text-center" role="columnheader">คู่แข่งขัน</span><span class="text-center" role="columnheader">ผล</span>' +
  '<span class="' + C_VENUE + '" role="columnheader">สนาม</span><span role="columnheader">สถานะ</span></div>';

/** ป้าย LIVE กดแล้วเปิดลิงก์ถ่ายทอดสดในแท็บใหม่ (ลิงก์ผ่าน webLink() ใน sheets.js มาแล้ว = http/https เท่านั้น) */
function liveLink(url) {
  return '<a class="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-live" href="' + esc(url) +
    '" target="_blank" rel="noopener noreferrer" title="ดูถ่ายทอดสด">' +
    '<img class="block h-[24px] w-auto" src="assets/icons/live.svg" alt="ดูถ่ายทอดสด" width="84" height="30" /></a>';
}

/** สกอร์ตัวใหญ่: เลขฝั่งโรงเรียนเราสีชมพู เลขอีกฝั่งสีกรมท่า แบบเดียวกับการ์ดผลที่ชนะในหน้าผลการแข่งขัน (ผู้ดูแลขอ)
    ไม่มีโรงเรียนเราในคู่ = สีกรมท่าทั้งสองฝั่ง · ป้ายชนะ/แพ้/เสมอของโรงเรียนเราอยู่ใต้สกอร์
    '' = สกอร์ไม่ใช่รูป "ตัวเลข-ตัวเลข" */
var SELF_TEXT = 'text-brand-ink';
function scoreMark(i, isSelf) {
  var s = splitScore(i.score);
  if (!s) return '';
  var sides = teamSides(i.teams);
  var mine = sides.length === 2 ? sides.map(isSelf) : [false, false];
  var any = mine[0] !== mine[1];
  function num(k) {
    return '<span class="' + (any && mine[k] ? SELF_TEXT : 'text-brand-strong') + '">' + esc(s[k]) + '</span>';
  }
  // ไม่มีป้ายชนะ/แพ้/เสมอในแผงนี้ (ผู้ดูแลขอ ต.ค. 2569) — สกอร์สีชมพูของโรงเรียนเราบอกอยู่แล้ว
  return '<span class="flex flex-col items-center">' +
    '<span class="font-display fs-26 leading-none whitespace-nowrap tabular-nums">' + num(0) + '<span class="text-brand-strong"> - </span>' + num(1) + '</span></span>';
}
/** แผงแคบ (<680px) คู่แข่งสองฝ่ายพับเป็นป้ายคะแนนทีมละบรรทัด แต้มชิดขวาของแต่ละบรรทัด (boardLines)
    ช่องผลแยกจึงซ่อนไป (ยกเว้นผลแบบข้อความ ที่ยังขึ้นบรรทัดของตัวเอง) */
function stackedScore(i) {
  return teamSides(i.teams).length === 2 && (splitScore(i.score) || !i.score);
}

/** "ชื่อ ตรา  VS  ตรา ชื่อ" — ฝั่งแรกชิดขวาเข้าหากลาง ฝั่งที่สองชิดซ้าย ชื่อจึงไม่ห่างกันแม้แผงกว้าง
    ชื่อโรงเรียนเราสีน้ำเงิน · อีกฝั่งสีเทา (ผู้ดูแลขอ) */
function teamsCell(i, isSelf) {
  var sides = teamSides(i.teams);
  if (sides.length !== 2) {
    // ไม่มีคู่แข่ง (เช่นกรีฑา) แผงแคบไม่ต้องมีบรรทัด "-" ของตัวเอง แถวจะได้ไม่สูงเปล่า ๆ
    return i.teams ? '<span class="line-clamp-2 fs-14.5 text-fg-soft @min-[680px]:text-center">' + esc(i.teams) + '</span>' : '<span class="text-fg-mute @min-[680px]:text-center @max-[679px]:hidden">-</span>';
  }
  function side(name, first) {
    var m = schoolByText(state.data, name) || { school: name };
    var crest = schoolCrest(m, 'size-10 flex-none p-[1px]! max-[560px]:size-9');
    var label = '<span class="line-clamp-2 fs-14.5 leading-[1.35] ' + (isSelf(name) ? SELF_TEXT : 'text-fg-mute') + '">' + esc(name) + '</span>';
    return '<span class="flex min-w-0 items-center gap-1.5' + (first ? ' justify-end text-right' : '') + '" title="' + esc(name) + '">' +
      (first ? label + crest : crest + label) + '</span>';
  }
  var vs = '<span class="font-display fs-14 text-fg-mute">VS</span>';
  return '<span class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 @max-[679px]:hidden">' + side(sides[0], true) +
    vs + side(sides[1]) + '</span>' + boardLines(i, sides, isSelf);
}

/** แผงแคบ (<680px): ป้ายคะแนนแนวนอน "ตรา/ชื่อ  1 - 3  ตรา/ชื่อ" (ผู้ดูแลขอ ต.ค. 2569)
    ตราอยู่บน ชื่ออยู่ใต้ตรากึ่งกลาง แต่ละฝั่งจึงได้ความกว้างเกือบครึ่งแผง ชื่อยาวตัดขึ้นบรรทัดใหม่ได้สองบรรทัด
    (แบบบรรทัดเดียว "ชื่อ ตรา 1 - 0 ตรา ชื่อ" เดิม ชื่อเหลือที่ราว 85px จนถูกตัด "…")
    ชื่อทุกฝั่งสีเข้ม (ห้ามทำฝั่งแพ้ให้จาง ผู้ดูแลว่าอ่านยาก) · ไม่มีป้ายชนะ/แพ้/เสมอ (ผู้ดูแลขอ)
    ไม่มีสกอร์ (ยังไม่แข่ง) = "VS" ตรงกลาง */
function boardLines(i, sides, isSelf) {
  var s = splitScore(i.score);
  var mine = sides.map(isSelf), any = mine[0] !== mine[1];
  function side(k) {
    var m = schoolByText(state.data, sides[k]) || { school: sides[k] };
    return '<span class="flex min-w-0 flex-col items-center gap-1.5 text-center" title="' + esc(sides[k]) + '">' +
      schoolCrest(m, 'size-11 flex-none p-[1px]!') +
      '<span class="line-clamp-2 fs-15.5 leading-[1.35] ' + (mine[k] ? SELF_TEXT + ' font-semibold' : 'text-fg') + '">' + esc(sides[k]) + '</span>' +
    '</span>';
  }
  function num(k) { return '<span class="' + (any && mine[k] ? SELF_TEXT : 'text-brand-strong') + '">' + esc(s[k]) + '</span>'; }
  var mid = s
    ? '<span class="font-display fs-32 leading-none whitespace-nowrap tabular-nums">' + num(0) + '<span class="px-1.5 text-fg-mute">-</span>' + num(1) + '</span>'
    : '<span class="font-display fs-16 text-fg-mute">VS</span>';
  return '<span class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 pt-1 @min-[680px]:hidden">' +
    side(0) + '<span class="flex h-11 items-center self-start">' + mid + '</span>' + side(1) + '</span>';
}

function scoreCell(i, isSelf) {
  var mark = scoreMark(i, isSelf);
  if (mark) return mark;
  return i.score ? '<span class="line-clamp-2 text-center fs-14 text-fg-soft @max-[679px]:text-left">' + esc(i.score) + '</span>' : '<span class="block text-center text-fg-mute @max-[679px]:hidden">-</span>';
}

/* สถานะในแผงนี้: "กำลังแข่งขัน" ยังเป็นป้ายฟ้าทึบ (สิ่งเดียวที่กำลังเกิดขึ้น) ส่วนสถานะอื่นเป็นตัวหนังสือสีพร้อมจุดนำหน้า ไม่มีพื้น
   ป้ายพื้นอ่อน "จบการแข่งขัน" ขึ้นแทบทุกรายการจนแย่งสายตาจากสกอร์ · สีและคำยังเป็นสามแบบตามฝ่ายจัดการแข่งขัน (RESULT_STATUS) */
var STATUS_TEXT = { ended: 'text-ended', finished: 'text-done-ink', unofficial: 'text-upcoming' };
function statusText(cls, label, hollow) {
  return '<span class="inline-flex items-center gap-1.5 fs-13.5 whitespace-nowrap ' + cls + '">' +
    '<span class="size-2 flex-none rounded-full ' + (hollow ? 'ring-[1.5px] ring-current ring-inset' : 'bg-current') + '" aria-hidden="true"></span>' + label + '</span>';
}
function statusCell(i) {
  var r = resultStatusOf(i);
  var chip = i.status === 'live' ? statusChip('live')
    : r ? statusText(STATUS_TEXT[r], RESULT_STATUS[r].label)
    : statusText('text-fg-mute', 'รอแข่งขัน', true);
  if (i.liveUrl && i.status !== 'done') chip += liveLink(i.liveUrl);
  return '<span class="flex flex-wrap items-center gap-1.5 @max-[679px]:justify-end">' + chip + '</span>';
}

function rowHtml(r, isSelf, showDay) {
  var i = r.item, live = i.status === 'live';
  var kind = eventParts(sportName(state.data, i.sportId), i.event).kind;
  var sub = [i.round ? 'รอบ ' + i.round : '', i.pool ? 'สาย ' + i.pool : ''].filter(Boolean).join(' · ');
  // แถวที่กำลังแข่งพื้นฟ้าอ่อนทั้งแถว (ไม่ใช่แถบสีข้างแถว) — ป้าย "กำลังแข่งขัน" ฟ้าทึบกับเวลาสีฟ้าบอกสถานะอยู่แล้ว
  return '<div class="' + ROW + ' border-t border-line first:border-t-0 ' + (live ? 'bg-live-bg/50' : 'even:bg-surface-soft/60 @max-[679px]:even:bg-transparent') + '" role="row">' +
    '<span class="' + C_TIME + '" role="cell">' +
      (showDay ? '<span class="block fs-12.5 whitespace-nowrap text-fg-mute">' + esc(tabLabel(r.day)) + '</span>' : '') +
      '<span class="block font-mono fs-15.5 tabular-nums ' + (live ? 'text-live' : 'text-brand-strong') + '">' + esc(i.time || '—') + '</span></span>' +
    '<span class="min-w-0' + C_KIND + '" role="cell"><span class="line-clamp-2 fs-14.5 text-fg @max-[679px]:fs-15">' + esc(kind || '-') + '</span>' +
      ((sub || i.venue) ? '<span class="block truncate fs-13 text-fg-mute">' + esc(sub) +
        // คอลัมน์สนามซ่อนเมื่อแผง <860px จึงต่อชื่อสนามไว้บรรทัดรองแทน คนดูยังรู้ว่าแข่งที่ไหน
        (i.venue ? '<span class="@min-[860px]:hidden">' + (sub ? ' · ' : '') + esc(i.venue) + '</span>' : '') + '</span>' : '') + '</span>' +
    '<span class="min-w-0' + C_TEAMS + (i.teams ? '' : ' @max-[679px]:hidden') + '" role="cell">' + teamsCell(i, isSelf) + '</span>' +
    '<span class="' + C_SCORE + (stackedScore(i) ? ' @max-[679px]:hidden' : '') + '" role="cell">' + scoreCell(i, isSelf) + '</span>' +
    '<span class="min-w-0 truncate fs-14 text-fg-soft' + C_VENUE + '" role="cell" title="' + esc(i.venue || '') + '">' + (i.venue ? esc(i.venue) : '<span class="text-fg-mute">-</span>') + '</span>' +
    '<span class="' + C_STATUS + '" role="cell">' + statusCell(i) + '</span>' +
  '</div>';
}

function groupHtml(sportId, rows, isSelf) {
  var name = sportName(state.data, sportId) || eventParts('', rows[0].item.event).sport || 'อื่น ๆ';
  var shown = state.sportId === 'all' ? rows.slice(0, GROUP_TOP) : rows;
  var more = rows.length - shown.length;
  // ยังไม่มีผลเลย = ไปหน้าตารางแข่งขัน · มีผลแล้ว = ไปหน้าผลการแข่งขัน (ทั้งสองหน้ากรองกีฬาจาก ?sport= ได้)
  var hasResult = rows.some(function (r) { return r.item.status === 'live' || r.item.status === 'done'; });
  var href = (hasResult ? 'matches.html' : 'schedule.html') + (sportId ? '?sport=' + encodeURIComponent(sportId) : '');
  return '<section class="flex flex-col gap-2" aria-label="' + esc(name) + '">' +
    '<div class="flex items-center gap-2.5">' + sportArt(sportId, 'size-8') +
      '<h3 class="m-0 flex min-w-0 flex-1 items-baseline gap-2 font-display fs-17 leading-[1.3] font-normal text-brand-strong"><span class="truncate">' + esc(name) + '</span>' +
        '<span class="flex-none font-body fs-13 text-fg-mute">' + rows.length + ' รายการ</span></h3>' +
      '<a class="btn-pill btn-pill-sm" href="' + href + '">ดูทั้งหมด</a></div>' +
    '<div class="overflow-hidden rounded-[14px] border border-line" role="table" aria-label="' + esc(name) + '">' + HEAD +
      '<div role="rowgroup">' + shown.map(function (r) { return rowHtml(r, isSelf, state.dayKey === 'all'); }).join('') + '</div></div>' +
    (more > 0 ? '<a class="self-end fs-14 text-fg-mute no-underline hover:text-brand" href="' + href + '">ดู' + esc(name) + 'อีก ' + more + ' รายการ ›</a>' : '') +
  '</section>';
}

function renderGroups() {
  var data = state.data, host = document.getElementById('sportGroups');
  var day = state.days.filter(function (d) { return d.key === state.dayKey; })[0];
  var sport = state.sportId === 'all' ? '' : sportName(data, state.sportId);
  setText('dayHeading', day ? longDayLabel(day) : (eventDateRange(state.days) || 'ทุกวันแข่งขัน'));
  setText('resultsSub', sport ? 'เฉพาะ' + sport : 'รวมผลทุกประเภทกีฬา');

  var rows = rowsOf(state.dayKey, state.sportId);
  if (!rows.length) {
    var text = !state.days.length ? 'ยังไม่มีตารางการแข่งขัน'
      : 'ไม่มีรายการแข่งขัน' + (sport ? sport : '') + (day ? 'ใน' + longDayLabel(day) : '');
    host.innerHTML = '<div class="' + EMPTY_BOX + '">' + esc(text) + '</div>';
    return;
  }
  // จัดกลุ่มตามกีฬา เรียงตามลำดับกีฬาในชีต กีฬาที่ไม่อยู่ในรายการไว้ท้าย
  var order = (data.sports || []).map(function (s) { return s.id; });
  var groups = {}, keys = [];
  rows.forEach(function (r) {
    var k = r.item.sportId || '';
    if (!groups[k]) { groups[k] = []; keys.push(k); }
    groups[k].push(r);
  });
  function rank(k) { var n = order.indexOf(k); return n < 0 ? 999 : n; }
  keys.sort(function (a, b) { return rank(a) - rank(b); });
  var isSelf = selfSideTester(data);
  host.innerHTML = keys.map(function (k) { return groupHtml(k, groups[k], isSelf); }).join('');
  host.scrollTop = 0;
}

/* ===================== คอลัมน์ขวา: อันดับโรงเรียนเรา + เหรียญแยกประเภทกีฬา ===================== */
function coin(n, label) {
  return '<img class="mx-auto size-[22px]" src="assets/medals/coin-' + n + '.webp" alt="' + label + '" title="' + label + '" width="64" height="64" decoding="async" />';
}

/** แถบอันดับของโรงเรียนเรา — ตอบคำถามแรกที่คนเปิดหน้ามาหา "ตอนนี้เราอยู่อันดับไหน" */
function renderSelfRank() {
  var data = state.data, me = selfRow(data) || { gold: 0, silver: 0, bronze: 0 };
  var rank = data.school.rank || '—', n = total(me);
  var host = document.getElementById('selfRank');
  // การ์ดน้ำเงินเข้ม (navy ไม่เปลี่ยนตามธีม จึงเข้มทั้งโหมดสว่าง/มืด) ตัวหนังสือขาว · อันดับและจำนวนเหรียญตามชีตตรง ๆ
  host.innerHTML = '<div class="flex items-center gap-3 rounded-[14px] bg-[linear-gradient(135deg,var(--color-navy),var(--color-navy-2))] py-2.5 pr-2.5 pl-3 text-white">' +
    schoolCrest(me.fullName ? me : data.school, 'size-11 flex-none') +
    '<div class="min-w-0 flex-1"><p class="m-0 truncate font-display fs-17 leading-[1.3] text-white">' + esc(data.school.name) + '</p>' +
      '<p class="m-0 fs-13.5 text-white/75 tabular-nums">รวม ' + n + ' เหรียญ</p></div>' +
    '<div class="flex-none rounded-[12px] bg-white/12 px-3 py-1.5 text-center text-white ring-1 ring-white/20">' +
      '<span class="block fs-12 leading-[1.3] font-bold text-white">อันดับ</span>' +
      '<span class="block font-display fs-28 leading-none tabular-nums">' + esc(rank) + '</span>' +
      '<span class="block fs-11.5 leading-[1.4] whitespace-nowrap text-white/75">จาก ' + esc(data.school.totalSchools || '—') + ' โรงเรียน</span></div>' +
  '</div>';
  host.setAttribute('aria-label', data.school.name + ' อันดับ ' + rank + ' จาก ' + data.school.totalSchools + ' โรงเรียน');
}

/* มือถือคอลัมน์ตัวเลขแคบลง ให้ชื่อกีฬายาว (เทเบิลเทนนิส / หมากกระดาน) ไม่ถูกตัดเป็น "…" */
var BS_GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(3,36px)_40px] items-center gap-2 px-2.5 max-[560px]:grid-cols-[minmax(0,1fr)_repeat(3,28px)_34px] max-[560px]:gap-1.5 max-[560px]:px-2';
/** เหรียญของโรงเรียนเราแยกตามชนิดกีฬา (แท็บเหรียญแยกตามชนิดกีฬาในชีต) — เรียงทองมากก่อน · แถวท้ายรวมทุกกีฬา */
function renderBySport() {
  var host = document.getElementById('bySport');
  var sports = (state.data.sports || []).slice();
  if (!sports.length) { host.innerHTML = '<div class="' + EMPTY_BOX + '">ยังไม่มีข้อมูลเหรียญแยกประเภทกีฬา</div>'; return; }
  sports.sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });
  var sum = { gold: 0, silver: 0, bronze: 0 };
  sports.forEach(function (s) { MEDALS.forEach(function (k) { sum[k.key] += s[k.key] || 0; }); });
  function nums(m, cls) {
    return MEDALS.map(function (k) { return '<span class="text-center font-mono tabular-nums' + (m[k.key] ? '' : ' opacity-40') + '">' + (m[k.key] || 0) + '</span>'; }).join('') +
      '<span class="text-right font-mono tabular-nums ' + cls + '">' + total(m) + '</span>';
  }
  host.innerHTML =
    '<div class="' + BS_GRID + ' rounded-[12px] bg-surface-soft py-2 fs-13.5 text-fg-soft" aria-hidden="true">' +
      '<span>ประเภทกีฬา</span>' + coin(1, 'ทอง') + coin(2, 'เงิน') + coin(3, 'ทองแดง') + '<span class="text-right">รวม</span></div>' +
    '<div class="mt-1 flex flex-col">' + sports.map(function (s) {
      return '<a class="' + BS_GRID + ' rounded-[10px] py-1.5 fs-15 text-fg no-underline hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" href="matches.html?sport=' + esc(s.id) + '"' +
        ' aria-label="' + esc(s.name) + ' ทอง ' + s.gold + ' เงิน ' + s.silver + ' ทองแดง ' + s.bronze + '">' +
        '<span class="flex min-w-0 items-center gap-2">' + sportArt(s.id, 'size-8') + '<span class="truncate">' + esc(s.name) + '</span></span>' +
        nums(s, 'text-brand-strong') + '</a>';
    }).join('') + '</div>' +
    '<div class="' + BS_GRID + ' mt-1 rounded-[12px] bg-brand-100 py-2 fs-15 text-brand-strong"><span class="font-display">รวมทุกประเภท</span>' + nums(sum, 'text-brand') + '</div>';
}

/* ===================== ตารางอันดับย่อ =====================
   ตัวหนังสือในแถวใช้ font-display fs-17 (เดิม fs-21 เท่าหัวแผง — ผู้ดูแลบอกว่าใหญ่ไป ชื่อโรงเรียนถูกตัดเหลือไม่กี่ตัว)
   ชื่อใช้ชื่อเรียกสั้น (schoolNickname เช่น สาธิตปทุมวัน) — ชื่อเต็มอยู่ใน title และในหน้าอันดับเหรียญ */
var ST_GRID = 'grid grid-cols-[30px_minmax(0,1fr)_repeat(3,28px)_34px] items-center gap-2 px-2 max-[400px]:grid-cols-[26px_minmax(0,1fr)_repeat(3,24px)_30px] max-[400px]:gap-1.5';

function renderStandings(data) {
  var host = document.getElementById('standings');
  var rows = data.medalTable || [];
  if (!rows.length) { host.innerHTML = '<div class="' + EMPTY_BOX + '">ยังไม่มีตารางเหรียญ</div>'; return; }
  var me = selfRow(data);
  var shown = rows.slice(0, STAND_TOP);
  var pinned = me && shown.indexOf(me) < 0 ? me : null;

  function row(m) {
    var self = m.isSelf;
    return '<a class="' + ST_GRID + ' rounded-[12px] py-1.5 font-display fs-17 leading-[1.3] no-underline max-[400px]:fs-15.5 ' +
      (self ? 'bg-brand-100 text-brand' : 'text-fg hover:bg-surface-soft') +
      '" href="school.html?id=' + esc(schoolId(schoolKey(m))) + '" title="' + esc(m.fullName || m.school) + '">' +
      '<span class="flex size-7 items-center justify-center rounded-full tabular-nums max-[400px]:size-6 ' + (self ? 'bg-brand text-white' : 'text-fg-soft') + '">' + m.rank + '</span>' +
      '<span class="flex min-w-0 items-center gap-2">' + schoolCrest(m, 'size-7 flex-none max-[400px]:size-6') + '<span class="truncate">' + esc(schoolNickname(m)) + '</span></span>' +
      MEDALS.map(function (k) { return '<span class="text-center tabular-nums' + (m[k.key] ? '' : ' opacity-40') + '">' + m[k.key] + '</span>'; }).join('') +
      '<span class="text-right tabular-nums ' + (self ? '' : 'text-brand-strong') + '">' + total(m) + '</span>' +
    '</a>';
  }
  host.innerHTML =
    '<div class="' + ST_GRID + ' rounded-[12px] bg-surface-soft py-2 fs-13.5 text-fg-soft" aria-hidden="true">' +
      // หัวคอลัมน์อันดับแคบแค่ 30px คำ "อันดับ" ล้นทับคำ "โรงเรียน" — ใช้หัวเดียวคร่อมสองคอลัมน์ (ตัวเลขอันดับอ่านออกเองอยู่แล้ว)
      '<span class="col-span-2">อันดับโรงเรียน</span>' + coin(1, 'ทอง') + coin(2, 'เงิน') + coin(3, 'ทองแดง') + '<span class="text-right">รวม</span></div>' +
    '<div class="mt-1 flex flex-col gap-0.5">' + shown.map(row).join('') +
      (pinned ? '<div class="py-0.5 text-center fs-14 tracking-[.35em] text-fg-mute" aria-hidden="true">⋯</div>' + row(pinned) : '') +
    '</div>';
}

/* ===================== สรุปผลที่ชนะ แยกตามวัน =====================
   นับเฉพาะแมตช์ที่จบแล้วและโรงเรียนเราแต้มมากกว่า (matchOutcome = 'win') — ผลแบบข้อความ เช่น ประกาศอันดับ ไม่นับ ไม่เดา
   การ์ดของวันนี้พื้นชมพูอ่อน · ดาวน์โหลดเป็น CSV (มี BOM ให้ Excel อ่านภาษาไทยถูก) สร้างในเบราว์เซอร์ ไม่มีไฟล์บนเซิร์ฟเวอร์ */
var DL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var DL_BTN = 'btn-fx inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[12px] px-4 font-body fs-14.5 whitespace-nowrap' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-45';

function winsOf(d, isSelf) {
  return d.items.filter(function (i) { return matchOutcome(i, isSelf) === 'win'; });
}
function renderWins() {
  var data = state.data, host = document.getElementById('winDays');
  var isSelf = selfSideTester(data), now = isoDate(new Date());
  setText('winsSub', 'ดาวน์โหลดไฟล์สรุปผลการแข่งขันที่ชนะของ' + (data.school.fullName || data.school.name));
  var days = state.days.filter(function (d) { return d.items.length; });
  if (!days.length) { host.innerHTML = '<div class="' + EMPTY_BOX + '">ยังไม่มีตารางการแข่งขัน</div>'; return; }
  host.innerHTML = days.map(function (d) {
    var n = winsOf(d, isSelf).length, today = isToday(d);
    var note = n ? 'ชนะทั้งหมด ' + n + ' รายการ' : d.iso && d.iso > now ? 'ยังไม่ถึงวันแข่งขัน' : 'ยังไม่มีรายการที่ชนะ';
    return '<div class="flex min-w-[180px] flex-1 flex-col items-center gap-2 rounded-[16px] border px-4 py-3.5 text-center ' +
        (today ? 'border-brand bg-brand-100' : 'border-line bg-surface') + '">' +
      '<p class="m-0 flex items-center gap-2 fs-15 whitespace-nowrap text-brand-strong"><i class="icon-mask size-[18px] text-brand" data-ic="calendar"></i>' + esc(fullDate(d)) +
        (today ? '<span class="rounded-full bg-brand px-2 fs-12 text-white">วันนี้</span>' : '') + '</p>' +
      '<p class="m-0 fs-14.5 whitespace-nowrap ' + (n ? 'text-brand' : 'text-fg-mute') + '">' + note + '</p>' +
      '<button class="' + DL_BTN + '" type="button" data-win-day="' + esc(d.key) + '"' + (n ? '' : ' disabled') + ' aria-label="ดาวน์โหลดไฟล์ผลที่ชนะ ' + esc(fullDate(d)) + '">ดาวน์โหลดไฟล์' + DL_ICON + '</button>' +
    '</div>';
  }).join('');
}
/** กันสูตร Excel: ช่องที่ขึ้นต้นด้วย = + - @ ใส่ ' นำหน้า (ข้อมูลมาจากชีตที่คนภายนอกแก้ได้) */
function csvCell(v) {
  v = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function downloadWins(d) {
  var data = state.data, isSelf = selfSideTester(data);
  var lines = [['วันที่', 'เวลา', 'กีฬา', 'ประเภท', 'คู่แข่งขัน', 'ผลการแข่งขัน', 'สนาม']].concat(
    winsOf(d, isSelf).map(function (i) {
      var p = eventParts(sportName(data, i.sportId), i.event);
      return [fullDate(d), i.time, p.sport, p.kind, teamSides(i.teams).join(' vs '), i.score, i.venue];
    }));
  var csv = '﻿' + lines.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = url;
  a.download = 'ผลที่ชนะ-' + (d.iso || d.date) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
document.getElementById('winDays').addEventListener('click', function (e) {
  var b = e.target.closest('[data-win-day]');
  if (!b || b.disabled) return;
  var d = state.days.filter(function (x) { return x.key === b.getAttribute('data-win-day'); })[0];
  if (d) downloadWins(d);
});

/* ===================== ภาพบรรยากาศ =====================
   ภาพของวันนี้ (ยังไม่มีภาพ = วันล่าสุดก่อนหน้าที่มี ดู photoDayNow) จากคลังภาพ (โฟลเดอร์ Drive ของหน้าประมวลภาพ ผ่าน day-photos.js) หยิบกระจายหลายกีฬา
   เป็นการ์ดภาพแบบ "Chula Social Impact" ของเว็บจุฬาฯ: สองแถวเลื่อนไปทางซ้าย แถวล่างเหลื่อมครึ่งใบ — ภาพน้อยกว่า 6 ภาพเหลือแถวเดียว
   การเลื่อน/หยุด/เบลอขอบล่าง/ปิดตามเครื่องที่ลดการเคลื่อนไหว อยู่ใน .photo-marquee (input.css)
   กดการ์ด / "ดูทั้งหมด" = เปิดหน้าประมวลภาพที่แท็บวันเดียวกัน · ไม่มีภาพเลย = ซ่อนทั้งแถบ
   วาดครั้งเดียวตอนเปิดหน้า ข้อมูลชุดใหม่ (onFreshData) ไม่ทำให้ภาพสลับใต้มือคนดู */
var PHOTO_ROW_MIN = 8;  // การ์ดต่อชุดอย่างน้อยเท่านี้ (ภาพน้อยก็วนซ้ำ) ครึ่งแถวจึงยาวเกินจอกว้างเสมอ ไม่เห็นช่องโหว่ตอนวน
var PHOTO_SEC = 10;     // วินาทีต่อการ์ดหนึ่งใบ — ความเร็วเลื่อนเท่ากันไม่ว่าแถวยาวเท่าไร
var photosDrawn = false;
function isoLabel(iso) {
  var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
  return 'วัน' + WEEKDAYS_TH[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + MONTHS_TH[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
/** บรรทัดรองใต้ชื่อกีฬา: ชื่อโฟลเดอร์ย่อย (caption = "กีฬา · โฟลเดอร์") — ไม่มีก็เว้นไว้ วันที่อยู่ที่หัวแถบแล้ว */
function photoSub(p) {
  return String(p.caption || '').replace(p.sportText || '', '').replace(/^\s*·\s*/, '').trim();
}
/** การ์ดภาพหนึ่งใบ · copy = ชุดซ้ำสำหรับวนต่อท้าย (ซ่อนจากโปรแกรมอ่านหน้าจอและปุ่ม Tab) */
function photoCard(p, href, copy) {
  var fb = imageFallbackAt(p.link, 800);
  var title = p.sportText || 'ภาพบรรยากาศ', sub = photoSub(p);
  return '<a class="photo-card motion-ok relative mr-6 block h-[360px] w-[300px] flex-none overflow-hidden rounded-[20px] bg-navy no-underline max-[560px]:mr-4 max-[560px]:h-[240px] max-[560px]:w-[190px] max-[560px]:rounded-[14px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white" href="' + esc(href) + '"' +
      (copy ? ' data-copy aria-hidden="true" tabindex="-1"' : '') + '>' +
    // no-referrer: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    '<img class="absolute inset-0 block size-full object-cover" src="' + esc(imageUrlAt(p.link, 800)) + '"' + (fb ? ' data-fb="' + esc(fb) + '"' : '') +
      ' alt="' + (copy ? '' : esc(p.caption || title)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
    // เงาเข้มที่ขอบล่างให้ตัวหนังสือขาวอ่านออก — ไม่ใช้ backdrop-filter: การ์ดเลื่อนอยู่ตลอด เบลอ 30 กว่าใบต้องวาดใหม่ทุกเฟรม
    // แถบภาพกระตุก/ค้าง และ Safari มักไม่วาดตัวหนังสือที่ซ้อนบนชั้นเบลอ (DESIGN.md ก็ห้าม backdrop-blur)
    '<span class="absolute inset-x-0 bottom-0 h-[200px] bg-linear-to-b from-black/0 via-black/35 to-black/75 max-[560px]:h-[130px]"></span>' +
    '<span class="photo-text absolute inset-x-0 bottom-0 flex items-end gap-4 pr-6 pb-6 pl-8 text-white max-[560px]:gap-2 max-[560px]:px-4 max-[560px]:pb-4">' +
      '<span class="min-w-0 flex-1">' +
        '<span class="block font-display fs-24 leading-[1.5] font-bold line-clamp-2 max-[560px]:fs-16">' + esc(title) + '</span>' +
        (sub ? '<span class="mt-1 block fs-16 leading-[1.5] font-semibold line-clamp-2 max-[560px]:fs-14">' + esc(sub) + '</span>' : '') +
      '</span>' +
      '<span class="flex size-8 flex-none items-center justify-center rounded-full bg-white text-black max-[560px]:size-6" aria-hidden="true">' +
        '<svg class="size-4 max-[560px]:size-3" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 5.5l6.5 6.5-6.5 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
    '</span>' +
  '</a>';
}
/**
 * หนึ่งแถว: ชุดจริง (วนซ้ำจนครบ PHOTO_ROW_MIN) + ชุดซ้ำเหมือนกันต่อท้าย เพื่อให้เลื่อน -50% แล้ววนได้ไม่มีรอยต่อ
 * shift = เริ่มเลื่อนไปก่อนกี่ใบ (ติดลบใน animation-delay) ให้แถวล่างเหลื่อมกับแถวบน
 */
function photoRow(items, href, shift) {
  var set = [];
  while (set.length < PHOTO_ROW_MIN) set = set.concat(items);
  return '<div><div class="photo-row motion-ok" style="--dur:' + set.length * PHOTO_SEC + 's;--delay:-' + shift * PHOTO_SEC + 's">' +
    set.map(function (p, i) { return photoCard(p, href, i >= items.length); }).join('') +
    set.map(function (p) { return photoCard(p, href, true); }).join('') +
  '</div></div>';
}
function renderPhotos(data) {
  if (photosDrawn) return;
  photosDrawn = true;
  photoUnits.then(function (units) {
    var iso = photoDayNow(photoDates(units, data));
    if (!iso) return;
    return photosOfDay(units, data, iso).then(function (list) {
      // สุ่มใหม่ทุกครั้งที่เปิดหน้า (กระจายทุกกีฬา) — เดิมหยิบตามลำดับไฟล์ ได้ชุดเดิมทุกครั้ง
      var picks = pickRandom(list, PHOTO_TOP, function (p) { return p.sportText; });
      if (!picks.length) return;
      var href = 'gallery.html?day=' + encodeURIComponent(iso), day = isoLabel(iso);
      document.getElementById('photoDay').textContent = day;
      document.getElementById('photoAll').href = href;
      var rows = picks.length < 6 ? [picks] : [
        picks.filter(function (_, i) { return i % 2 === 0; }),
        picks.filter(function (_, i) { return i % 2 === 1; })
      ];
      var grid = document.getElementById('photoGrid');
      grid.innerHTML = rows.map(function (r, i) { return photoRow(r, href, i ? 0.5 : 0); }).join('');
      // รูปจาก lh3 โหลดไม่ได้ → สลับไปลิงก์รูปย่อของ Drive หนึ่งครั้ง
      grid.querySelectorAll('img[data-fb]').forEach(function (img) {
        img.addEventListener('error', function () { var fb = img.dataset.fb; if (fb) { delete img.dataset.fb; img.src = fb; } });
      });
      document.getElementById('photoBand').hidden = false;
    });
  }).catch(function (err) { console.error('แถบภาพบรรยากาศ:', err.message); });
}

function renderAll(data) {
  state.data = data;
  state.days = mergedDays(data);
  if (state.dayKey == null || (state.dayKey !== 'all' && !state.days.some(function (d) { return d.key === state.dayKey; }))) {
    state.dayKey = defaultDayKey(state.days);
  }
  if (state.sportId !== 'all' && !(data.sports || []).some(function (s) { return s.id === state.sportId; })) state.sportId = 'all';
  renderSportNav();
  renderDayTabs();
  renderGroups();
  renderSelfRank();
  renderBySport();
  renderStandings(data);
  renderWins();
  renderPhotos(data);
  paintUiIcons(document.getElementById('main'));
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
