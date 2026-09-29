/* =========================================================
   common.js — ของใช้ร่วมกันทุกหน้า (ไอคอน, โหลดข้อมูล, จับคู่โรงเรียน, chrome)
   โหลดผ่าน <script type="module"> — ES module มาตรฐานเบราว์เซอร์ ไม่ต้องแปลงไฟล์ก่อนใช้

   คลาสทั้งหมดในไฟล์นี้เป็น utility ของ Tailwind ตัวสร้าง CSS อ่านสตริงในไฟล์ .js ด้วย
   จึงต้องเขียนชื่อคลาสเต็ม ๆ ในสตริงเสมอ ห้ามต่อชื่อคลาสจากตัวแปร (เช่น 'text-' + kind)
   ไม่งั้นคลาสนั้นจะไม่ถูกสร้างลงไฟล์ CSS — ชุดที่ใช้ซ้ำหลายที่รวบไว้เป็นค่าคงที่ข้างล่างนี้
   ========================================================= */

import { loadFromSheets } from './sheets.js';
import { hasSupabase } from './config.js';
import { MONTHS_TH, isoDate } from './format.js';

/** ป้ายสถานะ (สด / ประกาศแล้ว / รอเริ่ม) — โครงเดียว เปลี่ยนแค่คู่สีตามสถานะ */
export var CHIP = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1 text-[13px]';
/** จุดกะพริบหน้าป้าย "กำลังแข่ง" — ย้อมตามสีข้อความของป้ายที่ครอบอยู่ */
export var LIVE_DOT = '<span class="size-1.5 flex-none rounded-full bg-current motion-safe:animate-blink" aria-hidden="true"></span>';
/** ข้อความบอกว่าไม่มีรายการ ใช้ตรงกลางพื้นที่ที่ควรมีตาราง/การ์ด */
export var EMPTY_TEXT = 'p-[26px] text-center text-[14.5px] text-fg-mute';

/* ไอคอน UI ทั้งชุดวาดบนกริดเดียวกัน: viewBox 24, เส้นหนา 1.7, ปลายเส้นมน
   และรูปกินพื้นที่ราว 3.5–20.5 ทุกตัว เพื่อให้น้ำหนักสายตาเท่ากันเวลาเรียงในเมนู */
export var UI_ICONS = {
  menu: "<path d='M4 7h16M4 12h16M4 17h16' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  dashboard: "<rect x='3.5' y='3.5' width='7' height='7' rx='1.6' stroke='%23000' stroke-width='1.7'/><rect x='13.5' y='3.5' width='7' height='7' rx='1.6' stroke='%23000' stroke-width='1.7'/><rect x='3.5' y='13.5' width='7' height='7' rx='1.6' stroke='%23000' stroke-width='1.7'/><rect x='13.5' y='13.5' width='7' height='7' rx='1.6' stroke='%23000' stroke-width='1.7'/>",
  medal: "<circle cx='12' cy='9' r='5.3' stroke='%23000' stroke-width='1.7'/><path d='M8.4 13.4L7.2 20.8l4.8-2.7 4.8 2.7-1.2-7.4' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  sports: "<path d='M7.2 3.8h9.6V9a4.8 4.8 0 01-9.6 0z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/><path d='M7.2 6.2H5.2a2.1 2.1 0 000 4.2h2M16.8 6.2h2a2.1 2.1 0 010 4.2h-2' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 13.8v3.2M8.6 20.4h6.8M10 20.4l.5-3.4h3l.5 3.4' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  calendar: "<rect x='3.5' y='5' width='17' height='15.5' rx='2.5' stroke='%23000' stroke-width='1.7'/><path d='M3.5 9.8h17M8 3.5v3.6M16 3.5v3.6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  results: "<rect x='9' y='3.1' width='6' height='4' rx='1.3' stroke='%23000' stroke-width='1.7'/><path d='M15.6 5.1h1.9a2 2 0 012 2v11.4a2 2 0 01-2 2h-11a2 2 0 01-2-2V7.1a2 2 0 012-2h1.9' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/><path d='M9 13.4l2.2 2.2 4-4.5' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  live: "<circle cx='12' cy='12' r='2.4' fill='%23000'/><path d='M7.5 7.5a7 7 0 000 9M16.5 7.5a7 7 0 010 9M4.8 4.8a11 11 0 000 14.4M19.2 4.8a11 11 0 010 14.4' stroke='%23000' stroke-width='1.7' fill='none' stroke-linecap='round'/>",
  rank: "<path d='M3.5 20.5h17' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/><rect x='9.3' y='7.5' width='5.4' height='13' rx='1.2' stroke='%23000' stroke-width='1.7'/><rect x='3.6' y='12' width='5.4' height='8.5' rx='1.2' stroke='%23000' stroke-width='1.7'/><rect x='15' y='10' width='5.4' height='10.5' rx='1.2' stroke='%23000' stroke-width='1.7'/>",
  search: "<circle cx='11' cy='11' r='6.6' stroke='%23000' stroke-width='1.7'/><path d='M16.2 16.2l4.3 4.3' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  table: "<rect x='3.5' y='4.5' width='17' height='15.5' rx='2.5' stroke='%23000' stroke-width='1.7'/><path d='M3.5 9.5h17M9.5 9.5V20' stroke='%23000' stroke-width='1.7'/>"
};
function uiIconUrl(name) {
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'>" + (UI_ICONS[name] || '') + "</svg>";
  return "url(\"data:image/svg+xml," + svg + "\")";
}
export function paintUiIcons(root) {
  (root || document).querySelectorAll('[data-ic]').forEach(function (elm) {
    var url = uiIconUrl(elm.getAttribute('data-ic'));
    elm.style.webkitMaskImage = url; elm.style.maskImage = url;
  });
}
/* ไอคอนกีฬาเป็นไอคอนเส้น (SVG inline) ไม่ใช่อิโมจิ/ภาพ 3D — หน้าตาเหมือนกันทุกแพลตฟอร์ม
   และย้อมสีตามข้อความรอบ ๆ (currentColor) ได้ เช่น สีแดงในกล่อง "กำลังแข่ง"
   รูปทรงมาจากชุด Tabler Icons (สัญญาอนุญาต MIT) ยกเว้นแบดมินตันกับฮอกกี้ที่วาดเองบนกริดเดียวกัน
   กีฬานอกรายการนี้ใช้ถ้วยรางวัล (default) เป็นไอคอนกลาง */
var SPORT_ICONS = {
  athletics: "<path d='M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' /><path d='M4 17l5 1l.75 -1.5' /><path d='M15 21v-4l-4 -3l1 -6' /><path d='M7 12v-3l5 -1l3 3l3 1' />",
  badminton: "<path d='M9 17.5a3 3 0 0 0 6 0z'/><path d='M9.3 17.5L5.5 4h13l-3.8 13.5M10.2 4l.9 13.5M13.8 4l-.9 13.5'/>",
  basketball: "<path d='M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' /><path d='M5.65 5.65l12.7 12.7' /><path d='M5.65 18.35l12.7 -12.7' /><path d='M12 3a9 9 0 0 0 9 9' /><path d='M3 12a9 9 0 0 1 9 9' />",
  basketball3x3: "<path d='M9.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' /><path d='M5 21l3 -3l.75 -1.5' /><path d='M14 21v-4l-4 -3l.5 -6' /><path d='M5 12l1 -3l4.5 -1l3.5 3l4 -.5' /><path d='M18.007 15.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0' />",
  boardgame: "<path d='M12 3a3 3 0 0 1 3 3c0 1.113 -.6 2.482 -1.5 3l1.5 7h-6l1.5 -7c-.9 -.518 -1.5 -1.887 -1.5 -3a3 3 0 0 1 3 -3' /><path d='M8 9h8' /><path d='M6.684 16.772a1 1 0 0 0 -.684 .949v1.279a1 1 0 0 0 1 1h10a1 1 0 0 0 1 -1v-1.28a1 1 0 0 0 -.684 -.948l-2.316 -.772h-6l-2.316 .772' />",
  dancesport: "<path d='M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0' /><path d='M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0' /><path d='M9 17v-13h10v13' /><path d='M9 8h10' />",
  esports: "<path d='M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4' /><path d='M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232' /><path d='M8 9v2' /><path d='M7 10h2' /><path d='M14 10h2' />",
  football: "<path d='M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' /><path d='M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45' /><path d='M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45' />",
  futsal: "<path d='M3 17l5 1l.75 -1.5' /><path d='M14 21v-4l-4 -3l1 -6' /><path d='M6 12v-3l5 -1l3 3l3 1' /><path d='M18.007 19.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0' /><path d='M10.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />",
  hockey: "<path d='M6 3l6.2 13.4a2.6 2.6 0 0 0 2.4 1.6H20'/><circle cx='6.5' cy='18.5' r='2'/>",
  golf: "<path d='M12 18v-15l7 4l-7 4' /><path d='M9 17.67c-.62 .36 -1 .82 -1 1.33c0 1.1 1.8 2 4 2s4 -.9 4 -2c0 -.5 -.38 -.97 -1 -1.33' />",
  handball: "<path d='M13 21l3.5 -2l-4.5 -4l2 -4.5' /><path d='M5 7l4 3l5 .5l4 2.5l2.5 3' /><path d='M4 20l5 -1l1.5 -2' /><path d='M13.007 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' /><path d='M6.007 3.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0' />",
  petanque: "<path d='M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' /><path d='M2.5 17a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' /><path d='M13.5 17a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' />",
  softball: "<path d='M5.636 18.364a9 9 0 1 0 12.728 -12.728a9 9 0 0 0 -12.728 12.728' /><path d='M12.495 3.02a9 9 0 0 1 -9.475 9.475' /><path d='M20.98 11.505a9 9 0 0 0 -9.475 9.475' /><path d='M9 9l2 2' /><path d='M13 13l2 2' /><path d='M11 7l2 1' /><path d='M7 11l1 2' /><path d='M16 11l1 2' /><path d='M11 16l2 1' />",
  swimming: "<path d='M15 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' /><path d='M6 11l4 -2l3.5 3l-1.5 2' /><path d='M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25' />",
  tabletennis: "<path d='M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864' /><path d='M11 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' /><path d='M9.3 5.3l9.4 9.4' />",
  tennis: "<path d='M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' /><path d='M6 5.3a9 9 0 0 1 0 13.4' /><path d='M18 5.3a9 9 0 0 0 0 13.4' />",
  volleyball: "<path d='M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' /><path d='M12 12a8 8 0 0 0 8 4' /><path d='M7.5 13.5a12 12 0 0 0 8.5 6.5' /><path d='M12 12a8 8 0 0 0 -7.464 4.928' /><path d='M12.951 7.353a12 12 0 0 0 -9.88 4.111' /><path d='M12 12a8 8 0 0 0 -.536 -8.928' /><path d='M15.549 15.147a12 12 0 0 0 1.38 -10.611' />",
  default: "<path d='M8 21l8 0' /><path d='M12 17l0 4' /><path d='M7 4l10 0' /><path d='M17 4v8a5 5 0 0 1 -10 0v-8' /><path d='M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' /><path d='M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />"
};
/** @param {string} [extra] - คลาสขนาด (เช่น 'size-[22px]') ผู้เรียกกำหนดเองทุกที่ ไม่มีขนาดตั้งต้น */
export function sportIcon(id, extra) {
  return '<svg class="inline-block flex-none ' + (extra || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (SPORT_ICONS[id] || SPORT_ICONS.default) + '</svg>';
}

/* ---------- ป้องกัน HTML injection: ข้อมูลมาจาก Google Sheets ที่แก้ไขได้จากภายนอก ---------- */
var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }

export var STATUS = {
  live:     { tone: 'bg-live-bg text-live',         label: 'กำลังแข่ง', dot: true },
  done:     { tone: 'bg-done-bg text-done',         label: 'ประกาศแล้ว', dot: false },
  upcoming: { tone: 'bg-upcoming-bg text-upcoming', label: 'รอเริ่ม',   dot: false }
};

/** ป้ายสถานะสำเร็จรูป — ป้าย "สด" พ่วงจุดกะพริบมาด้วยเสมอ */
export function statusChip(status, tone) {
  var s = STATUS[status] || STATUS.upcoming;
  return '<span class="' + CHIP + ' ' + (tone || s.tone) + '">' + (s.dot ? LIVE_DOT : '') + s.label + '</span>';
}

/** อัปเดตข้อความของ element ที่อาจไม่มีในหน้านั้น (แถบบนของแต่ละหน้าไม่เหมือนกัน) */
export function setText(id, text) { var n = document.getElementById(id); if (n) n.textContent = text; }

export function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

/* ---------- โหลดข้อมูล ----------
   เว็บอยู่บน GitHub Pages ซึ่งเสิร์ฟได้แค่ไฟล์นิ่ง ๆ ไม่มี /api/ ของเราเองให้เรียก
   เบราว์เซอร์จึงไปเอาข้อมูลจากแหล่งภายนอกตรง ๆ ตามลำดับนี้

     1) Supabase   — แหล่งหลักเมื่อกรอก config.js แล้ว (แก้ข้อมูลผ่านหน้า CMS ที่ admin.html)
     2) Google Sheets — ของเดิม ใช้เมื่อยังไม่ได้ตั้งค่า Supabase หรือ Supabase ล่ม
     3) data/mock.json — กันหน้าว่างเปล่าเมื่อไม่เหลือทางไหนเลย

   ข้อ 2 ไม่ใช่แค่ของสำรองตอนย้ายระบบ: วันแข่งจริงถ้า Supabase มีปัญหา เว็บยังขึ้นผลจากชีตได้
   ตราบใดที่ยังไม่ปิดแชร์ชีตทิ้ง

   ต่อแหล่งข้อมูลไม่ได้ทั้งหมด:
     - เคยโหลดสำเร็จมาก่อนในหน้านี้ → ใช้ชุดล่าสุดต่อไป ดีกว่าสลับไปโชว์ข้อมูลตัวอย่างกลางคัน
       (ข้อมูลตัวอย่างเป็นคนละรายการ คนดูจะเห็นวัน/คู่แข่ง/เหรียญเปลี่ยนเป็นของปลอมทั้งหน้า)
     - ยังไม่เคยสำเร็จเลย → data/mock.json ให้หน้ายังมีอะไรให้ดู และแจ้งใน console ว่าเป็นของตัวอย่าง

   ความเร็ว: Google Sheets ตอบช้าไม่แน่นอน (0.4–6 วินาทีต่อแท็บ) และเว็บนี้เป็นหลายไฟล์ HTML
   กดเมนูทีไรก็เริ่มดึงใหม่ทั้งหมด จึงเก็บชุดล่าสุดไว้ใน localStorage แล้วใช้แบบ stale-while-revalidate:
   เปิดหน้า → วาดจากชุดที่เก็บไว้ทันที → ดึงของจริงเบื้องหลัง → มาถึงแล้ววาดทับ
   "อัปเดตล่าสุด hh:mm น." ในแถบบนมาจาก syncedAt ของข้อมูล คนดูจึงเห็นว่าชุดที่ขึ้นอยู่เก่าแค่ไหน */
var CACHE_KEY = 'dash-data-v1';
// เก่ากว่านี้ไม่เอามาวาดก่อน (ผลเมื่อวานขึ้นมาแวบหนึ่งก่อนเปลี่ยนชวนสับสนเกินไป) แต่ยังใช้เป็นของสำรองตอนดึงไม่ได้
var CACHE_SHOW_MS = 6 * 60 * 60 * 1000;

function readCache() {
  try {
    var data = JSON.parse(localStorage.getItem(CACHE_KEY));
    return data && data.medalTable && data.days ? data : null;
  } catch (e) { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
}
function dataAgeMs(data) {
  var t = Date.parse(data && data.syncedAt);
  return isNaN(t) ? Infinity : Date.now() - t;
}

var lastGood = readCache();
var listeners = [];        // callback จาก onFreshData — รับข้อมูลใหม่ที่มาถึงนอกรอบ loadData()
var backgroundLoad = null; // รอบที่ดึงเบื้องหลังหลังวาดจาก cache ไปแล้ว
var firstLoad = true;

function publish(data) {
  listeners.forEach(function (fn) { deliver(fn, data); });
}

/* ---------- หน้าไม่เปลี่ยนเอง ผู้ใช้เป็นคนกดอัปเดต ----------
   เบราว์เซอร์ยังดึงข้อมูลเบื้องหลังทุก 30 วินาทีเหมือนเดิม แต่ไม่วาดทับหน้าที่คนกำลังอ่านอยู่
   (เดิมวาดทับทั้งหน้าทุกรอบ การ์ด/ตาราง/ตำแหน่งที่อ่านค้างไว้รีเซ็ตเองจนคนดูรำคาญ)
   เทียบเนื้อหา (ไม่นับ syncedAt) กับชุดที่วาดอยู่:
   - เหมือนเดิม = ยืนยันว่าหน้ายังเป็นปัจจุบัน อัปเดตแค่เวลา "อัปเดตล่าสุด" ในแถบบน
   - มีผลใหม่ = เก็บไว้ แล้วโชว์ปุ่ม "มีผลใหม่ · อัปเดต" ในแถบบน กดเมื่อไรค่อยวาดชุดใหม่
   ยกเว้นช่วงเปิดหน้า: วาดจาก cache แล้วของสดมาถึงภายใน OPEN_AUTO_MS = ถือเป็นการโหลดหน้าเดียวกัน วาดทับเลย */
var OPEN_AUTO_MS = 3000;
var shownFp = null;
var syncHook = null;     // initChrome ตั้งไว้ อัปเดตเวลาในแถบบนโดยไม่วาดหน้าใหม่
var pendingHook = null;  // initChrome ตั้งไว้ แสดง/ซ่อนปุ่ม "อัปเดต"
var pending = null;      // ชุดใหม่ที่รอผู้ใช้กดอัปเดต { fn, data, fp }
function fingerprint(data) {
  return JSON.stringify(data, function (k, v) { return k === 'syncedAt' ? undefined : v; });
}
function deliver(onData, data, auto) {
  var fp = fingerprint(data);
  if (fp === shownFp) {
    pending = null;
    if (pendingHook) pendingHook(false);
    if (syncHook) syncHook(data);
    return;
  }
  if (auto) { shownFp = fp; pending = null; onData(data); return; }
  pending = { fn: onData, data: data, fp: fp };
  if (pendingHook) pendingHook(true);
}
/** ผู้ใช้กดปุ่มอัปเดต: วาดชุดที่รออยู่ */
function applyPending() {
  var p = pending;
  pending = null;
  if (pendingHook) pendingHook(false);
  if (!p) return;
  shownFp = p.fp;
  p.fn(p.data);
}

/* ภาพบรรยากาศมาถึงหลังข้อมูลหลัก (ดู loadFromSheets) — เติมเข้าชุดล่าสุดแล้ววาดใหม่ */
function onLatePhotos(photos) {
  if (!lastGood || JSON.stringify(photos) === JSON.stringify(lastGood.photos || [])) return;
  lastGood = Object.assign({}, lastGood, { photos: photos });
  writeCache(lastGood);
  publish(lastGood);
}

function loadPrimary() {
  var sheetOpts = { prevPhotos: lastGood && lastGood.photos, onLatePhotos: onLatePhotos };
  // ปิด Supabase อยู่ (config.js ว่าง) → ไม่แตะไฟล์ supabase-data.js เลย
  // โหลดแบบ dynamic import ไม่ใช่ import ข้างบน เพราะ import ปกติจะถูกดึงลงเครื่อง
  // ผู้ชมทุกคนตั้งแต่เปิดหน้า แม้ไม่มีวันได้ใช้ — เปลืองโดยไม่ได้อะไรกลับมา
  if (!hasSupabase()) return loadFromSheets(sheetOpts);

  return import('./supabase-data.js')
    .then(function (m) { return m.loadFromSupabase(); })
    .catch(function (err) {
      console.error('เชื่อมต่อ Supabase ไม่สำเร็จ, ลองดึงจาก Google Sheets แทน:', err);
      return loadFromSheets(sheetOpts);
    });
}

var inFlight = null;
var lastFetchAt = 0;
function fetchFresh() {
  // รอบก่อนยังไม่จบ (เช่นโพลชนกับตอนกลับมาที่แท็บ) ใช้รอบเดิม ไม่ยิงซ้อน
  if (inFlight) return inFlight;
  lastFetchAt = Date.now();
  inFlight = loadPrimary()
    .then(function (data) { lastGood = data; writeCache(data); return data; })
    .catch(function (err) {
      console.error('โหลดข้อมูลจากแหล่งภายนอกไม่สำเร็จ:', err);
      if (lastGood) return lastGood;
      console.warn('กำลังแสดงข้อมูลตัวอย่างจาก data/mock.json ไม่ใช่ผลจริง');
      return fetch('data/mock.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
    })
    .finally(function () { inFlight = null; });
  return inFlight;
}

export function loadData() {
  return loadFirst().then(function (data) { shownFp = fingerprint(data); return data; });
}
function loadFirst() {
  if (firstLoad) {
    firstLoad = false;
    if (lastGood && dataAgeMs(lastGood) < CACHE_SHOW_MS) {
      backgroundLoad = fetchFresh();
      return Promise.resolve(lastGood);
    }
  }
  return fetchFresh();
}

/** โหลดข้อมูลไม่สำเร็จ: แทนที่เนื้อหาทั้งหน้าด้วยกล่องบอกวิธีแก้ (เหมือนกันทุกหน้า) */
export function showLoadError(err) {
  console.error('โหลดข้อมูลไม่สำเร็จ:', err);
  document.getElementById('main').innerHTML =
    '<div class="rounded-lg border border-line bg-surface px-6 py-[22px] shadow-panel">' +
      '<p class="mt-0 mb-1.5 text-live">โหลดข้อมูลการแข่งขันไม่สำเร็จ</p>' +
      '<p class="m-0 text-[15px] text-fg-soft">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต และเปิดหน้าเว็บผ่าน http(s):// ไม่ใช่เปิดไฟล์ตรง ๆ แล้วลองรีเฟรชอีกครั้ง</p>' +
    '</div>';
}

/* ---------- ข้อมูลชุดใหม่ที่มาถึงหลังวาดหน้าแล้ว ----------
   ไม่มีการเช็กข้อมูลซ้ำเป็นระยะแล้ว — ดึงครั้งเดียวตอนเปิดหน้า ผลใหม่จะเห็นเมื่อผู้ใช้รีเฟรช/เปิดหน้าใหม่เอง
   (เดิมโพลทุก 30 วินาทีแล้ววาดทับ หน้าจึงรีเซ็ตเองระหว่างอ่านจนคนดูรำคาญ)
   ที่เหลือคือกรณีเดียว: หน้าวาดจาก cache ไปก่อน แล้วของสดจากรอบเปิดหน้ามาถึงทีหลัง
   มาถึงเร็ว (ภายใน OPEN_AUTO_MS) = วาดทับเลย ถือเป็นการโหลดหน้าเดียวกัน
   มาช้า (คนเริ่มอ่านแล้ว) = ขึ้นปุ่ม "มีผลใหม่ · อัปเดต" ให้ผู้ใช้กดเอง
   ภาพบรรยากาศที่มาถึงทีหลัง (onLatePhotos → publish) ก็ผ่านทางนี้เช่นกัน */
export function onFreshData(onData) {
  listeners.push(onData);
  if (backgroundLoad) {
    backgroundLoad.then(function (d) { deliver(onData, d, performance.now() < OPEN_AUTO_MS); }).catch(function (err) { console.warn('ดึงข้อมูลล่าสุดไม่สำเร็จ:', err); });
    backgroundLoad = null;
  }
}

export function selfMedals(data) { return data.medalTable.filter(function (m) { return m.isSelf; })[0] || { gold: 0, silver: 0, bronze: 0 }; }
export function sportName(data, id) { var s = data.sports.filter(function (x) { return x.id === id; })[0]; return s ? s.name : ''; }
export function allDayItems(data) {
  var rows = [];
  data.days.forEach(function (day) { day.items.forEach(function (i) { rows.push(i); }); });
  return rows;
}
/**
 * วันนี้ตามปฏิทินจริงของเครื่องผู้ดูใช่ไหม — ใช้ติดป้าย "วันนี้"
 * เทียบวันที่เต็มพร้อมปี (iso) ข้อมูลที่ไม่มี iso (ข้อมูลตัวอย่าง) ถอยไปเทียบป้าย "21 ต.ค." แทน
 * ต่างจาก currentDay() ที่ "เดา" วันจากผลในชีต — อันนั้นใช้เลือกว่าจะโชว์วันไหน ไม่ใช่บอกว่าวันนี้วันอะไร
 */
export function isToday(day) {
  if (!day) return false;
  var now = new Date();
  if (day.iso) return day.iso === isoDate(now);
  return day.date === now.getDate() + ' ' + MONTHS_TH[now.getMonth()];
}
/** วันที่ "กำลังเกิดขึ้น": วันที่มีแมตช์สด > วันล่าสุดที่ประกาศผลแล้ว > วันแรกของรายการ */
export function currentDay(data) {
  var days = (data && data.days) || [];
  var live = days.filter(function (d) { return (d.items || []).some(function (i) { return i.status === 'live'; }); })[0];
  if (live) return live;
  var done = days.filter(function (d) { return (d.items || []).some(function (i) { return i.status === 'done'; }); });
  return done.length ? done[done.length - 1] : (days[0] || null);
}
export function dayLabel(day) {
  if (!day) return '';
  return ((day.weekday ? day.weekday + ' ' : '') + (day.date || '')).trim();
}
/**
 * ภาพที่จะขึ้นแถบสไลด์บนหน้าหลัก
 * ชีตภาพยังไม่มีคอลัมน์วันที่ ภาพจึงถือเป็นภาพบรรยากาศรวม แสดงได้ทุกวัน
 * แต่ถ้าวันหลังเพิ่มคอลัมน์วันที่จนภาพผูกกับวันได้ ให้กลับไปแสดงเฉพาะภาพของวันนั้นตามเดิม
 */
export function dayPhotos(data, day) {
  var all = (data && data.photos) || [];
  var dated = all.filter(function (p) { return p.dayId; });
  if (!dated.length) return all;
  if (!day) return [];
  return dated
    .filter(function (p) { return String(p.dayId) === String(day.id); })
    .sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
}
/** "A พบ B" → ['A','B'] (รายการที่ไม่ใช่การพบกันสองฝ่ายจะได้กลับมาแค่ตัวเดียว) */
export function teamSides(teams) {
  return String(teams || '').split(/\s+พบ\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
}
/** "2 – 1" → ['2','1'] ; รูปแบบอื่น (เช่น "ทอง: ศรีวัฒนา") คืน null ให้ผู้เรียกแสดงเป็นข้อความแทน */
export function splitScore(score) {
  var m = /^\s*(\d+)\s*[–\-:]\s*(\d+)\s*$/.exec(String(score || ''));
  return m ? [m[1], m[2]] : null;
}

/** หัวรายการ = ชนิดกีฬา + ประเภท ซึ่งชีตส่งมาต่อกันในช่อง event ("กีฬา — ประเภท") */
export function eventParts(sport, event) {
  var text = String(event || '').trim();
  var cut = text.indexOf(' — ');
  if (cut > -1) return { sport: text.slice(0, cut), kind: text.slice(cut + 3) };
  if (sport && text.indexOf(sport) === 0) return { sport: sport, kind: text.slice(sport.length).trim() };
  return sport ? { sport: sport, kind: text } : { sport: text, kind: '' };
}

export function allMatches(data) {
  var rows = [];
  data.days.forEach(function (day) {
    day.items.forEach(function (i) {
      if (!i.sportId) return;
      rows.push({ time: i.time, sportId: i.sportId, sport: sportName(data, i.sportId), event: i.event, teams: i.teams, score: i.score, status: i.status, unofficial: i.unofficial, day: day.id });
    });
  });
  return rows;
}

/* ---------- ระบุตัวโรงเรียน: id คงที่จากชื่อ ใช้เป็น deep link (school.html?id=) ---------- */
export function schoolKey(m) { return (m && (m.fullName || m.school)) || ''; }
export function schoolId(name) {
  var s = String(name || ''), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}
export function findSchool(data, id) {
  var rows = (data && data.medalTable) || [];
  return rows.filter(function (m) { return schoolId(schoolKey(m)) === id; })[0] || null;
}

/* ---------- โลโก้โรงเรียน ----------
   ไฟล์ใน assets/school/ ตั้งชื่อตามตัวย่อของโรงเรียน โดยตัดจุดท้ายทิ้ง (จฬม. → จฬม.png)
   ข้อมูลจากชีตไม่มีช่องตัวย่อ จึงเดาจากคำเฉพาะในชื่อเป็นทางสำรอง
   เรียงจากคำที่เจาะจงกว่าไปหาคำกว้าง (กำแพงแสน ต้องมาก่อน เกษตร) */
var LOGO_KEYWORDS = [
  ['กำแพงแสน', 'กพส.'], ['เกษตร', 'สมก.'],
  ['หนองคาย', 'มข.นค.'], ['ขอนแก่น', 'สมข.'],
  ['จุฬา', 'จฬม.'], ['ปทุมวัน', 'ปทว.'], ['ประสานมิตร', 'สปม.'], ['องครักษ์', 'สอร.'],
  ['รามคำแหง', 'สธ.มร.'], ['ศิลปากร', 'มศก.'],
  ['พิบูลบำเพ็ญ', 'พมบ.'], ['บูรพา', 'พมบ.'],
  ['เชียงใหม่', 'สมช.'], ['นเรศวร', 'สมน.'], ['พะเยา', 'สมพ.'], ['มหาสารคาม', 'สมค.'],
  ['ปัตตานี', 'ปมอ.'], ['สงขลานครินทร์', 'ปมอ.']
];

export function schoolAbbr(m) {
  if (!m) return '';
  if (m.abbr) return m.abbr;
  var text = [m.fullName, m.school, m.name].filter(Boolean).join(' ');
  for (var i = 0; i < LOGO_KEYWORDS.length; i++) {
    if (text.indexOf(LOGO_KEYWORDS[i][0]) > -1) return LOGO_KEYWORDS[i][1];
  }
  return '';
}
/** พาธรูปโลโก้ ('' = ไม่รู้จักโรงเรียนนี้ ให้ผู้เรียกใช้ตัวอักษรย่อแทน) */
export function schoolLogo(m) {
  if (m && m.logo) return encodeURI(m.logo);
  var abbr = schoolAbbr(m);
  return abbr ? 'assets/school/' + encodeURIComponent(abbr.replace(/\.$/, '')) + '.png' : '';
}
/** ตราโรงเรียน: ใช้โลโก้จริงถ้ามีไฟล์ ไม่มีก็วงกลมตัวอักษรแรกเหมือนเดิม
    โลโก้จริงเป็นตราพื้นโปร่ง — ใส่พื้นขาวไว้เสมอเพื่อให้อ่านออกทั้งธีมสว่างและมืด
    @param {string} [extraCls] - คลาสขนาด (เช่น 'size-11') ผู้เรียกกำหนดเองทุกที่ ไม่มีขนาดตั้งต้น
    @param {string} [letterTone] - คู่สีของวงกลมตัวอักษร (ใช้เมื่อโรงเรียนไม่มีไฟล์โลโก้)
      โลโก้จริงไม่รับค่านี้ เพราะตราต้องอยู่บนพื้นขาวเสมอไม่ว่าจะเป็นแถวของใคร */
export function schoolCrest(m, extraCls, letterTone) {
  var extra = extraCls ? ' ' + extraCls : '';
  var src = schoolLogo(m);
  if (src) {
    return '<img class="flex-none rounded-full border border-line bg-white object-contain p-[3px]' + extra + '"' +
      ' src="' + esc(src) + '" alt="" loading="lazy" decoding="async" />';
  }
  var label = (m && (m.abbr || m.school || m.fullName || m.name)) || '?';
  return '<span class="flex flex-none items-center justify-center rounded-full border ' +
    (letterTone || 'border-line bg-surface text-fg-soft') + extra + '"' +
    ' aria-hidden="true">' + esc(String(label).trim().charAt(0)) + '</span>';
}

/* ---------- มาสคอตประจำกีฬา ----------
   ไฟล์ใน assets/sport_mascot/ ตั้งชื่อเป็นภาษาไทยพร้อมลำดับนำหน้า จึงต้อง map จาก sportId
   หน้าเว็บใช้ไฟล์ย่อใน web/ (กว้าง 480px, .webp ~35KB) ไม่ใช่ไฟล์ต้นฉบับ 2–4MB
   ที่โหลดทั้งหน้าชนิดกีฬาแล้วหนักเกิน 20MB — ต้นฉบับเก็บไว้ในโฟลเดอร์เดิมสำหรับงานพิมพ์
   กีฬาที่ยังไม่มีไฟล์มาสคอตคืนค่าว่าง ให้ผู้เรียกใช้ไอคอนกีฬาแทน */
var MASCOT_FILES = {
  athletics: '01 กรีฑา', golf: '02 กอล์ฟ', softball: '03 ซอฟบอล', sepaktakraw: '04 เซปักตะกร้อ',
  tennis: '05 เทนนิส', tabletennis: '06 เทเบิลเทนนิส', basketball: '07 บาสเกตบอล',
  badminton: '08 แบดมินตัน', petanque: '09 เปตอง', futsal: '10 ฟุตซอล', football: '11 ฟุตบอล',
  dancesport: '12 ลีลาส', volleyball: '13 วอลเลย์บอล', swimming: '14 ว่ายน้ำ',
  boardgame: '15 หมากกระดาน', hockey: '16 ฮอกกี้', handball: '17 แฮนด์บอล',
  teqball: '18 เทคบอล', basketball3x3: '19 บาส3x3'
};
export function sportMascot(id) {
  var file = MASCOT_FILES[id];
  return file ? 'assets/sport_mascot/web/' + encodeURIComponent(file) + '.webp' : '';
}
/** ภาพมาสคอต ('' = กีฬานี้ยังไม่มีไฟล์) — alt ว่างเพราะเป็นภาพประกอบ ชื่อกีฬาอยู่ในข้อความข้าง ๆ แล้ว */
export function sportMascotImg(id, cls) {
  var src = sportMascot(id);
  return src
    ? '<img class="' + (cls || 'mascot') + '" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" />'
    : '';
}

/* ---------- จับคู่ชื่อโรงเรียนกับตารางแข่งขัน ----------
   แต่ละแท็บในชีตสะกดชื่อไม่ตรงกัน เช่น "สาธิตม.รามคำแหง (ฝ่ายมัธยม)" ในตารางเหรียญ
   แต่เขียนว่า "สาธิตราม มัธยม" ในตารางแข่งขัน จึงตัดคำที่ทุกโรงเรียนใช้ร่วมกันออกก่อน
   แล้วเทียบเฉพาะคำที่บอกตัวตนจริง ๆ (ปทุมวัน / รามคำแหง / กำแพงแสน) */
var GENERIC_WORDS = /โรงเรียน|สาธิตการศึกษา|สาธิต|มหาวิทยาลัย|วิทยาเขต|ศูนย์วิจัยและพัฒนาการศึกษา|สถาบันวิจัย|ฝ่ายมัธยมศึกษา|ฝ่ายมัธยม|มัธยมศึกษาตอนต้น|มัธยมศึกษาตอนปลาย|มัธยมศึกษา|มัธยม|มศว|ม\./g;

export function normSchoolText(s) {
  return String(s || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(GENERIC_WORDS, ' ')
    .replace(/[""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function schoolCores(m) {
  var seen = [];
  [m.fullName, m.school].forEach(function (raw) {
    normSchoolText(raw).split(' ').forEach(function (t) {
      if (t.length >= 3 && seen.indexOf(t) < 0) seen.push(t);
    });
  });
  return seen;
}
/** คะแนน = ความยาวของคำที่ตรงกันมากที่สุด (0 = ไม่ตรง) ใช้ตัดสินเมื่อหลายโรงเรียนชื่อคล้ายกัน */
export function matchScore(text, cores) {
  var toks = normSchoolText(text).split(' ').filter(Boolean), best = 0;
  cores.forEach(function (c) {
    toks.forEach(function (t) {
      var n = Math.min(c.length, t.length);
      if (n >= 3 && (c.indexOf(t) === 0 || t.indexOf(c) === 0)) best = Math.max(best, n);
    });
  });
  return best;
}
/** ชื่อทีมในตารางแข่งขัน ("ปทุมวัน (เรา)") → แถวในตารางเหรียญ ใช้ดึงโลโก้ตอนประกาศผล */
export function schoolByText(data, text) {
  var best = null, bestScore = 0;
  ((data && data.medalTable) || []).forEach(function (m) {
    var s = matchScore(text, schoolCores(m));
    if (s > bestScore) { bestScore = s; best = m; }
  });
  return best;
}
export function schoolMatches(data, m) {
  var cores = schoolCores(m), rows = [];
  var others = data.medalTable
    .filter(function (o) { return o !== m; })
    .map(function (o) { return schoolCores(o); });

  /** เทียบทีละฝั่งของ "A พบ B" หนึ่งแถวเป็นของทั้งสองโรงเรียน */
  function belongsTo(i) {
    var sides = String(i.teams || '').split(/\s+พบ\s+/);
    if (i.score) sides.push(String(i.score));
    return sides.some(function (side) {
      var score = matchScore(side, cores);
      if (!score) return false;
      // ฝั่งนี้มีโรงเรียนอื่นที่ชื่อตรงกว่า แปลว่าเป็นของโรงเรียนนั้น ไม่ใช่ของเรา
      return !others.some(function (oc) { return matchScore(side, oc) > score; });
    });
  }

  data.days.forEach(function (day) {
    day.items.forEach(function (i) {
      if (!belongsTo(i)) return;
      rows.push({
        time: i.time, sportId: i.sportId, event: i.event, teams: i.teams,
        score: i.score, status: i.status, dayId: day.id,
        dayLabel: (day.weekday ? day.weekday + ' ' : '') + (day.date || '')
      });
    });
  });
  return rows;
}

/* =========================================================
   ตารางอันดับเหรียญ — ใช้ทั้งหน้าหลัก (8 อันดับแรก) และหน้าอันดับเหรียญ (ทั้งหมด)
   ตัวเลขล้วน ไม่มีแถบสัดส่วน: ชนิดเหรียญบอกด้วยไอคอนเหรียญ "คู่กับ" ข้อความกำกับเสมอ
   (ไอคอนเป็นรูปทรง mask ใน styles.css ไม่ใช่อิโมจิ จึงหน้าตาเหมือนกันทุกแพลตฟอร์ม)
   ========================================================= */
/* สีตัวเลขตามชนิดเหรียญของตัวเอง ไอคอนในหัวคอลัมน์ใช้สีเดียวกัน จึงจับคู่คอลัมน์กับชนิดได้ทันที
   ยอดรวมเป็นสีเน้นและตัวโตสุด เพราะเป็นตัวเลขที่คนมองหาเป็นอันดับแรก
   เงินใช้เฉดเข้มกับไอคอนด้วย (ไม่ใช่ bg-silver) เพราะสีเงินสดเกือบขาว ไอคอน 14px จะจมหายไปกับพื้น */
var MEDAL_COLS = [
  { key: 'gold', coin: 1, num: 'text-gold-ink text-[18px] max-[720px]:text-[20px]', label: 'ทอง', pos: 'max-[720px]:col-start-2 max-[720px]:row-start-2' },
  { key: 'silver', coin: 2, num: 'text-silver-ink text-[18px] max-[720px]:text-[20px]', label: 'เงิน', pos: 'max-[720px]:col-start-3 max-[720px]:row-start-2' },
  { key: 'bronze', coin: 3, num: 'text-bronze-ink text-[18px] max-[720px]:text-[20px]', label: 'ทองแดง', pos: 'max-[720px]:col-start-4 max-[720px]:row-start-2' }
];
// "รวม" ไม่ใช่ชนิดเหรียญ จึงไม่มีไอคอนเหรียญ — เป็นผลบวก ไม่ใช่ของอีกอย่างหนึ่ง
var TOTAL_COL = {
  num: 'text-brand-strong text-[19.5px] max-[720px]:text-[21px]', label: 'รวม', plain: true,
  pos: 'max-[720px]:col-start-5 max-[720px]:row-span-2 max-[720px]:row-start-1 max-[720px]:justify-end'
};

/* โครงร่วมของแถวหัวตารางกับแถวข้อมูล — คอลัมน์ต้องตรงกันเป๊ะ จึงใช้สตริงเดียวกัน
   คอลัมน์ชื่อมีพื้นขั้นต่ำ 7rem: ถ้าปล่อยเป็น minmax(0,1fr) แล้วแผงแคบกว่าที่คาด
   คอลัมน์จะยุบจนเหลือความกว้างตัวอักษรเดียว ชื่อไทยจะเรียงลงแนวตั้งอ่านไม่ออก
   จอ ≥1200px แบ่งที่ว่างส่วนหนึ่งให้คอลัมน์ตัวเลข ไม่งั้นตัวเลขจะอยู่ไกลจากชื่อจนต้องกวาดสายตาข้ามแถว */
var MT_GRID = 'grid grid-cols-[40px_minmax(7rem,1fr)_repeat(4,minmax(58px,76px))] items-center gap-3 px-5' +
  ' min-[1200px]:grid-cols-[40px_minmax(7rem,1fr)_repeat(4,92px)] min-[1200px]:px-6';

/** ไอคอนกำกับชนิดเหรียญ (คอลัมน์รวมเป็นข้อความ) ใช้ทั้งในหัวตาราง (จอกว้าง) และในช่องตัวเลข (จอแคบ) */
function medalTag(col, micSize) {
  // ไอคอนคือวงเหรียญที่ครอปจากรูปเหรียญบนโพเดียม (assets/medals/coin-N.webp) ให้เป็นชุดเดียวกันทั้งหน้า
  // ชนิดเหรียญบอกด้วยรูปเหรียญอย่างเดียว ไม่มีข้อความ — ชื่อชนิดอยู่ใน title (ชี้เมาส์) และ aria-label ของแถว
  if (col.plain) return col.label;
  return '<img class="flex-none ' + micSize + '" src="assets/medals/coin-' + col.coin + '.webp" alt="" title="' + col.label + '" width="64" height="64" decoding="async" />';
}

/* จอกว้างมีหัวคอลัมน์บอกชนิดเหรียญอยู่แล้ว ป้ายในช่องจึงโผล่เฉพาะจอแคบที่ไม่มีหัวตาราง
   เดิมวางป้ายไว้ "ข้าง" ตัวเลข ซึ่งกินความกว้างช่องละ ~40px จนต้องย่อทั้งไอคอนและตัวเลขลง
   เพื่อไม่ให้คอลัมน์ "รวม" หลุดขอบการ์ดที่ 360px — กลายเป็นว่าจอที่ต้องอ่านกลางแดด
   ได้ตัวเลขเล็กกว่าจอคอมพิวเตอร์ ซึ่งกลับหัวกลับหางกับความจริง
   ตอนนี้วางป้าย "เหนือ" ตัวเลขแทน ความกว้างของช่องจึงเท่ากับคำที่ยาวที่สุด ("ทองแดง")
   ไม่ใช่ผลรวมของป้ายบวกตัวเลข เหลือที่ให้ขยายตัวเลขเป็น 18px ได้โดยไม่ดันอะไรหลุดขอบ */
function medalCell(col, value) {
  return '<span class="min-w-0 text-right max-[720px]:flex max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-px max-[720px]:text-left max-[720px]:whitespace-nowrap ' + col.pos + '">' +
    '<span class="hidden text-[13.5px] text-fg-mute max-[720px]:flex max-[720px]:items-center max-[720px]:gap-[4px]">' +
      medalTag(col, 'size-[20px]') +
    '</span>' +
    // ศูนย์ใช้สีจาง ตัวเลขที่มีเหรียญจริงจึงเด่นขึ้นมาเอง ไม่ต้องไล่อ่านทีละช่อง
    '<b class="font-mono leading-[1.1] font-normal tabular-nums ' + col.num + (value ? '' : ' opacity-35') + '">' + value + '</b>' +
  '</span>';
}

/**
 * วาดตารางอันดับลงใน host
 * @param {object} opts - { pinned: แถวที่ตรึงไว้ท้ายตาราง }
 */
export function renderMedalTable(host, rows, opts) {
  opts = opts || {};

  host.innerHTML = '';
  // จอแคบไม่มีหัวตาราง (ตัวเลขพกป้ายกำกับของตัวเองแทน) — หัวคอลัมน์ตัวเลขชิดขวาเหมือนตัวเลขที่อยู่ใต้มัน
  host.appendChild(el('div', MT_GRID + ' border-b border-line py-3 text-[15px] text-fg-soft max-[720px]:hidden',
    '<span class="flex items-center">อันดับ</span><span class="flex items-center">โรงเรียน</span>' +
    MEDAL_COLS.concat(TOTAL_COL).map(function (c) {
      return '<span class="flex items-center justify-end gap-1.5 whitespace-nowrap">' + medalTag(c, 'size-[26px]') + '</span>';
    }).join('')));
  host.lastChild.setAttribute('aria-hidden', 'true');

  /* อันดับ 1–3 เท่านั้นที่ได้ป้ายสีเหรียญ เพราะเป็นความหมายของอันดับนั้นจริง
     อันดับอื่นเป็นตัวเลขเปล่า ไม่ต้องมีวงกลมเทาให้รก */
  var RANK_TONE = {
    1: 'bg-gold text-[oklch(28%_0.06_75)]',
    2: 'bg-silver text-[oklch(30%_0.01_250)]',
    3: 'bg-bronze text-[oklch(99%_0.005_60)]'
  };

  function addRow(m) {
    var total = m.gold + m.silver + m.bronze;
    // ชื่อเต็มตรงตามที่สะกดในชีต ไม่ย่อ — ชื่อโรงเรียนเป็นข้อมูลทางการที่ต้องตรงกับต้นทาง
    // ชื่อยาวจึงตัดขึ้นบรรทัดใหม่ได้ ไม่ตัดท้ายทิ้งด้วย ellipsis เพราะชื่อโรงเรียนต่างกันที่ท้ายชื่อ
    // (ฝ่ายมัธยม / วิทยาเขต…) — break-words ตัดตามขอบคำไทยก่อน แล้วค่อยหักกลางคำที่ยาวเกินคอลัมน์จริง ๆ
    var name = m.fullName || m.school;
    // opts.onPick: แตะแถวแล้วเปิดป๊อปอัปรายละเอียด (ไม่ได้พาไปหน้าใหม่) — ไม่ส่งมา แถวเป็นข้อมูลเฉย ๆ
    var pick = typeof opts.onPick === 'function';
    var row = el(pick ? 'button' : 'div',
      MT_GRID + ' border-b border-line py-3 text-[17px] text-fg last:border-b-0' +
      (pick ? ' w-full cursor-pointer text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand active:bg-surface-soft motion-reduce:transition-none' +
        (m.isSelf ? '' : ' hover:bg-surface-soft') : '') +
      /* จอแคบ: ตัวเลขเหรียญย้ายลงบรรทัดที่สอง ชื่อโรงเรียนกับยอดรวมอยู่บรรทัดแรก */
      ' max-[720px]:grid-cols-[28px_repeat(3,minmax(0,1fr))_minmax(38px,auto)] max-[720px]:gap-x-1.5 max-[720px]:gap-y-2 max-[720px]:px-3.5 max-[720px]:py-3' +
      (m.isSelf ? ' bg-brand-100' : ''),
      '<span class="flex size-7 flex-none items-center justify-center rounded-full font-mono text-[17px] max-[720px]:col-start-1 max-[720px]:row-span-2 max-[720px]:row-start-1 ' +
        (RANK_TONE[m.rank] || 'text-fg-mute') + '">' + m.rank + '</span>' +
      '<span class="flex min-w-0 items-center gap-3 max-[720px]:col-span-3 max-[720px]:col-start-2 max-[720px]:row-start-1">' +
        schoolCrest(m, 'size-9 max-[720px]:hidden') +
        '<span class="min-w-0 text-[17px] leading-[1.35] break-words max-[720px]:text-[17.5px]">' + esc(name) + '</span>' +
      '</span>' +
      MEDAL_COLS.map(function (c) { return medalCell(c, m[c.key]); }).join('') +
      medalCell(TOTAL_COL, total));
    // ไม่มีป้าย "โรงเรียนเรา" ในแถวแล้ว (พื้นสีบอกอยู่แล้ว) แต่โปรแกรมอ่านหน้าจอยังต้องรู้
    if (pick) {
      row.type = 'button';
      row.setAttribute('aria-haspopup', 'dialog');
      row.addEventListener('click', function () { opts.onPick(m, row); });
    } else {
      row.setAttribute('role', 'group');
    }
    row.setAttribute('aria-label',
      (pick ? 'ดูรายละเอียด ' : '') + name + (m.isSelf ? ' (โรงเรียนของเรา)' : '') + ' อันดับ ' + m.rank +
      ' ทอง ' + m.gold + ' เงิน ' + m.silver + ' ทองแดง ' + m.bronze + ' รวม ' + total);
    host.appendChild(row);
  }

  rows.forEach(addRow);
  if (opts.pinned) {
    // ช่องว่างเมื่อโรงเรียนเราหลุดจากอันดับต้น ๆ แต่ยังถูกตรึงไว้ท้ายตาราง
    host.appendChild(el('div', 'border-b border-line py-1.5 text-center text-[14.5px] tracking-[.35em] text-fg-mute', '⋯'));
    addRow(opts.pinned);
  }
}

/* ---------- ส่วนต่างเหรียญกับโรงเรียนที่อยู่ติดกันในตาราง ---------- */
export function medalDiff(higher, lower) {
  var kinds = [['gold', 'เหรียญทอง'], ['silver', 'เหรียญเงิน'], ['bronze', 'เหรียญทองแดง']];
  for (var i = 0; i < kinds.length; i++) {
    var d = (higher[kinds[i][0]] || 0) - (lower[kinds[i][0]] || 0);
    if (d !== 0) return { n: Math.abs(d), label: kinds[i][1] };
  }
  return null;
}

/* =========================================================
   chrome: sidebar / topbar ที่เหมือนกันทุกหน้า
   ========================================================= */
export function initChrome(activePage) {
  var root = document.documentElement, app = document.getElementById('app');
  var saved = null; try { saved = localStorage.getItem('dash-theme'); } catch (e) {}
  if (saved) root.setAttribute('data-theme', saved);

  document.getElementById('themeToggle').addEventListener('click', function () {
    var isDark = root.getAttribute('data-theme') === 'dark' ||
      (!root.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('dash-theme', next); } catch (e) {}
  });

  /* เมนูบนจอแคบ: สถานะเปิด/ปิดอยู่ที่ data-side ของ #app แล้วให้ตัวแปร group-data-[side=open]
     ใน HTML เลื่อนแถบเมนูเข้ามาเอง (JS ไม่ต้องรู้ว่าหน้าตาของ "เปิด" เป็นอย่างไร) */
  var scrim = document.getElementById('scrim');
  function setSide(open) { app.dataset.side = open ? 'open' : 'closed'; scrim.hidden = !open; }
  document.getElementById('menuBtn').addEventListener('click', function () {
    setSide(app.dataset.side !== 'open');
  });
  scrim.addEventListener('click', function () { setSide(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && app.dataset.side === 'open') setSide(false);
  });

  // เมนูของหน้าปัจจุบัน: aria-current เป็นทั้งข้อมูลให้โปรแกรมอ่านหน้าจอและตัวสั่งสีของปุ่ม
  document.querySelectorAll('[data-page]').forEach(function (a) {
    if (a.getAttribute('data-page') === activePage) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  document.getElementById('liveBell').addEventListener('click', function () { location.href = 'matches.html'; });

  // แถบบนแสดง "เวลา" ที่ข้อมูลถูกดึงมา (อัปเดตล่าสุด 14:32 น.) — เขียนครั้งเดียวต่อชุดข้อมูล ไม่มีตัวนับวินาที
  var syncedMs = NaN, out = document.getElementById('syncTime');
  function showSynced(data) {
    syncedMs = Date.parse(data.syncedAt);
    var t = isNaN(syncedMs) ? new Date() : new Date(syncedMs);
    out.textContent = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }
  syncHook = showSynced;

  // ปุ่ม "มีผลใหม่ · อัปเดต" — สร้างจาก JS ที่เดียว ไม่ต้องแก้ HTML ทั้ง 6 หน้า
  // วางหน้าข้อความ "อัปเดตล่าสุด" ซ่อนไว้จนกว่าจะมีชุดใหม่รออยู่ ไม่กะพริบ ไม่เด้ง
  var status = out.closest('[role="status"]');
  var newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.hidden = true;
  newBtn.className = 'btn h-[38px] rounded-full px-4 text-[13.5px]';
  newBtn.innerHTML = '<span class="max-[560px]:hidden">มีผลใหม่ · </span>อัปเดต';
  newBtn.setAttribute('aria-label', 'มีผลการแข่งขันใหม่ กดเพื่ออัปเดตหน้า');
  newBtn.addEventListener('click', applyPending);
  if (status) status.parentNode.insertBefore(newBtn, status);
  pendingHook = function (on) { newBtn.hidden = !on; };

  paintUiIcons();

  return {
    /** เรียกทุกครั้งที่ข้อมูลใหม่มาถึง: อัปเดตชื่อโรงเรียน/อันดับ/แจ้งเตือนสด ในแถบบน */
    onData: function (data) {
      // เวลาที่ข้อมูลชุดนี้ถูกดึงมาจริง ไม่ใช่เวลาที่วาด — ชุดจาก cache จึงไม่ถูกอ้างว่าเพิ่งอัปเดต
      showSynced(data);
      // แต่ละหน้ามีองค์ประกอบในแถบบนไม่เท่ากัน จึงอัปเดตเฉพาะอันที่มีจริงในหน้านั้น
      setText('schoolChipName', data.school.name);
      setText('schoolChipRank', 'อันดับ ' + (data.school.rank || '—') + ' / ' + data.school.totalSchools);
      setText('schoolMark', data.school.name.trim().charAt(0) || '?');
      setText('metaEdition',
        data.school.name + ' · อันดับ ' + (data.school.rank || '—') + ' จาก ' + data.school.totalSchools + ' โรงเรียน');

      var liveNow = allDayItems(data).filter(function (i) { return i.status === 'live'; }).length;
      var badge = document.getElementById('liveBadge');
      if (badge) { badge.textContent = liveNow; badge.hidden = liveNow === 0; }
    },
    /** อายุของชุดข้อมูลที่แสดงอยู่ (วินาที) คำนวณตอนเรียก — ไม่มีตัวจับเวลาวิ่งอยู่เบื้องหลัง */
    secondsSinceSync: function () { return isNaN(syncedMs) ? 0 : Math.max(0, Math.round((Date.now() - syncedMs) / 1000)); }
  };
}
