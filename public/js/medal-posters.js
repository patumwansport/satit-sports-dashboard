/* =========================================================
   medal-posters.js — ส่วน "สรุปเหรียญการแข่งขัน" ในหน้าตารางอันดับ (ผู้ดูแลขอ ต.ค. 2569)
   โปสเตอร์ผลการแข่งขัน (รูป 16:9) จากโฟลเดอร์ Google Drive MEDAL_POSTERS_FOLDER ใน gallery-config.js

   โครงโฟลเดอร์:
     โฟลเดอร์แม่
       ├── 25ตุลาคม2569     ← ชุดละโฟลเดอร์ย่อย · ชื่อเป็นวันที่ (parseThaiDate) = ชุด "25 ต.ค. 2569"
       │     └── รูป…
       └── ว่ายน้ำ           ← ชื่ออื่น = ชุดตามชื่อโฟลเดอร์ (อนาคตจะแยกตามชนิดกีฬา) ตามลำดับใน Drive
             └── 25 ต.ค. 2569 / รูป…   ← โฟลเดอร์ย่อยอีกชั้นนับรวมในชุดเดียวกัน
   รูปวางตรง ๆ ในโฟลเดอร์แม่ = ชุด "ภาพอื่น ๆ" · ชื่อขึ้นต้นด้วย _ หรือ # = ซ่อน
   ทุกชุดรวมในสไลด์เดียว ไม่มีแท็บ (ผู้ดูแลเลือก ต.ค. 2569): ชุดวันล่าสุดก่อน → วันเก่า → ชุดชื่ออื่น → ภาพอื่น ๆ
   บรรทัดใต้หัวข้อ = ชุดของรูปที่กำลังแสดง (เปลี่ยนตามสไลด์) · ไม่มีรูปเลย / อ่าน Drive ไม่ได้ = ซ่อนทั้งส่วน (ตารางอันดับไม่สะดุด)
   อยู่ใต้ "สัดส่วนเหรียญรางวัลรวม" ในคอลัมน์ขวา: สไลด์ทีละรูป เลื่อนเองทุก AUTO_MS วนกลับรูปแรก (ผู้ดูแลขอ ต.ค. 2569)
   หยุดเมื่อเมาส์ชี้ / ไล่ด้วยคีย์บอร์ด / สลับแท็บเบราว์เซอร์ / เปิดภาพใหญ่ · เครื่องตั้งลดการเคลื่อนไหว = ไม่เลื่อนเอง · ปัด/ลูกศรเลื่อนเองได้
   แตะรูป = ดูภาพเต็มจอแบบเดียวกับหน้าประมวลภาพ (ดาวน์โหลด / เปิดไฟล์ต้นฉบับ / เลื่อนซ้าย-ขวา)
   ถามผ่านตัวกลางแคช api/drive (listFolder) — โฟลเดอร์ต้องอยู่ใน ALLOWED_ROOTS ไม่งั้นทุกคนยิง Drive ตรง
   ========================================================= */
import { MEDAL_POSTERS_FOLDER, GOOGLE_API_KEY } from './gallery-config.js';
import { driveFolderId, listFolder } from './drive-photos.js';
import { parseThaiDate, MONTHS_TH, imageUrlAt, imageFallbackAt, originalImageUrl, downloadImageUrl } from './format.js';
import { el, esc } from './common.js';

var FOLDER = 'application/vnd.google-apps.folder';
var AUTO_MS = 4000;
/** images = [{ id: รหัสรูป, label: ชื่อชุด ("25 ต.ค. 2569" / ชื่อโฟลเดอร์) }] เรียงตามลำดับสไลด์ */
var state = { images: [], viewing: -1 };
var slide = { at: 0, timer: null, hover: false, keyboard: false, startX: null, swiped: false };
var modal = null;

function hiddenName(name) { return /^[_#]/.test(String(name || '').trim()); }
function isImage(f) { return /^image\//.test(f.mimeType || ''); }
function driveUrl(id) { return 'https://drive.google.com/file/d/' + id + '/view'; }

/** '2026-10-25' → "25 ต.ค. 2569" */
function dateLabel(iso) {
  var p = iso.split('-');
  return +p[2] + ' ' + MONTHS_TH[+p[1] - 1] + ' ' + (+p[0] + 543);
}

/** รูปทั้งหมดในโฟลเดอร์ + โฟลเดอร์ย่อยอีกชั้น (เรียงตามชื่อจากตัวกลาง/Drive) → [รหัสรูป] */
async function groupImages(id) {
  var files = await listFolder(id);
  var subs = files.filter(function (f) { return f.mimeType === FOLDER && !hiddenName(f.name); });
  var nested = await Promise.all(subs.map(function (f) {
    return listFolder(f.id).then(function (list) { return list.filter(isImage); }).catch(function () { return []; });
  }));
  return nested.reduce(function (all, list) { return all.concat(list); }, files.filter(isImage))
    .map(function (f) { return f.id; });
}

/** ชุด = โฟลเดอร์ย่อยของโฟลเดอร์แม่ → [{ id, label, iso, list: [รหัสรูป] }] · ชุดวันล่าสุดก่อน · ชุดที่ไม่มีรูปตัดทิ้ง */
async function loadGroups(root) {
  var files = await listFolder(root);
  var folders = files.filter(function (f) { return f.mimeType === FOLDER && !hiddenName(f.name); }).map(function (f) {
    var iso = parseThaiDate(f.name);
    return { id: f.id, label: iso ? dateLabel(iso) : String(f.name).trim(), iso: iso, images: null };
  });
  var dated = folders.filter(function (g) { return g.iso; }).sort(function (a, b) { return a.iso > b.iso ? -1 : a.iso < b.iso ? 1 : 0; });
  var named = folders.filter(function (g) { return !g.iso; });
  var loose = files.filter(isImage).map(function (f) { return f.id; });
  var groups = dated.concat(named);
  if (loose.length) groups.push({ id: root, label: 'ภาพอื่น ๆ', iso: '', images: Promise.resolve(loose) });
  // ถามรูปของทุกชุดพร้อมกัน
  groups.forEach(function (g) { if (!g.images) g.images = groupImages(g.id).catch(function () { return []; }); });
  var counts = await Promise.all(groups.map(function (g) { return g.images; }));
  return groups.filter(function (g, i) { g.list = counts[i]; return counts[i].length > 0; });
}

function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

function paintSlides() {
  slide.at = 0;
  document.getElementById('posterTrack').innerHTML = state.images.map(function (p, i) {
    var url = driveUrl(p.id);
    return '<button class="block aspect-video w-full flex-none cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" type="button" data-i="' + i + '" aria-roledescription="สไลด์" aria-label="ดูภาพสรุปเหรียญ ' + esc(p.label) + ' ภาพที่ ' + (i + 1) + ' จาก ' + state.images.length + '">' +
      '<img class="block size-full object-cover" src="' + esc(imageUrlAt(url, 960)) + '" data-fb="' + esc(imageFallbackAt(url, 960)) + '" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" decoding="async" />' +
    '</button>';
  }).join('');
  var many = state.images.length > 1;
  Array.prototype.forEach.call(document.querySelectorAll('#posterViewport [data-nav]'), function (b) { b.hidden = !many; });
  go(0, false);
}
/** ไปรูปที่ i (วนรอบ) · animate=false = กระโดดทันที (วาดใหม่ / ปิดภาพเต็มจอ) */
function go(i, animate) {
  var n = state.images.length, track = document.getElementById('posterTrack');
  if (!n) return;
  slide.at = (i + n) % n;
  if (animate === false || reducedMotion()) {
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + (-100 * slide.at) + '%)';
    void track.offsetHeight;   // บังคับใช้ตำแหน่งนี้ก่อนเปิดแอนิเมชันกลับ
    track.style.transition = '';
  } else {
    track.style.transform = 'translateX(' + (-100 * slide.at) + '%)';
  }
  // รูปนอกกรอบเป็น inert: Tab ไม่หลุดไปโดน โปรแกรมอ่านหน้าจอข้าม
  Array.prototype.forEach.call(track.children, function (b, k) { b.inert = k !== slide.at; });
  document.querySelector('#posterViewport [data-pos]').textContent = (slide.at + 1) + ' / ' + n;
  document.getElementById('posterSub').textContent = state.images[slide.at].label + ' · ทั้งหมด ' + n + ' ภาพ';
  autoplay();
}
/** นับเวลาใหม่ทุกครั้งที่เลื่อน (ปัด/กดเองแล้วไม่เด้งต่อทันที) · ช่วงที่หยุดอยู่ รอรอบถัดไปแทน */
function autoplay() {
  clearTimeout(slide.timer);
  if (state.images.length < 2 || reducedMotion()) return;
  slide.timer = setTimeout(function () {
    if (slide.hover || slide.keyboard || document.hidden || (modal && modal.open)) autoplay();
    else go(slide.at + 1);
  }, AUTO_MS);
}
var NAV_BTN = 'absolute top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-surface/85 text-fg shadow-panel hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
/** ปุ่มเลื่อน + ตัวนับ "1 / 9" ซ้อนบนกรอบสไลด์ · ปัดซ้าย/ขวา · ผูกครั้งเดียว */
function bindSlider() {
  var vp = document.getElementById('posterViewport');
  vp.insertAdjacentHTML('beforeend',
    '<button class="' + NAV_BTN + ' left-2" type="button" data-nav="-1" aria-label="ภาพก่อนหน้า">' + arrow('M15 6l-6 6 6 6') + '</button>' +
    '<button class="' + NAV_BTN + ' right-2" type="button" data-nav="1" aria-label="ภาพถัดไป">' + arrow('M9 6l6 6-6 6') + '</button>' +
    '<span class="pointer-events-none absolute right-2 bottom-2 rounded-full bg-[oklch(20%_0.03_260/.6)] px-2.5 py-0.5 fs-12.5 text-white tabular-nums" data-pos></span>');
  vp.addEventListener('mouseenter', function () { slide.hover = true; });
  vp.addEventListener('mouseleave', function () { slide.hover = false; });
  vp.addEventListener('focusin', function (e) { slide.keyboard = e.target.matches(':focus-visible'); });
  vp.addEventListener('focusout', function () { slide.keyboard = false; });
  vp.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(slide.at - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(slide.at + 1); }
  });
  // ลากไม่ถึง 40px = แตะ (เปิดภาพใหญ่) · ปัดเกินนั้น = เลื่อน และไม่นับเป็นการแตะ
  vp.addEventListener('pointerdown', function (e) { slide.startX = e.clientX; slide.swiped = false; });
  vp.addEventListener('pointerup', function (e) {
    if (slide.startX == null) return;
    var dx = e.clientX - slide.startX;
    slide.startX = null;
    if (Math.abs(dx) > 40 && state.images.length > 1) { slide.swiped = true; go(slide.at + (dx < 0 ? 1 : -1)); }
  });
  vp.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) return go(slide.at + +nav.dataset.nav);
    var b = e.target.closest('[data-i]');
    if (!b || slide.swiped) return;
    openViewer(+b.dataset.i);
  });
}

/* ---------- ดูภาพเต็มจอ — หน้าตาและการทำงานเดียวกับหน้าประมวลภาพ (gallery.html #viewer · ผู้ดูแลขอ ต.ค. 2569) ----------
   พื้นเข้มเต็มจอ · ตัวนับ · ดาวน์โหลดไฟล์ต้นฉบับ · เปิดใน Drive · ปิด · วงหมุนระหว่างโหลด · ลูกศร/ปัด/คีย์บอร์ด
   แตะพื้นที่ว่างรอบภาพ = ปิด · คำบรรยายใต้ภาพ = ชุดภาพ (วัน/กีฬา) · โหลดภาพข้าง ๆ ไว้ก่อน */
function arrow(d) {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="' + d + '" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
var VIEW_NAV = 'absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white max-[560px]:hidden';
var slowTimer = null;
function $v(name) { return modal.querySelector('[data-v="' + name + '"]'); }
function ensureModal() {
  if (modal) return modal;
  modal = el('dialog', 'm-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[oklch(14%_0.015_260)] p-0 text-white backdrop:bg-transparent');
  modal.setAttribute('aria-label', 'ดูภาพขนาดเต็ม');
  modal.innerHTML =
    '<div class="flex h-full flex-col">' +
      '<div class="flex items-center gap-3 px-4 py-3">' +
        '<span class="fs-14 text-white/75 tabular-nums" data-v="count" aria-live="polite"></span>' +
        '<div class="flex-1"></div>' +
        '<a class="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 fs-14 font-semibold text-[oklch(22%_0.03_260)] no-underline hover:bg-surface-soft hover:text-fg active:bg-surface-soft active:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" data-v="download" download>' +
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>ดาวน์โหลด</span></a>' +
        '<a class="flex h-9 items-center gap-1.5 rounded-full px-3.5 fs-14 text-white/85 no-underline hover:bg-white/10 hover:text-white max-[560px]:px-2.5" data-v="original" target="_blank" rel="noopener" aria-label="เปิดไฟล์ต้นฉบับใน Google Drive">' +
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><path d="M13.5 4.5h6v6M19.5 4.5l-8.5 8.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 13.5v4.5a2 2 0 01-2 2h-9.5a2 2 0 01-2-2V8.5a2 2 0 012-2h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span class="max-[560px]:hidden">เปิดไฟล์ต้นฉบับ</span></a>' +
        '<button class="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" type="button" data-v="close" aria-label="ปิด">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
      '</div>' +
      '<div class="relative flex min-h-0 flex-1 items-center justify-center px-14 max-[560px]:px-0" data-v="stage">' +
        '<img class="max-h-full max-w-full object-contain select-none" data-v="img" alt="" referrerpolicy="no-referrer" decoding="async" />' +
        '<span class="absolute inset-0 m-auto size-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white/80 motion-reduce:animate-none" data-v="spin" aria-hidden="true"></span>' +
        '<button class="' + VIEW_NAV + ' left-3" type="button" data-v="prev" aria-label="ภาพก่อนหน้า">' + arrow('M15 5l-7 7 7 7') + '</button>' +
        '<button class="' + VIEW_NAV + ' right-3" type="button" data-v="next" aria-label="ภาพถัดไป">' + arrow('M9 5l7 7-7 7') + '</button>' +
      '</div>' +
      '<p class="mx-auto m-0 min-h-[52px] max-w-[70ch] px-5 pt-3 pb-5 text-center fs-15 leading-[1.55] text-white/90" data-v="caption"></p>' +
    '</div>';
  document.body.appendChild(modal);
  var stage = $v('stage');
  $v('close').addEventListener('click', function () { modal.close(); });
  $v('prev').addEventListener('click', function () { show(state.viewing - 1); });
  $v('next').addEventListener('click', function () { show(state.viewing + 1); });
  modal.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(state.viewing - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(state.viewing + 1); }
  });
  // แตะพื้นที่ว่างรอบภาพ = ปิด (เหมือนแอปดูรูปทั่วไป)
  stage.addEventListener('click', function (e) { if (e.target === stage) modal.close(); });
  // ปัดซ้าย/ขวาบนจอสัมผัส = ภาพถัดไป/ก่อนหน้า
  var startX = null, startY = 0;
  stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { startX = e.clientX; startY = e.clientY; } });
  stage.addEventListener('pointerup', function (e) {
    if (startX == null) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(state.viewing + (dx < 0 ? 1 : -1));
  });
  modal.addEventListener('close', function () {
    document.documentElement.style.overflow = '';
    clearTimeout(slowTimer);
    $v('img').removeAttribute('src');
    // ปิดภาพเต็มจอแล้วสไลด์อยู่ที่รูปที่ดูค้างไว้ · คืนโฟกัสให้รูปนั้น
    if (state.viewing > -1) go(state.viewing, false);
    var tile = document.querySelector('#posterTrack [data-i="' + state.viewing + '"]');
    if (tile) tile.focus();
    state.viewing = -1;
  });
  return modal;
}
function openViewer(i) {
  ensureModal();
  if (!modal.open) {
    modal.showModal();
    document.documentElement.style.overflow = 'hidden';   // dialog ไม่ล็อกการเลื่อนหน้าข้างหลังให้เอง
  }
  show(i);
}
/** ภาพที่ i (วนรอบได้) */
function show(i) {
  var n = state.images.length;
  if (!n) return;
  state.viewing = (i + n) % n;
  var p = state.images[state.viewing], url = driveUrl(p.id), img = $v('img'), spin = $v('spin');
  var caption = 'สรุปเหรียญการแข่งขัน · ' + p.label;
  spin.hidden = false;
  img.style.opacity = '0';
  // lh3 ล้ม → ลองลิงก์สำรองของ Drive หนึ่งครั้ง · ล้มทั้งคู่ค่อยบอกผู้ชม · โหลดนานเกิน 15 วินาทีบอกในคำบรรยาย
  var fallback = imageFallbackAt(url, 2000);
  clearTimeout(slowTimer);
  slowTimer = setTimeout(function () {
    if (!spin.hidden) $v('caption').textContent = 'ภาพกำลังโหลดช้า — อาจเป็นเพราะอินเทอร์เน็ตช้า รอสักครู่หรือกดเปิดไฟล์ต้นฉบับ';
  }, 15000);
  img.onload = function () { clearTimeout(slowTimer); spin.hidden = true; img.style.opacity = '1'; $v('caption').textContent = caption; };
  img.onerror = function () {
    if (fallback && img.src !== fallback) { img.src = fallback; return; }
    clearTimeout(slowTimer);
    spin.hidden = true; $v('caption').textContent = 'โหลดภาพนี้ไม่ได้ — ไฟล์อาจยังไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์"';
  };
  img.src = imageUrlAt(url, 2000);
  img.alt = caption + ' ภาพที่ ' + (state.viewing + 1);
  $v('count').textContent = (state.viewing + 1) + ' / ' + n;
  $v('caption').textContent = caption;
  $v('original').href = originalImageUrl(url);
  $v('download').href = downloadImageUrl(url);
  $v('download').setAttribute('aria-label', 'ดาวน์โหลด' + caption + ' ภาพที่ ' + (state.viewing + 1));
  $v('prev').hidden = $v('next').hidden = n < 2;
  // โหลดภาพข้าง ๆ ไว้ก่อน กดถัดไปแล้วขึ้นทันที
  [state.viewing + 1, state.viewing - 1].forEach(function (k) {
    if (n < 2) return;
    var pre = new Image();
    pre.referrerPolicy = 'no-referrer';
    pre.src = imageUrlAt(driveUrl(state.images[(k + n) % n].id), 2000);
  });
}

/** วาดส่วนสรุปเหรียญครั้งเดียวตอนเปิดหน้า (ไม่ผูกกับรอบข้อมูลชีต) */
export function renderMedalPosters() {
  var box = document.getElementById('posters');
  var root = driveFolderId(MEDAL_POSTERS_FOLDER);
  if (!box || !root || !GOOGLE_API_KEY) return;
  loadGroups(root).then(function (groups) {
    state.images = groups.reduce(function (all, g) {
      return all.concat(g.list.map(function (id) { return { id: id, label: g.label }; }));
    }, []);
    if (!state.images.length) return;
    box.hidden = false;
    paintSlides();
  }).catch(function (err) {
    console.error('สรุปเหรียญการแข่งขัน:', err.message);
  });
  bindSlider();
}
