/* =========================================================
   gallery.js — หน้า "ประมวลภาพ" แยกตามวัน

   แหล่งภาพหลัก: โฟลเดอร์ Google Drive ของฝ่ายประชาสัมพันธ์ (กีฬา → วัน → รูป ดู drive-photos.js)
   เปิดหน้า = อ่านแค่โครงโฟลเดอร์มาทำแท็บวัน · กดวันไหนค่อยโหลดรูปของวันนั้น (วันหนึ่งมีได้เป็นพันรูป)
   ไม่ได้ตั้งค่า Drive / Drive อ่านไม่ได้ → ใช้แท็บ "img" ในชีตแทน (ดู buildPhotos ใน sheets.js)

   ภาพในกริดขอรูปย่อกว้าง 640px จาก Drive (โหลดเร็ว) ส่วนตอนเปิดดูเต็มจอค่อยขอ 2000px
   ========================================================= */

import {
  esc, loadData, onFreshData, initChrome, sportName, showLoadError, paintUiIcons
} from './common.js';
import { loadPhotos, sportIdOf } from './sheets.js';
import { hasSupabase } from './config.js';
import { hasDrive, loadDriveTree, loadUnitPhotos, setDriveConfig } from './drive-photos.js';
import { loadGallerySettings } from './gallery-settings.js';
import { WEEKDAYS_TH, MONTHS_TH, isoDate, imageUrlAt, originalImageUrl, downloadImageUrl, parseThaiDate } from './format.js';

var chrome = initChrome('gallery');

var NO_DATE = 'none';         // กลุ่มของภาพที่ไม่ได้ใส่วันที่
var ALL_SPORTS = '';
var GRID_PAGE = 48;           // ภาพต่อหน้า ในโหมดดูทั้งหมดของกีฬา (48 ลงตัวทั้ง 2 / 3 / 4 คอลัมน์)
var SAMPLES = 8;              // ภาพตัวอย่างต่อกีฬา ในมุมมอง "ทุกกีฬา"
var HIGHLIGHTS = 12;          // ภาพในสไลด์ภาพเด่นของวัน

var state = {
  data: null,
  photos: [],       // ภาพทั้งหมดหลังแปลงรูปแบบแล้ว
  groups: [],       // [{ key, photos, units }] เรียงตามวัน — photos = null คือยังไม่ได้โหลด (โหมด Drive)
  day: null,        // key ของวันที่เลือกอยู่
  sport: ALL_SPORTS,
  shown: [],        // ภาพที่อยู่ในกริดตอนนี้ (หลังกรองกีฬา) — ลำดับเดียวกับที่ปุ่มก่อนหน้า/ถัดไปใช้
  page: 0,          // หน้าของกริดในโหมดดูทั้งหมด (วันหนึ่งเป็นพันรูป — แบ่งหน้าละ GRID_PAGE)
  viewing: -1
};

var $ = function (id) { return document.getElementById(id); };

/* ---------- แปลงข้อมูล ---------- */

var MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function isoToDate(iso) {
  var p = iso.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function shortLabel(iso) {
  var d = isoToDate(iso);
  return d.getDate() + ' ' + MONTHS_TH[d.getMonth()];
}
function longLabel(iso) {
  var d = isoToDate(iso);
  return 'วัน' + WEEKDAYS_TH[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** วันแข่งทั้งหมดเรียงตามวัน (จากตารางการแข่งขัน) — ใช้แปลง "วันที่ 2" เป็นวันที่จริง */
function competitionDays(data) {
  var all = {};
  ((data && data.schedule) || []).concat((data && data.days) || []).forEach(function (x) { if (x.iso) all[x.iso] = 1; });
  return Object.keys(all).sort();
}

/**
 * ชื่อโฟลเดอร์รายวันใน Drive → 'YYYY-MM-DD' (อ่านไม่ออก = '' แล้วใช้ชื่อโฟลเดอร์เป็นชื่อแท็บแทน)
 * รับ: "20 ต.ค. 2569" · "20/10/2569" · "วันที่ 20 ต.ค." · "วันจันทร์ที่ 20 ต.ค." · "วันที่ 2" (= วันแข่งวันที่ 2)
 */
function folderIso(name, data) {
  var s = String(name || '').trim();
  var nth = /^(?:วันที่|วัน|day)\s*(\d{1,2})$/i.exec(s);
  if (nth) return competitionDays(data)[Number(nth[1]) - 1] || '';
  var cleaned = s.replace(/^วัน\S*?ที่\s*/, '').replace(/^วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)\s*/, '');
  return parseThaiDate(cleaned) || parseThaiDate(s);
}

/** ภาพจากแหล่งไหนก็ได้ (Drive / ชีต / Supabase / mock.json) → รูปแบบเดียวที่หน้านี้ใช้ */
function normalize(p, data) {
  var iso = p.iso || (p.folder ? folderIso(p.folder, data) : '');
  // ข้อมูลตัวอย่าง (mock.json) อ้างวันด้วย dayId แทนวันที่
  if (!iso && p.dayId && data && data.days) {
    var day = data.days.filter(function (d) { return String(d.id) === String(p.dayId); })[0];
    iso = (day && day.iso) || '';
  }
  var sport = (p.sportId && data ? sportName(data, p.sportId) : '') || p.sportText || '';
  // ภาพจาก Drive ใช้ชื่อโฟลเดอร์กีฬาเป็นคำบรรยาย — ตรงกับชื่อกีฬาเป๊ะก็ไม่ต้องมีคำบรรยายซ้ำ
  // (ไม่งั้นการ์ดขึ้น "เทนนิส" สองที่ และหน้าดูเต็มจอขึ้น "เทนนิส · เทนนิส")
  var caption = p.caption && p.caption !== sport && p.caption !== p.sportText ? p.caption : '';
  return {
    link: p.link || p.src,
    iso: iso,
    folder: p.folder || '',
    caption: caption,
    sportId: p.sportId || sportIdOf(p.sportText || ''),
    sport: sport
  };
}

/* กลุ่มของภาพ: วันที่ ('2026-10-21') · โฟลเดอร์ที่ชื่อไม่ใช่วันที่ ('f:พิธีเปิด') · ไม่ระบุ (NO_DATE)
   เรียง: วันที่ตามปฏิทิน → โฟลเดอร์ตามชื่อ → ไม่ระบุไว้ท้ายสุด */
var FOLDER_KEY = 'f:';
function groupKey(p) { return p.iso || (p.folder ? FOLDER_KEY + p.folder : NO_DATE); }
function isFolderKey(k) { return k.indexOf(FOLDER_KEY) === 0; }
function groupRank(k) { return k === NO_DATE ? 2 : isFolderKey(k) ? 1 : 0; }

function buildGroups(photos) {
  var byDay = {};
  photos.forEach(function (p) {
    var key = groupKey(p);
    (byDay[key] = byDay[key] || []).push(p);
  });
  return Object.keys(byDay)
    .sort(function (a, b) {
      return (groupRank(a) - groupRank(b)) || a.localeCompare(b, 'th', { numeric: true });
    })
    .map(function (key) { return { key: key, photos: byDay[key] }; });
}

/** โหมด Drive: หน่วย (กีฬา×วัน) จาก loadDriveTree → กลุ่มตามวัน ยังไม่มีรูป (photos: null) */
function groupsFromUnits(units) {
  var byKey = {};
  units.forEach(function (u) { (byKey[u.key] = byKey[u.key] || []).push(u); });
  return Object.keys(byKey)
    .sort(function (a, b) { return (groupRank(a) - groupRank(b)) || a.localeCompare(b, 'th', { numeric: true }); })
    .map(function (key) { return { key: key, units: byKey[key], photos: null }; });
}

/** โหลดรูปของกลุ่ม (ครั้งเดียว เก็บไว้ใช้ซ้ำ) — กดแท็บสลับไปมาไม่ต้องโหลดใหม่ */
function ensureLoaded(group) {
  if (group.photos) return Promise.resolve(group);
  if (!group.loading) {
    group.loading = loadUnitPhotos(group.units).then(function (list) {
      // วันที่ของภาพมาจากโฟลเดอร์วันที่มันอยู่ (= key ของกลุ่ม) — ใช้ขึ้นวันที่บนสไลด์และหน้าดูเต็มจอ
      var iso = groupRank(group.key) === 0 ? group.key : '';
      group.photos = list.map(function (p) { return normalize(Object.assign({ iso: iso }, p), state.data); });
      return group;
    }).catch(function (err) {
      group.loading = null;   // ให้กดลองใหม่ได้
      throw err;
    });
  }
  return group.loading;
}

function groupTitle(key) {
  if (key === NO_DATE) return 'ภาพอื่น ๆ';
  return isFolderKey(key) ? key.slice(FOLDER_KEY.length) : shortLabel(key);
}

/** "วันที่ N" ของรายการแข่ง — นับจากวันในตารางการแข่งขัน ไม่ใช่วันในปฏิทิน */
function competitionDayNo(iso) {
  var d = state.data;
  if (!d) return 0;
  return competitionDays(d).indexOf(iso) + 1;
}

/** วันที่เปิดมาเจอ: ?day= ในลิงก์ → วันนี้ (ถ้ามีภาพ) → วันล่าสุดที่มีภาพ */
function initialDay() {
  var want = new URLSearchParams(location.search).get('day');
  var keys = state.groups.map(function (g) { return g.key; });
  if (want && keys.indexOf(want) > -1) return want;
  var today = isoDate(new Date());
  if (keys.indexOf(today) > -1) return today;
  // วันล่าสุดที่มีภาพ (กลุ่มวันที่เรียงอยู่หน้าสุด) · ไม่มีกลุ่มไหนเป็นวันที่เลย = กลุ่มแรก
  var dated = keys.filter(function (k) { return groupRank(k) === 0; });
  return dated.length ? dated[dated.length - 1] : keys[0];
}

/* ---------- แสดงผล ---------- */

/* ปุ่มทุกแบบในหน้านี้: ชี้/แตะ = พื้นเทาฟ้าอ่อน (สีเดียวกับเมนูซ้ายตอนชี้) — ปุ่มที่ "ถูกเลือกอยู่" ยังเป็นน้ำเงิน
   ใส่ทั้ง hover: และ active: — มือถือไม่มีการชี้ (hover ของ Tailwind ทำงานเฉพาะอุปกรณ์ที่มีเมาส์)
   active: คือช่วงที่นิ้วแตะค้างอยู่ จอสัมผัสจึงเห็นสีตอนกดด้วย */
var HOVER = ' hover:bg-surface-soft hover:text-fg active:bg-surface-soft active:text-fg';
/** ปุ่มพาไปดูภาพเพิ่ม ("ดูเพิ่มเติม" / "ดูทั้งหมด") — แตะหรือชี้แล้วเป็นพื้นน้ำเงินตัวขาว ชุดเดียวกับปุ่ม "ดูทั้งหมด" หน้าแรก */
var HOVER_BRAND = ' hover:border-brand hover:bg-brand hover:text-white active:border-brand active:bg-brand active:text-white';

var TAB = 'flex flex-none cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-4 py-2.5 text-left transition-[background-color,border-color,color] duration-150' +
  ' border-line bg-surface text-fg aria-[selected=false]:hover:bg-surface-soft aria-[selected=false]:active:bg-surface-soft' +
  ' aria-selected:border-brand aria-selected:bg-brand aria-selected:text-on-ink aria-selected:shadow-card' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';
var CHIP_BTN = 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 fs-14 transition-colors duration-150' +
  ' border-line bg-surface text-fg-soft aria-pressed:border-brand aria-pressed:bg-brand-100 aria-pressed:text-brand-strong' +
  ' aria-[pressed=false]:hover:bg-surface-soft aria-[pressed=false]:hover:text-fg aria-[pressed=false]:active:bg-surface-soft aria-[pressed=false]:active:text-fg' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';

function renderTabs() {
  var host = $('dayTabs');
  var dated = state.groups.filter(function (g) { return g.key !== NO_DATE; });
  // ไม่มีภาพไหนใส่วันที่เลย = ไม่มีอะไรให้แบ่ง ซ่อนแท็บ โชว์ทุกภาพในกริดเดียว
  host.hidden = !dated.length;
  if (!dated.length) return;

  var today = isoDate(new Date());
  host.innerHTML = state.groups.map(function (g) {
    var title = groupTitle(g.key);
    var no = groupRank(g.key) === 0 ? competitionDayNo(g.key) : 0;
    var sub = g.key === today ? 'วันนี้' : no ? 'วันที่ ' + no : '';
    return '<button class="' + TAB + '" type="button" role="tab" data-day="' + esc(g.key) + '" aria-selected="' + (g.key === state.day) + '"' +
      ' tabindex="' + (g.key === state.day ? '0' : '-1') + '">' +
      '<span class="fs-15.5 font-semibold whitespace-nowrap">' + esc(title) + '</span>' +
      (sub ? '<span class="fs-13 whitespace-nowrap opacity-80">' + esc(sub) + '</span>' : '') + '</button>';
  }).join('');

  host.querySelectorAll('[data-day]').forEach(function (b) {
    b.addEventListener('click', function () { selectDay(b.dataset.day); });
  });
  var sel = host.querySelector('[aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ลูกศรซ้าย/ขวาเลื่อนไปแท็บข้าง ๆ ตามแบบแผน tablist — คนใช้คีย์บอร์ดไม่ต้องกด Tab ไล่ทีละวัน */
function bindTabKeys() {
  $('dayTabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var keys = state.groups.map(function (g) { return g.key; });
    var i = keys.indexOf(state.day) + (e.key === 'ArrowRight' ? 1 : -1);
    if (i < 0 || i >= keys.length) return;
    e.preventDefault();
    selectDay(keys[i]);
    $('dayTabs').querySelector('[data-day="' + keys[i] + '"]').focus();
  });
}

function currentGroup() {
  return state.groups.filter(function (g) { return g.key === state.day; })[0] || { key: NO_DATE, photos: [] };
}

function renderSportFilter(group) {
  var host = $('sportFilter');
  var seen = {}, sports = [];
  group.photos.forEach(function (p) {
    var key = p.sportId || p.sport;
    if (key && !seen[key]) { seen[key] = 1; sports.push({ key: key, id: p.sportId, name: p.sport }); }
  });
  // กีฬาเดียวหรือไม่มีเลย กรองไปก็ได้ผลเท่าเดิม ไม่ต้องมีปุ่ม
  host.hidden = sports.length < 2;
  if (sports.length < 2) { state.sport = ALL_SPORTS; return; }
  if (state.sport && !seen[state.sport]) state.sport = ALL_SPORTS;

  host.innerHTML = '<button class="' + CHIP_BTN + '" type="button" data-sport="" aria-pressed="' + (state.sport === ALL_SPORTS) + '">ทุกกีฬา</button>' +
    sports.map(function (s) {
      return '<button class="' + CHIP_BTN + '" type="button" data-sport="' + esc(s.key) + '" aria-pressed="' + (state.sport === s.key) + '">' +
        esc(s.name) + '</button>';
    }).join('');
  host.querySelectorAll('[data-sport]').forEach(function (b) {
    b.addEventListener('click', function () { state.sport = b.dataset.sport; renderBody(); });
  });
}

/** @param {boolean} [inSection] - อยู่ใต้หัวข้อกีฬาแล้ว ไม่ต้องติดป้ายชื่อกีฬาซ้ำทุกรูป */
function tileHtml(p, i, inSection) {
  var label = [p.caption, p.sport].filter(Boolean).join(' · ') || 'ภาพบรรยากาศ ภาพที่ ' + (i + 1);
  return '<button class="group/tile relative block aspect-[4/3] cursor-zoom-in overflow-hidden rounded-lg border-0 bg-surface-soft p-0 shadow-panel' +
      ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="button" data-i="' + i + '" aria-label="ดูภาพเต็มจอ: ' + esc(label) + '">' +
    // no-referrer: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    '<img class="block h-full w-full object-cover transition-transform duration-300 group-hover/tile:scale-[1.04] motion-reduce:transition-none"' +
      ' src="' + esc(imageUrlAt(p.link, 640)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
    (p.sport && !inSection ? '<span class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-[oklch(16%_0.02_260/.62)] px-2.5 py-1 fs-12.5 text-white backdrop-blur-sm">' +
      esc(p.sport) + '</span>' : '') +
    (p.caption ? '<span class="absolute inset-x-0 bottom-0 bg-linear-to-t from-[oklch(16%_0.02_260/.85)] to-[oklch(16%_0.02_260/0)] px-3 pt-8 pb-2.5 text-left fs-14 leading-[1.4] text-white line-clamp-2">' +
      esc(p.caption) + '</span>' : '') +
  '</button>';
}

/** เลือกภาพเด่นใส่สไลด์: วนหยิบจากทุกกีฬาทีละรูป (ไม่ใช่ 12 รูปแรกที่เป็นกีฬาเดียวกันหมด)
    หยิบห่าง ๆ กันในแต่ละกีฬา — รูปติดกันในโฟลเดอร์มักเป็นช็อตต่อเนื่องที่หน้าตาแทบเหมือนกัน */
function pickHighlights(list, max) {
  var bySport = [], idx = {};
  list.forEach(function (p) {
    var k = p.sport || '';
    if (!(k in idx)) { idx[k] = bySport.length; bySport.push([]); }
    bySport[idx[k]].push(p);
  });
  var picks = [];
  for (var round = 0; picks.length < max && round < max; round++) {
    bySport.forEach(function (arr) {
      if (picks.length >= max) return;
      var step = Math.max(1, Math.floor(arr.length / Math.ceil(max / bySport.length)));
      var p = arr[round * step];
      if (p && picks.indexOf(p) < 0) picks.push(p);
    });
  }
  return picks;
}

function gridHtml(from, to) {
  return state.shown.slice(from, to).map(function (p, j) { return tileHtml(p, from + j); }).join('');
}
function bindTiles(root) {
  root.querySelectorAll('[data-i]:not([data-bound])').forEach(function (b) {
    b.dataset.bound = '1';
    b.addEventListener('click', function () { openViewer(Number(b.dataset.i)); });
    var img = b.querySelector('img');
    // รูปที่โหลดไม่ขึ้น (ส่วนใหญ่คือไฟล์ใน Drive ยังไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์") — บอกตรง ๆ แทนกรอบว่าง
    if (img) img.addEventListener('error', function () {
      img.replaceWith(Object.assign(document.createElement('span'), {
        className: 'flex h-full w-full items-center justify-center px-3 text-center fs-13.5 text-fg-mute',
        textContent: 'โหลดภาพนี้ไม่ได้'
      }));
    }, { once: true });
  });
}

function renderBody() {
  var group = currentGroup();
  if (!group.photos) {
    // โหมด Drive: วันนี้ยังไม่ได้โหลดรูป — โชว์โครงว่างระหว่างรอ แล้ววาดใหม่เมื่อรูปมาถึง
    $('sportFilter').hidden = true;
    renderSkeleton();
    var key = group.key;
    ensureLoaded(group).then(function () {
      if (state.day === key) renderBody();         // ผู้ใช้กดไปวันอื่นระหว่างรอ — ไม่วาดทับ
    }).catch(function (err) {
      console.error('โหลดรูปจาก Google Drive ไม่สำเร็จ:', err.message);
      if (state.day !== key) return;
      $('galleryBody').innerHTML = '<div class="rounded-lg border border-line bg-surface px-6 py-10 text-center shadow-panel">' +
        '<p class="m-0 fs-16 text-fg">โหลดภาพไม่สำเร็จ</p>' +
        '<p class="mt-1 mb-4 fs-14.5 text-fg-mute">ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>' +
        '<button class="btn btn-outline' + HOVER + '" type="button" id="retryLoad">ลองใหม่</button></div>';
      $('retryLoad').addEventListener('click', renderBody);
    });
    return;
  }
  renderSportFilter(group);
  $('sportFilter').querySelectorAll('[data-sport]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.sport === state.sport));
  });

  state.shown = group.photos.filter(function (p) {
    return !state.sport || (p.sportId || p.sport) === state.sport;
  });

  var dated = state.groups.some(function (g) { return g.key !== NO_DATE; });
  var heading = !dated ? 'ภาพทั้งหมด' : group.key === NO_DATE ? 'ภาพที่ยังไม่ระบุวัน'
    : isFolderKey(group.key) ? groupTitle(group.key) : longLabel(group.key);

  if (!state.shown.length) {
    $('galleryBody').innerHTML = '<h2 class="m-0 mb-4 fs-17 font-semibold text-fg">' + esc(heading) + '</h2>' +
      '<div class="rounded-lg border border-line bg-surface px-6 py-10 text-center fs-15 text-fg-mute shadow-panel">ยังไม่มีภาพในหมวดนี้</div>';
    initCarousel([]);
    return;
  }

  var highlights = pickHighlights(state.shown, HIGHLIGHTS);
  var sports = sportSections(state.shown);
  // "ทุกกีฬา" และวันนั้นมีหลายกีฬา → แสดงตัวอย่างกีฬาละไม่กี่รูป + ปุ่มดูเพิ่มเติม
  // เลือกกีฬาแล้ว (หรือวันนั้นมีกีฬาเดียว) → กริดเต็มของกีฬานั้น แบ่งหน้าทีละ GRID_PAGE
  var bySport = !state.sport && sports.length > 1;

  $('galleryBody').innerHTML =
    '<h2 class="m-0 mb-4 fs-17 font-semibold text-fg">' + esc(heading) + '</h2>' +
    carouselHtml(highlights) +
    (bySport ? sports.map(sectionHtml).join('') : fullGridHtml(dated));

  if (bySport) {
    bindTiles($('galleryBody'));
    $('galleryBody').querySelectorAll('[data-more-sport]').forEach(function (b) {
      b.addEventListener('click', function () { showSport(b.dataset.moreSport); });
    });
  } else {
    bindFullGrid();
  }
  initCarousel(highlights);
}

/** แสดงภาพทั้งหมดของกีฬาเดียว (ปุ่ม "ดูเพิ่มเติม" ใต้หัวข้อกีฬา / "ดูทั้งหมด" บนสไลด์) */
function showSport(key) {
  state.sport = key;
  renderBody();
  // พาไปที่ตัวกรอง ให้เห็นว่ากำลังดูกีฬาไหน และกดกลับ "ทุกกีฬา" ได้ · วันที่มีกีฬาเดียวไม่มีตัวกรอง → ไปที่กริด
  var target = $('sportFilter').hidden ? $('photoGrid') : $('sportFilter');
  if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** ภาพของวันแยกตามกีฬา (ลำดับเดียวกับในกริด) → [{ key, id, name, photos: [{ p, i }] }] */
function sportSections(list) {
  var out = [], at = {};
  list.forEach(function (p, i) {
    var key = p.sportId || p.sport || '';
    if (!(key in at)) { at[key] = out.length; out.push({ key: key, id: p.sportId, name: p.sport || 'ภาพอื่น ๆ', photos: [] }); }
    out[at[key]].photos.push({ p: p, i: i });
  });
  return out;
}

/** ตัวอย่างกระจายทั่วทั้งกีฬา — รูปติดกันในโฟลเดอร์มักเป็นช็อตต่อเนื่องที่แทบเหมือนกัน */
function spread(arr, n) {
  if (arr.length <= n) return arr;
  var step = arr.length / n, out = [];
  for (var k = 0; k < n; k++) out.push(arr[Math.floor(k * step)]);
  return out;
}

function sectionHtml(sec) {
  var more = sec.photos.length > SAMPLES;
  return '<section class="mt-9 first-of-type:mt-9">' +
    '<div class="mb-3.5 flex items-center gap-3">' +
      // ชื่อกีฬาเป็นสีชมพูของเว็บ (ชมพูเดียวกับเส้นใต้โลโก้ / คะแนนฝั่งเรา) — แยกหัวข้อกีฬาออกจากรูปให้เห็นชัด
      '<h3 class="m-0 flex min-w-0 items-center gap-2 fs-16.5 font-semibold text-live">' +
        esc(sec.name) + '</h3>' +
      '<span class="h-px flex-1 bg-line" aria-hidden="true"></span>' +
      (more ? '<button class="btn btn-outline btn-sm flex-none rounded-full px-4' + HOVER_BRAND + '" type="button" data-more-sport="' + esc(sec.key) + '">ดูเพิ่มเติม' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="sr-only"> ภาพ' + esc(sec.name) + '</span></button>' : '') +
    '</div>' +
    '<div class="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2 max-[560px]:gap-2">' +
      spread(sec.photos, SAMPLES).map(function (x) { return tileHtml(x.p, x.i, true); }).join('') +
    '</div>' +
  '</section>';
}

function fullGridHtml(dated) {
  return '<h3 class="mt-9 mb-3.5 scroll-mt-24 fs-15.5 font-semibold text-fg-soft" id="gridTop">' + (dated ? 'ภาพทั้งหมดของวันนี้' : 'ภาพทั้งหมด') + '</h3>' +
    '<div class="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 max-[560px]:grid-cols-2 max-[560px]:gap-2" id="photoGrid"></div>' +
    '<nav class="mt-8 flex items-center justify-center gap-2 max-[560px]:gap-1" id="pager" aria-label="เลือกหน้าภาพ"></nav>';
}

function bindFullGrid() {
  state.page = 0;
  showGridPage(0, false);
}

/* ---------- แบ่งหน้า (‹ ก่อนหน้า  1 2 3 4  ถัดไป ›) ---------- */

var PAGE_NUM = 'flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent fs-16 text-fg tabular-nums' +
  ' hover:bg-surface-soft active:bg-surface-soft' +
  ' aria-[current=page]:bg-brand aria-[current=page]:text-on-ink aria-[current=page]:shadow-card aria-[current=page]:hover:bg-brand' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[560px]:size-9 max-[560px]:fs-15';
var PAGE_STEP = 'flex h-11 flex-none cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-5 fs-15 text-fg' +
  ' enabled:hover:bg-surface-soft enabled:active:bg-surface-soft disabled:cursor-default disabled:border-line disabled:text-fg-mute disabled:opacity-60' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[560px]:h-9 max-[560px]:px-3 max-[560px]:fs-14';
var CHEV_L = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var CHEV_R = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** เลขหน้าที่จะแสดง — หน้าเยอะจะย่อเป็น 1 … 5 6 7 … 15 (null = จุดไข่ปลา) */
function pageList(cur, total) {
  var near = window.innerWidth < 560 ? 0 : 1;   // จอแคบเหลือแค่หน้าปัจจุบันกับหัวท้าย ไม่ให้ล้นจอ
  var out = [];
  for (var k = 0; k < total; k++) {
    if (k === 0 || k === total - 1 || Math.abs(k - cur) <= near) out.push(k);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

function renderPager() {
  var host = $('pager');
  var total = Math.ceil(state.shown.length / GRID_PAGE);
  host.hidden = total < 2;
  if (total < 2) { host.innerHTML = ''; return; }
  var cur = state.page;
  host.innerHTML =
    '<button class="' + PAGE_STEP + '" type="button" data-page="' + (cur - 1) + '"' + (cur === 0 ? ' disabled' : '') + '>' + CHEV_L + '<span>ก่อนหน้า</span></button>' +
    '<div class="flex items-center gap-1.5 px-2 max-[560px]:gap-0.5 max-[560px]:px-0.5">' +
      pageList(cur, total).map(function (k) {
        if (k === null) return '<span class="w-6 text-center text-fg-mute" aria-hidden="true">…</span>';
        return '<button class="' + PAGE_NUM + '" type="button" data-page="' + k + '"' + (k === cur ? ' aria-current="page"' : '') + ' aria-label="หน้า ' + (k + 1) + '">' + (k + 1) + '</button>';
      }).join('') +
    '</div>' +
    '<button class="' + PAGE_STEP + '" type="button" data-page="' + (cur + 1) + '"' + (cur === total - 1 ? ' disabled' : '') + '><span>ถัดไป</span>' + CHEV_R + '</button>';
  host.querySelectorAll('[data-page]').forEach(function (b) {
    b.addEventListener('click', function () { showGridPage(Number(b.dataset.page), true); });
  });
}

function showGridPage(k, scroll) {
  var total = Math.max(1, Math.ceil(state.shown.length / GRID_PAGE));
  state.page = Math.max(0, Math.min(k, total - 1));
  var from = state.page * GRID_PAGE;
  $('photoGrid').innerHTML = gridHtml(from, Math.min(from + GRID_PAGE, state.shown.length));
  bindTiles($('photoGrid'));
  renderPager();
  // เปลี่ยนหน้าแล้วพากลับไปบนสุดของกริด ไม่ให้ค้างอยู่ที่แถบเลขหน้าท้ายจอ
  if (scroll) $('gridTop').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function selectDay(key) {
  state.day = key;
  state.sport = ALL_SPORTS;
  // ใส่วันลงลิงก์ — คัดลอกลิงก์ไปแชร์แล้วคนเปิดเจอวันเดียวกัน
  var url = new URL(location.href);
  if (state.groups.some(function (g) { return g.key !== NO_DATE; })) url.searchParams.set('day', key);
  history.replaceState(null, '', url);
  renderTabs();
  renderBody();
}

/** เปิดจากเครื่องตัวเอง (Live Server ฯลฯ) แล้ว Drive ปฏิเสธ — บอกสาเหตุตรง ๆ บนหน้า แทนที่จะเงียบเป็น "ยังไม่มีภาพ"
    ผู้ชมทั่วไปบนเว็บจริงไม่เห็นกล่องนี้ (แสดงเฉพาะ localhost / 127.0.0.1) */
function devHint() {
  if (!state.driveError || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return '';
  var blocked = /referer/i.test(state.driveError);
  return '<div class="mx-auto mt-5 max-w-[640px] rounded-sm border border-gold/40 bg-gold/15 px-4 py-3 text-left fs-14 text-gold-ink">' +
    '<strong class="font-semibold">สำหรับผู้พัฒนา:</strong> Google Drive ปฏิเสธคำขอ — ' + esc(state.driveError) +
    (blocked ? '<br>เพิ่ม <code class="font-mono">' + esc(location.origin) + '/*</code> ใน Website restrictions ของ API key (Google Cloud Console → Credentials)' : '') +
  '</div>';
}

function renderEmpty() {
  $('dayTabs').hidden = true;
  $('sportFilter').hidden = true;
  $('galleryCount').textContent = 'ภาพบรรยากาศการแข่งขัน';
  $('galleryBody').innerHTML =
    '<div class="rounded-lg border border-line bg-surface px-6 py-12 text-center shadow-panel">' +
      '<i class="icon-mask mx-auto mb-3 block size-10 text-fg-mute" data-ic="photo"></i>' +
      '<p class="m-0 fs-16 text-fg">ยังไม่มีภาพบรรยากาศ</p>' +
      '<p class="mt-1 mb-0 fs-14.5 text-fg-mute">ฝ่ายประชาสัมพันธ์จะทยอยลงภาพระหว่างการแข่งขัน กลับมาดูอีกครั้งนะคะ</p>' +
      devHint() +
    '</div>';
  paintUiIcons($('galleryBody'));
}

function renderGallery() {
  if (!state.groups.length) {
    if (!state.photos.length) { renderEmpty(); return; }
    state.groups = buildGroups(state.photos);
  }
  // ไม่บอกจำนวนภาพ (ผู้ใช้ไม่ต้องการ) — บอกแค่ว่าแบ่งตามวัน เมื่อมีวันให้แบ่งจริง
  var days = state.groups.some(function (g) { return g.key !== NO_DATE; });
  $('galleryCount').textContent = 'ภาพบรรยากาศการแข่งขัน' + (days ? ' แยกตามวัน' : '');
  state.day = state.groups.some(function (g) { return g.key === state.day; }) ? state.day : initialDay();
  renderTabs();
  renderBody();
}

function renderSkeleton() {
  $('galleryBody').innerHTML = '<div class="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 max-[560px]:grid-cols-2 max-[560px]:gap-2" aria-hidden="true">' +
    Array.from({ length: 8 }, function () { return '<div class="aspect-[4/3] rounded-lg bg-surface-soft motion-safe:animate-pulse"></div>'; }).join('') + '</div>';
}

/* =========================================================
   สไลด์ภาพเด่นของวัน — ภาพกลางชัด ภาพข้าง ๆ เบลอจางโผล่ให้เห็นว่ายังมีต่อ
   เลื่อนเองทุก 5 วินาที · หยุดเมื่อเอาเมาส์วาง/โฟกัส/กดหยุด/เปิดดูเต็มจอ
   วนไม่รู้จบ: วาดภาพชุดเดียวกันสามรอบต่อกัน แล้วอยู่ที่ชุดกลางเสมอ — เลื่อนเลยขอบชุดกลางเมื่อไร
   พอแอนิเมชันจบก็กระโดดกลับตำแหน่งเดียวกันในชุดกลางแบบไม่มีแอนิเมชัน คนดูจึงไม่เห็นรอยต่อ
   ========================================================= */

var CAR_MS = 5000;
var CAR_MAX_DOTS = 12;   // ภาพเยอะกว่านี้ จุดจะยาวเกินแถว — ใช้ตัวเลข "3 / 40" แทน
var car = { n: 0, list: [], pos: 0, settle: null, keyboard: false, userPaused: false };

function carReduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

var CAL_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.8h17M8 3.5v3.6M16 3.5v3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
var ARROW_R = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ARROW_L = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var EXPAND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M9 6.5v11M15 6.5v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
var ICON_PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M8.5 6.2v11.6L18 12z" fill="currentColor"/></svg>';

var CAR_BTN = 'flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface text-fg transition-colors duration-150' + HOVER +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';

function slideHtml(p, i, n, k) {
  var sportKey = p.sportId || p.sport || '';
  var title = p.caption || p.sport || 'ภาพบรรยากาศการแข่งขัน';
  var date = p.iso ? (function () { var d = isoToDate(p.iso); return d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543); })() : '';
  return '<div class="motion-ok relative aspect-[16/9] w-[86%] flex-none cursor-pointer overflow-hidden rounded-2xl bg-surface-soft shadow-panel' +
      ' transition-[filter,opacity] duration-500 data-[on=false]:opacity-50 data-[on=false]:blur-[3px] motion-reduce:transition-none' +
      ' min-[700px]:w-[62%] min-[1100px]:w-[40%]" data-k="' + k + '" data-on="false" role="group" aria-roledescription="สไลด์" aria-label="' + (i + 1) + ' จาก ' + n + '">' +
    '<img class="absolute inset-0 h-full w-full object-cover" src="' + esc(imageUrlAt(p.link, 1200)) + '" alt="' + esc(p.caption || 'ภาพบรรยากาศการแข่งขัน') + '"' +
      ' loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" />' +
    '<div class="absolute inset-x-0 bottom-0 flex items-end gap-4 bg-linear-to-t from-[oklch(14%_0.02_260/.88)] via-[oklch(14%_0.02_260/.5)] to-[oklch(14%_0.02_260/0)] px-6 pt-20 pb-5 max-[560px]:gap-3 max-[560px]:px-4 max-[560px]:pt-14 max-[560px]:pb-4">' +
      '<div class="min-w-0 flex-1 text-white">' +
        (date ? '<p class="m-0 mb-1 flex items-center gap-1.5 fs-13 text-white/80">' + CAL_ICON + esc(date) + '</p>' : '') +
        '<p class="m-0 line-clamp-2 font-display fs-21 leading-[1.35] max-[560px]:fs-17">' + esc(title) + '</p>' +
      '</div>' +
      // "ดูทั้งหมด" = ไปดูภาพทั้งหมดของกีฬาในภาพนี้ (ภาพที่ไม่รู้ว่าเป็นกีฬาอะไรไม่มีปุ่มนี้)
      (sportKey ? '<button class="flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border-0 bg-white px-4 fs-14 font-semibold text-[oklch(22%_0.03_260)]' +
        ' transition-colors duration-150' + HOVER_BRAND +
        ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-[560px]:h-8 max-[560px]:px-3 max-[560px]:fs-13" type="button" data-sport-link="' + esc(sportKey) + '" tabindex="-1">' +
        'ดูทั้งหมด<span class="sr-only"> ภาพ' + esc(p.sport) + '</span>' + ARROW_R + '</button>' : '') +
    '</div>' +
    // ดูภาพเต็มจอ = ไอคอนมุมขวาบน
    '<button class="absolute top-3 right-3 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-[oklch(14%_0.02_260/.55)] text-white backdrop-blur-sm' +
      ' hover:bg-surface-soft hover:text-fg active:bg-surface-soft active:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-[560px]:top-2 max-[560px]:right-2 max-[560px]:size-9"' +
      ' type="button" data-open="' + i + '" tabindex="-1" aria-label="ดูภาพเต็มจอ">' + EXPAND_ICON + '</button>' +
  '</div>';
}

function carouselHtml(list) {
  var n = list.length;
  if (!n) return '';
  // ภาพเดียวไม่ต้องวน — วาดชุดเดียว ไม่มีปุ่มควบคุม
  var copies = n > 1 ? 3 : 1;
  var slides = '';
  for (var c = 0; c < copies; c++) list.forEach(function (p, i) { slides += slideHtml(p, i, n, c * n + i); });

  var dots = n > CAR_MAX_DOTS
    ? '<span class="fs-14 text-fg-soft tabular-nums" id="carCounter"></span>'
    : list.map(function (_, i) {
        return '<button class="motion-ok h-2 w-2 cursor-pointer rounded-full border-0 bg-line-strong p-0 transition-[width,background-color] duration-300 data-[on=true]:w-6 data-[on=true]:bg-fg motion-reduce:transition-none' +
          ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="button" data-dot="' + i + '" aria-label="ไปภาพที่ ' + (i + 1) + '"></button>';
      }).join('');

  return '<section class="relative -mx-8 max-[560px]:-mx-3.5" aria-roledescription="carousel" aria-label="ภาพเด่นของวัน" id="carousel">' +
    '<div class="overflow-hidden py-1 touch-pan-y" id="carViewport">' +
      '<div class="motion-ok relative flex gap-4 transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none max-[560px]:gap-2.5" id="carTrack">' + slides + '</div>' +
    '</div>' +
    (n > 1
      ? '<div class="mx-auto mt-4 flex items-center justify-between gap-4" id="carControls">' +
          '<div class="flex items-center gap-3">' +
            // ปุ่มหยุด/เล่นมีวงแหวนนับเวลารอบ ๆ — เห็นได้ว่าสไลด์กำลังเดินและอีกนานแค่ไหนจะเปลี่ยนภาพ
            '<button class="' + CAR_BTN + ' relative size-11 border-0 bg-transparent" type="button" id="carPause" aria-label="หยุดเลื่อนภาพอัตโนมัติ">' +
              '<svg class="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">' +
                '<circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-line-strong)" stroke-width="2" />' +
                '<circle class="motion-ok" id="carRing" cx="22" cy="22" r="18" fill="none" stroke="var(--color-brand)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="113.1" stroke-dashoffset="113.1" />' +
              '</svg>' +
              '<span class="relative flex" id="carIcon"></span>' +
            '</button>' +
            '<div class="flex items-center gap-1.5">' + dots + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<button class="' + CAR_BTN + '" type="button" id="carPrev" aria-label="ภาพก่อนหน้า">' + ARROW_L + '</button>' +
            '<button class="' + CAR_BTN + ' [&>svg]:rotate-180" type="button" id="carNext" aria-label="ภาพถัดไป">' + ARROW_L + '</button>' +
          '</div>' +
        '</div>'
      : '') +
  '</section>';
}

/** จัดภาพที่ car.pos ให้อยู่กลางจอ · animate=false = กระโดดทันที (ตอนวนกลับชุดกลาง / ปรับขนาดจอ) */
function carLayout(animate) {
  var track = $('carTrack'), vp = $('carViewport');
  if (!track) return;
  var slides = track.children, cur = slides[car.pos];
  if (!cur) return;
  var x = vp.clientWidth / 2 - (cur.offsetLeft + cur.offsetWidth / 2);
  if (!animate || carReduced()) {
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + x + 'px)';
    void track.offsetHeight;          // บังคับให้เบราว์เซอร์ใช้ตำแหน่งนี้ก่อนเปิดแอนิเมชันกลับ
    track.style.transition = '';
  } else {
    track.style.transform = 'translateX(' + x + 'px)';
  }

  var active = car.n ? car.pos % car.n : 0;
  Array.prototype.forEach.call(slides, function (el, k) {
    var on = k === car.pos;
    el.dataset.on = String(on);
    el.setAttribute('aria-hidden', String(!on));
    el.querySelectorAll('button').forEach(function (b) { b.tabIndex = on ? 0 : -1; });
  });
  document.querySelectorAll('#carousel [data-dot]').forEach(function (d) { d.dataset.on = String(Number(d.dataset.dot) === active); });
  if ($('carCounter')) $('carCounter').textContent = (active + 1) + ' / ' + car.n;
  // ปุ่มควบคุมกว้างเท่าภาพกลาง ให้จุด/ลูกศรอยู่ใต้ขอบภาพพอดีเหมือนต้นแบบ
  if ($('carControls')) $('carControls').style.width = cur.offsetWidth + 'px';
}

/** ออกนอกชุดกลางแล้ว → กลับตำแหน่งเดียวกันในชุดกลางแบบไม่มีแอนิเมชัน */
function carNormalize() {
  var n = car.n;
  if (n > 1 && (car.pos < n || car.pos >= 2 * n)) {
    car.pos = n + ((car.pos % n) + n) % n;
    carLayout(false);
  }
}

function carGo(pos) {
  carNormalize();
  car.pos = pos;
  carLayout(true);
  if (carReduced()) carNormalize();   // ไม่มีแอนิเมชัน = ไม่มี transitionend มาเรียกให้
  // ตัวสำรองของ transitionend: แอนิเมชันที่ถูกกดซ้อนกลางทาง บางครั้งเบราว์เซอร์ไม่ส่งอีเวนต์นี้มา
  // ถ้าไม่มีตัวนี้ แทร็กจะค้างอยู่ชุดซ้าย/ขวา จนกว่าผู้ใช้จะกดอีกครั้ง (ยาวกว่า duration-500 เล็กน้อย)
  clearTimeout(car.settle);
  car.settle = setTimeout(carNormalize, 600);
  carAutoplay();
}
function carStep(d) { carNormalize(); carGo(car.pos + d); }

/* ไม่หยุดตอนเอาเมาส์วางบนภาพ — สไลด์กินพื้นที่กลางจอ เมาส์จึงค้างอยู่บนนั้นบ่อยจนภาพไม่เดินเลย
   หยุดเฉพาะ: กดปุ่มหยุด · เปิดดูเต็มจอ · ใช้คีย์บอร์ดอยู่ในสไลด์ · สลับไปแท็บอื่น */
function carPaused() {
  return car.userPaused || car.keyboard || document.hidden || $('viewer').open;
}
/** เริ่มนับรอบใหม่: วงแหวนวิ่งจากศูนย์ วิ่งครบเมื่อไร animationend จะเลื่อนภาพ (ดู initCarousel) */
function carAutoplay() {
  var ring = $('carRing');
  if (!ring || car.n < 2) return;
  ring.style.animation = 'none';
  void ring.getBoundingClientRect();   // ล้างแอนิเมชันเดิมก่อน ไม่งั้นตั้งค่าเดิมซ้ำแล้วมันไม่เริ่มใหม่
  ring.style.animation = 'carRing ' + CAR_MS + 'ms linear forwards';
  carSync();
}
/** หยุด/เดินวงแหวนตามสถานะ — วงแหวนหยุดค้างไว้ตรงไหน กดเล่นต่อก็นับต่อจากตรงนั้น */
function carSync() {
  var ring = $('carRing');
  if (ring) ring.style.animationPlayState = carPaused() ? 'paused' : 'running';
}
function carSetPaused(p) {
  car.userPaused = p;
  var b = $('carPause');
  if (!b) return;
  $('carIcon').innerHTML = p ? ICON_PLAY : ICON_PAUSE;
  b.setAttribute('aria-label', p ? 'เล่นภาพอัตโนมัติต่อ' : 'หยุดเลื่อนภาพอัตโนมัติ');
  carSync();
}

function initCarousel(list) {
  var n = list.length;
  car.list = list;
  car.n = n;
  car.keyboard = false;
  if (!n) return;
  car.pos = n > 1 ? n : 0;
  // คนที่ตั้งเครื่องให้ลดการเคลื่อนไหว ไม่เลื่อนเองตั้งแต่แรก กดเล่นเองได้
  carSetPaused(car.userPaused || carReduced());

  var track = $('carTrack'), vp = $('carViewport'), box = $('carousel');
  // รอให้รูปแรกมีขนาด (aspect-ratio คำนวณได้ทันทีอยู่แล้ว แต่ฟอนต์อาจขยับเลย์เอาต์) แล้วค่อยจัดกลาง
  requestAnimationFrame(function () { carLayout(false); });

  track.addEventListener('transitionend', function (e) { if (e.target === track) carNormalize(); });
  track.querySelectorAll('[data-k]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var k = Number(el.dataset.k);
      if (k !== car.pos) { carGo(k); return; }          // แตะภาพข้าง = เลื่อนมาตรงกลาง
      var link = e.target.closest('[data-sport-link]');
      if (link) { e.stopPropagation(); showSport(link.dataset.sportLink); return; }
      openViewer(state.shown.indexOf(car.list[k % n])); // แตะภาพกลาง = ดูเต็มจอ (ตำแหน่งในกริด ปุ่มถัดไปจะได้ไล่ทั้งวัน)
      e.stopPropagation();
    });
    var img = el.querySelector('img');
    img.addEventListener('error', function () {
      img.replaceWith(Object.assign(document.createElement('span'), {
        className: 'absolute inset-0 flex items-center justify-center fs-14 text-fg-mute', textContent: 'โหลดภาพนี้ไม่ได้'
      }));
    }, { once: true });
  });

  if (n < 2) return;
  $('carPrev').addEventListener('click', function () { carStep(-1); });
  $('carNext').addEventListener('click', function () { carStep(1); });
  $('carPause').addEventListener('click', function () { carSetPaused(!car.userPaused); });
  $('carRing').addEventListener('animationend', function () { carStep(1); });
  document.querySelectorAll('#carousel [data-dot]').forEach(function (d) {
    d.addEventListener('click', function () { carNormalize(); carGo(car.n + Number(d.dataset.dot)); });
  });
  // ใช้คีย์บอร์ดไล่อยู่ในสไลด์ = หยุดรอ ไม่ให้ภาพเลื่อนหนีระหว่างกำลังจะกด (คลิกเมาส์ไม่นับ — ไม่มี :focus-visible)
  vp.addEventListener('focusin', function (e) { car.keyboard = e.target.matches(':focus-visible'); carSync(); });
  vp.addEventListener('focusout', function () { car.keyboard = false; carSync(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); carStep(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); carStep(1); }
  });

  // ปัดซ้าย/ขวา (นิ้วหรือเมาส์ลาก) — ลากไม่ถึง 40px ถือเป็นการแตะ
  var startX = null, moved = false;
  vp.addEventListener('pointerdown', function (e) { startX = e.clientX; moved = false; });
  vp.addEventListener('pointerup', function (e) {
    if (startX == null) return;
    var dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) { moved = true; carStep(dx < 0 ? 1 : -1); }
  });
  // ปัดจบตรงบนภาพ เบราว์เซอร์ยังส่ง click ตามมา — กลืนทิ้ง ไม่ให้กลายเป็นการเปิดดูเต็มจอ
  vp.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); moved = false; } }, true);

  carAutoplay();
}

window.addEventListener('resize', function () { carLayout(false); });
document.addEventListener('visibilitychange', carSync);

/* ---------- ดูภาพเต็มจอ ---------- */

function openViewer(i) {
  var dlg = $('viewer');
  if (!dlg.open) {
    dlg.showModal();
    document.documentElement.style.overflow = 'hidden';   // dialog ไม่ล็อกการเลื่อนหน้าข้างหลังให้เอง
    carSync();
  }
  showPhoto(i);
}

function showPhoto(i) {
  var n = state.shown.length;
  if (!n) return;
  state.viewing = (i + n) % n;
  var p = state.shown[state.viewing];
  var img = $('viewerImg');

  $('viewerSpin').hidden = false;
  img.style.opacity = '0';
  img.onload = function () { $('viewerSpin').hidden = true; img.style.opacity = '1'; };
  img.onerror = function () { $('viewerSpin').hidden = true; $('viewerCaption').textContent = 'โหลดภาพนี้ไม่ได้ — ไฟล์อาจยังไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์"'; };
  img.src = imageUrlAt(p.link, 2000);
  img.alt = p.caption || 'ภาพบรรยากาศการแข่งขัน';

  $('viewerCount').textContent = (state.viewing + 1) + ' / ' + n;
  // คำบรรยายจาก Drive ขึ้นต้นด้วยชื่อกีฬาอยู่แล้ว ("ฟุตบอล · ม.ปลาย") — ไม่ต่อชื่อกีฬาซ้ำอีกรอบ
  var sportPart = p.caption && p.sport && p.caption.indexOf(p.sport) === 0 ? '' : p.sport;
  $('viewerCaption').textContent = [p.caption, sportPart, p.iso ? shortLabel(p.iso) : ''].filter(Boolean).join(' · ');
  $('viewerOriginal').href = originalImageUrl(p.link);
  $('viewerDownload').href = downloadImageUrl(p.link);
  $('viewerDownload').setAttribute('aria-label', 'ดาวน์โหลดภาพ ' + ($('viewerCaption').textContent || 'นี้'));
  $('viewerPrev').hidden = $('viewerNext').hidden = n < 2;

  // โหลดภาพข้าง ๆ ไว้ก่อน กดถัดไปแล้วขึ้นทันที
  [state.viewing + 1, state.viewing - 1].forEach(function (k) {
    var q = state.shown[(k + n) % n];
    if (q && n > 1) { var pre = new Image(); pre.referrerPolicy = 'no-referrer'; pre.src = imageUrlAt(q.link, 2000); }
  });
}

function bindViewer() {
  var dlg = $('viewer'), stage = $('viewerStage');
  $('viewerClose').addEventListener('click', function () { dlg.close(); });
  $('viewerPrev').addEventListener('click', function () { showPhoto(state.viewing - 1); });
  $('viewerNext').addEventListener('click', function () { showPhoto(state.viewing + 1); });
  dlg.addEventListener('close', function () {
    document.documentElement.style.overflow = '';
    carSync();
    $('viewerImg').removeAttribute('src');
    // คืนโฟกัสให้ภาพที่เปิดดูล่าสุด คนใช้คีย์บอร์ดจะได้ไม่หลุดกลับไปบนสุดของหน้า
    var tile = $('galleryBody').querySelector('[data-i="' + state.viewing + '"]');
    if (tile) tile.focus();
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(state.viewing - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(state.viewing + 1); }
  });
  // แตะพื้นที่ว่างรอบภาพ = ปิด (เหมือนแอปดูรูปทั่วไป)
  stage.addEventListener('click', function (e) { if (e.target === stage) dlg.close(); });

  // ปัดซ้าย/ขวาบนจอสัมผัส = ภาพถัดไป/ก่อนหน้า
  var startX = null, startY = 0;
  stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { startX = e.clientX; startY = e.clientY; } });
  stage.addEventListener('pointerup', function (e) {
    if (startX == null) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showPhoto(state.viewing + (dx < 0 ? 1 : -1));
  });
}

/* ---------- เริ่มทำงาน ---------- */

bindTabKeys();
bindViewer();
renderSkeleton();

// แหล่งภาพ ตามลำดับ:
//   1) โฟลเดอร์ Google Drive (gallery-config.js กรอกแล้ว) — กีฬา → วัน → รูป
//   2) แท็บ img ในชีต — ใช้เมื่อยังไม่ตั้งค่า Drive หรือ Drive อ่านไม่ได้
//   3) ภาพที่มากับข้อมูลหลัก (Supabase / cache) — เมื่อสองทางแรกไม่ได้อะไรเลย
function sheetPhotos() { return hasSupabase() ? Promise.resolve(null) : loadPhotos(); }
// ลิงก์โฟลเดอร์ / โฟลเดอร์ที่ซ่อน: ค่าจาก CMS มาก่อน (แก้ได้โดยไม่ต้อง deploy) ไม่มีค่อยใช้ gallery-config.js
var treeReady = loadGallerySettings().then(function (settings) {
  setDriveConfig(settings);
  if (!hasDrive()) return null;
  return loadDriveTree().catch(function (err) {
    console.error('อ่านโฟลเดอร์ภาพใน Google Drive ไม่สำเร็จ — ใช้แท็บ img ในชีตแทน:', err.message);
    state.driveError = err.message;
    return null;
  });
});

loadData().then(function (data) {
  state.data = data;
  chrome.onData(data);
  return treeReady.then(function (units) {
    if (units && units.length) {
      state.groups = groupsFromUnits(units);
      renderGallery();
      return;
    }
    return sheetPhotos().then(function (fresh) {
      // ชีตอ่านไม่ได้ (loadPhotos คืน []) ถอยไปใช้ชุดที่มากับข้อมูลหลัก ดีกว่าขึ้นว่าไม่มีภาพ
      var list = fresh && fresh.length ? fresh : (data.photos || []);
      state.photos = list.map(function (p) { return normalize(p, data); }).filter(function (p) { return p.link; });
      renderGallery();
    });
  });
}).catch(showLoadError);

onFreshData(function (data) {
  state.data = data;
  chrome.onData(data);
});
