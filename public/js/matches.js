/* =========================================================
   matches.js — ผลการแข่งขัน
   อ่านจากแท็บ "ผลการแข่งขัน" ในชีต: วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ
   (+ คอลัมน์เสริม นักกีฬา / สนาม / Live ที่หาจากชื่อหัวคอลัมน์)
   ตัวตาราง/ตัวกรอง/แบ่งหน้าอยู่ใน fixture-table.js (ใช้ร่วมกับหน้าตารางการแข่งขัน)
   ตารางหน้าตาเดียวกับหน้าตารางการแข่งขัน: วันแข่งขัน / รายการแข่งขัน / ประเภท / เวลา / ระหว่าง แล้วต่อด้วย ผล / สถานะ / สนาม
   หน้านี้เพิ่ม: เปิดมาที่ "วันนี้" · ชิปชื่อกีฬา
   แถวที่มีชื่อนักกีฬากดเปิดดูรายละเอียดได้ · แผงข้าง: สรุปผลของวัน + ไฮไลต์ภาพการแข่งขันของวันนั้น (Google Drive)
   + นักกีฬาดีเด่นของวันนั้น (แท็บ "MVP" ในชีต)
   เลือกกีฬาจากเมนูซ้าย = ทั้งหน้าเป็นเรื่องของกีฬานั้น: การ์ดแนะนำกีฬา · ภาพ · ผลที่ชนะ · สรุป · นักกีฬาดีเด่น · ตาราง
   ========================================================= */
import {
  RESULT_STATUS, resultStatusOf, resultLabel, resultChip, statusChip, CHIP, LIVE_DOT, esc, teamSides, splitScore,
  dayLabel, isToday, schoolByText, schoolCrest, schoolNickname, scoreStrip, sportMascotImg, sportIcon, paintUiIcons,
  matchOutcome, sportName, medalOf, medalCoin, medalStrip, isWinOrMedal, winLabel, MEDAL_NAMES
} from './common.js';
import { mountFixtureTable, renderSportIntro, orDash, TD_TIME, TH_TEAMS, teamsHtml, isSelfFor, SCORE_LINE, venueHtml } from './fixture-table.js';
import { imageUrlAt, imageFallbackAt } from './format.js';
import { loadStars, sportIdOf } from './sheets.js';

/** รายชื่อนักกีฬา: ชีตเก็บเป็น "ชื่อ1, ชื่อ2, …" (ช่องแบบเลือกหลายชื่อ) หรือขึ้นบรรทัดใหม่ในช่อง
    ช่องว่างซ้อนในชื่อ (ชื่อ␣␣สกุล) ยุบเหลือช่องเดียว */
function athleteNames(text) {
  return String(text || '').split(/\s*[,\n]\s*/).map(function (n) { return n.trim().replace(/\s+/g, ' '); }).filter(Boolean);
}

/** สกอร์ "x-y" ของคู่ที่พบกันสองฝ่าย — จอแคบวางแต้มเรียงลงข้างชื่อแต่ละฝั่งแบบป้ายคะแนน (ดู teamsHtml) */
function boardScore(r) {
  return teamSides(r.teams).length === 2 && splitScore(r.score);
}

/** สกอร์ "x-y" แต้มฝั่งเราเป็นสีชมพู · สกอร์รูปแบบอื่น (ทอง: …) แสดงตามชีต
    จอกว้าง "2 - 1" บรรทัดเดียว · จอแคบแต้มเรียงลงตรงกับบรรทัดชื่อทีม (สูง SCORE_LINE เท่ากัน) ตัวโตขึ้น ไม่มีขีดคั่น */
function scoreHtml(r) {
  var sides = teamSides(r.teams), sc = splitScore(r.score);
  // ยังไม่มีผล: จอกว้างคงขีดไว้ให้คอลัมน์ไม่โหว่ · จอแคบไม่มีคอลัมน์ให้เรียง ขีดเดี่ยว ๆ เป็นแค่สิ่งรก
  if (!r.score) return '<span class="text-fg-mute @max-[800px]:hidden">-</span>';
  // ผลเป็นเหรียญ (ว่ายน้ำ ฯลฯ): รูปเหรียญ + ชื่อเหรียญ แทนคำในชีต (ผู้ดูแลขอ ต.ค. 2569)
  var medal = medalOf(r.score);
  if (medal) return '<span class="inline-flex items-center gap-1.5 fs-15 font-semibold whitespace-nowrap text-brand-strong">' + medalCoin(medal, 'size-[26px]') + MEDAL_NAMES[medal] + '</span>';
  if (!sc || sides.length !== 2) return orDash(r.score);
  var live = r.status === 'live';
  var tone = function (k) { return r.isSelf(sides[k]) ? 'text-brand' : live ? 'text-live' : 'text-fg'; };
  var num = function (k) {
    return '<span class="' + tone(k) + ' @max-[800px]:flex @max-[800px]:items-center @max-[800px]:justify-end ' + SCORE_LINE + '">' + esc(sc[k]) + '</span>';
  };
  return '<span class="inline-flex items-baseline gap-1.5 font-mono fs-17 tabular-nums @max-[800px]:flex-col @max-[800px]:items-end @max-[800px]:fs-22 @max-[800px]:leading-none">' +
    num(0) + '<span class="text-fg-mute @max-[800px]:hidden">-</span>' + num(1) + '</span>';
}

/** ป้ายสถานะ: กำลังแข่งขัน (ฟ้าทึบ ดังสุดในหน้า) / จบการแข่งขัน / เสร็จสิ้น / ยังไม่เป็นทางการ (RESULT_STATUS ใน common.js) · ยังไม่มีผล = ขีด
    ใหญ่กว่า CHIP ปกติ: แถวตารางสูงสองบรรทัดอยู่แล้ว (ช่องระหว่าง/ประเภท) ป้ายเล็กจะจมหาย */
var CHIP_ROW = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-1 fs-13.5';
function statusChipHtml(r) {
  if (r.status === 'live' && !resultStatusOf(r)) return statusChip('live', 'bg-live text-white dark:text-on-ink').replace(CHIP, CHIP_ROW);
  return resultChip(r, CHIP_ROW) || '<span class="text-fg-mute @max-[800px]:hidden">-</span>';
}
/** ช่องสถานะ — จอแคบพ่วงสนามมาไว้ซ้ายในบรรทัดเดียวกัน (ช่องสนามของตัวเองซ่อนไป)
    ช่องนี้คร่อมทุกคอลัมน์ของกริดแถว ป้ายกว้าง ๆ จึงไม่ถ่างคอลัมน์เวลา เวลาทุกแถวอยู่ตรงกัน และชื่อกีฬาไม่ถูกบีบจนตัด */
function statusHtml(r) {
  return (r.venue ? '<span class="hidden min-w-0 fs-14.5 whitespace-normal text-fg-soft @max-[800px]:block">' + venueHtml(r) + '</span>' : '') + statusChipHtml(r);
}


/* คำนำหน้าชื่อแยกออกมาเว้นวรรคจากชื่อ แต่ขนาด/สีเดียวกับชื่อ (ผู้ดูแลขอ ต.ค. 2569 — เดิมคำนำหน้าตัวเล็กจาง
   ผู้ชมเห็นเป็นตัวหนา-บางปนกันในชื่อเดียว ดูไม่เรียบร้อย)
   (เรียงคำยาวก่อน: "นางสาว" ต้องจับก่อน "นาง") */
var NAME_PREFIX = /^(นางสาว|นาง|นาย|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/;
var PEOPLE = '<svg class="flex-none" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M15.5 4.9a3.4 3.4 0 010 6.3M17.6 14.6c1.8.6 3 2.2 3.4 4.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function athleteItem(n, i) {
  var m = n.match(NAME_PREFIX), prefix = m ? m[1] : '', name = m ? n.slice(m[0].length) : n;
  return '<li class="flex min-w-0 items-center gap-3 rounded-[12px] bg-surface px-3 py-2.5 ring-1 ring-line @max-[560px]:gap-2 @max-[560px]:px-2.5 @max-[560px]:py-2">' +
    '<span class="flex size-7 flex-none items-center justify-center rounded-full bg-brand-100 font-mono fs-13 text-brand tabular-nums">' + (i + 1) + '</span>' +
    '<span class="min-w-0 leading-[1.3]">' +
      '<span class="fs-15 text-fg">' + (prefix ? esc(prefix) + ' ' : '') + esc(name) + '</span>' +
    '</span></li>';
}

/** แถวรายละเอียด (กดเปิดจากปุ่มท้ายแถว): หัว "นักกีฬา · N คน" (+ ปุ่มถ่ายทอดสดชิดขวา)
    แล้วรายชื่อเป็นการ์ดเลขลำดับ เรียงเป็นคอลัมน์กว้างเท่ากัน — จำนวนคอลัมน์ตามความกว้างกล่องตาราง (@container) */
function detailHtml(r) {
  var names = athleteNames(r.athletes);
  if (!names.length && !r.liveUrl) return '';
  return '<div class="rounded-[16px] bg-surface-soft p-4 ring-1 ring-line @max-[800px]:p-3">' +
    '<div class="flex flex-wrap items-center gap-x-4 gap-y-2' + (names.length ? ' mb-3' : '') + '">' +
      (names.length ? '<p class="m-0 flex items-center gap-2 fs-15 text-fg">' +
        '<span class="text-brand">' + PEOPLE + '</span>นักกีฬา' +
        '<span class="rounded-full bg-surface px-2.5 py-0.5 fs-13 text-fg-soft ring-1 ring-line tabular-nums">' + names.length + ' คน</span></p>' : '') +
      (r.liveUrl ? '<a class="ml-auto inline-flex flex-none items-center gap-2 rounded-full bg-live px-4 py-2 fs-14 text-white no-underline hover:opacity-90" href="' + esc(r.liveUrl) + '" target="_blank" rel="noopener">' +
        LIVE_DOT + 'ดูถ่ายทอดสด</a>' : '') +
    '</div>' +
    (names.length ? '<ol class="m-0 grid list-none grid-cols-1 gap-2 p-0 @min-[560px]:grid-cols-2 @max-[560px]:gap-1.5 @min-[900px]:grid-cols-3 @min-[1200px]:grid-cols-4">' +
      names.map(athleteItem).join('') + '</ol>' : '') +
  '</div>';
}

/* ---------- ชิ้นส่วนที่ใช้ซ้ำในแผงต่าง ๆ ---------- */
/** มาสคอตกีฬา (ไม่มีไฟล์ = ไอคอนเส้น) */
function sportArt(id, size) {
  return '<span class="flex flex-none items-center justify-center ' + size + '">' +
    (sportMascotImg(id, 'size-full object-contain') || sportIcon(id, 'size-[70%] text-brand-strong')) + '</span>';
}
/** ชื่อทีมในชีต ("สาธิตราม มัธยม") → แถวโรงเรียนในตารางเหรียญ + ชื่อเรียกสั้น (สาธิตรามคำแหง) · จับคู่ไม่ได้ใช้ชื่อตามชีต */
function sideInfo(data, name) {
  var m = schoolByText(data, name);
  return { m: m || { school: name }, name: m ? schoolNickname(m) : name };
}
/** ประเภท "ทีม มัธยมศึกษาตอนต้น หญิง" → เพศ (ป้ายสี) + ส่วนที่เหลือ */
var GENDER_TONE = { 'หญิง': 'bg-brand-100 text-brand', 'ชาย': 'bg-surface-soft text-navy-2 dark:text-fg', 'ผสม': 'bg-upcoming-bg text-upcoming' };
function genderOf(kind) {
  var m = /\s*(ชาย|หญิง|ผสม)\s*$/.exec(kind || '');
  return m ? { g: m[1], rest: kind.slice(0, m.index).trim() } : { g: '', rest: kind || '' };
}
var CLOCK = '<svg class="flex-none" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** "วันนี้" / "<วัน>" / "ทุกวัน" ต่อท้ายหัวพาเนล */
function dayWord(day) {
  if (!day) return 'ทุกวัน';
  return isToday(day) ? 'วันนี้' : dayLabel(day);
}

/* ---------- แมตช์เด่น ----------
   หยิบจากแถวที่ผ่านตัวกรองแล้ว (วัน · กีฬา · คำค้น) เรียงเวลาแล้ว:
   กำลังแข่งของโรงเรียนเรา > ผลล่าสุดของโรงเรียนเรา > ผลล่าสุดของใครก็ได้ · ไม่มีผลเลย = ซ่อนการ์ด
   แสดงเฉพาะตอนเลือกกีฬา — ดู "ผลการแข่งขันทั้งหมด" อยู่ = ซ่อน (ผู้ดูแลขอ ต.ค. 2569)
   ป้ายคะแนน: ตรา + ชื่อสองฝั่ง แต้มตัวโต ฝั่งเราสีชมพู (ชีตไม่มีคะแนนรายเซต จึงไม่มีแถวเซต) */
/** รายการของโรงเรียนเรา: ชื่อเราอยู่ในคู่แข่งขัน หรือผลเป็นเหรียญ (ว่ายน้ำ ฯลฯ ไม่มีคู่ — ชีตกรอกเฉพาะเหรียญของเรา) */
function hasUs(r) { return Boolean(medalOf(r.score)) || teamSides(r.teams).some(function (s) { return r.isSelf(s); }); }
function pickFeatured(rows) {
  var mine = rows.filter(hasUs);
  function last(list, test) { for (var i = list.length - 1; i >= 0; i--) if (test(list[i])) return list[i]; return null; }
  return last(mine, function (r) { return r.status === 'live'; }) ||
    last(mine, function (r) { return r.score; }) ||
    last(rows, function (r) { return r.score; });
}
var CHIP_BIG = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 fs-14.5';
function renderFeatured(ctx) {
  var box = document.getElementById('featured');
  var r = ctx.sportId ? pickFeatured(ctx.rows) : null;
  box.hidden = !r;
  if (!r) return;
  var sides = teamSides(r.teams), sc = splitScore(r.score), gk = genderOf(r.kind);
  var status = r.status === 'live' ? statusChip('live', 'bg-live text-white dark:text-on-ink').replace(CHIP, CHIP_BIG) : resultChip(r, CHIP_BIG);
  var stage = [r.round, r.pool].filter(Boolean).join(' ');

  function side(name) {
    var info = sideInfo(ctx.data, name), self = r.isSelf(name);
    return '<div class="flex min-w-0 flex-col items-center gap-2.5 text-center">' +
      '<span class="rounded-full bg-surface p-1.5 shadow-panel">' + schoolCrest(info.m, 'size-24 max-[700px]:size-16 max-[400px]:size-14') + '</span>' +
      '<span class="font-display fs-21 leading-[1.25] max-[700px]:fs-16 ' + (self ? 'text-brand' : 'text-brand-strong') + '">' + esc(info.name) + '</span></div>';
  }
  function pts(k) {
    return '<span class="font-display fs-56 leading-none tabular-nums max-[700px]:fs-40 max-[400px]:fs-32 ' + (r.isSelf(sides[k]) ? 'text-brand' : 'text-brand-strong') + '">' + esc(sc[k]) + '</span>';
  }
  var board = sides.length === 2
    ? '<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 max-[560px]:gap-2">' + side(sides[0]) +
        '<div class="flex items-center gap-5 rounded-[18px] bg-surface px-7 py-4 shadow-panel max-[700px]:gap-3 max-[700px]:px-4 max-[700px]:py-3 max-[400px]:px-3">' +
          (sc ? pts(0) : '') +
          '<span class="rounded-full bg-surface-soft px-3 py-1 font-display fs-16 text-fg-soft max-[700px]:fs-14">' + (sc ? 'VS' : esc(r.score || 'VS')) + '</span>' +
          (sc ? pts(1) : '') +
        '</div>' + side(sides[1]) + '</div>'
    : medalOf(r.score)
    ? '<div class="flex items-center justify-center gap-4">' + medalCoin(medalOf(r.score), 'size-20 max-[700px]:size-14') +
        '<span class="font-display fs-32 leading-none text-brand-strong max-[700px]:fs-24">เหรียญ' + MEDAL_NAMES[medalOf(r.score)] + '</span></div>'
    : '<p class="m-0 text-center font-display fs-24 text-brand-strong">' + esc(r.teams || r.sport) + (r.score ? ' · ' + esc(r.score) : '') + '</p>';

  box.innerHTML =
    '<div class="flex flex-wrap items-center gap-x-6 gap-y-3">' +
      '<div class="flex min-w-0 items-center gap-3">' +
        '<span class="flex size-16 flex-none items-center justify-center rounded-full bg-surface-soft ring-1 ring-line max-[560px]:size-12">' + sportArt(r.sportId, 'size-[86%]') + '</span>' +
        '<div class="min-w-0">' +
          '<p class="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1"><span class="font-display fs-28 leading-[1.2] text-brand-strong max-[560px]:fs-22">' + esc(r.sport) + '</span>' +
            (gk.g ? '<span class="rounded-full px-3 py-0.5 fs-14 ' + GENDER_TONE[gk.g] + '">' + gk.g + '</span>' : '') + '</p>' +
          (gk.rest ? '<p class="m-0 fs-14.5 text-fg-soft">' + esc(gk.rest) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2 max-[700px]:ml-0">' +
        '<span class="flex items-center gap-2.5 fs-15 text-fg"><span class="flex size-9 items-center justify-center rounded-[10px] bg-brand-100 text-brand"><i class="icon-mask size-[18px]" data-ic="calendar"></i></span>' +
          esc(dayLabel(r.day)) + (isToday(r.day) ? ' <span class="text-fg-mute">(วันนี้)</span>' : '') + '</span>' +
        (r.time ? '<span class="flex items-center gap-2 fs-15 text-fg"><span class="text-brand">' + CLOCK + '</span><span class="font-mono tabular-nums">' + esc(r.time) + '</span> น.</span>' : '') +
        status +
        (r.liveUrl ? '<a class="inline-flex items-center gap-2 rounded-full bg-live px-4 py-2 fs-14.5 text-white no-underline hover:opacity-90" href="' + esc(r.liveUrl) + '" target="_blank" rel="noopener">' + LIVE_DOT + 'ดูถ่ายทอดสด</a>' : '') +
      '</div>' +
    '</div>' +
    '<div class="mt-5 rounded-[18px] bg-surface-soft px-5 py-6 max-[560px]:mt-4 max-[560px]:px-2.5 max-[560px]:py-4">' +
      (stage ? '<p class="m-0 mb-4 text-center font-display fs-17 text-brand-strong">' + esc(stage) + '</p>' : '') +
      board +
    '</div>';
  paintUiIcons(box);
}

/* ---------- สไลด์วนไม่รู้จบ (ผลที่ชนะ + นักกีฬา MVP) ----------
   แบบ carousel ใน gallery.js: วาดชุดเดียวกันสามรอบต่อกัน อยู่ชุดกลางเสมอ — เลื่อนเลยขอบชุดกลาง แอนิเมชันจบแล้วกระโดดกลับตำแหน่งเดียวกันในชุดกลาง
   เห็นทีละ perView() ใบ ใบแรกชิดซ้ายกล่อง · การ์ดเท่ากับช่องที่กล่องรับได้ก็ยังเลื่อน (ผู้ดูแลขอ — 4 ใบบนจอ 4 ช่องเคยอยู่นิ่ง ดูเหมือนค้าง)
   การ์ดน้อยกว่าช่อง = ชุดเดียวอยู่นิ่ง (เลื่อนไปจะเห็นใบเดียวกันซ้ำสองที่พร้อมกัน)
   เลื่อนเองทีละใบทุก ms ไม่หยุดตอนเมาส์วาง (แบบเดียวกับหน้าประมวลภาพ) · ปัด / ลูกศรคีย์บอร์ด = นับเวลาใหม่จากตรงนั้น
   หยุดเมื่อ: ไล่ด้วยคีย์บอร์ด · สลับแท็บ · เครื่องตั้งลดการเคลื่อนไหว (ไม่เลื่อนเองเลย)
   ใบที่อยู่นอกกล่องเป็น inert: กด Tab ไม่หลุดไปโดน และโปรแกรมอ่านหน้าจอข้าม */
function reducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
/**
 * @param {object} o - { box, viewport, track: id ขององค์ประกอบใน HTML · ms · perView(viewport) = จำนวนใบที่เห็นพร้อมกัน (ไม่ใส่ = 1) }
 * @returns {{ set: function(Array, function(*, number, number): string) }} set(รายการ, slide(รายการ, ลำดับ, k)) — k = ลำดับใน track ใช้เป็น data-k
 */
function loopCarousel(o) {
  var box = document.getElementById(o.box), vp = document.getElementById(o.viewport), track = document.getElementById(o.track);
  var perView = o.perView || function () { return 1; };
  var s = { items: [], slide: null, n: 0, per: 1, pos: 0, settle: null, timer: null, keyboard: false };
  function looping() { return s.n > 1 && s.n >= s.per; }

  /** ใบที่ s.pos ชิดซ้ายกล่อง · animate=false = กระโดดทันที (วนกลับชุดกลาง / ปรับขนาดจอ) */
  function layout(animate) {
    var first = track.children[0], cur = track.children[s.pos];
    var x = looping() && cur ? first.offsetLeft - cur.offsetLeft : 0;
    if (!animate || reducedMotion()) {
      track.style.transition = 'none';
      track.style.transform = 'translateX(' + x + 'px)';
      void track.offsetHeight;          // บังคับใช้ตำแหน่งนี้ก่อนเปิดแอนิเมชันกลับ
      track.style.transition = '';
    } else {
      track.style.transform = 'translateX(' + x + 'px)';
    }
    mark();
  }
  /** ใบที่อยู่ในกล่อง data-on=true (MVP ใช้จางใบที่เลื่อนออก) · ที่เหลือ inert */
  function mark() {
    Array.prototype.forEach.call(track.children, function (el, k) {
      var on = !looping() || (k >= s.pos && k < s.pos + s.per);
      el.dataset.on = String(on);
      el.inert = !on;
    });
  }
  /** ออกนอกชุดกลางแล้ว → กลับตำแหน่งเดียวกันในชุดกลางแบบไม่มีแอนิเมชัน */
  function normalize() {
    var n = s.n;
    if (looping() && (s.pos < n || s.pos >= 2 * n)) { s.pos = n + ((s.pos % n) + n) % n; layout(false); }
  }
  function go(pos) {
    normalize();
    s.pos = pos;
    layout(true);
    if (reducedMotion()) normalize();
    // ตัวสำรองของ transitionend (บางครั้งเบราว์เซอร์ไม่ส่งมาเมื่อกดซ้อนกลางทาง)
    clearTimeout(s.settle);
    s.settle = setTimeout(normalize, 600);
    autoplay();
  }
  function step(d) { normalize(); go(s.pos + d); }
  /** เริ่มนับเวลาใหม่ — ครบ ms แล้วเลื่อนไปใบถัดไป (ช่วงที่หยุดอยู่ รอรอบถัดไปแทน) */
  function autoplay() {
    clearTimeout(s.timer);
    if (!looping() || reducedMotion()) return;
    s.timer = setTimeout(function () {
      if (s.keyboard || document.hidden) autoplay();
      else step(1);
    }, o.ms);
  }
  /** วาดใหม่ทั้งชุด · start = ใบที่จะอยู่ซ้ายสุด (ปรับขนาดจอแล้ววาดใหม่ ไม่เด้งกลับใบแรก) */
  function render(start) {
    var n = s.n, copies = looping() ? 3 : 1, html = '';
    track.style.setProperty('--per', s.per);
    for (var c = 0; c < copies; c++) s.items.forEach(function (it, i) { html += s.slide(it, i, c * n + i); });
    track.innerHTML = html;
    s.pos = looping() ? n + start : 0;
    mark();
    requestAnimationFrame(function () { layout(false); });
    autoplay();
  }

  // ผูกการปัด/คีย์บอร์ดครั้งเดียว (องค์ประกอบอยู่ใน HTML ไม่ได้วาดใหม่)
  track.addEventListener('transitionend', function (e) { if (e.target === track) normalize(); });
  vp.addEventListener('focusin', function (e) { s.keyboard = e.target.matches(':focus-visible'); });
  vp.addEventListener('focusout', function () { s.keyboard = false; });
  box.addEventListener('keydown', function (e) {
    if (!looping()) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // ปัดซ้าย/ขวา (นิ้วหรือเมาส์ลาก) — ลากไม่ถึง 40px ถือเป็นการแตะ
  var startX = null;
  vp.addEventListener('pointerdown', function (e) { startX = e.clientX; });
  vp.addEventListener('pointerup', function (e) {
    if (startX == null || !looping()) return;
    var dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });
  // จอเปลี่ยนขนาดจนจำนวนใบที่เห็นเปลี่ยน: วาดใหม่ (เลื่อน ↔ อยู่นิ่ง จำนวนชุดไม่เท่ากัน) · ไม่เปลี่ยน = จัดตำแหน่งใหม่พอ
  window.addEventListener('resize', function () {
    if (!s.n) return;
    var per = Math.max(1, perView(vp));
    if (per === s.per) { layout(false); return; }
    var start = looping() ? s.pos % s.n : 0;
    s.per = per;
    render(start);
  });

  return {
    set: function (items, slide) {
      s.items = items; s.slide = slide; s.n = items.length;
      s.per = Math.max(1, perView(vp));
      s.keyboard = false;
      render(0);
    }
  };
}

/* ---------- ผลที่ชนะของวันที่เลือก ----------
   แถวเดียวเลื่อนวนเอง (ผู้ดูแลขอ ต.ค. 2569 — เดิมเป็นกริดขึ้นแถวใหม่ ชนะหลายรายการแล้วหน้ายาวไม่จบ)
   ล่าสุดก่อน: ผลใหม่ที่เพิ่งลงชีตขึ้นเป็นใบแรก · เห็นพร้อมกันตามความกว้างกล่อง (ใบละอย่างน้อย WIN_MIN px — จอมือถือใบเดียว)
   การ์ดละหนึ่งแมตช์ (ผู้ดูแลขอให้ไม่มีข้อความถูกตัด "…"): ทุกบรรทัดตัดบรรทัดได้
   หัวการ์ดพื้นเทาอ่อน (ชมพูเหลือแค่ป้ายชนะ — ผู้ดูแลว่าชมพูเยอะไป): มาสคอต · ชื่อกีฬา · ประเภท (ได้ความกว้างเต็ม ไม่ต้องแบ่งที่กับป้าย)
   หัวการ์ดชิดขวามีป้าย "• ชนะ" · กลาง: แถบสกอร์ scoreStrip() "PDS (ตรา) 69 - 15 (ตรา) KUS" แบบเดียวกับหน้าแรก (ผู้ดูแลขอ ต.ค. 2569 — เดิมแต้มตัวโต + "พบ ตรา ชื่อคู่แข่ง")
   ท้าย: รายชื่อนักกีฬา WIN_NAMES คนแรก ที่เหลือกด "ดูอีก N คน" เปิดต่อท้ายในคอลัมน์เดียวกัน แล้วกด "ย่อรายชื่อ" ปิดกลับได้
   (ผู้ดูแลขอ ต.ค. 2569 — เดิมเป็น details เปิดแล้วปุ่มหายไป ย่อกลับไม่ได้) · ปุ่มผูกครั้งเดียวที่ winList (toggleNames) */
var WIN_NAMES = 5;
var WIN_MIN = 250, WIN_GAP = 12, WIN_MS = 4000;
var winCar = null;
/** ตัดบรรทัดได้เฉพาะที่ช่องว่างระหว่างคำ — การ์ดแคบ เบราว์เซอร์ตัดคำไทยกลางคำ ("สกุลศิริ / ทิวากร") */
function wordsNoBreak(text) {
  return String(text || '').split(/\s+/).filter(Boolean).map(function (w) { return '<span class="whitespace-nowrap">' + esc(w) + '</span>'; }).join(' ');
}
function winName(n, i) {
  var m = n.match(NAME_PREFIX), prefix = m ? m[1] : '', name = m ? n.slice(m[0].length) : n;
  return '<li class="flex items-baseline gap-2.5">' +
    '<span class="w-4 flex-none text-right font-mono fs-12.5 text-fg-mute tabular-nums">' + (i + 1) + '</span>' +
    '<span class="min-w-0 truncate" title="' + esc(n) + '">' + (prefix ? esc(prefix) + ' ' : '') + esc(name) + '</span></li>';
}
/** ใบหนึ่งในแถวเลื่อน: กว้าง = (กล่อง − ช่องไฟ) / จำนวนใบที่เห็น (--per ตั้งโดย loopCarousel · auto-cols ของ #winList) · ใบในแถวสูงเท่ากัน
    ใบละ 3 แถวของกริด winList (subgrid: หัว · สกอร์ · รายชื่อ) — หัวทุกใบสูงเท่าใบที่ประเภทยาวสุด แถบสกอร์/รายชื่อจึงตรงแนวกันทุกใบ
    (ผู้ดูแลขอ ต.ค. 2569 — ประเภทยาวตัดเป็น 3 บรรทัดแล้วแถบสกอร์ใบนั้นต่ำกว่าใบอื่น)
    หัวการ์ดตัวเล็กลง (ชื่อกีฬา 17 · ประเภท/ป้ายชนะ 12.5 · มาสคอต 40px) ให้ประเภทยาว ๆ เหลือสองบรรทัด หัวไม่สูงเกิน (ผู้ดูแลขอ ต.ค. 2569)
    ประเภทไม่เกิน 3 บรรทัด (ประเภทจริงยาวสุดก็ 3 บรรทัด): กันแถวที่วางรายชื่อนักกีฬาผิดลงช่อง "ประเภท" (หมากกระดาน 24 ต.ค.)
    ทำหัวใบนั้นยาวครึ่งจอ แล้วหัวทุกใบในแถวยืดตาม · ข้อความเต็มอยู่ใน title
    ตัดแค่แนวตั้ง (overflow-y-clip ไม่ใช่ line-clamp): คำยาว "มัธยมศึกษาตอนปลาย" กว้างเกินช่องบนการ์ดแคบ line-clamp ตัดท้ายคำทิ้ง
    grid-cols-1 (= minmax(0,1fr)) ต้องมี: คอลัมน์ auto ขยายตามเนื้อหา แถบสกอร์/ป้ายชนะล้นขอบการ์ดแล้วโดนตัด */
function winCard(r, i, n, k, data, allDays) {
  var names = athleteNames(r.athletes), rest = names.slice(WIN_NAMES);
  // ชื่อบรรทัดเดียวเสมอ (ผู้ดูแลขอ ต.ค. 2569): ตัวเล็กลงพอให้ชื่อยาวทั่วไปพอดีการ์ด · ยาวเกินจริง ๆ ตัดท้ายเป็น … (ชื่อเต็มอยู่ใน title)
  var LIST = 'm-0 flex list-none flex-col gap-1 p-0 fs-13 leading-[1.45] text-fg';
  return '<li class="row-span-3 grid min-w-0 grid-cols-1 grid-rows-subgrid" data-k="' + k + '" aria-roledescription="สไลด์" aria-label="' + (i + 1) + ' จาก ' + n + '">' +
    '<article class="row-span-3 grid min-w-0 grid-cols-1 grid-rows-subgrid overflow-hidden rounded-[16px] border border-line bg-surface">' +
    '<div class="flex items-start gap-2.5 bg-surface-soft px-4 py-3">' + sportArt(r.sportId, 'size-10') +
      '<div class="min-w-0 flex-1">' +
        '<p class="m-0 font-display fs-17 leading-[1.25] text-brand-strong">' + esc(r.sport) + '</p>' +
        (r.kind ? '<p class="m-0 max-h-[4.2em] overflow-y-clip fs-12.5 leading-[1.4] text-fg-soft" title="' + esc(r.kind) + '">' + wordsNoBreak(r.kind) + '</p>' : '') +
        (allDays ? '<p class="m-0 fs-13 leading-[1.4] text-fg-mute">' + esc(dayLabel(r.day)) + '</p>' : '') +
      '</div>' +
      // การ์ดเหรียญ: ป้ายมุมเป็นรูปเหรียญเล็ก — ข้อความ "เหรียญทองแดง" กว้างจนช่องประเภท (ว่ายน้ำชื่อยาว) เหลือแคบ ชื่อเหรียญอยู่ในแถบกลางแล้ว
      (medalOf(r.score)
        ? '<span class="flex-none pt-0.5" title="' + winLabel(r) + '">' + medalCoin(medalOf(r.score), 'size-6') + '</span>'
        : '<span class="inline-flex flex-none items-center gap-1 pt-0.5 fs-12.5 font-semibold text-brand-ink"><span class="size-2 rounded-full bg-current" aria-hidden="true"></span>' + winLabel(r) + '</span>') +
    '</div>' +
    '<div class="px-4 py-3.5">' + (medalOf(r.score) ? medalStrip(r.score) : scoreStrip(data, r.teams, r.score, r.isSelf)) + '</div>' +
    (names.length ? '<div class="border-t border-line px-4 pt-3 pb-3.5">' +
      '<p class="m-0 mb-1.5 fs-13 text-fg-mute">นักกีฬา · ' + names.length + ' คน</p>' +
      '<ol class="' + LIST + '">' + names.slice(0, WIN_NAMES).map(winName).join('') + '</ol>' +
      (rest.length ? '<ol class="' + LIST + ' mt-1" hidden data-more>' + rest.map(function (n, i) { return winName(n, i + WIN_NAMES); }).join('') + '</ol>' +
        '<button class="group/more mt-1.5 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 pl-[26px] font-body fs-13.5 text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="button" aria-expanded="false" data-names-toggle>' +
          '<span class="group-aria-expanded/more:hidden">ดูอีก ' + rest.length + ' คน</span><span class="hidden group-aria-expanded/more:inline">ย่อรายชื่อ</span>' +
          '<svg class="flex-none transition-transform duration-150 group-aria-expanded/more:rotate-180 motion-reduce:transition-none" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' : '') +
    '</div>' : '') +
  '</article></li>';
}
/** ปุ่ม "ดูอีก N คน" / "ย่อรายชื่อ" ในการ์ดผลที่ชนะ — การ์ดถูกวาดใหม่ (และทำซ้ำสามชุดตอนเลื่อนวน) จึงผูกที่ track ทีเดียว */
function toggleNames(e) {
  var btn = e.target.closest('[data-names-toggle]');
  if (!btn) return;
  var open = btn.getAttribute('aria-expanded') !== 'true';
  btn.previousElementSibling.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}
function renderWins(ctx) {
  // ชีตเรียงวัน/เวลาจากเก่าไปใหม่ — กลับด้านให้ล่าสุดก่อน
  // ชนะคู่แข่ง + ได้เหรียญ (ว่ายน้ำ ฯลฯ — ผู้ดูแลขอ ต.ค. 2569)
  var wins = ctx.dayRows.filter(function (r) { return isWinOrMedal(r, r.isSelf); }).reverse();
  var chip = document.getElementById('winsDay');
  chip.hidden = !ctx.day;
  chip.textContent = ctx.day ? (isToday(ctx.day) ? 'วันนี้ · ' : '') + dayLabel(ctx.day) : '';
  document.getElementById('winsTitle').textContent = 'สรุปผลการแข่งขัน' + ctx.sportName + 'ที่ชนะ' + (ctx.day ? (isToday(ctx.day) ? 'ในวันนี้' : '') : 'ทุกวัน');
  // ไม่มีบรรทัด "รวม N รายการ" ที่หัวการ์ด (ผู้ดูแลขอเอาออก ต.ค. 2569)
  document.getElementById('winViewport').hidden = !wins.length;
  var empty = document.getElementById('winEmpty');
  empty.hidden = Boolean(wins.length);
  empty.textContent = 'ยังไม่มีรายการ' + ctx.sportName + 'ที่ชนะ' + (ctx.day ? (isToday(ctx.day) ? 'ในวันนี้' : 'ในวันนี้ของการแข่งขัน') : '');
  if (!winCar) document.getElementById('winList').addEventListener('click', toggleNames);
  winCar = winCar || loopCarousel({
    box: 'wins', viewport: 'winViewport', track: 'winList', ms: WIN_MS,
    perView: function (vp) { return Math.floor((vp.clientWidth + WIN_GAP) / (WIN_MIN + WIN_GAP)); }
  });
  winCar.set(wins, function (r, i, k) { return winCard(r, i, wins.length, k, ctx.data, !ctx.day); });
}

/* ---------- สรุปผลของวันที่เลือก ----------
   ประโยคสรุปของโรงเรียนเรา (ลงแข่ง/ชนะ/แพ้/เสมอ นับจากแมตช์ที่มีผลเป็นตัวเลข) + ตัวเลขสามช่องตามสถานะผล
   จบการแข่งขัน / เสร็จสิ้น / ยังไม่เป็นทางการ — สีตัวเลขตรงกับป้ายในตาราง (RESULT_STATUS) */
var SUM_TILES = [
  { key: 'ended', num: 'text-ended' },
  { key: 'finished', num: 'text-done-ink' },
  { key: 'unofficial', num: 'text-upcoming' }
];
function renderSummary(ctx) {
  var n = { ended: 0, finished: 0, unofficial: 0, pending: 0 }, o = { win: 0, loss: 0, draw: 0 }, mine = 0;
  ctx.dayRows.forEach(function (r) {
    var k = resultStatusOf(r); if (k) n[k]++;
    if (hasUs(r)) mine++;
    var w = matchOutcome(r, r.isSelf); if (w) o[w]++;
  });
  document.getElementById('sumTitle').textContent = 'สรุปผลการแข่งขัน' + (ctx.sportName || '');
  document.getElementById('sumDay').textContent = ctx.day ? dayLabel(ctx.day) + (isToday(ctx.day) ? ' (วันนี้)' : '') : 'ทุกวัน';
  var decided = o.win + o.loss + o.draw;
  document.getElementById('sumText').innerHTML = mine
    ? 'โรงเรียนเราลงแข่ง <b class="font-semibold">' + mine + '</b> รายการ' +
      (decided ? ' · ประกาศผลแล้ว ชนะ <b class="font-semibold text-brand">' + o.win + '</b> แพ้ <b class="font-semibold">' + o.loss + '</b>' + (o.draw ? ' เสมอ <b class="font-semibold">' + o.draw + '</b>' : '') : ' · ยังไม่มีผลที่ประกาศ')
    : 'ยังไม่มีรายการแข่งขัน' + ctx.sportName + 'ของโรงเรียนเรา' + (ctx.day ? 'ในวันนี้' : '');
  document.getElementById('daySummary').innerHTML = SUM_TILES.map(function (t) {
    return '<div class="min-w-0 rounded-[14px] border border-line bg-surface-soft px-3 py-2.5">' +
      '<span class="block font-display fs-28 leading-[1.15] tabular-nums ' + t.num + '">' + n[t.key] + '</span>' +
      '<span class="block fs-14 leading-[1.35] text-fg-soft">' + RESULT_STATUS[t.key].label + '</span>' +
    '</div>';
  }).join('');
}

/* ---------- ภาพบรรยากาศของวันที่เลือก ----------
   ภาพมาจาก day-photos.js (Drive ของหน้าประมวลภาพ · สำรองด้วยแท็บภาพในชีต)
   ครบ 5 ภาพขึ้นไป = ภาพใหญ่ซ้าย + เล็กสี่ (จอแคบ ภาพใหญ่เต็มแถว เล็กเป็นกริด 2×2) · น้อยกว่านั้นเรียงเท่ากัน
   เลือกกีฬาอยู่ = เฉพาะภาพของกีฬานั้น (ชื่อโฟลเดอร์/ชื่อกีฬาของภาพ → sportIdOf)
   สุ่มภาพครั้งเดียวต่อ วัน×กีฬา วาดซ้ำชุดเดิม (ข้อมูลซิงก์ใหม่) ได้ภาพเดิม ไม่สลับใต้สายตาผู้อ่าน */
var HL_COUNT = 5;
var hl = { key: null, picks: [], token: 0 };
/* ปิดการ์ดนี้ไว้ (ผู้ดูแลขอ ต.ค. 2569) — การ์ดใน matches.html มี hidden อยู่แล้วจึงไม่ขึ้นเลย
   day-photos.js จึง import ตอนเปิดใช้เท่านั้น ไม่ให้หน้าไปอ่านโฟลเดอร์ Drive ทั้งที่ไม่ได้แสดง · เปิดกลับ = true */
var SHOW_HIGHLIGHT = false;
var dayPhotos = null;
/** ตัวกรองชื่อกีฬาของภาพ ตามกีฬาที่เลือก · ไม่ได้เลือก = null (ทุกภาพ) */
function sportTest(ctx) {
  return ctx.sportId ? function (name) { return sportIdOf(name) === ctx.sportId; } : null;
}
var EVEN_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4 max-[700px]:grid-cols-2' };
/** วันของภาพ: วันที่เลือกอยู่ · ดูทุกวัน = วันล่าสุดในรายการแข่งที่มีภาพแล้ว (ของกีฬาที่เลือก) */
function highlightIso(ctx, units) {
  if (ctx.day) return ctx.day.iso || '';
  var withPhotos = ctx.photos.photoDates(units, ctx.data, sportTest(ctx));
  var days = (ctx.data.days || []).filter(function (d) { return d.iso && withPhotos.indexOf(d.iso) > -1; });
  return days.length ? days[days.length - 1].iso : '';
}
/** ภาพไม่ซ้ำ (ลิงก์เดียวกันนับครั้งเดียว) สลับลำดับแบบสุ่ม (Fisher–Yates) */
function shuffledUnique(list) {
  var seen = {}, out = list.filter(function (p) {
    if (!p.link || seen[p.link]) return false;
    return (seen[p.link] = true);
  });
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = out[i];
    out[i] = out[j]; out[j] = t;
  }
  return out;
}

function renderHighlight(ctx) {
  if (!SHOW_HIGHLIGHT) return;
  var token = ++hl.token;
  (dayPhotos || (dayPhotos = import('./day-photos.js'))).then(function (m) {
    ctx = Object.assign({}, ctx, { photos: m });
    return m.photoUnits;
  }).then(function (units) {
    if (token !== hl.token) return;
    var iso = highlightIso(ctx, units);
    var box = document.getElementById('highlight');
    // ยังไม่มีวันไหนมีภาพ: มีโฟลเดอร์ Drive = การ์ดขึ้นข้อความรอภาพ · ไม่มีแหล่งภาพเลย = ซ่อนทั้งการ์ด
    if (!iso) { box.hidden = !units; if (!box.hidden) showPhotos([], ctx.day, '', ctx); return; }
    ctx.photos.photosOfDay(units, ctx.data, iso).then(function (list) {
      if (token !== hl.token) return;
      var test = sportTest(ctx);
      if (test) list = list.filter(function (p) { return test(p.sportText || ''); });
      var day = (ctx.data.days || []).filter(function (d) { return d.iso === iso; })[0] || ctx.day;
      box.hidden = !list.length && !units;
      if (!box.hidden) showPhotos(list, day, iso, ctx);
    });
  });
}

function photoTile(p, href, big, cls) {
  var w = big ? 960 : 480, fb = imageFallbackAt(p.link, w);
  var label = p.caption && p.caption !== p.sportText ? p.caption : (p.sportText || '');
  return '<a class="group/ph relative block overflow-hidden rounded-[14px] bg-surface-soft ' + cls + '" href="' + href + '">' +
    '<img class="block size-full object-cover transition-transform duration-300 group-hover/ph:scale-[1.04] motion-reduce:transition-none" src="' + esc(imageUrlAt(p.link, w)) + '"' +
      (fb ? ' data-fb="' + esc(fb) + '"' : '') + ' alt="' + esc(label || 'ภาพการแข่งขัน') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
    (p.sportText ? '<span class="pointer-events-none absolute bottom-2 left-2 rounded-full bg-[oklch(16%_0.02_260/.62)] px-2.5 py-0.5 fs-12.5 text-white">' + esc(p.sportText) + '</span>' : '') +
  '</a>';
}

function showPhotos(list, day, iso, ctx) {
  var key = iso + '|' + (ctx.sportId || '');
  if (key !== hl.key || !hl.picks.length) { hl.picks = shuffledUnique(list).slice(0, HL_COUNT); hl.key = key; }
  var picks = hl.picks;
  var query = [iso ? 'day=' + encodeURIComponent(iso) : '', ctx.sportId ? 'sport=' + encodeURIComponent(ctx.sportId) : ''].filter(Boolean).join('&');
  var href = 'gallery.html' + (query ? '?' + query : '');
  document.getElementById('hlTitle').textContent = 'ภาพบรรยากาศ' + (ctx.sportName || 'การแข่งขัน');
  document.getElementById('hlDay').textContent = day ? dayLabel(day) + (isToday(day) ? ' (วันนี้)' : '') : '';
  document.getElementById('hlAll').href = href;
  var grid = document.getElementById('hlGrid');
  grid.hidden = !picks.length;
  if (picks.length >= HL_COUNT) {
    grid.className = 'grid grid-cols-4 gap-2.5 max-[700px]:grid-cols-2 max-[560px]:gap-2';
    grid.innerHTML = picks.map(function (p, i) {
      return photoTile(p, href, i === 0, i === 0 ? 'col-span-2 row-span-2 aspect-[4/3] max-[700px]:row-span-1' : 'aspect-[4/3]');
    }).join('');
  } else {
    grid.className = 'grid gap-2.5 max-[560px]:gap-2 ' + (EVEN_COLS[picks.length] || '');
    grid.innerHTML = picks.map(function (p) { return photoTile(p, href, picks.length < 3, picks.length === 1 ? 'aspect-[16/8]' : 'aspect-[4/3]'); }).join('');
  }
  var empty = document.getElementById('hlEmpty');
  empty.hidden = Boolean(picks.length);
  empty.textContent = 'ยังไม่มีภาพ' + (ctx.sportName || 'การแข่งขัน') + (!day ? '' : isToday(day) ? 'ของวันนี้' : 'ของวันที่ ' + day.date) + ' — ฝ่ายประชาสัมพันธ์จะทยอยลงภาพระหว่างวัน';
}

/* ---------- นักกีฬา MVP ----------
   แท็บ "MVP" ในชีต อ่านครั้งเดียวตอนเปิดหน้า แยกจากข้อมูลหลัก (ช้า/พังก็ไม่ถ่วงตาราง)
   วันที่เลือก = คนของวันนั้น (ไม่มีวันที่ = ขึ้นทุกวัน) · ดูทุกวัน = ล่าสุดก่อน ไม่เกิน STAR_MAX คน
   หน้าตา (ผู้ดูแลขอ ต.ค. 2569): การ์ดแนวนอน รูปวงกลม + ป้าย MVP (เคยลองการ์ดรูปใหญ่ ผู้ดูแลว่าเด่นเกินไป)
   การเลื่อน "แบบหน้าประมวลภาพ" (ผู้ดูแลขอ — ตัวต้นแบบคือ carousel ใน gallery.js):
   ทีละใบเต็มกล่อง (เคยมีใบข้างจางโผล่สองฝั่ง ผู้ดูแลว่าผังไม่สอดคล้องกับการ์ดสรุปข้าง ๆ) · เลื่อนเองทุก STAR_MS (ไม่มีปุ่มหยุด/เล่น)
   วนไม่รู้จบ / หยุดเมื่อไหร่: ดู loopCarousel (ใช้ร่วมกับผลที่ชนะ) */
var STAR_MAX = 12;
var STAR_MS = 5000;
var starsReady = loadStars();
var starCar = null;

/** ประเภทในชีตมักขึ้นต้นด้วยชื่อกีฬาซ้ำ ("กรีฑา : วิ่ง 100 เมตร …") ตัดออก ชื่อกีฬาอยู่บนป้ายของการ์ดแล้ว */
function starKind(s) {
  var k = String(s.kind || '');
  return s.sportText && k.indexOf(s.sportText) === 0 ? k.slice(s.sportText.length).replace(/^\s*[:：\-–—]\s*/, '') : k;
}

/** รูปนักกีฬาในวงกลม · ไม่มีรูป = มาสคอตของกีฬานั้นบนพื้นอ่อน */
function starPhoto(s) {
  if (!s.photo) {
    return '<span class="flex size-full items-center justify-center bg-navy-100 p-2">' +
      (sportMascotImg(s.sportId, 'size-full object-contain') || sportIcon(s.sportId, 'size-1/2 text-brand-strong')) + '</span>';
  }
  var fb = imageFallbackAt(s.photo, 300);
  return '<img class="block size-full object-cover object-[50%_25%]" data-sport="' + esc(s.sportId) + '" src="' + esc(imageUrlAt(s.photo, 300)) + '"' +
    (fb ? ' data-fb="' + esc(fb) + '"' : '') + ' alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />';
}

/** การ์ดแนวนอนตามภาพแบบที่ผู้ดูแลส่งมา (ต.ค. 2569 รอบที่สาม — ขอให้ตัวอักษรใหญ่กว่าในภาพ):
    ซ้าย = รูปมุมมนในกรอบไล่สีชมพู–น้ำเงิน (โทนเดียวกับกรอบมาสคอตในป๊อปอัปถ่ายทอดสด) + ป้าย "👑 MVP" สีทองไล่ส้มคร่อมขอบล่างกลางรูป
           (ผู้ดูแลขอทำกรอบใหม่ ต.ค. 2569 — เดิมกรอบฟ้าหนา ป้ายมุมซ้ายบนบังหน้า · ไม่มีประกาย ป้ายไม่มีเงาฟุ้ง ผู้ดูแลขอเอาออก)
    ขวา = ชนิดกีฬา · ชื่อตัวโต · รายการแข่ง · โรงเรียน · ตำแหน่ง
    มุมขวาล่าง = ส่วนโค้งฟ้าอ่อน + แถบเฉียงน้ำเงิน/ชมพูสองเส้น (สีเดียวกับกรอบรูป — เดิมฟ้า/ส้มอมแดง) (ตกแต่งตามภาพแบบ อยู่หลังเนื้อหา)
    (เคยลอง: การ์ดรูปใหญ่ / ช่อมะกอกทอง / รูปบนแผ่นชมพูเหลื่อม — ผู้ดูแลว่าเด่นเกินไป / ดูแก่) */
/* กราฟิกเป็นไฟล์ภาพ ไม่วาด SVG เอง (ผู้ดูแลขอ): มงกุฎ = Microsoft Fluent Emoji 3D (MIT) ชุดเดียวกับ trophy.webp
   ย่อเป็น 96px ด้วย cwebp อยู่ที่ assets/medals/ */
// มงกุฎอยู่ในวงขาว — มงกุฎทองบนพื้นป้ายทองตรง ๆ กลืนกันจนมองไม่ออก
var CROWN = '<span class="-my-1 -ml-0.5 flex size-7 flex-none items-center justify-center rounded-full bg-white max-[560px]:size-6">' +
  '<img class="size-5 max-[560px]:size-4" src="assets/medals/crown.webp" alt="" width="96" height="96" decoding="async" /></span>';
function starSlide(s, i, n, k, isSelf) {
  var self = s.school && isSelf(s.school);
  var kind = starKind(s);
  var meta = [s.school, s.role ? 'ตำแหน่ง ' + s.role : ''].filter(Boolean);
  return '<li class="motion-ok flex-none transition-opacity duration-500 data-[on=false]:opacity-45 motion-reduce:transition-none w-full" data-k="' + k + '" aria-roledescription="สไลด์" aria-label="' + (i + 1) + ' จาก ' + n + '">' +
    '<figure class="relative m-0 flex h-full items-center gap-6 overflow-hidden rounded-[22px] border border-navy-100 bg-surface py-5 pr-5 pl-7 max-[560px]:gap-4 max-[560px]:py-4 max-[560px]:pr-4 max-[560px]:pl-5">' +
      // ตกแต่งมุมขวาล่าง (ตามภาพแบบ) · จอ ≤560px ซ่อนแถบเฉียง ข้อความยาวถึงมุมแล้วทับกัน
      '<span class="pointer-events-none absolute -right-16 -bottom-28 size-56 rounded-full bg-navy-100/40" aria-hidden="true"></span>' +
      '<span class="pointer-events-none absolute right-11 -bottom-3 h-20 w-3 skew-x-[-38deg] rounded-sm bg-[oklch(52%_0.19_268/.75)] max-[560px]:hidden" aria-hidden="true"></span>' +
      '<span class="pointer-events-none absolute right-4 -bottom-3 h-20 w-3 skew-x-[-38deg] rounded-sm bg-[oklch(70%_0.19_357/.85)] max-[560px]:hidden" aria-hidden="true"></span>' +
      // กรอบ = พื้นไล่สีหนา 3px + ขอบในสีพื้นการ์ด 3px คั่นรูปกับกรอบ (รูปพื้นขาว/โปร่งใสจะได้ไม่กลืนกับสีกรอบ)
      '<span class="relative mb-2 size-[116px] flex-none max-[560px]:size-[96px]">' +
        '<span class="block size-full rounded-[26px] bg-[linear-gradient(140deg,oklch(70%_0.19_357),oklch(52%_0.19_268))] p-[3px] shadow-[0_8px_20px_oklch(52%_0.19_268/.18)]">' +
          '<span class="block size-full overflow-hidden rounded-[23px] border-[3px] border-surface bg-navy-100">' + starPhoto(s) + '</span>' +
        '</span>' +
        // ป้าย MVP สีทองไล่ส้ม (ผู้ดูแลขอ ต.ค. 2569 — ป้ายกรมท่าเดิม "ไม่สวยแถมไม่โดดเด่น" กลืนกับชื่อสีกรมท่า แนวตามภาพตัวอย่างป้ายส้มทอง)
        // ตัวหนังสือขาวมีเงาส้มเข้มคม ๆ (ไม่ฟุ้ง) รองไว้ให้อ่านออกบนพื้นทอง · ไฮไลต์ขาวขอบบนให้ดูเป็นเหรียญมันวาว · มงกุฎตัวโตล้นขอบป้ายขึ้นไป
        '<span class="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,oklch(88%_0.15_92),oklch(76%_0.17_70)_55%,oklch(66%_0.19_48))] py-1 pr-3 pl-1.5 font-body fs-16 leading-none font-extrabold tracking-[.06em] whitespace-nowrap text-white ring-[3px] ring-surface shadow-[inset_0_1.5px_0_oklch(98%_0.06_95/.9),inset_0_-2px_0_oklch(55%_0.16_45/.5)] [text-shadow:0_1px_0_oklch(45%_0.14_40)] max-[560px]:fs-14">' + CROWN + 'MVP</span>' +
      '</span>' +
      '<figcaption class="relative flex min-w-0 flex-1 flex-col gap-1">' +
        // ชื่อกีฬาล้วน ไม่มีมาสคอต/เส้นคั่นนำหน้า (ผู้ดูแลขอ)
        (s.sportText ? '<span class="fs-16 text-fg-mute">' + esc(s.sportText) + '</span>' : '') +
        '<p class="m-0 font-display fs-28 leading-[1.2] max-[560px]:fs-23 ' + (self ? 'text-brand' : 'text-brand-strong') + '">' + wordsNoBreak(s.name) + '</p>' +
        (kind ? '<p class="m-0 line-clamp-2 fs-16.5 leading-[1.45] text-fg-soft max-[560px]:fs-15">' + esc(kind) + '</p>' : '') +
        (meta.length ? '<p class="m-0 fs-14.5 leading-[1.45] text-fg-mute">' + meta.map(function (t) { return '<span class="whitespace-nowrap">' + esc(t) + '</span>'; }).join(' · ') + '</p>' : '') +
        (s.feat ? '<span class="mt-1 self-start rounded-full bg-brand-100 px-2.5 py-0.5 fs-13.5 text-brand-ink">' + esc(s.feat) + '</span>' : '') +
      '</figcaption>' +
    '</figure>' +
  '</li>';
}

function renderStars(ctx) {
  starsReady.then(function (stars) {
    var box = document.getElementById('stars');
    box.hidden = !stars;
    if (!stars) return;
    var day = ctx.day;
    var pool = ctx.sportId ? stars.filter(function (s) { return sportIdOf(s.sportText || '') === ctx.sportId; }) : stars;
    // ไม่มีวันที่ในชีต = ขึ้นทุกวัน (แท็บ MVP กรอกแค่ ชื่อ / ชนิดกีฬา / ประเภท / รูป ก็ได้)
    var list = day
      ? pool.filter(function (s) { return !s.iso || s.iso === day.iso; })
      : pool.slice().sort(function (a, b) { return (b.iso || '').localeCompare(a.iso || ''); });
    list = list.slice(0, STAR_MAX);
    document.getElementById('starDay').textContent = day ? dayLabel(day) + (isToday(day) ? ' (วันนี้)' : '') : 'ทุกวัน' + (list.length > 1 ? ' · ล่าสุดก่อน' : '');
    var n = list.length, isSelf = isSelfFor(ctx.data);
    var track = document.getElementById('starList');
    document.getElementById('mvpViewport').hidden = !n;
    // ทีละใบเต็มกล่อง · คนเดียวไม่ต้องวน — ชุดเดียว
    starCar = starCar || loopCarousel({ box: 'stars', viewport: 'mvpViewport', track: 'starList', ms: STAR_MS });
    starCar.set(list, function (s, i, k) { return starSlide(s, i, n, k, isSelf); });
    // รูปโหลดไม่ได้แม้ลองลิงก์สำรองและลองซ้ำแล้ว (img-retry.js · ไฟล์ไม่ได้แชร์/ลิงก์เว็บอื่นกันดึงรูป) = มาสคอตแทนรูปแตก
    track.querySelectorAll('img[data-sport]').forEach(function (img) {
      img.addEventListener('error', function () {
        img.outerHTML = starPhoto({ sportId: img.getAttribute('data-sport') });
      });
    });
    var empty = document.getElementById('starEmpty');
    empty.hidden = Boolean(n);
    empty.textContent = 'ยังไม่มีการประกาศนักกีฬา MVP' + (ctx.sportName ? 'ประเภท' + ctx.sportName + ' ' : '') + (!day ? '' : isToday(day) ? 'ของวันนี้' : 'ของวันที่ ' + day.date);
  });
}

mountFixtureTable({
  page: 'matches',
  // เมนูกีฬาเป็นคอลัมน์ซ้าย (มาสคอต + ชื่อ) ตามแบบ
  sportMenu: true,
  sportAllLabel: 'ผลการแข่งขันทั้งหมด',
  days: function (data) { return data.days || []; },
  // เปิดหน้ามาเจอผลของ "วันนี้" ทันที · ไม่ใช่วันแข่ง (ก่อน/หลังงาน) ดูทุกวัน
  defaultDay: function (days) {
    var today = days.filter(isToday)[0];
    return today ? today.id : null;
  },
  // จอแคบ: กริดเดียวกับหน้าตารางการแข่งขัน + คอลัมน์ท้ายสำหรับปุ่มรายละเอียด
  rowCls: ' @max-[800px]:grid-cols-[auto_1fr_auto_auto] @max-[800px]:items-baseline',
  detail: detailHtml,
  detailCls: '@max-[800px]:col-start-4 @max-[800px]:row-start-1 @max-[800px]:self-center @max-[800px]:w-auto',
  fields: function (i, data) {
    var isSelf = isSelfFor(data);
    return {
      teams: i.teams || '', athletes: i.athletes || '', score: i.score || '', status: i.status || '', statusText: i.statusText || '',
      venue: i.venue || '', liveUrl: i.liveUrl || '', round: i.round || '', pool: i.pool || '',
      unofficial: i.unofficial, teamsHtml: teamsHtml(data, i.teams), isSelf: isSelf
    };
  },
  // ค้นหาด้วยชื่อนักกีฬา/สนามได้ด้วย
  searchText: function (r) { return r.teams + ' ' + r.athletes + ' ' + r.venue + ' ' + r.score + ' ' + resultLabel(r); },
  emptyText: 'ยังไม่มีผลการแข่งขันในชีต',
  onRender: function (ctx) {
    // เลือกกีฬาอยู่: การ์ดทุกใบแสดงเฉพาะกีฬานั้น (ctx.rows ผ่านตัวกรองกีฬามาแล้ว · dayRows ยังไม่ผ่าน จึงกรองตรงนี้)
    ctx.sportName = ctx.sportId ? sportName(ctx.data, ctx.sportId) : '';
    if (ctx.sportId) ctx.dayRows = ctx.dayRows.filter(function (r) { return r.sportId === ctx.sportId; });
    // การ์ดแนะนำกีฬา (fixture-table.js): ตัวเลขตลอดการแข่งขันของกีฬานี้ + ลิงก์ไปตาราง/ภาพ
    renderSportIntro(ctx, function (rows) {
      var mine = rows.filter(hasUs).length;
      var wins = rows.filter(function (r) { return isWinOrMedal(r, r.isSelf); }).length;
      return [
        { n: rows.length, label: 'รายการทั้งหมด' },
        { n: mine, label: 'โรงเรียนเราลงแข่ง' },
        { n: wins, label: 'ชนะแล้ว', tone: 'text-brand' }
      ];
    }, [
      { href: 'schedule.html?sport=' + encodeURIComponent(ctx.sportId || ''), label: 'ตารางแข่งขัน' },
      { href: 'gallery.html?sport=' + encodeURIComponent(ctx.sportId || ''), label: 'ภาพทั้งหมด' }
    ]);
    renderFeatured(ctx);
    renderWins(ctx);
    renderSummary(ctx);
    renderHighlight(ctx);
    renderStars(ctx);
    // หัวตาราง: กรองกีฬาอยู่ = "ผลการแข่งขัน<กีฬา>" (fixture-table ตั้งชื่อกีฬาไว้ให้) · ไม่กรอง = "ผลการแข่งขันวันนี้" / "<วัน>"
    var title = document.getElementById('schedTitle');
    var sport = title.textContent !== title.dataset.base ? title.textContent : '';
    title.textContent = 'ผลการแข่งขัน' + (sport ? sport + ' ' : '') + (ctx.day ? dayWord(ctx.day) : '');
  },
  // ตารางเต็มความกว้างใต้เมนูกีฬา หน้าตาเดียวกับหน้าตารางการแข่งขัน (หัวตาราง/ตัวอักษร/ช่องเหมือนกัน)
  // คอลัมน์ต่อจาก วันแข่งขัน / รายการแข่งขัน (fixture-table วางให้) เรียงแบบหน้าตารางการแข่งขัน
  // จอแคบ: บรรทัด 1 วัน · กีฬา · เวลา · ปุ่มรายละเอียด · บรรทัด 2 ประเภท
  //   บรรทัด 3 คู่แข่งซ้อนสองบรรทัด + แต้มแต่ละฝั่งชิดขวา (ผลแบบข้อความ เช่น "ทอง: …" ขึ้นบรรทัด 4 ของมันเอง)
  //   บรรทัด 5 สนาม · สถานะชิดขวา (ช่องเดียวกัน ดู statusHtml)
  columns: [
    // ช่อง "ระหว่าง" ไม่ตัดบรรทัด ตารางกว้างเกินกล่องเมื่อไรเบราว์เซอร์จะบีบช่องประเภทจนแตกเป็นคำละบรรทัด
    // จึงกันไว้ 150px (ประเภทของหน้านี้สั้น ขึ้นอย่างมากสองบรรทัด) — กว้างกว่านี้ จอ 1280px จะต้องเลื่อนตารางด้านข้าง
    { head: 'ประเภท', cls: function () { return '@min-[800px]:min-w-[150px] @max-[800px]:col-[1/-1] @max-[800px]:row-start-2'; },
      cell: function (r) { return orDash(r.kind); } },
    { head: 'เวลา', cls: function () { return TD_TIME; },
      cell: function (r) { return orDash(r.time); } },
    // self-start ทั้งช่องทีมและช่องแต้ม: บรรทัดแรกของทั้งสองช่องเริ่มที่ขอบบนเดียวกัน แต้มจึงตรงกับชื่อทีม (กริดแถวจัดแบบ baseline)
    { head: 'ระหว่าง', headCls: TH_TEAMS, cls: function (r) { return 'leading-[1.5] @max-[800px]:mt-1 @max-[800px]:self-start @max-[800px]:row-start-3' + (boardScore(r) ? ' @max-[800px]:col-[1/3]' : ' @max-[800px]:col-[1/-1]') + (r.teams ? '' : ' @max-[800px]:hidden'); },
      cell: function (r) { return r.teamsHtml; } },
    // หัวคอลัมน์ไม่ตัดบรรทัด คำยาว "ผลการแข่งขัน" จะดันคอลัมน์สกอร์ให้กว้างเกินเนื้อหา จึงใช้ "ผล"
    { head: 'ผล', cls: function (r) {
        return 'whitespace-nowrap' + (!r.score ? ' @max-[800px]:hidden'
          : boardScore(r) ? ' @max-[800px]:col-[3/-1] @max-[800px]:row-start-3 @max-[800px]:mt-1 @max-[800px]:self-start @max-[800px]:justify-self-end'
          : ' @max-[800px]:col-[1/-1] @max-[800px]:row-start-4 @max-[800px]:whitespace-normal');
      },
      cell: scoreHtml },
    { head: 'สถานะ', cls: function (r) { return 'whitespace-nowrap @max-[800px]:col-[1/-1] @max-[800px]:row-start-5 @max-[800px]:mt-1 @max-[800px]:flex! @max-[800px]:items-center @max-[800px]:justify-between @max-[800px]:gap-3' + (r.venue || resultStatusOf(r) || r.status === 'live' ? '' : ' @max-[800px]:hidden'); },
      cell: statusHtml },
    /* คอลัมน์สถานที่มาจากคอลัมน์ "สนาม"/"สถานที่" ในชีต (หัวบนเว็บใช้คำว่า "สถานที่" ตามชีต) — ไม่มีสักแถวก็ซ่อนทั้งคอลัมน์ */
    { head: 'สถานที่',
      showIf: function (all) { return all.some(function (r) { return r.venue; }); },
      // จอแคบสนามไปอยู่ในช่องสถานะ (statusHtml) แทน
      cls: function () { return 'fs-14.5 text-fg-soft @max-[800px]:hidden'; },
      cell: venueHtml }
  ]
});
