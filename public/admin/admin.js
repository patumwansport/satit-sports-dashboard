/* =========================================================
   admin/admin.js — CMS หลังบ้าน (ระบบสำรอง)

   หน้าที่ของหน้านี้:
     1) แก้ข้อมูลทุกหมวดที่หน้าเว็บแสดง (ผล / ตาราง / เหรียญ / กีฬา / ภาพ / ตั้งค่า)
     2) จัดการแบนเนอร์ประกาศที่ขึ้นบนหน้าเว็บสาธารณะ
     3) ดูสถิติผู้เข้าชม (ข้อมูลมาจาก admin/site.js ที่ทุกหน้าโหลด)
     4) สำรอง / กู้คืน / ดึงข้อมูลล่าสุดจาก Google Sheets เข้าฐานข้อมูล

   "สำรอง" แปลว่า: ทุกวันนี้หน้าเว็บอ่านผลจาก Google Sheets ฐานข้อมูลนี้คือตัวเตรียมไว้
   กด "ดึงจาก Google Sheets" เป็นระยะให้ข้อมูลในฐานทันสมัยอยู่เสมอ วันที่ชีตใช้ไม่ได้
   จะได้สลับหน้าเว็บมาอ่านจากที่นี่ได้ทันที (กรอก js/config.js) โดยไม่ต้องกรอกข้อมูลใหม่หมด

   สิทธิ์การเขียนบังคับที่ RLS ในฐานข้อมูล ไม่ใช่ที่ไฟล์นี้ — การซ่อนปุ่มเป็นเรื่องความสะดวก
   ========================================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from './config.js';
import { esc, sportIcon, UI_ICONS } from '../js/common.js';
import { loadFromSheets, useSheet, currentSheetId, sheetIdFromUrl, gvizUrl, SHEET_KEYS, SHEET_TABS, DEFAULT_SHEET_ID } from '../js/sheets.js';
import { MONTHS_TH, directImageUrl, imageUrlAt, imageFallbackAt } from '../js/format.js';
import { sheetRows, isMissingPhotoColumns, withoutPhotoDays } from './sheets-sync.js';
import { checkDriveFolder, driveFolderId } from '../js/drive-photos.js';
import { newsCard, NEWS_TONE, safeUrl } from '../js/news.js';
import { HERO_SLOTS } from '../js/hero-settings.js';
import { GALLERY_KEYS, parseHiddenFolders } from '../js/gallery-settings.js';
import { DRIVE_FOLDER, HIDDEN_FOLDERS } from '../js/gallery-config.js';

/* =========================================================
   ไอคอนเพิ่มเติมของหน้านี้ — วาดบนกริดเดียวกับ UI_ICONS (viewBox 24 เส้น 1.7)
   ========================================================= */
var ICONS = Object.assign({}, UI_ICONS, {
  visitors: "<circle cx='9' cy='8' r='3.6' stroke='%23000' stroke-width='1.7'/><path d='M3 19.5c.6-3.2 3-5.2 6-5.2s5.4 2 6 5.2' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/><path d='M15.5 4.6a3.6 3.6 0 010 6.8M18 14.6c1.6.7 2.7 2.4 3 4.9' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  banner: "<path d='M4 9.5v5a1.5 1.5 0 001.5 1.5H7l9 4.5V3.5L7 8H5.5A1.5 1.5 0 004 9.5z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/><path d='M19.5 9a4 4 0 010 6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  photo: "<rect x='3.5' y='4.5' width='17' height='15' rx='2.5' stroke='%23000' stroke-width='1.7'/><circle cx='9' cy='10' r='1.8' stroke='%23000' stroke-width='1.7'/><path d='M4 17l4.5-4 3.5 3 3-2.5 5 4' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/>",
  settings: "<circle cx='12' cy='12' r='3' stroke='%23000' stroke-width='1.7'/><path d='M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  backup: "<ellipse cx='12' cy='6' rx='7.5' ry='2.8' stroke='%23000' stroke-width='1.7'/><path d='M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6' stroke='%23000' stroke-width='1.7'/>",
  // ไอคอน calendar ใน UI_ICONS ขาดช่องว่างระหว่าง y='5' กับ width จน SVG เสีย — วาดใหม่ที่นี่แทน
  calendar: "<rect x='3.5' y='5' width='17' height='15.5' rx='2.5' stroke='%23000' stroke-width='1.7'/><path d='M3.5 9.8h17M8 3.5v3.6M16 3.5v3.6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  folder: "<path d='M3.5 7.5a2 2 0 012-2h4l2 2.2h7a2 2 0 012 2V17a2 2 0 01-2 2h-13a2 2 0 01-2-2z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/>",
  edit: "<path d='M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/><path d='M13.5 6.5l4 4' stroke='%23000' stroke-width='1.7'/>",
  plus: "<path d='M12 5v14M5 12h14' stroke='%23000' stroke-width='1.9' stroke-linecap='round'/>",
  trash: "<path d='M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.6 1.6 0 001.6 1.5h6.2a1.6 1.6 0 001.6-1.5l.8-12' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  refresh: "<path d='M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4v4h-4' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  download: "<path d='M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  upload: "<path d='M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 19.5h15' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  sync: "<path d='M4.5 10a7.5 7.5 0 0113.4-3.6L19.5 8M19.5 14a7.5 7.5 0 01-13.4 3.6L4.5 16' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/><path d='M19.5 4v4h-4M4.5 20v-4h4' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  info: "<circle cx='12' cy='12' r='8.5' stroke='%23000' stroke-width='1.7'/><path d='M12 11v5.5' stroke='%23000' stroke-width='1.8' stroke-linecap='round'/><circle cx='12' cy='7.8' r='1.1' fill='%23000'/>",
  external: "<path d='M13.5 4.5h6v6M19.5 4.5l-8.5 8.5' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/><path d='M17.5 13.5v4.5a2 2 0 01-2 2h-9.5a2 2 0 01-2-2V8.5a2 2 0 012-2h4.5' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  logout: "<path d='M14 4.5H6.5a2 2 0 00-2 2v11a2 2 0 002 2H14' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/><path d='M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/>",
  eye: "<path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/><circle cx='12' cy='12' r='3' stroke='%23000' stroke-width='1.7'/>",
  views: "<path d='M4 19.5V10M10 19.5V4.5M16 19.5v-7M21 19.5H3' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>"
});
function paintIcons(root) {
  (root || document).querySelectorAll('[data-ic]').forEach(function (elm) {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'>" + (ICONS[elm.getAttribute('data-ic')] || '') + '</svg>';
    var url = 'url("data:image/svg+xml,' + svg + '")';
    elm.style.webkitMaskImage = url; elm.style.maskImage = url;
  });
}

/* =========================================================
   คำอธิบายหมวดข้อมูล
   kind: 'table' = ตารางแก้ไขได้ · 'stats' = สถิติผู้เข้าชม · 'backup' = สำรองข้อมูล
   columns = สิ่งที่เห็นในตาราง · fields = สิ่งที่แก้ได้ในกล่องแก้ไข
   ========================================================= */

var STATUS_OPTIONS = [
  { value: 'upcoming', label: 'รอเริ่ม' },
  { value: 'live', label: 'กำลังแข่ง' },
  { value: 'done', label: 'ประกาศผลแล้ว' }
];
var TONE_OPTIONS = [
  { value: 'info', label: 'ข่าวสาร (น้ำเงิน)' },
  { value: 'success', label: 'ข่าวดี (เขียว)' },
  { value: 'warning', label: 'แจ้งเตือน (เหลือง)' },
  { value: 'danger', label: 'ด่วน / สำคัญ (แดง)' }
];
var PLACEMENT_OPTIONS = [
  { value: 'all', label: 'หน้าหลัก + แถบบนสุดทุกหน้า' },
  { value: 'home', label: 'หน้าหลักเท่านั้น' }
];

function matchFields() {
  return [
    { key: 'match_date', label: 'วันที่', type: 'date', required: true, size: 'half' },
    { key: 'start_time', label: 'เวลาเริ่ม', type: 'time', hint: 'เว้นว่างได้ถ้ายังไม่กำหนดเวลา', size: 'half' },
    { key: 'sport_id', label: 'ชนิดกีฬา', type: 'select', options: 'sports', required: true },
    { key: 'event_type', label: 'ประเภท', type: 'text', hint: 'เช่น ชายเดี่ยว รอบชิงชนะเลิศ · รายการที่ไม่ได้แข่งเป็นคู่ (เช่น กรีฑา) เว้นช่องทีมว่างไว้' },
    { key: 'team_a', label: 'ทีม/ฝ่าย A', type: 'text', size: 'half' },
    { key: 'team_b', label: 'ทีม/ฝ่าย B', type: 'text', size: 'half' }
  ];
}

var VIEWS = [
  { group: 'ภาพรวม' },
  {
    id: 'stats', kind: 'stats', icon: 'visitors',
    title: 'ผู้เข้าชมเว็บไซต์',
    hint: 'นับจากการเปิดหน้าเว็บสาธารณะ — คนเดิมเปิดหน้าเดิมซ้ำภายใน 30 นาทีไม่นับเพิ่ม · ตัดรอบวันตามเวลาไทย'
  },
  { group: 'ข้อมูลบนเว็บ' },
  {
    id: 'sheet', kind: 'sheet', icon: 'table',
    title: 'ข้อมูลในชีต',
    hint: 'อ่านและแก้ข้อมูลใน Google Sheets ตัวจริงที่หน้าเว็บใช้ — บันทึกแล้วหน้าเว็บเห็นผลภายในราว 1 นาที'
  },
  {
    id: 'results', kind: 'table', table: 'matches', pk: 'id', icon: 'results',
    title: 'ผลการแข่งขัน',
    hint: 'รายการที่ประกาศผลแล้วและที่กำลังแข่ง — แสดงบนหน้าแรกและหน้า "ผลการแข่งขัน"',
    filter: { kind: 'result' },
    defaults: { kind: 'result', status: 'upcoming' },
    order: 'match_date.asc,start_time.asc',
    columns: [
      { key: 'match_date', label: 'วันที่', type: 'date' },
      { key: 'start_time', label: 'เวลา', type: 'time' },
      { key: 'sport_id', label: 'กีฬา', type: 'sport' },
      { key: 'event_type', label: 'ประเภท' },
      { key: 'versus', label: 'คู่แข่งขัน', type: 'versus' },
      { key: 'score', label: 'ผล', type: 'score' },
      { key: 'status', label: 'สถานะ', type: 'status' }
    ],
    fields: matchFields().concat([
      { key: 'score', label: 'ผลการแข่งขัน', type: 'text', size: 'half', hint: 'เช่น 2 - 1 หรือ ทอง: ปทุมวัน — กรอกแล้วขึ้นเป็น "ประกาศผลแล้ว" เอง' },
      { key: 'status', label: 'สถานะ', type: 'select', options: STATUS_OPTIONS, size: 'half' },
      { key: 'unofficial', label: 'ผลยังไม่เป็นทางการ', type: 'checkbox', hint: 'ติ๊กไว้เมื่อผลยังรอการรับรอง หน้าเว็บจะขึ้นหมายเหตุกำกับ' },
      { key: 'note', label: 'หมายเหตุภายใน', type: 'text', hint: 'บันทึกช่วยจำของทีมงาน ไม่แสดงบนหน้าเว็บ' }
    ])
  },
  {
    id: 'plan', kind: 'table', table: 'matches', pk: 'id', icon: 'calendar',
    title: 'ตารางการแข่งขัน',
    hint: 'ผังกำหนดการทั้งรายการ — เป็นตารางอ้างอิง ไม่มีช่องผลและสถานะ',
    filter: { kind: 'plan' },
    defaults: { kind: 'plan', status: 'upcoming' },
    order: 'match_date.asc,start_time.asc',
    columns: [
      { key: 'match_date', label: 'วันที่', type: 'date' },
      { key: 'start_time', label: 'เวลา', type: 'time' },
      { key: 'sport_id', label: 'กีฬา', type: 'sport' },
      { key: 'event_type', label: 'ประเภท' },
      { key: 'versus', label: 'คู่แข่งขัน', type: 'versus' }
    ],
    fields: matchFields()
  },
  {
    id: 'schools', kind: 'table', table: 'schools', pk: 'id', icon: 'medal',
    title: 'เหรียญรายโรงเรียน',
    hint: 'อันดับคำนวณจากจำนวนเหรียญให้อัตโนมัติ (ทอง → เงิน → ทองแดง) ไม่ต้องกรอกเอง',
    order: 'gold.desc,silver.desc,bronze.desc',
    columns: [
      { key: 'full_name', label: 'โรงเรียน' },
      { key: 'is_self', label: 'โรงเรียนเรา', type: 'flag' },
      { key: 'gold', label: 'ทอง', type: 'medal', tone: 'bg-gold' },
      { key: 'silver', label: 'เงิน', type: 'medal', tone: 'bg-silver-ink' },
      { key: 'bronze', label: 'ทองแดง', type: 'medal', tone: 'bg-bronze' }
    ],
    fields: [
      { key: 'full_name', label: 'ชื่อเต็ม', type: 'text', required: true },
      { key: 'short_name', label: 'ชื่อย่อที่แสดงในตาราง', type: 'text', size: 'half', hint: 'เว้นว่าง = ให้ระบบย่อให้เอง' },
      { key: 'abbr', label: 'อักษรย่อ', type: 'text', size: 'half', hint: 'เช่น ปทว. — ใช้หาไฟล์โลโก้' },
      { key: 'logo', label: 'พาธโลโก้', type: 'text', hint: 'เว้นว่าง = หาจากอักษรย่อให้เอง' },
      { key: 'is_self', label: 'เป็นโรงเรียนของเรา', type: 'checkbox', hint: 'ติ๊กได้โรงเรียนเดียว — แถวนี้จะถูกไฮไลต์และขึ้นการ์ดสรุปบนหน้าแรก' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number', size: 'third' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number', size: 'third' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number', size: 'third' }
    ]
  },
  {
    id: 'sports', kind: 'table', table: 'sports', pk: 'id', icon: 'sports',
    title: 'เหรียญรายกีฬา',
    hint: 'จำนวนเหรียญของโรงเรียนเราในแต่ละกีฬา — กรอกเหรียญแล้วการ์ดกีฬานั้นจะขึ้นเป็น "ประกาศแล้ว" เอง',
    order: 'sort_order.asc',
    columns: [
      { key: 'name', label: 'ชนิดกีฬา', type: 'sportName' },
      { key: 'entered', label: 'ส่งแข่ง', type: 'flag' },
      { key: 'gold', label: 'ทอง', type: 'medal', tone: 'bg-gold' },
      { key: 'silver', label: 'เงิน', type: 'medal', tone: 'bg-silver-ink' },
      { key: 'bronze', label: 'ทองแดง', type: 'medal', tone: 'bg-bronze' }
    ],
    fields: [
      { key: 'id', label: 'รหัสกีฬา', type: 'text', required: true, createOnly: true,
        hint: 'ภาษาอังกฤษตัวพิมพ์เล็ก ตรงกับชื่อไอคอน เช่น football' },
      { key: 'name', label: 'ชื่อกีฬา (ภาษาไทย)', type: 'text', required: true },
      { key: 'entered', label: 'ปีนี้ส่งเข้าแข่ง', type: 'checkbox', default: true, hint: 'ไม่ติ๊ก = ซ่อนกีฬานี้ออกจากทุกหน้าของเว็บ โดยไม่ต้องลบข้อมูลทิ้ง' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number', size: 'third' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number', size: 'third' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number', size: 'third' },
      { key: 'sort_order', label: 'ลำดับการแสดง', type: 'number' }
    ]
  },
  {
    id: 'photos', kind: 'table', table: 'photos', pk: 'id', icon: 'photo',
    title: 'ภาพบรรยากาศ',
    hint: 'หน้า "ประมวลภาพ" แยกตามวัน — วางลิงก์แชร์จาก Google Drive ได้เลย ระบบแปลงเป็นลิงก์รูปให้เอง',
    order: 'taken_on.asc,sort_order.asc',
    columns: [
      { key: 'url', label: 'รูป', type: 'thumb' },
      { key: 'taken_on', label: 'วันที่', type: 'photoDate' },
      { key: 'sport_id', label: 'กีฬา', type: 'sport' },
      { key: 'caption', label: 'คำบรรยาย' },
      { key: 'sort_order', label: 'ลำดับ', type: 'num' }
    ],
    fields: [
      { key: 'url', label: 'ลิงก์รูป', type: 'text', required: true,
        hint: 'ไฟล์ใน Drive ต้องตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์" ไม่งั้นรูปจะไม่ขึ้นบนเว็บ' },
      { key: 'taken_on', label: 'วันที่', type: 'date', size: 'half', hint: 'เว้นว่าง = ไปอยู่กลุ่ม "ภาพอื่น ๆ"' },
      { key: 'sport_id', label: 'กีฬา', type: 'select', options: 'sports', size: 'half' },
      { key: 'caption', label: 'คำบรรยาย', type: 'text' },
      { key: 'sort_order', label: 'ลำดับการแสดง', type: 'number' }
    ]
  },
  {
    id: 'banners', kind: 'table', table: 'banners', pk: 'id', icon: 'banner',
    title: 'ข่าวสารและไฮไลต์',
    hint: 'ขึ้นเป็นการ์ดในแถบ "ข่าวสารและไฮไลต์" ของหน้าหลัก (เลือกให้ขึ้นเป็นแถบประกาศบนสุดของหน้าอื่นด้วยได้) — ตั้งเวลาเริ่ม/หมดได้ ถึงเวลาแล้วขึ้นและหายเอง',
    order: 'sort_order.asc,updated_at.desc',
    columns: [
      { key: 'title', label: 'ประกาศ', type: 'banner' },
      { key: 'tone', label: 'ประเภท', type: 'newsTone' },
      { key: 'placement', label: 'แสดงที่', type: 'placement' },
      { key: 'period', label: 'ช่วงเวลา', type: 'period' },
      { key: 'active', label: 'สถานะ', type: 'bannerState' }
    ],
    fields: [
      { key: 'title', label: 'หัวข้อข่าว', type: 'text', hint: 'เช่น "เลื่อนการแข่งขันฟุตบอล" — การ์ดแสดงไม่เกิน 2 บรรทัด' },
      { key: 'message', label: 'รายละเอียด', type: 'textarea' },
      { key: 'image_url', label: 'รูป', type: 'text', upload: { bucket: 'news', maxSide: 1600 },
        hint: 'ไม่บังคับ — กด "อัปโหลดรูป" เลือกไฟล์จากเครื่อง หรือวางลิงก์รูปเอง · ใส่แล้วเป็นรูปเต็มการ์ด (แนวตั้ง 3:4 เช่น 1200×1600 · โปสเตอร์สี่เหลี่ยม/4:5 ก็ได้ ขอบซ้ายขวาถูกตัดเล็กน้อย) ส่วนล่างของรูปมีหัวข้อทับ · แถบบนสุดของหน้าอื่นจะแสดงรูปแทนข้อความ · ลิงก์แชร์ Drive ใช้ได้' },
      { key: 'link_url', label: 'ลิงก์เมื่อกด', type: 'text', hint: 'https://… หรือหน้าในเว็บ เช่น matches.html — ใส่แล้วการ์ดมีปุ่ม "อ่านเพิ่มเติม"' },
      { key: 'tone', label: 'ประเภทข่าว', type: 'select', options: TONE_OPTIONS, noBlank: true, size: 'half' },
      { key: 'placement', label: 'แสดงที่', type: 'select', options: PLACEMENT_OPTIONS, noBlank: true, size: 'half' },
      { key: 'starts_at', label: 'เริ่มแสดง', type: 'datetime', size: 'half', hint: 'เว้นว่าง = แสดงทันที' },
      { key: 'ends_at', label: 'หยุดแสดง', type: 'datetime', size: 'half', hint: 'เว้นว่าง = แสดงจนกว่าจะปิด' },
      { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox', default: true, hint: 'ไม่ติ๊ก = เก็บเป็นฉบับร่าง ยังไม่ขึ้นบนเว็บ' },
      { key: 'sort_order', label: 'ลำดับ', type: 'number', hint: 'เลขน้อยขึ้นก่อน' }
    ]
  },
  {
    id: 'heroes', kind: 'heroes', icon: 'photo',
    title: 'ภาพแบนเนอร์',
    hint: 'ภาพใหญ่บนสุดของหน้าเว็บ — วางลิงก์รูปแล้วบันทึก ผู้ชมรีเฟรชหน้าก็เห็น ไม่ต้อง deploy เว็บใหม่ · เว้นว่าง = ใช้ภาพเดิม'
  },
  {
    id: 'gallery', kind: 'gallery', icon: 'folder',
    title: 'ประมวลภาพ',
    hint: 'โฟลเดอร์ Drive ที่หน้า "ประมวลภาพ" ดึงรูปมาแสดง — บันทึกแล้วมีผลทันที ผู้ชมรีเฟรชหน้าก็เห็น ไม่ต้อง deploy เว็บใหม่'
  },
  {
    id: 'settings', kind: 'source', icon: 'settings',
    title: 'ตั้งค่าแหล่งข้อมูล',
    hint: 'ชีตที่หน้าเว็บอ่านข้อมูล และตัวเชื่อมที่ทำให้ CMS แก้ข้อมูลในชีตได้'
  },
  { group: 'ระบบ' },
  {
    id: 'backup', kind: 'backup', icon: 'backup',
    title: 'สำรองและกู้คืนข้อมูล',
    hint: 'ดาวน์โหลดข้อมูลทั้งหมดเก็บไว้ · กู้คืนจากไฟล์ · หรือดึงข้อมูลล่าสุดจาก Google Sheets มาเก็บในฐานข้อมูลนี้'
  }
];

/** ตารางที่อยู่ในไฟล์สำรอง — เรียงตามลำดับที่ต้องเขียนตอนกู้คืน (sports ก่อน matches เพราะ foreign key) */
var BACKUP_TABLES = [
  { table: 'site_settings', pk: 'key', label: 'ตั้งค่าเว็บ' },
  { table: 'sports', pk: 'id', label: 'กีฬา' },
  { table: 'schools', pk: 'id', label: 'โรงเรียน' },
  { table: 'matches', pk: 'id', label: 'รายการแข่งขัน' },
  { table: 'photos', pk: 'id', label: 'ภาพ' },
  { table: 'banners', pk: 'id', label: 'ข่าวสารและประกาศ' }
];

var PAGE_NAMES = {
  'index.html': 'หน้าหลัก', 'schedule.html': 'ตารางการแข่งขัน', 'matches.html': 'ผลการแข่งขัน',
  'medals.html': 'อันดับเหรียญ', 'sports.html': 'ชนิดกีฬา', 'school.html': 'หน้าโรงเรียน', 'gallery.html': 'ประมวลภาพ'
};

/* =========================================================
   สถานะของหน้า
   ========================================================= */
var db = null;
var current = null;
var rows = [];
var loading = false;    // กำลังโหลดหมวดนี้อยู่ — อย่าเพิ่งขึ้น "ยังไม่มีข้อมูล" ให้คนกรอกตกใจ
var query = '';
var sports = [];
var editing = null;
var statsDays = 14;
var statsTimer = null;

var $ = function (id) { return document.getElementById(id); };

/* ชุดคลาสที่ใช้ซ้ำ — เขียนชื่อคลาสเต็มเสมอ Tailwind สแกนไฟล์นี้หาคลาสด้วย */
var TH = 'border-b border-line bg-surface-soft px-4 py-3 text-left fs-13 font-medium text-fg-soft whitespace-nowrap';
var TD = 'border-b border-line px-4 py-3 align-middle';
// เมนูที่เลือก = พื้นชมพูอ่อน + ขีดชมพูชิดขอบแถบเมนู (ก่อนหน้าเป็นพื้นชมพูทึบทั้งแถบ แย่งสายตาจากเนื้อหา)
var NAV_ITEM = 'group/nav relative flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent px-3 py-[9px] text-left fs-14.5 text-fg-soft transition-[background-color,color] duration-150 ' +
  'before:absolute before:top-1.5 before:bottom-1.5 before:-left-3.5 before:w-[3px] before:rounded-r-full before:bg-brand before:opacity-0 ' +
  'hover:bg-surface-soft hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ' +
  'aria-[current=page]:bg-brand-100 aria-[current=page]:font-semibold aria-[current=page]:text-brand-ink aria-[current=page]:before:opacity-100 motion-reduce:transition-none';
var NAV_GROUP = 'm-0 px-3 pt-5 pb-1.5 fs-12 font-medium tracking-[.06em] text-fg-mute first:pt-1';
var PANEL = 'overflow-hidden rounded-lg border border-line bg-surface shadow-panel';
var CARD = 'rounded-lg border border-line bg-surface px-6 py-5 shadow-panel';
var BADGE = 'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-[3px] fs-12.5 leading-snug whitespace-nowrap';
// สีสถานะชุดเดียวกับหน้าเว็บ: กำลังแข่ง = ฟ้าทึบ · ประกาศผลแล้ว = เขียวพื้นอ่อน · รอเริ่ม = กรอบเส้นไม่มีพื้น
var STATUS_TONE = {
  live: 'border-transparent bg-live text-paper',
  done: 'border-transparent bg-done-bg text-done-ink',
  upcoming: 'border-line-strong bg-transparent text-fg-soft'
};
var TONE_BADGE = {
  ok: 'border-transparent bg-done-bg text-done-ink',
  live: 'border-transparent bg-live-bg text-live',
  mute: 'border-line-strong bg-transparent text-fg-soft',
  draft: 'border-transparent bg-upcoming-bg text-upcoming'
};
function badge(text, tone) { return '<span class="' + BADGE + ' ' + tone + '">' + esc(text) + '</span>'; }
function icon(name, cls) { return '<i class="icon-mask ' + (cls || 'size-4') + '" data-ic="' + name + '"></i>'; }

/** กล่องข้อความแจ้ง — tone: warn (เหลือง) / ok (เขียว) / error (แดง) */
function notice(tone, title, text) {
  var c = {
    warn: ['border-gold/40 bg-gold/10', 'text-gold-ink'],
    ok: ['border-done/30 bg-done-bg', 'text-done-ink'],
    error: ['border-destructive/30 bg-destructive/10', 'text-destructive']
  }[tone];
  return '<div class="flex items-start gap-3 rounded-md border px-4 py-3 ' + c[0] + '">' +
    '<span class="mt-[3px] ' + c[1] + '">' + icon('info', 'size-[18px]') + '</span>' +
    '<div class="min-w-0 fs-14 text-fg-soft">' + (title ? '<p class="m-0 font-semibold ' + c[1] + '">' + title + '</p>' : '') +
    '<p class="m-0">' + text + '</p></div></div>';
}
var TONE_DOT = {
  info: 'bg-brand', success: 'bg-done', warning: 'bg-gold', danger: 'bg-destructive'
};

/* =========================================================
   ตัวช่วยแปลงค่า
   ========================================================= */
function pad(n) { return String(n).padStart(2, '0'); }
function thaiDate(iso) {
  if (!iso) return '—';
  var p = String(iso).slice(0, 10).split('-');
  return Number(p[2]) + ' ' + MONTHS_TH[Number(p[1]) - 1];
}
function thaiDateTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getDate() + ' ' + MONTHS_TH[d.getMonth()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
/** timestamptz → ค่าของช่อง datetime-local ("YYYY-MM-DDTHH:MM" เวลาเครื่อง) */
function toLocalInput(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function fmtNum(n) { return Number(n || 0).toLocaleString('th-TH'); }
function sportNameOf(id) {
  var s = sports.filter(function (x) { return x.id === id; })[0];
  return s ? s.name : (id || '—');
}
function optionLabel(opts, value) {
  var o = opts.filter(function (x) { return x.value === value; })[0];
  return o ? o.label : value;
}

/** แบนเนอร์นี้ขึ้นบนเว็บอยู่ตอนนี้ไหม — กฎเดียวกับ policy public_read ในฐานข้อมูล */
function bannerState(b) {
  var now = Date.now();
  if (!b.active) return { label: 'ฉบับร่าง', tone: TONE_BADGE.draft };
  if (b.starts_at && new Date(b.starts_at) > now) return { label: 'ตั้งเวลาไว้', tone: TONE_BADGE.live };
  if (b.ends_at && new Date(b.ends_at) <= now) return { label: 'หมดเวลาแล้ว', tone: TONE_BADGE.mute };
  return { label: 'กำลังแสดง', tone: TONE_BADGE.ok };
}

/* =========================================================
   มุมมอง "ตาราง" — แก้ไขข้อมูลทีละแถว
   ========================================================= */

function cellHtml(col, row) {
  if (col.type === 'date') return esc(thaiDate(row.match_date));
  if (col.type === 'time') return row.start_time ? esc(String(row.start_time).slice(0, 5)) : '—';
  if (col.type === 'sport') return row.sport_id ? '<span class="flex items-center gap-2 whitespace-nowrap">' +
    '<span class="text-fg-mute">' + sportIcon(row.sport_id, 'size-[18px]') + '</span>' + esc(sportNameOf(row.sport_id)) + '</span>' : '<span class="text-fg-mute">—</span>';
  if (col.type === 'photoDate') return row.taken_on ? esc(thaiDate(row.taken_on)) : '<span class="text-fg-mute">ไม่ระบุ</span>';
  if (col.type === 'sportName') return '<span class="flex items-center gap-2.5">' +
    '<span class="text-fg-soft">' + sportIcon(row.id, 'size-[22px]') + '</span>' + esc(row.name) + '</span>';
  if (col.type === 'versus') {
    var sides = [row.team_a, row.team_b].filter(Boolean);
    if (!sides.length) return '<span class="text-fg-mute">—</span>';
    return sides.map(function (t) { return '<span class="text-fg">' + esc(t) + '</span>'; })
      .join(' <span class="px-0.5 fs-12.5 text-fg-mute">พบ</span> ');
  }
  if (col.type === 'score') {
    return row.score ? '<span class="font-semibold text-brand-strong tabular-nums">' + esc(row.score) + '</span>' : '<span class="text-fg-mute">—</span>';
  }
  if (col.type === 'status') {
    return '<span class="flex flex-wrap gap-1.5">' +
      badge(optionLabel(STATUS_OPTIONS, row.status || 'upcoming'), STATUS_TONE[row.status] || STATUS_TONE.upcoming) +
      (row.unofficial ? badge('ไม่เป็นทางการ', 'border-gold/50 bg-transparent text-gold-ink') : '') + '</span>';
  }
  if (col.type === 'flag') {
    return row[col.key] ? badge('ใช่', TONE_BADGE.ok) : '<span class="text-fg-mute">—</span>';
  }
  if (col.type === 'medal') {
    var n = row[col.key] == null ? 0 : row[col.key];
    return '<span class="inline-flex items-center gap-1.5 tabular-nums' + (n ? ' text-fg' : ' text-fg-mute') + '">' +
      '<i class="medal-mic size-4 ' + col.tone + '" aria-hidden="true"></i>' + esc(n) + '</span>';
  }
  if (col.type === 'num') return '<span class="tabular-nums">' + esc(row[col.key] == null ? 0 : row[col.key]) + '</span>';
  if (col.type === 'key') return '<code class="rounded-[6px] bg-surface-soft px-2 py-0.5 font-mono fs-13.5 text-fg-soft">' + esc(row[col.key]) + '</code>';
  if (col.type === 'thumb') {
    // referrerpolicy: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    return '<img class="h-12 w-[72px] rounded-[8px] border border-line bg-surface-soft object-cover" src="' + esc(directImageUrl(row.url)) +
      '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />';
  }
  if (col.type === 'banner') {
    var text = [row.title, row.message].filter(Boolean).join(' — ') || (row.image_url ? '(แบนเนอร์รูป)' : '—');
    return '<span class="flex max-w-[520px] items-start gap-2.5">' +
      (row.image_url
        ? '<img class="h-9 w-16 flex-none rounded-sm border border-line object-cover" src="' + esc(directImageUrl(row.image_url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
        : '<span class="mt-[7px] size-2.5 flex-none rounded-full ' + (TONE_DOT[row.tone] || TONE_DOT.info) + '" aria-hidden="true"></span>') +
      '<span class="line-clamp-2">' + esc(text) + '</span></span>';
  }
  if (col.type === 'newsTone') {
    var nt = NEWS_TONE[row.tone] || NEWS_TONE.info;
    return '<span class="inline-flex rounded-full px-2.5 py-0.5 fs-13 font-semibold whitespace-nowrap ' + nt.cls + '">' + esc(nt.label) + '</span>';
  }
  if (col.type === 'placement') return esc(optionLabel(PLACEMENT_OPTIONS, row.placement));
  if (col.type === 'period') {
    if (!row.starts_at && !row.ends_at) return '<span class="text-fg-mute">ไม่จำกัด</span>';
    return '<span class="fs-14 whitespace-nowrap">' + esc(row.starts_at ? thaiDateTime(row.starts_at) : 'ทันที') +
      ' → ' + esc(row.ends_at ? thaiDateTime(row.ends_at) : 'ไม่กำหนด') + '</span>';
  }
  if (col.type === 'bannerState') {
    var st = bannerState(row);
    return badge(st.label, st.tone);
  }
  var v = row[col.key];
  return v === '' || v == null ? '<span class="text-fg-mute">—</span>' : esc(v);
}

/** ข้อความทั้งแถวที่ช่องค้นหาใช้เทียบ (รวมชื่อกีฬาไทย ค้น "ฟุตบอล" แล้วเจอแถว football) */
function rowText(row) {
  return (Object.keys(row).map(function (k) { return row[k]; }).join(' ') + ' ' + sportNameOf(row.sport_id || row.id)).toLowerCase();
}

/** หมวดที่ซิงก์จาก Google Sheets ทุก 15 นาที — แก้ในหน้านี้แล้วจะถูกเขียนทับรอบถัดไป */
var SYNCED_FROM_SHEETS = ['results', 'plan', 'schools', 'sports', 'photos'];

function renderTableView() {
  var synced = SYNCED_FROM_SHEETS.indexOf(current.id) > -1;
  $('viewBody').innerHTML =
    (synced ? notice('warn', 'หมวดนี้คัดลอกจาก Google Sheets อัตโนมัติทุก 15 นาที',
      '<strong class="font-semibold text-fg">ให้แก้ที่ชีต</strong> — ถ้าแก้ที่นี่จะถูกเขียนทับในรอบถัดไป และหน้าเว็บก็ยังแสดงตามชีตอยู่ดี · ' +
      '<button class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-brand-ink underline" type="button" data-go="sheet">แก้ในหน้า “ข้อมูลในชีต”</button>') : '') +
    '<section class="' + PANEL + '">' +
      '<div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 max-[560px]:flex-col max-[560px]:items-stretch">' +
        '<label class="relative block w-full max-w-[380px] max-[560px]:max-w-none">' +
          '<span class="sr-only">ค้นหาในหมวดนี้</span>' +
          '<i class="icon-mask pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-mute" data-ic="search"></i>' +
          '<input class="input h-10 pl-10" id="search" type="search" placeholder="ค้นหา เช่น ชื่อทีม กีฬา วันที่" value="' + esc(query) + '" />' +
        '</label>' +
        '<span class="ml-auto fs-13.5 text-fg-mute tabular-nums max-[560px]:ml-0" id="rowCount"></span>' +
      '</div>' +
      '<div class="overflow-x-auto"><table class="w-full border-collapse fs-14.5" id="grid"></table></div>' +
    '</section>';
  paintIcons($('viewBody'));
  bindGoLinks($('viewBody'));
  $('search').addEventListener('input', function (e) { query = e.target.value; renderGrid(); });
  renderGrid();
}

/** คอลัมน์สั้นที่ห้ามตัดบรรทัด ("13 ต.ค." / "2 - 1" ขึ้นสองบรรทัดอ่านยาก) — ตารางกว้างเกินจอก็เลื่อนแนวนอนเอา */
var NOWRAP = { date: 1, time: 1, score: 1, num: 1, medal: 1, status: 1, photoDate: 1, placement: 1, bannerState: 1, flag: 1 };

/** แถวว่าง/กำลังโหลด — กินทุกคอลัมน์ ไอคอนตรงกลาง */
function emptyRow(text, ic) {
  return '<tbody><tr><td class="px-5 py-14 text-center">' +
    '<span class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-soft text-fg-mute">' + icon(ic || 'table', 'size-[22px]') + '</span>' +
    '<p class="m-0 fs-14.5 text-fg-mute">' + text + '</p></td></tr></tbody>';
}

function renderGrid() {
  var grid = $('grid');
  if (!grid) return;
  if (loading) {
    $('rowCount').textContent = '';
    // โครงแถวจาง ๆ ระหว่างโหลด ให้เห็นว่ากำลังมา ไม่ใช่ตารางว่าง
    grid.innerHTML = '<tbody>' + [1, 2, 3, 4, 5].map(function (i) {
      return '<tr>' + current.columns.map(function (c, j) {
        return '<td class="' + TD + '"><span class="skeleton block h-3.5" style="width:' + (40 + ((i * 7 + j * 13) % 50)) + '%"></span></td>';
      }).join('') + '<td class="' + TD + '"></td></tr>';
    }).join('') + '</tbody>';
    return;
  }
  var q = query.trim().toLowerCase();
  var shown = rows.map(function (r, i) { return { row: r, i: i }; })
    .filter(function (x) { return !q || rowText(x.row).indexOf(q) > -1; });

  $('rowCount').textContent = q ? 'พบ ' + fmtNum(shown.length) + ' จาก ' + fmtNum(rows.length) + ' รายการ' : 'ทั้งหมด ' + fmtNum(rows.length) + ' รายการ';

  if (!shown.length) {
    grid.innerHTML = rows.length
      ? emptyRow('ไม่พบรายการที่ตรงกับ “' + esc(query.trim()) + '”', 'search')
      : emptyRow('ยังไม่มีข้อมูลในหมวดนี้ — กด “เพิ่ม” มุมขวาบนเพื่อเริ่มกรอก', 'table');
    paintIcons(grid);
    return;
  }

  var head = '<thead><tr>' + current.columns.map(function (c) {
    return '<th class="' + TH + '" scope="col">' + esc(c.label) + '</th>';
  }).join('') + '<th class="' + TH + '"><span class="sr-only">แก้ไข</span></th></tr></thead>';

  // ทั้งแถวกดเปิดกล่องแก้ไขได้ (เป้าใหญ่ใช้ง่ายบนจอสัมผัส) ปุ่ม "แก้ไข" ท้ายแถวมีไว้ให้คีย์บอร์ด/โปรแกรมอ่านหน้าจอ
  var body = '<tbody>' + shown.map(function (x) {
    return '<tr class="group/row cursor-pointer transition-colors duration-100 hover:bg-surface-soft/70 [&:last-child>td]:border-b-0" data-open="' + x.i + '">' + current.columns.map(function (c) {
      var fit = NOWRAP[c.type] ? ' whitespace-nowrap' : !c.type || c.type === 'versus' ? ' min-w-[150px]' : '';
      return '<td class="' + TD + fit + '">' + cellHtml(c, x.row) + '</td>';
    }).join('') +
      '<td class="' + TD + ' w-px text-right"><button class="btn btn-ghost btn-sm text-fg-mute group-hover/row:text-brand-ink" type="button" data-row="' + x.i + '">' +
        icon('edit') + 'แก้ไข</button></td></tr>';
  }).join('') + '</tbody>';

  grid.innerHTML = head + body;
  paintIcons(grid);
  grid.querySelectorAll('[data-open]').forEach(function (tr) {
    tr.addEventListener('click', function () { openEditor(rows[Number(tr.dataset.open)]); });
  });
}

async function refreshTable() {
  setPanelError('');
  var view = current;
  var q = db.from(current.table).select('*');
  if (current.filter) Object.keys(current.filter).forEach(function (k) { q = q.eq(k, current.filter[k]); });
  if (current.excludeKeys) q = q.not(current.pk, 'in', '(' + current.excludeKeys.join(',') + ')');
  current.order.split(',').forEach(function (part) {
    var bits = part.split('.');
    q = q.order(bits[0], { ascending: bits[1] !== 'desc', nullsFirst: false });
  });

  var res = await q;
  if (current !== view) return;   // ผู้ใช้สลับหมวดไปแล้วระหว่างรอ — อย่าเอาแถวของหมวดเก่ามาวาดทับ
  loading = false;
  if (res.error) {
    rows = [];
    setPanelError('โหลดข้อมูลไม่สำเร็จ: ' + missingSchemaHint(res.error));
  } else {
    rows = res.data || [];
  }
  renderGrid();
}

/* =========================================================
   อัปโหลดรูปจากเครื่อง → Supabase Storage (bucket "news" / "hero" — migrations 20261020000001/2)
   ย่อรูปในเบราว์เซอร์ก่อน (ด้านยาวไม่เกิน maxSide) แล้วแปลงเป็น webp — รูปจากมือถือ 5–10 MB เหลือไม่กี่ร้อย KB
   ชื่อไฟล์ใหม่ทุกครั้ง (เวลา + สุ่ม) ไม่เขียนทับไฟล์เดิม เพราะ CDN เก็บรูปไว้นาน เขียนทับแล้วผู้ชมอาจยังเห็นรูปเก่า
   สิทธิ์อัปโหลดบังคับที่ policy ของ storage (is_admin) เหมือนตารางอื่น
   ========================================================= */
var UPLOAD_MAX_BYTES = 25 * 1024 * 1024;   // ไฟล์ต้นฉบับ — ใหญ่กว่านี้มักไม่ใช่รูปถ่าย/โปสเตอร์ธรรมดา

function canvasBlob(canvas, type, quality) {
  return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
}

/** ไฟล์รูป → { url, w, h } (URL สาธารณะของไฟล์ใน bucket) · ไม่ใช่รูป / ใหญ่เกิน / อัปโหลดไม่ผ่าน = throw พร้อมข้อความภาษาไทย */
async function uploadImage(file, bucket, maxSide) {
  if (!file || !/^image\//.test(file.type)) throw new Error('เลือกไฟล์รูปภาพ (jpg, png, webp)');
  if (file.size > UPLOAD_MAX_BYTES) throw new Error('ไฟล์ใหญ่เกิน 25 MB');
  var bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('เปิดไฟล์รูปนี้ไม่ได้ — ลองบันทึกเป็น jpg หรือ png ก่อน'); }
  var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  var w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  var canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  // Safari รุ่นเก่าแปลงเป็น webp ไม่ได้ (ได้ png กลับมา) — ใช้ jpg แทน
  var blob = await canvasBlob(canvas, 'image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', 0.88);
  if (!blob) throw new Error('แปลงรูปไม่สำเร็จ');
  var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  var path = new Date().toISOString().slice(0, 10) + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  var res = await db.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (res.error) throw new Error('อัปโหลดไม่สำเร็จ: ' + (res.error.message || res.error));
  return { url: db.storage.from(bucket).getPublicUrl(path).data.publicUrl, w: w, h: h };
}

/** ปุ่ม "อัปโหลดรูป" + ช่องเลือกไฟล์ที่ซ่อนไว้ · ผูกการทำงานด้วย bindUpload() */
function uploadButtonHtml(id) {
  return '<button class="btn btn-outline flex-none" type="button" id="' + id + 'Btn">' + icon('upload') + 'อัปโหลดรูป</button>' +
    '<input class="hidden" id="' + id + 'File" type="file" accept="image/*" />';
}

/** กดปุ่ม → เลือกไฟล์ → อัปโหลด → ใส่ URL ลงช่อง input แล้วยิง event input (ตัวอย่างสดอัปเดตตาม) · onDone(url) ไม่บังคับ */
function bindUpload(id, input, bucket, maxSide, statusNode, onDone) {
  var btn = $(id + 'Btn'), picker = $(id + 'File');
  if (!btn || !picker) return;
  var label = btn.innerHTML;
  function status(text, tone) {
    if (!statusNode) return;
    statusNode.textContent = text;
    statusNode.className = 'mt-1.5 mb-0 fs-12.5 leading-snug ' + (tone === 'error' ? 'text-destructive' : tone === 'ok' ? 'text-done' : 'text-fg-mute');
    statusNode.hidden = !text;
  }
  btn.addEventListener('click', function () { picker.click(); });
  picker.addEventListener('change', async function () {
    var file = picker.files && picker.files[0];
    picker.value = '';
    if (!file) return;
    btn.disabled = true;
    btn.textContent = 'กำลังอัปโหลด…';
    status('กำลังย่อรูปและอัปโหลด ' + file.name + '…');
    try {
      var r = await uploadImage(file, bucket, maxSide);
      input.value = r.url;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      status('อัปโหลดแล้ว ✓ (' + r.w + ' × ' + r.h + ' px) — กดบันทึกเพื่อใช้รูปนี้', 'ok');
      if (onDone) onDone(r.url);
    } catch (err) {
      status(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
      paintIcons(btn);
    }
  });
}

/* =========================================================
   กล่องแก้ไข
   ========================================================= */

/** ความกว้างของช่องในกริด 6 คอลัมน์ของกล่องแก้ไข — จอแคบทุกช่องเต็มแถว */
var FIELD_SPAN = {
  full: 'col-span-6',
  half: 'col-span-3 max-[520px]:col-span-6',
  third: 'col-span-2 max-[520px]:col-span-6'
};

function fieldHtml(f, value) {
  var id = 'f_' + f.key;
  var wrap = '<div class="' + FIELD_SPAN[f.size || 'full'] + '">';
  var label = '<label class="label mb-2 fs-14 text-fg-soft" for="' + id + '">' + esc(f.label) +
    (f.required ? ' <span class="-ml-1 text-destructive">*</span>' : '') + '</label>';
  var hint = f.hint ? '<p class="mt-1.5 mb-0 fs-12.5 leading-snug text-fg-mute">' + esc(f.hint) + '</p>' : '';
  var input;

  if (f.type === 'select') {
    var opts = f.options === 'sports' ? sports.map(function (s) { return { value: s.id, label: s.name }; }) : f.options;
    input = '<select class="input h-10" id="' + id + '" name="' + f.key + '">' +
      (f.noBlank ? '' : '<option value="">— ไม่ระบุ —</option>') +
      opts.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (String(value) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  } else if (f.type === 'checkbox') {
    // ช่องติ๊กเป็นการ์ดทั้งใบ กดตรงไหนก็ติ๊กได้ · ติ๊กแล้วกรอบเป็นสีชมพู
    return '<label class="col-span-6 flex cursor-pointer items-start gap-3 rounded-md border border-line px-4 py-3 transition-colors duration-100 hover:bg-surface-soft has-[:checked]:border-brand/50 has-[:checked]:bg-brand-100/50">' +
      '<input class="mt-1 size-[17px] flex-none accent-brand" id="' + id + '" name="' + f.key + '" type="checkbox"' + (value ? ' checked' : '') + ' />' +
      '<span class="min-w-0"><span class="block fs-14.5 text-fg">' + esc(f.label) + '</span>' + hint + '</span></label>';
  } else if (f.type === 'textarea') {
    input = '<textarea class="textarea min-h-[92px]" id="' + id + '" name="' + f.key + '" rows="3">' + esc(value == null ? '' : value) + '</textarea>';
  } else {
    var type = { number: 'number', date: 'date', time: 'time', datetime: 'datetime-local' }[f.type] || 'text';
    input = '<input class="input h-10' + (f.upload ? ' min-w-0 flex-1' : '') + '" id="' + id + '" name="' + f.key + '" type="' + type + '"' +
      (f.type === 'number' ? ' min="0" step="1"' : '') + (f.required ? ' required' : '') +
      ' value="' + esc(value == null ? '' : value) + '" />';
    // ช่องลิงก์รูปที่อัปโหลดจากเครื่องได้ (f.upload = { bucket, maxSide }) — ผูกปุ่มใน bindFieldUploads()
    if (f.upload) {
      input = '<div class="flex gap-2">' + input + uploadButtonHtml(id + 'Up') + '</div>' +
        '<p class="mt-1.5 mb-0 fs-12.5 leading-snug" id="' + id + 'UpMsg" hidden></p>';
    }
  }
  return wrap + label + input + hint + '</div>';
}

function defaultValue(f) {
  if (f.default !== undefined) return f.default;
  if (f.key === 'match_date') {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  if (f.type === 'number') return 0;
  if (f.type === 'checkbox') return false;
  if (f.type === 'select' && f.noBlank) return f.options[0].value;
  return '';
}

function openEditor(row) {
  editing = row || null;
  var isNew = !row;
  $('editorKicker').textContent = current.title;
  $('editorTitle').textContent = isNew ? 'เพิ่มรายการใหม่' : 'แก้ไขรายการ';
  $('deleteBtn').hidden = isNew;
  setEditorError('');

  $('editorFields').innerHTML = current.fields.filter(function (f) { return !f.createOnly || isNew; }).map(function (f) {
    var v = row ? row[f.key] : defaultValue(f);
    if (f.type === 'time' && v) v = String(v).slice(0, 5);   // 'HH:MM:SS' ของ Postgres → ช่อง time รับแค่ HH:MM
    if (f.type === 'datetime') v = toLocalInput(v);
    return fieldHtml(f, v);
  }).join('');

  $('editorFields').oninput = $('editorFields').onchange = null;   // ตัวอย่างสดของหมวดข่าวสาร ไม่ติดไปฟอร์มหมวดอื่น
  if (current.id === 'banners') mountNewsPreview();
  current.fields.forEach(function (f) {
    var id = 'f_' + f.key;
    if (f.upload && $(id)) bindUpload(id + 'Up', $(id), f.upload.bucket, f.upload.maxSide, $(id + 'UpMsg'));
  });
  paintIcons($('editorFields'));

  $('editor').showModal();
  var first = $('editorFields').querySelector('input, select, textarea');
  if (first) first.focus();
}

/* ตัวอย่างการ์ดในฟอร์มข่าวสาร — วาดด้วย newsCard() ตัวเดียวกับหน้าหลัก พิมพ์แล้วเปลี่ยนตามทันที
   ลิงก์ในตัวอย่างกดไม่ได้ (กันกดหลุดออกจากฟอร์มที่ยังไม่บันทึก) */
function mountNewsPreview() {
  var box = document.createElement('div');
  box.className = 'col-span-6 flex flex-col gap-2 rounded-md bg-surface-soft p-4';
  box.innerHTML = '<p class="m-0 fs-13 text-fg-mute">ตัวอย่างบนหน้าหลัก (แถบข่าวสารและไฮไลต์)</p>' +
    '<div class="pointer-events-none w-[260px] max-w-full self-center" id="newsPreview" aria-hidden="true"></div>';
  $('editorFields').prepend(box);
  var paint = function () {
    var v = collectValues(!editing);
    v.updated_at = editing && editing.updated_at;
    var host = $('newsPreview');
    host.innerHTML = (v.title || v.message || v.image_url) ? newsCard(v)
      : '<div class="flex aspect-[3/4] items-center justify-center rounded-[16px] border border-dashed border-line-strong fs-14 text-fg-mute">กรอกหัวข้อหรือรายละเอียดเพื่อดูตัวอย่าง</div>';
    host.querySelectorAll('img[data-fb]').forEach(function (img) {
      img.addEventListener('error', function () { var fb = img.dataset.fb; if (fb) { delete img.dataset.fb; img.src = fb; } });
    });
  };
  $('editorFields').oninput = paint;
  $('editorFields').onchange = paint;
  paint();
}

function collectValues(isNew) {
  var out = {};
  current.fields.forEach(function (f) {
    if (f.createOnly && !isNew) return;
    var node = $('f_' + f.key);
    if (!node) return;
    if (f.type === 'checkbox') { out[f.key] = node.checked; return; }

    var v = node.value.trim();
    if (f.type === 'number') { out[f.key] = v === '' ? 0 : Number(v); return; }
    // ช่องเวลา/วันเวลา/select เว้นว่างต้องส่ง null ไม่ใช่ '' — Postgres ปฏิเสธสตริงว่างของชนิดเหล่านี้
    if ((f.type === 'time' || f.type === 'select' || f.type === 'datetime') && v === '') { out[f.key] = null; return; }
    // datetime-local ไม่มีโซนเวลา — new Date() อ่านเป็นเวลาเครื่อง แล้วส่งเป็น UTC ให้ timestamptz
    if (f.type === 'datetime') { out[f.key] = new Date(v).toISOString(); return; }
    out[f.key] = v;
  });
  return out;
}

async function save(event) {
  event.preventDefault();
  if (current.kind === 'sheet') return saveSheetRow();
  var isNew = !editing;
  var values = collectValues(isNew);

  if (current.id === 'results' && values.score && values.status === 'upcoming') values.status = 'done';
  if (current.id === 'banners') {
    if (!values.title && !values.message && !values.image_url) {
      setEditorError('ใส่หัวข้อ รายละเอียด หรือรูปอย่างน้อยหนึ่งอย่าง — ประกาศว่างจะไม่ขึ้นบนเว็บ');
      return;
    }
    if (values.starts_at && values.ends_at && values.ends_at <= values.starts_at) {
      setEditorError('เวลาหยุดแสดงต้องอยู่หลังเวลาเริ่มแสดง');
      return;
    }
  }

  var payload = Object.assign({}, current.defaults || {}, values);
  $('saveBtn').disabled = true;
  setEditorError('');
  try {
    var res = isNew
      ? await db.from(current.table).insert(payload)
      : await db.from(current.table).update(payload).eq(current.pk, editing[current.pk]);
    if (res.error) throw res.error;
    $('editor').close();
    setSaveState('บันทึกแล้ว');
    if (current.table === 'sports') await loadSports();
    await refreshTable();
  } catch (err) {
    setEditorError(friendlyError(err));
  } finally {
    $('saveBtn').disabled = false;
  }
}

async function remove() {
  if (!editing) return;
  if (current.kind === 'sheet') return deleteSheetRow();
  if (!confirm('ลบรายการนี้ออกจาก "' + current.title + '" ถาวร?\nการลบย้อนกลับไม่ได้ (ถ้าเคยดาวน์โหลดไฟล์สำรองไว้ กู้คืนจากไฟล์นั้นได้)')) return;
  try {
    var res = await db.from(current.table).delete().eq(current.pk, editing[current.pk]);
    if (res.error) throw res.error;
    $('editor').close();
    setSaveState('ลบแล้ว');
    await refreshTable();
  } catch (err) {
    setEditorError(friendlyError(err));
  }
}

function friendlyError(err) {
  var code = (err && err.code) || '';
  var msg = (err && err.message) || String(err);
  if (code === '23505' && /schools_one_self/.test(msg)) return 'มีโรงเรียนที่ติ๊ก "เป็นโรงเรียนของเรา" อยู่แล้ว — เอาเครื่องหมายออกจากโรงเรียนเดิมก่อน';
  if (code === '23505') return 'มีรายการนี้อยู่แล้ว (ชื่อหรือรหัสซ้ำกับที่มีอยู่)';
  if (code === '23503') return 'อ้างถึงข้อมูลที่ไม่มีอยู่ — ตรวจว่าเลือกชนิดกีฬาถูกต้อง';
  if (code === '23514') return 'ค่าที่กรอกไม่อยู่ในช่วงที่อนุญาต';
  if (code === '42501' || /row-level security/i.test(msg)) return 'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูล — ต้องถูกเพิ่มในตาราง app_admins ก่อน';
  return 'บันทึกไม่สำเร็จ: ' + missingSchemaHint(err);
}

/** ตาราง/ฟังก์ชันยังไม่มีในฐานข้อมูล = ยังไม่ได้ส่ง migration ขึ้นไป บอกวิธีแก้ตรง ๆ */
function missingSchemaHint(err) {
  var msg = (err && err.message) || String(err);
  if ((err && (err.code === 'PGRST202' || err.code === 'PGRST205' || err.code === '42P01' || err.code === '42883')) ||
      /could not find|does not exist|schema cache/i.test(msg)) {
    return 'ฐานข้อมูลยังไม่มีตาราง/ฟังก์ชันที่หน้านี้ต้องใช้ — รัน `npm run db:push` เพื่อส่ง migration ใน supabase/migrations/ ขึ้นไปก่อน (' + msg + ')';
  }
  return msg;
}

/* =========================================================
   มุมมอง "ผู้เข้าชม"
   ========================================================= */

function renderStatsShell() {
  $('viewBody').innerHTML = '<div class="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1">' +
    [1, 2, 3, 4].map(function () {
      return '<div class="' + CARD + ' flex flex-col gap-3"><span class="skeleton block h-4 w-1/2"></span><span class="skeleton block h-9 w-2/3"></span><span class="skeleton block h-3.5 w-3/4"></span></div>';
    }).join('') + '</div>';
}

/** การ์ดตัวเลข — live = จุดฟ้าหน้าป้าย (ตัวเลขที่เปลี่ยนตามเวลาจริง) */
function kpi(label, value, sub, ic, live) {
  return '<div class="' + CARD + ' flex flex-col">' +
    '<div class="flex items-center gap-2.5">' +
      '<span class="flex size-9 flex-none items-center justify-center rounded-sm bg-brand-100 text-brand-ink">' + icon(ic, 'size-[18px]') + '</span>' +
      '<p class="m-0 flex items-center gap-2 fs-14 text-fg-soft">' + esc(label) +
        (live ? '<span class="size-2 rounded-full bg-live" aria-hidden="true"></span>' : '') + '</p>' +
    '</div>' +
    '<p class="mt-4 mb-0 font-display fs-36 leading-none text-brand-strong tabular-nums">' + esc(fmtNum(value)) + '</p>' +
    (sub ? '<p class="mt-2.5 mb-0 fs-13.5 text-fg-mute">' + esc(sub) + '</p>' : '') + '</div>';
}

/** ค่าบนแกนกราฟที่อ่านง่าย (1, 2, 5 × 10ⁿ) ไม่ใช่ค่าสูงสุดดิบ ๆ อย่าง 1,437 */
function niceMax(n) {
  var p = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))));
  var m = [1, 2, 2.5, 5, 10].filter(function (k) { return k * p >= n; })[0];
  return m * p;
}

function dailyChart(daily) {
  // แท่งเดียวต่อวัน = ผู้เข้าชม (คน) ตรงกับการ์ด "ผู้เข้าชมวันนี้" · จำนวนครั้งที่เปิดหน้าอยู่ในข้อความตอนชี้แท่ง
  var max = niceMax(Math.max.apply(null, daily.map(function (d) { return d.visitors; }).concat([1])));
  var every = daily.length > 16 ? Math.ceil(daily.length / 10) : 1;   // วันเยอะ ป้ายวันที่เว้นระยะไม่ให้ทับกัน
  var bars = daily.map(function (d, i) {
    var h = Math.round((d.visitors / max) * 100);
    var label = thaiDate(d.day);
    return '<div class="group/bar flex min-w-0 flex-1 flex-col items-center gap-1.5" title="' + esc(label + ' · ผู้เข้าชม ' + fmtNum(d.visitors) + ' คน · เปิดหน้า ' + fmtNum(d.views) + ' ครั้ง') + '">' +
      '<span class="fs-12 text-fg-mute tabular-nums opacity-0 group-hover/bar:opacity-100">' + esc(fmtNum(d.visitors)) + '</span>' +
      '<div class="relative flex h-[200px] w-full max-w-[28px] items-end">' +
        '<div class="w-full rounded-t-[4px] bg-chart group-hover/bar:opacity-85" style="height:' + h + '%"></div>' +
      '</div>' +
      '<span class="h-4 fs-11.5 whitespace-nowrap ' + (i === daily.length - 1 ? 'font-semibold text-fg' : 'text-fg-mute') + '">' +
        (i === daily.length - 1 ? 'วันนี้' : i % every === 0 ? esc(label) : '') + '</span>' +
    '</div>';
  }).join('');

  // ตารางซ่อนสำหรับโปรแกรมอ่านหน้าจอ — กราฟแท่งอ่านออกเสียงไม่ได้
  var table = '<table class="sr-only"><caption>ยอดเข้าชมรายวัน</caption><thead><tr><th>วันที่</th><th>เปิดหน้า</th><th>ผู้เข้าชม</th></tr></thead><tbody>' +
    daily.map(function (d) { return '<tr><td>' + esc(thaiDate(d.day)) + '</td><td>' + d.views + '</td><td>' + d.visitors + '</td></tr>'; }).join('') +
    '</tbody></table>';

  // เส้นแกนนอน 4 ระดับ — วางทับหลังแท่ง (ไม่ใช่ตัวแท่ง) จึงอยู่ในกล่อง h-[200px] เดียวกับแท่งพอดี
  var grid = [1, 0.75, 0.5, 0.25, 0].map(function (f) {
    return '<div class="absolute right-0 left-12 border-t ' + (f ? 'border-dashed border-line' : 'border-line-strong') + '" style="bottom:' + (f * 200 + 22) + 'px">' +
      '<span class="absolute -top-2.5 -left-12 w-10 text-right fs-11 text-fg-mute tabular-nums">' + esc(fmtNum(Math.round(max * f))) + '</span></div>';
  }).join('');

  return '<div class="' + CARD + '">' +
    '<div class="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5">' +
      '<h2 class="m-0 mr-auto font-display fs-20 font-normal text-brand-strong">ยอดเข้าชมรายวัน</h2>' +
      '<span class="flex items-center gap-1.5 fs-13.5 text-fg-soft"><span class="size-2.5 rounded-[3px] bg-chart"></span>ผู้เข้าชม (คน)</span>' +
    '</div>' +
    '<div class="relative pl-12" aria-hidden="true">' + grid +
      '<div class="relative flex items-end gap-1.5 overflow-x-auto">' + bars + '</div></div>' + table + '</div>';
}

function pagesTable(pages) {
  if (!pages.length) return '<div class="' + CARD + ' fs-14.5 text-fg-mute">ยังไม่มีการเข้าชมในช่วงนี้</div>';
  var max = Math.max.apply(null, pages.map(function (p) { return p.views; }).concat([1]));
  return '<div class="' + PANEL + '"><div class="border-b border-line px-6 py-4"><h2 class="m-0 font-display fs-20 font-normal text-brand-strong">หน้าที่เปิดมากที่สุด</h2></div>' +
    '<div class="overflow-x-auto"><table class="w-full border-collapse fs-15"><thead><tr>' +
      '<th class="' + TH + '" scope="col">หน้า</th><th class="' + TH + ' text-right" scope="col">เปิดหน้า</th><th class="' + TH + ' text-right" scope="col">ผู้เข้าชม</th>' +
    '</tr></thead><tbody>' + pages.map(function (p) {
      return '<tr class="[&:last-child>td]:border-b-0"><td class="' + TD + '"><div class="flex flex-col gap-2"><span>' + esc(PAGE_NAMES[p.path] || p.path || '—') +
        ' <span class="fs-13 text-fg-mute">' + esc(p.path) + '</span></span>' +
        '<span class="block h-1.5 overflow-hidden rounded-full bg-surface-soft"><span class="block h-full rounded-full bg-brand" style="width:' + Math.max(2, Math.round(p.views / max * 100)) + '%"></span></span></div></td>' +
        '<td class="' + TD + ' text-right tabular-nums">' + esc(fmtNum(p.views)) + '</td>' +
        '<td class="' + TD + ' text-right tabular-nums">' + esc(fmtNum(p.visitors)) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

async function refreshStats() {
  var res = await db.rpc('visit_stats', { p_days: statsDays });
  if (current.id !== 'stats') return;   // ผู้ใช้สลับหมวดไปแล้วระหว่างรอ
  if (res.error) {
    setPanelError('โหลดสถิติไม่สำเร็จ: ' + missingSchemaHint(res.error));
    $('viewBody').innerHTML = '';
    return;
  }
  setPanelError('');
  var s = res.data || {};
  var daily = s.daily || [];
  var rangeViews = daily.reduce(function (a, d) { return a + d.views; }, 0);

  $('viewBody').innerHTML =
    '<div class="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1">' +
      kpi('ผู้เข้าชมวันนี้', s.today_visitors, 'เปิดหน้า ' + fmtNum(s.today_views) + ' ครั้ง', 'visitors') +
      kpi('กำลังดูอยู่ตอนนี้', s.online_now, 'คนที่เปิดหน้าใน 5 นาทีล่าสุด', 'eye', true) +
      kpi('เปิดหน้าใน ' + statsDays + ' วัน', rangeViews, 'เฉลี่ยวันละ ' + fmtNum(Math.round(rangeViews / Math.max(1, daily.length))) + ' ครั้ง', 'views') +
      kpi('ผู้เข้าชมทั้งหมด', s.total_visitors, 'เปิดหน้ารวม ' + fmtNum(s.total_views) + ' ครั้ง ตั้งแต่เริ่มนับ', 'rank') +
    '</div>' +
    dailyChart(daily) +
    pagesTable(s.pages || []) +
    '<p class="m-0 fs-13.5 text-fg-mute">อัปเดตเองทุก 1 นาที · ล่าสุด ' + esc(thaiDateTime(new Date())) +
      ' · "ผู้เข้าชม" นับจากรหัสสุ่มในเบราว์เซอร์ คนเดียวเปิดหลายเครื่องจะถูกนับหลายคน</p>';
  paintIcons($('viewBody'));
}

function renderStatsActions() {
  $('panelActions').innerHTML = '<div class="inline-flex rounded-sm border border-line bg-surface-soft p-[3px]" role="group" aria-label="ช่วงเวลา">' +
    [7, 14, 30].map(function (d) {
      return '<button class="h-8 cursor-pointer rounded-[7px] border-0 bg-transparent px-3.5 fs-14 text-fg-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-brand ' +
        'aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-brand-ink aria-pressed:ring-1 aria-pressed:ring-line" type="button" data-days="' + d + '" aria-pressed="' + (d === statsDays) + '">' + d + ' วัน</button>';
    }).join('') + '</div>' +
    '<button class="btn btn-outline btn-sm" type="button" id="statsReload">' + icon('refresh') + 'รีเฟรช</button>';
  paintIcons($('panelActions'));
  $('panelActions').querySelectorAll('[data-days]').forEach(function (b) {
    b.addEventListener('click', function () { statsDays = Number(b.dataset.days); renderStatsActions(); refreshStats(); });
  });
  $('statsReload').addEventListener('click', refreshStats);
}

/* =========================================================
   มุมมอง "สำรองและกู้คืน"
   ========================================================= */

var pendingRestore = null;

/** หัวการ์ดของหน้าสำรองข้อมูล: ไอคอน + ชื่อ + คำอธิบาย */
function taskHead(ic, title, text) {
  return '<div class="flex items-start gap-3.5">' +
    '<span class="flex size-10 flex-none items-center justify-center rounded-sm bg-brand-100 text-brand-ink">' + icon(ic, 'size-5') + '</span>' +
    '<div class="min-w-0"><h2 class="m-0 font-display fs-19 font-normal text-brand-strong">' + title + '</h2>' +
    '<p class="mt-1 mb-0 fs-14 text-fg-soft">' + text + '</p></div></div>';
}

function renderBackupView() {
  $('viewBody').innerHTML =
    '<div class="grid grid-cols-3 gap-5 max-[1200px]:grid-cols-1">' +
      '<section class="' + CARD + ' flex flex-col gap-4">' +
        taskHead('download', 'ดาวน์โหลดไฟล์สำรอง', 'บันทึกข้อมูลทุกหมวด (ผล ตาราง เหรียญ กีฬา ภาพ แบนเนอร์ ตั้งค่า) เป็นไฟล์ .json เก็บไว้ในเครื่อง — ควรกดก่อนแก้ข้อมูลครั้งใหญ่ทุกครั้ง') +
        '<button class="btn mt-auto self-start" type="button" id="exportBtn">' + icon('download') + 'ดาวน์โหลดไฟล์สำรอง</button>' +
      '</section>' +
      '<section class="' + CARD + ' flex flex-col gap-4">' +
        taskHead('upload', 'กู้คืนจากไฟล์สำรอง', 'เลือกไฟล์ .json ที่เคยดาวน์โหลดไว้ ระบบจะแสดงจำนวนรายการให้ตรวจก่อนเขียนจริง') +
        '<label class="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface-soft/50 px-4 py-4 text-center hover:border-brand/60 hover:bg-brand-100/30 focus-within:outline-2 focus-within:outline-brand">' +
          '<span class="text-fg-mute">' + icon('upload', 'size-5') + '</span>' +
          '<span class="fs-14 text-fg" id="restoreFileName">เลือกไฟล์ .json</span>' +
          '<input class="sr-only" id="restoreFile" type="file" accept="application/json,.json" />' +
        '</label>' +
        '<label class="flex cursor-pointer items-start gap-2.5 fs-14 text-fg-soft"><input class="mt-1 size-[16px] flex-none accent-brand" id="restoreReplace" type="checkbox" checked />' +
          '<span><span class="text-fg">แทนที่ทั้งหมด</span> — ลบรายการในฐานข้อมูลที่ไม่มีอยู่ในไฟล์ (ไม่ติ๊ก = เพิ่ม/ทับเฉพาะที่มีในไฟล์)</span></label>' +
        '<div class="fs-14 text-fg-soft empty:hidden" id="restoreSummary"></div>' +
        '<button class="btn btn-destructive mt-auto self-start" type="button" id="restoreBtn" disabled>' + icon('upload') + 'กู้คืนข้อมูล</button>' +
      '</section>' +
      '<section class="' + CARD + ' flex flex-col gap-4">' +
        taskHead('sync', 'ดึงข้อมูลล่าสุดจาก Google Sheets', 'อ่านชีตตัวเดียวกับที่หน้าเว็บใช้อยู่ แล้วเขียนทับลงฐานข้อมูลนี้ ให้ระบบสำรองมีข้อมูลตรงกับหน้าเว็บจริงเสมอ') +
        notice('warn', '', 'ข้อมูลการแข่งขันถูกเขียนทับจากชีตทุกรอบ — สิ่งที่แก้ในหน้านี้เอง (ยกเว้นแบนเนอร์) จะหายในรอบถัดไป ให้แก้ที่ชีตเท่านั้น') +
        '<p class="m-0 fs-14 text-fg-soft" id="lastSync">ซิงก์ล่าสุด: กำลังตรวจ…</p>' +
        '<button class="btn mt-auto self-start" type="button" id="syncBtn">' + icon('sync') + 'ดึงจาก Google Sheets เดี๋ยวนี้</button>' +
      '</section>' +
    '</div>' +
    '<section class="' + PANEL + '"><div class="flex items-center gap-2.5 border-b border-line px-6 py-3.5">' +
        '<h2 class="m-0 font-display fs-18 font-normal text-brand-strong">บันทึกการทำงาน</h2></div>' +
      '<ol class="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-y-auto bg-surface-soft/40 px-6 py-4 font-mono fs-13.5 text-fg-soft tabular-nums" id="log">' +
        '<li class="text-fg-mute">ยังไม่มีการทำงาน</li></ol></section>';
  paintIcons($('viewBody'));

  $('exportBtn').addEventListener('click', function () { runTask($('exportBtn'), exportBackup); });
  $('restoreFile').addEventListener('change', readRestoreFile);
  $('restoreBtn').addEventListener('click', function () { runTask($('restoreBtn'), restoreBackup); });
  $('syncBtn').addEventListener('click', function () { runTask($('syncBtn'), syncFromSheets); });
  showLastSync();
}

/** เวลาซิงก์ชีตล่าสุด (ทั้งรอบอัตโนมัติของ GitHub Actions และปุ่มในหน้านี้) — ค้างนานผิดปกติ = ซิงก์มีปัญหา */
async function showLastSync() {
  var res = await db.from('site_settings').select('value').eq('key', 'last_sheet_sync').maybeSingle();
  var n = $('lastSync');
  if (!n) return;
  var ts = res.data && res.data.value;
  if (!ts) { n.innerHTML = 'ซิงก์ล่าสุด: <span class="text-fg-mute">ยังไม่เคยซิงก์</span>'; return; }
  var mins = Math.round((Date.now() - new Date(ts)) / 60000);
  var ago = mins < 1 ? 'เมื่อสักครู่' : mins < 60 ? mins + ' นาทีที่แล้ว' : mins < 1440 ? Math.floor(mins / 60) + ' ชั่วโมงที่แล้ว' : Math.floor(mins / 1440) + ' วันที่แล้ว';
  // ซิงก์อัตโนมัติทุก 15 นาที — เกินชั่วโมงแปลว่ารอบอัตโนมัติล้มหรือถูกปิด ให้เห็นเป็นสีเตือน
  var stale = mins > 60;
  n.innerHTML = 'ซิงก์ล่าสุด: <strong class="' + (stale ? 'text-destructive' : 'text-done') + '">' + esc(thaiDateTime(ts)) + '</strong> (' + esc(ago) + ')' +
    '<br><span class="fs-13 text-fg-mute">ระบบซิงก์ให้เองทุก 15 นาที' + (stale ? ' — ค้างเกิน 1 ชั่วโมง ตรวจแท็บ Actions ใน GitHub' : '') + '</span>';
}

function log(text, tone) {
  var list = $('log');
  if (!list) return;
  if (list.dataset.started !== '1') { list.innerHTML = ''; list.dataset.started = '1'; }
  var li = document.createElement('li');
  li.className = tone === 'error' ? 'text-destructive' : tone === 'ok' ? 'text-done' : '';
  li.textContent = new Date().toLocaleTimeString('th-TH', { hour12: false }) + '  ' + text;
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}

/** ปุ่มงานยาว: ปิดปุ่มระหว่างทำ กันกดซ้ำแล้วเขียนข้อมูลชนกันเอง */
async function runTask(btn, task) {
  var busy = document.querySelectorAll('#viewBody button');
  busy.forEach(function (b) { b.disabled = true; });
  var old = btn.innerHTML;
  btn.textContent = 'กำลังทำงาน…';
  try {
    await task();
  } catch (err) {
    log('ล้มเหลว: ' + missingSchemaHint(err), 'error');
  } finally {
    busy.forEach(function (b) { b.disabled = false; });
    btn.innerHTML = old;
    $('restoreBtn').disabled = !pendingRestore;
  }
}

/** อ่านทั้งตาราง — PostgREST คืนครั้งละไม่เกิน 1000 แถว ต้องไล่เป็นหน้า ๆ */
async function fetchAll(table) {
  var all = [];
  for (var from = 0; ; from += 1000) {
    var res = await db.from(table).select('*').range(from, from + 999);
    if (res.error) throw res.error;
    all = all.concat(res.data || []);
    if (!res.data || res.data.length < 1000) return all;
  }
}

async function exportBackup() {
  log('เริ่มดาวน์โหลดไฟล์สำรอง');
  var tables = {};
  for (var i = 0; i < BACKUP_TABLES.length; i++) {
    var t = BACKUP_TABLES[i];
    tables[t.table] = await fetchAll(t.table);
    log('  ' + t.label + ' ' + tables[t.table].length + ' รายการ');
  }
  var now = new Date();
  var stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  var blob = new Blob([JSON.stringify({ app: 'satit-sports-cms', version: 1, exportedAt: now.toISOString(), tables: tables }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'satit-sports-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  log('ดาวน์โหลด ' + a.download + ' แล้ว', 'ok');
}

async function readRestoreFile(e) {
  pendingRestore = null;
  $('restoreBtn').disabled = true;
  var file = e.target.files[0];
  $('restoreFileName').textContent = file ? file.name : 'เลือกไฟล์ .json';
  if (!file) { $('restoreSummary').textContent = ''; return; }
  try {
    var json = JSON.parse(await file.text());
    if (!json || json.app !== 'satit-sports-cms' || !json.tables) throw new Error('ไม่ใช่ไฟล์สำรองของระบบนี้');
    pendingRestore = json;
    $('restoreSummary').innerHTML = 'สำรองเมื่อ <strong>' + esc(thaiDateTime(json.exportedAt)) + '</strong><br>' +
      BACKUP_TABLES.map(function (t) {
        var n = (json.tables[t.table] || []).length;
        return esc(t.label) + ' ' + n;
      }).join(' · ');
    $('restoreBtn').disabled = false;
  } catch (err) {
    $('restoreSummary').innerHTML = '<span class="text-destructive">อ่านไฟล์ไม่ได้: ' + esc(err.message) + '</span>';
  }
}

/** ลบทุกแถวที่ pk ไม่อยู่ใน keep — PostgREST ไม่ยอม DELETE แบบไม่มีเงื่อนไข จึงต้องใส่ตัวกรองเสมอ */
async function deleteMissing(t, keep) {
  var existing = await fetchAll(t.table);
  var keepSet = new Set(keep.map(String));
  var drop = existing.map(function (r) { return r[t.pk]; }).filter(function (id) { return !keepSet.has(String(id)); });
  for (var i = 0; i < drop.length; i += 100) {
    var res = await db.from(t.table).delete().in(t.pk, drop.slice(i, i + 100));
    if (res.error) throw res.error;
  }
  return drop.length;
}

async function restoreBackup() {
  if (!pendingRestore) return;
  var replace = $('restoreReplace').checked;
  if (!confirm('กู้คืนข้อมูลจากไฟล์สำรองเมื่อ ' + thaiDateTime(pendingRestore.exportedAt) + '?\n' +
    (replace ? 'ข้อมูลปัจจุบันที่ไม่มีในไฟล์จะถูกลบ ' : 'รายการที่มีในไฟล์จะเขียนทับของเดิม ') +
    'แนะนำให้ดาวน์โหลดไฟล์สำรองของตอนนี้เก็บไว้ก่อน')) return;

  log('เริ่มกู้คืนจากไฟล์ (' + (replace ? 'แทนที่ทั้งหมด' : 'เพิ่ม/ทับ') + ')');

  // is_self มีได้โรงเรียนเดียว (unique index) — ถ้าไฟล์ย้ายโรงเรียนเรา upsert จะชนแถวเดิม
  // จึงล้างธงเดิมก่อน แล้วให้ไฟล์เป็นคนตั้งกลับ
  if ((pendingRestore.tables.schools || []).length) {
    var clr = await db.from('schools').update({ is_self: false }).eq('is_self', true);
    if (clr.error) throw clr.error;
  }

  for (var i = 0; i < BACKUP_TABLES.length; i++) {
    var t = BACKUP_TABLES[i];
    var data = pendingRestore.tables[t.table];
    if (!Array.isArray(data)) { log('  ข้าม ' + t.label + ' (ไม่มีในไฟล์)'); continue; }
    // ลบส่วนเกินก่อนเขียน ไม่ใช่หลัง — แถวเก่าที่ id ต่างแต่ชื่อซ้ำ (เช่นโรงเรียนที่ถูกลบแล้วเพิ่มใหม่)
    // จะชน unique ของ full_name ตอน upsert ถ้ายังไม่ถูกลบออกไป
    var removed = 0;
    if (replace) removed = await deleteMissing(t, data.map(function (r) { return r[t.pk]; }));
    for (var j = 0; j < data.length; j += 500) {
      var res = await db.from(t.table).upsert(data.slice(j, j + 500), { onConflict: t.pk });
      if (res.error) throw res.error;
    }
    log('  ' + t.label + ' ' + data.length + ' รายการ' + (removed ? ' · ลบที่เกิน ' + removed : ''), 'ok');
  }
  await loadSports();
  log('กู้คืนเสร็จแล้ว', 'ok');
  setSaveState('กู้คืนแล้ว');
}

async function syncFromSheets() {
  useSheet(source.url || DEFAULT_SHEET_ID, { direct: true });
  log('กำลังอ่าน Google Sheets… (ชีต ' + currentSheetId() + ')');
  var data = await loadFromSheets();
  var r = sheetRows(data);
  r.skippedDays.forEach(function (d) { log('  ข้ามวัน "' + d + '" — แปลงเป็นวันที่ไม่ได้', 'error'); });
  log('  อ่านได้: โรงเรียน ' + r.schools.length + ' · กีฬา ' + r.sports.length + ' · รายการแข่ง ' + r.matches.length + ' · ภาพ ' + r.photos.length);

  if (!r.matches.length && !r.schools.length) throw new Error('ชีตไม่มีข้อมูล (หรืออ่านไม่สำเร็จ) — ยกเลิกเพื่อไม่ให้ฐานข้อมูลถูกล้างเป็นค่าว่าง');
  if (!confirm('เขียนข้อมูลจาก Google Sheets ทับฐานข้อมูล?\nรายการแข่งขัน ' + r.matches.length + ' รายการและภาพ ' + r.photos.length +
    ' ภาพจะแทนที่ของเดิมทั้งชุด\n(ระบบจะดาวน์โหลดไฟล์สำรองของตอนนี้ให้ก่อน)')) { log('ยกเลิกแล้ว'); return; }

  await exportBackup();

  var steps = [
    ['ตั้งค่าเว็บ', function () { return db.from('site_settings').upsert(r.settings, { onConflict: 'key' }); }],
    ['กีฬา', function () { return db.from('sports').upsert(r.sports, { onConflict: 'id' }); }],
    ['ล้างธงโรงเรียนเรา', function () { return db.from('schools').update({ is_self: false }).eq('is_self', true); }],
    ['โรงเรียน', function () { return db.from('schools').upsert(r.schools, { onConflict: 'full_name' }); }],
    ['ล้างรายการแข่งเดิม', function () { return db.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'); }],
    ['รายการแข่งขัน', function () { return r.matches.length ? db.from('matches').insert(r.matches) : { error: null }; }]
  ];
  // ชีตไม่มีแท็บภาพ/อ่านไม่ได้ = ได้ภาพ 0 รูป อย่าเอาไปล้างภาพที่มีอยู่ทิ้ง
  if (r.photos.length) {
    steps.push(['ล้างภาพเดิม', function () { return db.from('photos').delete().neq('id', '00000000-0000-0000-0000-000000000000'); }]);
    steps.push(['ภาพ', async function () {
      var res = await db.from('photos').insert(r.photos);
      if (res.error && isMissingPhotoColumns(res.error.message)) {
        log('  ฐานข้อมูลยังไม่มีคอลัมน์วันที่ของภาพ — บันทึกภาพโดยไม่มีวันที่ไปก่อน', 'error');
        res = await db.from('photos').insert(withoutPhotoDays(r.photos));
      }
      return res;
    }]);
  }

  for (var i = 0; i < steps.length; i++) {
    var res = await steps[i][1]();
    if (res.error) throw res.error;
    log('  ✓ ' + steps[i][0], 'ok');
  }
  await db.from('site_settings').upsert({ key: 'last_sheet_sync', value: new Date().toISOString() }, { onConflict: 'key' });
  showLastSync();
  await loadSports();
  log('ดึงข้อมูลจาก Google Sheets เสร็จแล้ว', 'ok');
  setSaveState('ซิงก์จากชีตแล้ว');
}


/* =========================================================
   มุมมอง "ประมวลภาพ" — แก้ลิงก์โฟลเดอร์ / โฟลเดอร์ที่ซ่อน
   เก็บใน site_settings (GALLERY_KEYS) · หน้าประมวลภาพอ่านค่านี้ก่อนค่าในไฟล์ gallery-config.js
   ========================================================= */

async function renderGalleryView() {
  $('viewBody').innerHTML = '<div class="' + CARD + ' text-[14.5px] text-fg-mute">กำลังโหลด…</div>';
  var res = await db.from('site_settings').select('key,value').in('key', [GALLERY_KEYS.folder, GALLERY_KEYS.hidden]);
  if (current.id !== 'gallery') return;
  if (res.error) { setPanelError('โหลดค่าไม่สำเร็จ: ' + missingSchemaHint(res.error)); $('viewBody').innerHTML = ''; return; }

  var saved = {};
  (res.data || []).forEach(function (r) { saved[r.key] = r.value; });
  var fromCms = GALLERY_KEYS.folder in saved && String(saved[GALLERY_KEYS.folder]).trim();
  var folder = fromCms ? saved[GALLERY_KEYS.folder] : DRIVE_FOLDER;
  var hiddenText = GALLERY_KEYS.hidden in saved ? saved[GALLERY_KEYS.hidden] : (HIDDEN_FOLDERS || []).join('\n');

  $('viewBody').innerHTML =
    '<form class="' + CARD + ' flex flex-col gap-5" id="galleryForm">' +
      (fromCms ? notice('ok', '', 'หน้าประมวลภาพใช้ค่าจาก CMS นี้อยู่')
        : notice('warn', '', 'ยังไม่เคยบันทึกใน CMS — ตอนนี้หน้าเว็บใช้ค่าในไฟล์ gallery-config.js (แสดงไว้ในช่องด้านล่าง) กดบันทึกเพื่อให้ CMS เป็นตัวกำหนด')) +
      '<div>' +
        '<label class="label mb-2" for="gFolder">ลิงก์โฟลเดอร์แม่ใน Google Drive <span class="-ml-1 text-destructive">*</span></label>' +
        '<input class="input h-10" id="gFolder" type="url" required placeholder="https://drive.google.com/drive/folders/…" value="' + esc(folder) + '" />' +
        '<p class="mt-1.5 text-[13.5px] text-fg-mute">โฟลเดอร์ที่มีโฟลเดอร์กีฬาอยู่ข้างใน (กีฬา → วัน → รูป) · ต้องแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" · คัดลอกจากปุ่ม "แชร์" ของโฟลเดอร์ใน Drive</p>' +
      '</div>' +
      '<div>' +
        '<label class="label mb-2" for="gHidden">โฟลเดอร์ที่ไม่แสดงบนเว็บ</label>' +
        '<textarea class="textarea min-h-[96px]" id="gHidden" rows="4" placeholder="เช่น การประชุมคณะกรรมการ">' + esc(hiddenText) + '</textarea>' +
        '<p class="mt-1.5 text-[13.5px] text-fg-mute">บรรทัดละชื่อ สะกดตรงตามชื่อโฟลเดอร์ใน Drive · อีกทางหนึ่ง: ตั้งชื่อโฟลเดอร์ใน Drive ให้ขึ้นต้นด้วย _ ก็ซ่อนได้</p>' +
      '</div>' +
      '<div class="flex flex-wrap items-center gap-2.5">' +
        '<button class="btn btn-outline" type="button" id="gCheck">' + icon('search') + 'ตรวจสอบลิงก์</button>' +
        '<button class="btn" type="submit" id="gSave">บันทึก</button>' +
        '<a class="btn btn-ghost ml-auto text-fg-soft" href="../gallery.html" target="_blank" rel="noopener">' + icon('external') + 'เปิดหน้าประมวลภาพ</a>' +
      '</div>' +
      '<div id="gResult"></div>' +
    '</form>';

  paintIcons($('viewBody'));
  $('gCheck').addEventListener('click', function () { runGalleryCheck(); });
  $('galleryForm').addEventListener('submit', saveGallerySettings);
}

/** อ่านโฟลเดอร์จริงจาก Drive แล้วแสดงว่าเจออะไร — กันบันทึกลิงก์ผิด/ยังไม่แชร์ขึ้นเว็บ */
async function runGalleryCheck() {
  var out = $('gResult');
  out.innerHTML = '<p class="m-0 text-[14px] text-fg-mute">กำลังอ่านโฟลเดอร์จาก Google Drive…</p>';
  $('gCheck').disabled = true;
  var r = await checkDriveFolder($('gFolder').value, parseHiddenFolders($('gHidden').value));
  $('gCheck').disabled = false;

  if (!r.ok) {
    out.innerHTML = '<p class="m-0 rounded-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">อ่านโฟลเดอร์ไม่ได้: ' + esc(r.error) + '</p>';
    return r;
  }
  if (!r.folders.length) {
    out.innerHTML = '<p class="m-0 rounded-sm border border-gold/40 bg-gold/15 px-3.5 py-2.5 text-[14px] text-gold-ink">' +
      'เปิดลิงก์ได้ แต่ไม่พบโฟลเดอร์ข้างใน — ตรวจว่าเป็นลิงก์ "โฟลเดอร์แม่" (ที่มีโฟลเดอร์กีฬาอยู่ข้างใน) และแชร์แบบ "ทุกคนที่มีลิงก์ดูได้"</p>';
    r.ok = false;
    return r;
  }
  var shown = r.folders.filter(function (f) { return !f.hidden; });
  out.innerHTML =
    '<p class="m-0 mb-2.5 rounded-sm border border-done/30 bg-done-bg px-3.5 py-2.5 text-[14px] text-done">อ่านได้ ✓ พบ ' + r.folders.length + ' โฟลเดอร์ · แสดงบนเว็บ ' + shown.length + ' โฟลเดอร์</p>' +
    '<ul class="m-0 flex list-none flex-col divide-y divide-line rounded-sm border border-line p-0">' +
      r.folders.map(function (f) {
        var tag = f.hidden ? '<span class="badge badge-upcoming">ซ่อน</span>'
          : f.days ? '<span class="badge badge-done">' + f.days + ' วัน</span>'
          : '<span class="badge badge-secondary">แท็บของตัวเอง</span>';
        return '<li class="flex items-center gap-3 px-3.5 py-2 text-[14.5px]' + (f.hidden ? ' text-fg-mute line-through' : '') + '">' +
          '<span class="min-w-0 flex-1 truncate">' + esc(f.name) + '</span>' + tag + '</li>';
      }).join('') +
    '</ul>' +
    '<p class="mt-2 mb-0 text-[13px] text-fg-mute">"N วัน" = มีโฟลเดอร์วันข้างใน (รวมเข้าแท็บวัน) · "แท็บของตัวเอง" = ไม่มีโฟลเดอร์วัน (เช่น พิธีเปิด) เป็นแท็บชื่อโฟลเดอร์</p>';
  return r;
}

async function saveGallerySettings(event) {
  event.preventDefault();
  var link = $('gFolder').value.trim();
  if (!driveFolderId(link)) {
    $('gResult').innerHTML = '<p class="m-0 rounded-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">ไม่ใช่ลิงก์โฟลเดอร์ Google Drive — ลิงก์ต้องมี /drive/folders/ อยู่ข้างใน</p>';
    return;
  }
  // ตรวจก่อนบันทึกเสมอ — บันทึกลิงก์ที่อ่านไม่ได้ = หน้าประมวลภาพของผู้ชมทุกคนไม่มีรูปทันที
  $('gSave').disabled = true;
  var check = await runGalleryCheck();
  if (!check.ok && !confirm('ตรวจลิงก์ไม่ผ่าน — หน้าประมวลภาพจะไม่มีรูปจนกว่าจะแก้\nบันทึกต่อไปหรือไม่?')) {
    $('gSave').disabled = false;
    return;
  }
  var res = await db.from('site_settings').upsert([
    { key: GALLERY_KEYS.folder, value: link },
    { key: GALLERY_KEYS.hidden, value: parseHiddenFolders($('gHidden').value).join('\n') }
  ], { onConflict: 'key' });
  $('gSave').disabled = false;
  if (res.error) { setPanelError('บันทึกไม่สำเร็จ: ' + friendlyError(res.error)); return; }
  setSaveState('บันทึกแล้ว — ผู้ชมรีเฟรชหน้าก็เห็นผล');
  renderGalleryView();
}

/* =========================================================
   มุมมอง "ภาพแบนเนอร์" — ลิงก์รูปแบนเนอร์บนสุดของหน้า (HERO_SLOTS ใน hero-settings.js)
   เก็บใน site_settings · admin/site.js บนหน้าเว็บสาธารณะอ่านแล้วสลับรูป · ว่าง = รูปเดิมใน assets/hero/
   ========================================================= */

async function renderHeroView() {
  $('viewBody').innerHTML = '<div class="' + CARD + ' text-[14.5px] text-fg-mute">กำลังโหลด…</div>';
  var res = await db.from('site_settings').select('key,value').in('key', HERO_SLOTS.map(function (s) { return s.key; }));
  if (current.id !== 'heroes') return;
  if (res.error) { setPanelError('โหลดค่าไม่สำเร็จ: ' + missingSchemaHint(res.error)); $('viewBody').innerHTML = ''; return; }
  var saved = {};
  (res.data || []).forEach(function (r) { saved[r.key] = r.value || ''; });

  $('viewBody').innerHTML =
    '<form class="flex flex-col gap-5" id="heroForm">' +
      HERO_SLOTS.map(function (s, i) {
        return '<section class="' + CARD + ' flex flex-col gap-3">' +
          '<label class="label" for="hero' + i + '">' + esc(s.label) + '</label>' +
          '<div class="overflow-hidden rounded-md border border-line bg-surface-soft" style="aspect-ratio:' + s.ratio + '">' +
            '<img class="block size-full object-cover" id="heroPrev' + i + '" alt="ตัวอย่าง' + esc(s.label) + '" referrerpolicy="no-referrer" /></div>' +
          '<div class="flex flex-wrap gap-2.5">' +
            '<input class="input h-10 min-w-0 flex-1" id="hero' + i + '" type="url" placeholder="ลิงก์รูป — ลิงก์แชร์ Google Drive หรือ https://…" value="' + esc(saved[s.key] || '') + '" />' +
            uploadButtonHtml('heroUp' + i) +
            '<button class="btn btn-outline" type="button" data-hero-reset="' + i + '">ใช้ภาพเดิม</button>' +
          '</div>' +
          '<p class="m-0 text-[13.5px] text-fg-mute" id="heroUpMsg' + i + '" hidden></p>' +
          '<p class="m-0 text-[13.5px] text-fg-mute">' + esc(s.size) + ' · กด "อัปโหลดรูป" เลือกไฟล์จากเครื่อง หรือวางลิงก์ (ไฟล์ใน Drive ต้องแชร์แบบ "ทุกคนที่มีลิงก์ดูได้")</p>' +
          '<div id="heroMsg' + i + '"></div>' +
        '</section>';
      }).join('') +
      '<div class="flex flex-wrap items-center gap-2.5">' +
        '<button class="btn" type="submit" id="heroSave">บันทึก</button>' +
        '<a class="btn btn-ghost ml-auto text-fg-soft" href="../index.html" target="_blank" rel="noopener">' + icon('external') + 'เปิดหน้าหลัก</a>' +
      '</div>' +
      notice('ok', '', 'ข่าวสาร ไฮไลต์ และแถบประกาศ แก้ที่เมนู <button class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-brand-ink underline" type="button" data-go="banners">ข่าวสารและไฮไลต์</button>') +
    '</form>';

  HERO_SLOTS.forEach(function (s, i) {
    var input = $('hero' + i), timer = null;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { previewHero(i); }, 500); });
    bindUpload('heroUp' + i, input, 'hero', s.width, $('heroUpMsg' + i));
    previewHero(i);
  });
  $('heroForm').querySelectorAll('[data-hero-reset]').forEach(function (b) {
    b.addEventListener('click', function () { var i = +b.dataset.heroReset; $('hero' + i).value = ''; previewHero(i); });
  });
  $('heroForm').addEventListener('submit', saveHeroSettings);
  bindGoLinks($('viewBody'));
  paintIcons($('viewBody'));
}

/** โหลดรูปจริงแบบที่หน้าเว็บจะโหลด (lh3 → ลิงก์สำรองของ Drive) · ได้ { ok, w, h } */
function probeHero(url, width) {
  return new Promise(function (resolve) {
    var tries = [imageUrlAt(url, width), imageFallbackAt(url, width)].filter(Boolean);
    (function next() {
      var src = tries.shift();
      if (!src) { resolve({ ok: false }); return; }
      var im = new Image();
      im.referrerPolicy = 'no-referrer';
      im.onload = function () { resolve({ ok: true, w: im.naturalWidth, h: im.naturalHeight, src: src }); };
      im.onerror = next;
      im.src = src;
    })();
  });
}

/** ตัวอย่างรูป + ผลตรวจ (โหลดได้ไหม · สัดส่วนใกล้ที่แนะนำไหม) · ได้ true เมื่อใช้ได้ (ว่าง = ใช้ภาพเดิม ถือว่าใช้ได้) */
async function previewHero(i) {
  var s = HERO_SLOTS[i], raw = $('hero' + i).value.trim(), msg = $('heroMsg' + i), prev = $('heroPrev' + i);
  if (!raw) {
    prev.src = '../' + s.def;
    msg.innerHTML = '<p class="m-0 text-[13.5px] text-fg-mute">ใช้ภาพเดิมของเว็บ</p>';
    return true;
  }
  var url = safeUrl(raw);
  if (!/^https?:\/\//i.test(url)) {
    msg.innerHTML = '<p class="m-0 rounded-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">ลิงก์ต้องขึ้นต้นด้วย https://</p>';
    return false;
  }
  msg.innerHTML = '<p class="m-0 text-[13.5px] text-fg-mute">กำลังโหลดรูป…</p>';
  var r = await probeHero(url, s.width);
  if ($('hero' + i).value.trim() !== raw) return false;   // พิมพ์ต่อระหว่างโหลด — ผลนี้เก่าแล้ว
  if (!r.ok) {
    prev.removeAttribute('src');
    msg.innerHTML = '<p class="m-0 rounded-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">โหลดรูปไม่ได้ — ตรวจว่าเป็นลิงก์ของไฟล์รูป (ไม่ใช่โฟลเดอร์) และแชร์แบบ "ทุกคนที่มีลิงก์ดูได้"</p>';
    return false;
  }
  prev.src = r.src;
  var ratio = r.w / r.h, off = Math.abs(ratio - s.ratio) / s.ratio > 0.15;
  msg.innerHTML = off
    ? '<p class="m-0 rounded-sm border border-gold/40 bg-gold/15 px-3.5 py-2.5 text-[14px] text-gold-ink">โหลดได้ ✓ แต่สัดส่วนรูป ' + ratio.toFixed(2) + ' : 1 ต่างจากที่แนะนำ — ขอบบน/ล่างหรือซ้าย/ขวาจะถูกตัด ดูกรอบตัวอย่างข้างบน</p>'
    : '<p class="m-0 rounded-sm border border-done/30 bg-done-bg px-3.5 py-2.5 text-[14px] text-done">โหลดได้ ✓ (' + r.w + ' × ' + r.h + ' px)</p>';
  return true;
}

async function saveHeroSettings(event) {
  event.preventDefault();
  $('heroSave').disabled = true;
  var checks = await Promise.all(HERO_SLOTS.map(function (s, i) { return previewHero(i); }));
  if (checks.indexOf(false) > -1 && !confirm('มีรูปที่ตรวจไม่ผ่าน — หน้าเว็บจะใช้ภาพเดิมแทนรูปนั้นจนกว่าจะแก้\nบันทึกต่อไปหรือไม่?')) {
    $('heroSave').disabled = false;
    return;
  }
  var res = await db.from('site_settings').upsert(HERO_SLOTS.map(function (s, i) {
    return { key: s.key, value: safeUrl($('hero' + i).value.trim()) };
  }), { onConflict: 'key' });
  $('heroSave').disabled = false;
  if (res.error) { setPanelError('บันทึกไม่สำเร็จ: ' + friendlyError(res.error)); return; }
  setSaveState('บันทึกแล้ว — ผู้ชมรีเฟรชหน้าก็เห็นผล');
}

/* =========================================================
   แหล่งข้อมูล — ลิงก์ชีต + ตัวเชื่อม Apps Script (เก็บใน site_settings, key ใน SHEET_KEYS ของ sheets.js)
   ========================================================= */

var source = { url: '', script: '' };

async function loadSource() {
  var res = await db.from('site_settings').select('key,value').in('key', [SHEET_KEYS.url, SHEET_KEYS.script]);
  source = { url: '', script: '' };
  (res.data || []).forEach(function (r) {
    if (r.key === SHEET_KEYS.url) source.url = String(r.value || '').trim();
    if (r.key === SHEET_KEYS.script) source.script = String(r.value || '').trim();
  });
}

function sheetEditUrl(id, gid) {
  return 'https://docs.google.com/spreadsheets/d/' + id + '/edit' + (gid ? '#gid=' + gid : '');
}
function activeSheetId() { return sheetIdFromUrl(source.url) || DEFAULT_SHEET_ID; }

/**
 * เรียกตัวเชื่อม Apps Script (public/admin/apps-script.gs) — แนบ access token ของ Supabase ให้สคริปต์ตรวจสิทธิ์ผู้ดูแล
 * ส่งเป็น text/plain (ค่าตั้งต้นของ fetch เมื่อ body เป็นสตริง) ไม่ต้องผ่าน CORS preflight ซึ่ง Apps Script ไม่รองรับ
 */
async function callScript(action, payload, url) {
  url = url || source.script;
  if (!url) throw new Error('ยังไม่ได้ตั้งตัวเชื่อม Apps Script');
  var s = await db.auth.getSession();
  var token = s.data && s.data.session && s.data.session.access_token;
  var res;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(Object.assign({ action: action, token: token }, payload || {})),
      signal: AbortSignal.timeout(30000)
    });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? 'ตัวเชื่อมไม่ตอบภายใน 30 วินาที' : 'เรียกตัวเชื่อมไม่ได้ — ตรวจ URL และว่าตั้ง "ผู้มีสิทธิ์เข้าถึง: ทุกคน" แล้ว');
  }
  var text = await res.text();
  var json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('ตัวเชื่อมไม่ได้ตอบเป็นข้อมูล — ใช้ URL ที่ลงท้ายด้วย /exec และตั้ง "ผู้มีสิทธิ์เข้าถึง: ทุกคน"');
  }
  if (!json.ok) throw new Error(json.error || 'ตัวเชื่อมทำงานไม่สำเร็จ');
  return json;
}

/* =========================================================
   มุมมอง "ข้อมูลใน Google Sheets" — อ่าน/แก้แถวในชีตจริงผ่านตัวเชื่อม
   ========================================================= */

var sheetView = { tabs: [], gid: '', tab: null, rows: [], header: -1, cols: [], query: '' };

function colLetter(i) {
  var s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

/** แถวหัวตาราง = แถวแรก (ใน 10 แถวบน) ที่ช่องมีค่าเยอะพอ — แท็บที่มีชื่อตารางหรือแถวว่างข้างบนจะข้ามไปเอง */
function detectHeader(rows) {
  var counts = rows.slice(0, 10).map(function (r) { return r.v.filter(function (x) { return String(x).trim(); }).length; });
  var max = Math.max.apply(null, counts.concat([0]));
  var idx = counts.findIndex(function (c) { return c >= Math.max(2, Math.ceil(max * 0.6)); });
  return idx < 0 ? -1 : idx;
}

function renderSheetView() {
  if (!source.script) {
    $('viewBody').innerHTML = '<section class="' + CARD + ' flex flex-col items-start gap-4 py-8">' +
      '<span class="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-ink">' + icon('table', 'size-[22px]') + '</span>' +
      '<div><h2 class="m-0 font-display fs-22 font-normal text-brand-strong">ยังไม่ได้เชื่อม CMS กับ Google Sheets</h2>' +
      '<p class="mt-1.5 mb-0 fs-14.5 text-fg-soft">ติดตั้ง “ตัวเชื่อม Apps Script” ในชีตครั้งเดียว (ประมาณ 5 นาที) แล้วจะแก้ข้อมูลในชีตจากหน้านี้ได้เลย ไม่ต้องเปิด Google Sheets</p></div>' +
      '<div class="flex flex-wrap gap-2.5"><button class="btn" type="button" data-go="settings">' + icon('settings') + 'ไปตั้งค่าตัวเชื่อม</button>' +
      '<a class="btn btn-outline" href="' + esc(sheetEditUrl(activeSheetId())) + '" target="_blank" rel="noopener">' + icon('external') + 'เปิดชีต</a></div>' +
      '</section>';
    paintIcons($('viewBody'));
    bindGoLinks($('viewBody'));
    return;
  }

  $('panelActions').innerHTML =
    '<button class="btn btn-outline" type="button" id="sheetReload">' + icon('refresh') + 'โหลดใหม่</button>' +
    '<button class="btn" type="button" id="sheetAdd" disabled>' + icon('plus') + 'เพิ่มแถว</button>';
  paintIcons($('panelActions'));
  $('sheetReload').addEventListener('click', function () { loadSheetTab(sheetView.gid); });
  $('sheetAdd').addEventListener('click', function () { openSheetEditor(null); });

  $('viewBody').innerHTML =
    '<div class="flex flex-wrap gap-2" id="sheetTabs" role="tablist" aria-label="แท็บในชีต">' +
      '<span class="skeleton block h-9 w-32 rounded-full"></span><span class="skeleton block h-9 w-28 rounded-full"></span><span class="skeleton block h-9 w-36 rounded-full"></span>' +
    '</div>' +
    '<div class="empty:hidden" id="sheetWarn"></div>' +
    '<div class="empty:hidden" id="sheetNote"></div>' +
    '<section class="' + PANEL + '">' +
      '<div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 max-[560px]:flex-col max-[560px]:items-stretch">' +
        '<label class="relative block w-full max-w-[380px] max-[560px]:max-w-none">' +
          '<span class="sr-only">ค้นหาในแท็บนี้</span>' +
          '<i class="icon-mask pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-mute" data-ic="search"></i>' +
          '<input class="input h-10 pl-10" id="sheetSearch" type="search" placeholder="ค้นหาในแท็บนี้" />' +
        '</label>' +
        '<span class="ml-auto fs-13.5 text-fg-mute tabular-nums max-[560px]:ml-0" id="sheetCount"></span>' +
        '<a class="btn btn-ghost btn-sm text-fg-soft" id="sheetOpen" href="#" target="_blank" rel="noopener">' + icon('external') + 'เปิดแท็บนี้ในชีต</a>' +
      '</div>' +
      '<div class="max-h-[70vh] overflow-auto"><table class="w-full border-collapse fs-14.5" id="sheetGrid"></table></div>' +
    '</section>';
  paintIcons($('viewBody'));
  $('sheetSearch').addEventListener('input', function (e) { sheetView.query = e.target.value; renderSheetGrid(); });
  $('sheetGrid').innerHTML = emptyRow('กำลังอ่านรายชื่อแท็บจากชีต…', 'table');
  paintIcons($('sheetGrid'));
  loadSheetTabs();
}

async function loadSheetTabs() {
  try {
    var r = await callScript('tabs');
    if (current.id !== 'sheet') return;
    sheetView.tabs = r.tabs;
    if (r.sheetId !== activeSheetId()) {
      $('sheetWarn').innerHTML = notice('warn', 'ตัวเชื่อมนี้อยู่ในชีตคนละไฟล์กับที่หน้าเว็บใช้',
        'สิ่งที่แก้ในหน้านี้จะไม่ขึ้นบนเว็บ — ติดตั้งตัวเชื่อมในชีตที่ตั้งไว้ หรือเปลี่ยนลิงก์ชีตใน <button class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-brand-ink underline" type="button" data-go="settings">ตั้งค่าแหล่งข้อมูล</button>');
      paintIcons($('sheetWarn'));
      bindGoLinks($('sheetWarn'));
    }
    var saved = null;
    try { saved = localStorage.getItem('cms2-sheet-tab'); } catch (e) {}
    // แท็บที่เปิดค้างไว้ครั้งก่อน > แท็บแรกที่หน้าเว็บใช้และแก้ได้ (ตามลำดับ SHEET_TABS) > แท็บแรกของชีต
    var byGid = function (gid) { return r.tabs.filter(function (t) { return t.gid === String(gid); })[0]; };
    var pick = byGid(saved) ||
      SHEET_TABS.map(function (t) { return byGid(t.source); }).filter(function (t) { return t && !t.readOnly; })[0] || r.tabs[0];
    renderSheetTabs();
    if (pick) loadSheetTab(pick.gid);
  } catch (err) {
    if (current.id !== 'sheet') return;
    $('sheetTabs').innerHTML = '';
    $('sheetGrid').innerHTML = emptyRow(esc(err.message), 'info');
    paintIcons($('sheetGrid'));
  }
}

function renderSheetTabs() {
  // แท็บที่หน้าเว็บใช้ขึ้นก่อน (ตามลำดับใน SHEET_TABS) แท็บอื่นตามหลัง
  var order = SHEET_TABS.map(function (t) { return String(t.source); });
  var tabs = sheetView.tabs.slice().sort(function (a, b) {
    var ia = order.indexOf(a.gid), ib = order.indexOf(b.gid);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  $('sheetTabs').innerHTML = tabs.map(function (t) {
    var used = order.indexOf(t.gid) > -1 || SHEET_TABS.some(function (x) { return x.source === t.name; });
    return '<button class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 fs-14 text-fg-soft hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-brand ' +
      'aria-selected:border-brand aria-selected:bg-brand-100 aria-selected:font-semibold aria-selected:text-brand-ink" type="button" role="tab" data-gid="' + esc(t.gid) + '" aria-selected="' + (t.gid === sheetView.gid) + '">' +
      (used ? '<span class="size-1.5 rounded-full bg-brand" title="หน้าเว็บใช้แท็บนี้"></span>' : '') +
      esc(t.name) + (t.readOnly ? icon('info', 'size-3.5 opacity-70') : '') + '</button>';
  }).join('');
  paintIcons($('sheetTabs'));
  $('sheetTabs').querySelectorAll('[data-gid]').forEach(function (b) {
    b.addEventListener('click', function () { loadSheetTab(b.dataset.gid); });
  });
}

async function loadSheetTab(gid) {
  sheetView.gid = gid;
  sheetView.query = '';
  if ($('sheetSearch')) $('sheetSearch').value = '';
  try { localStorage.setItem('cms2-sheet-tab', gid); } catch (e) {}
  renderSheetTabs();
  $('sheetAdd').disabled = true;
  $('sheetOpen').href = sheetEditUrl(activeSheetId(), gid);
  $('sheetCount').textContent = '';
  $('sheetGrid').innerHTML = '<tbody>' + [1, 2, 3, 4, 5, 6].map(function (i) {
    return '<tr>' + [1, 2, 3, 4, 5].map(function (j) {
      return '<td class="' + TD + '"><span class="skeleton block h-3.5" style="width:' + (40 + ((i * 7 + j * 13) % 50)) + '%"></span></td>';
    }).join('') + '</tr>';
  }).join('') + '</tbody>';
  try {
    var r = await callScript('read', { gid: gid });
    if (current.id !== 'sheet' || sheetView.gid !== gid) return;
    sheetView.tab = r.tab;
    sheetView.rows = r.rows;
    sheetView.header = detectHeader(r.rows);
    // คอลัมน์ว่างทั้งคอลัมน์ไม่ต้องแสดง (ชีตมักมีคอลัมน์เผื่อไว้ข้างขวา)
    var width = r.tab.cols;
    sheetView.cols = [];
    for (var c = 0; c < width; c++) {
      if (r.rows.some(function (row) { return String(row.v[c] || '').trim(); })) sheetView.cols.push(c);
    }
    $('sheetAdd').disabled = r.tab.readOnly;
    $('sheetNote').innerHTML = r.tab.readOnly
      ? notice('warn', 'แท็บนี้ถูกป้องกันไว้ในชีต — อ่านอย่างเดียว', 'ยกเลิก “ป้องกันชีต” ใน Google Sheets ถ้าต้องการแก้จาก CMS') : '';
    paintIcons($('sheetNote'));
    renderSheetGrid();
  } catch (err) {
    if (current.id !== 'sheet') return;
    $('sheetGrid').innerHTML = emptyRow(esc(err.message), 'info');
    paintIcons($('sheetGrid'));
  }
}

function colLabel(c) {
  var h = sheetView.header > -1 ? String(sheetView.rows[sheetView.header].v[c] || '').trim() : '';
  return h || 'คอลัมน์ ' + colLetter(c);
}

function sheetDataRows() {
  return sheetView.rows.filter(function (r, i) {
    return i > sheetView.header && r.v.some(function (x) { return String(x).trim(); });
  });
}

function renderSheetGrid() {
  var grid = $('sheetGrid');
  if (!grid || !sheetView.tab) return;
  var data = sheetDataRows();
  var q = sheetView.query.trim().toLowerCase();
  var shown = q ? data.filter(function (r) { return r.v.join(' ').toLowerCase().indexOf(q) > -1; }) : data;
  $('sheetCount').textContent = q ? 'พบ ' + fmtNum(shown.length) + ' จาก ' + fmtNum(data.length) + ' แถว' : 'ทั้งหมด ' + fmtNum(data.length) + ' แถว';

  if (!shown.length) {
    grid.innerHTML = emptyRow(data.length ? 'ไม่พบแถวที่ตรงกับ “' + esc(sheetView.query.trim()) + '”' : 'แท็บนี้ยังไม่มีข้อมูล', data.length ? 'search' : 'table');
    paintIcons(grid);
    return;
  }
  var ro = sheetView.tab.readOnly;
  // หัวตารางติดบนขณะเลื่อนในกล่อง (กล่องสูงไม่เกิน 70vh) — แท็บผลการแข่งขันมีหลายร้อยแถว
  var TH_STICKY = TH + ' sticky top-0 z-[1]';
  grid.innerHTML = '<thead><tr><th class="' + TH_STICKY + ' w-px text-right" scope="col">แถว</th>' +
    sheetView.cols.map(function (c) { return '<th class="' + TH_STICKY + '" scope="col">' + esc(colLabel(c)) + '</th>'; }).join('') +
    (ro ? '' : '<th class="' + TH_STICKY + '"><span class="sr-only">แก้ไข</span></th>') + '</tr></thead>' +
    '<tbody>' + shown.slice(0, 1000).map(function (r) {
      var idx = sheetView.rows.indexOf(r);
      var locked = ro || r.locked;
      return '<tr class="group/row [&:last-child>td]:border-b-0' + (locked ? '' : ' cursor-pointer hover:bg-surface-soft/70') + '"' + (locked ? '' : ' data-sheet-row="' + idx + '"') + '>' +
        '<td class="' + TD + ' text-right fs-12.5 text-fg-mute tabular-nums">' + r.n + '</td>' +
        sheetView.cols.map(function (c) {
          var v = String(r.v[c] || '');
          return '<td class="' + TD + ' max-w-[280px]' + (r.f[c] ? ' text-fg-soft' : '') + '"><span class="block truncate" title="' + esc(v) + '">' +
            (v ? esc(v) : '<span class="text-fg-mute">—</span>') + '</span></td>';
        }).join('') +
        (ro ? '' : '<td class="' + TD + ' w-px text-right">' + (r.locked
          ? '<span class="fs-12.5 text-fg-mute whitespace-nowrap">ถูกป้องกัน</span>'
          : '<button class="btn btn-ghost btn-sm text-fg-mute group-hover/row:text-brand-ink" type="button">' + icon('edit') + 'แก้ไข</button>') + '</td>') +
      '</tr>';
    }).join('') + '</tbody>';
  paintIcons(grid);
  grid.querySelectorAll('[data-sheet-row]').forEach(function (tr) {
    tr.addEventListener('click', function () { openSheetEditor(sheetView.rows[Number(tr.dataset.sheetRow)]); });
  });
}

function openSheetEditor(row) {
  editing = row || null;
  var isNew = !row;
  // คอลัมน์ที่เกือบทุกแถวเป็นสูตร = แถวใหม่ก็ไม่ต้องกรอก (ชีตคำนวณให้ ถ้าลากสูตรลงมาไว้)
  var data = sheetDataRows();
  $('editorKicker').textContent = 'Google Sheets · ' + sheetView.tab.name;
  $('editorTitle').textContent = isNew ? 'เพิ่มแถวใหม่' : 'แก้ไขแถวที่ ' + row.n;
  $('deleteBtn').hidden = isNew;
  setEditorError('');
  $('editorFields').innerHTML = sheetView.cols.map(function (c) {
    var formula = isNew
      ? data.length > 0 && data.filter(function (r) { return r.f[c]; }).length > data.length / 2
      : Boolean(row.f[c]);
    var v = isNew ? '' : String(row.v[c] || '');
    var id = 'sf_' + c;
    var long = v.length > 70 || /\n/.test(v);
    var hint = formula ? '<p class="mt-1.5 mb-0 fs-12.5 text-fg-mute">คำนวณจากสูตรในชีต — แก้ที่นี่ไม่ได้</p>' : '';
    var input = long
      ? '<textarea class="textarea min-h-[92px]" id="' + id + '" rows="3"' + (formula ? ' disabled' : '') + '>' + esc(v) + '</textarea>'
      : '<input class="input h-10" id="' + id + '" type="text" value="' + esc(v) + '"' + (formula ? ' disabled' : '') + ' />';
    return '<div class="' + FIELD_SPAN[long ? 'full' : 'half'] + '">' +
      '<label class="label mb-2 fs-14 text-fg-soft" for="' + id + '">' + esc(colLabel(c)) +
        ' <span class="fs-12 text-fg-mute">' + colLetter(c) + '</span></label>' + input + hint + '</div>';
  }).join('');
  $('editor').showModal();
  var first = $('editorFields').querySelector('input:not([disabled]), textarea:not([disabled])');
  if (first) first.focus();
}

/** ค่าทั้งแถวตามความกว้างของแท็บ — คอลัมน์ที่ซ่อน (ว่างทั้งคอลัมน์) ส่งค่าเดิมกลับไป */
function sheetRowValues() {
  var width = sheetView.tab.cols;
  var out = [];
  for (var c = 0; c < width; c++) out.push(editing ? String(editing.v[c] || '') : '');
  sheetView.cols.forEach(function (c) {
    var n = $('sf_' + c);
    if (n && !n.disabled) out[c] = n.value.trim();
  });
  return out;
}

async function saveSheetRow() {
  var values = sheetRowValues();
  $('saveBtn').disabled = true;
  $('saveBtn').textContent = 'กำลังบันทึกลงชีต…';
  setEditorError('');
  try {
    if (editing) {
      var r = await callScript('update', { gid: sheetView.gid, row: editing.n, expect: editing.v, values: values });
      setSaveState(r.changed ? 'บันทึกลงชีตแล้ว' : 'ไม่มีอะไรเปลี่ยน');
    } else {
      if (!values.some(Boolean)) throw new Error('กรอกอย่างน้อยหนึ่งช่อง');
      await callScript('append', { gid: sheetView.gid, values: values });
      setSaveState('เพิ่มแถวในชีตแล้ว');
    }
    $('editor').close();
    loadSheetTab(sheetView.gid);
  } catch (err) {
    setEditorError(err.message);
  } finally {
    $('saveBtn').disabled = false;
    $('saveBtn').textContent = 'บันทึก';
  }
}

async function deleteSheetRow() {
  if (!confirm('ลบแถวที่ ' + editing.n + ' ออกจากแท็บ "' + sheetView.tab.name + '" ในชีตจริง?\nหน้าเว็บจะไม่แสดงรายการนี้อีก · กู้คืนได้จากประวัติเวอร์ชันของ Google Sheets')) return;
  try {
    await callScript('delete', { gid: sheetView.gid, row: editing.n, expect: editing.v });
    $('editor').close();
    setSaveState('ลบแถวในชีตแล้ว');
    loadSheetTab(sheetView.gid);
  } catch (err) {
    setEditorError(err.message);
  }
}

/* =========================================================
   มุมมอง "ตั้งค่าแหล่งข้อมูล"
   ผังแบบหน้าตั้งค่าทั่วไป: ซ้าย = หัวข้อ + คำอธิบาย · ขวา = ช่องกรอกในการ์ด (จอแคบเรียงลง)
   ========================================================= */

function settingSection(title, text, body) {
  return '<section class="grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-x-10 gap-y-4 border-b border-line pb-8 last:border-b-0 last:pb-0 max-[960px]:grid-cols-1">' +
    '<div><h2 class="m-0 font-display fs-20 font-normal text-brand-strong">' + title + '</h2>' +
    '<p class="mt-1.5 mb-0 fs-14 text-fg-soft">' + text + '</p></div>' + body + '</section>';
}

function renderSourceView() {
  var savedId = sheetIdFromUrl(source.url);
  var sheetUrl = source.url || sheetEditUrl(DEFAULT_SHEET_ID);

  $('viewBody').innerHTML = '<div class="flex flex-col gap-8">' +
    settingSection('Google Sheets ที่ใช้เป็นแหล่งข้อมูล',
      'หน้าเว็บทุกหน้า ตัวกลางแคช และการซิงก์สำรองทุก 15 นาที อ่านข้อมูลจากชีตนี้ · ชีตใหม่ต้อง “ทำสำเนา” จากชีตเดิม (ไฟล์ → ทำสำเนา) แท็บจะได้รหัสตรงกับที่เว็บใช้ และต้องแชร์แบบ “ทุกคนที่มีลิงก์ดูได้”',
      '<form class="' + CARD + ' flex flex-col gap-4" id="srcSheetForm">' +
        (savedId ? notice('ok', '', 'หน้าเว็บอ่านจากชีตที่ตั้งไว้ในหน้านี้')
          : notice('warn', '', 'ยังไม่เคยตั้ง — ตอนนี้ใช้ชีตตั้งต้นในโค้ด (แสดงอยู่ในช่องด้านล่าง)')) +
        '<div><label class="label mb-2 fs-14 text-fg-soft" for="srcSheet">ลิงก์ Google Sheets</label>' +
          '<input class="input h-10" id="srcSheet" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value="' + esc(sheetUrl) + '" />' +
          '<p class="mt-1.5 mb-0 fs-12.5 text-fg-mute">คัดลอกจากแถบที่อยู่ของเบราว์เซอร์ตอนเปิดชีต · เว้นว่างแล้วบันทึก = กลับไปใช้ชีตตั้งต้น</p></div>' +
        '<div class="flex flex-wrap items-center gap-2.5">' +
          '<button class="btn btn-outline" type="button" id="srcCheck">' + icon('search') + 'ตรวจสอบลิงก์</button>' +
          '<button class="btn" type="submit" id="srcSave">บันทึก</button>' +
          '<a class="btn btn-ghost ml-auto text-fg-soft" id="srcOpen" href="' + esc(sheetUrl) + '" target="_blank" rel="noopener">' + icon('external') + 'เปิดชีต</a>' +
        '</div>' +
        '<div class="empty:hidden" id="srcResult"></div>' +
      '</form>') +
    settingSection('ตัวเชื่อมสำหรับแก้ไขชีต',
      'Apps Script ที่ติดตั้งในชีต ทำให้หน้า “ข้อมูลในชีต” บันทึกลงชีตได้ · สคริปต์ตรวจทุกครั้งว่าผู้แก้เข้าสู่ระบบ CMS เป็นผู้ดูแล',
      '<form class="' + CARD + ' flex flex-col gap-4" id="srcScriptForm">' +
        (source.script ? '' : notice('warn', '', 'ยังไม่ได้ตั้ง — ทำตามขั้นตอนด้านล่างแล้ววาง URL ที่ได้')) +
        '<div><label class="label mb-2 fs-14 text-fg-soft" for="srcScript">URL ของเว็บแอป Apps Script</label>' +
          '<input class="input h-10" id="srcScript" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(source.script) + '" /></div>' +
        '<div class="flex flex-wrap items-center gap-2.5">' +
          '<button class="btn btn-outline" type="button" id="scriptTest">' + icon('sync') + 'ทดสอบการเชื่อมต่อ</button>' +
          '<button class="btn" type="submit" id="scriptSave">บันทึก</button>' +
        '</div>' +
        '<div class="empty:hidden" id="scriptResult"></div>' +
      '</form>') +
    settingSection('วิธีติดตั้งตัวเชื่อม',
      'ทำครั้งเดียวต่อชีต โดยบัญชี Google ที่เป็นเจ้าของหรือแก้ไขชีตได้',
      '<div class="' + CARD + ' flex flex-col gap-4">' +
        '<ol class="m-0 flex list-none flex-col gap-3 p-0 fs-14.5 text-fg">' +
          [
            'เปิดชีต → เมนู <b>ส่วนขยาย → Apps Script</b>',
            'ลบโค้ดเดิมในไฟล์ <code class="rounded-[6px] bg-surface-soft px-1.5 font-mono fs-13">Code.gs</code> ทั้งหมด วางโค้ดจากปุ่มด้านล่าง แล้วกดบันทึก',
            'กด <b>ทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่</b> เลือกประเภท <b>เว็บแอป</b>',
            'ตั้ง <b>เรียกใช้ในฐานะ: ฉัน</b> และ <b>ผู้มีสิทธิ์เข้าถึง: ทุกคน</b> → ทำให้ใช้งานได้ → อนุญาตสิทธิ์',
            'คัดลอก <b>URL ของเว็บแอป</b> (ลงท้าย /exec) มาวางในช่องด้านบน → ทดสอบการเชื่อมต่อ → บันทึก'
          ].map(function (t, i) {
            return '<li class="flex gap-3"><span class="flex size-6 flex-none items-center justify-center rounded-full bg-brand-100 fs-13 font-semibold text-brand-ink">' + (i + 1) + '</span><span class="pt-px">' + t + '</span></li>';
          }).join('') +
        '</ol>' +
        '<p class="m-0 fs-13 text-fg-mute">“ทุกคน” หมายถึงเรียก URL ได้ แต่สคริปต์ยอมอ่าน/แก้ให้เฉพาะผู้ดูแลที่เข้าสู่ระบบ CMS อยู่เท่านั้น · แก้โค้ดทีหลังต้องทำให้ใช้งานได้เป็นเวอร์ชันใหม่</p>' +
        '<div class="flex flex-wrap gap-2.5">' +
          '<button class="btn btn-outline" type="button" id="scriptCopy">' + icon('download') + 'คัดลอกโค้ดสคริปต์</button>' +
          '<a class="btn btn-ghost text-fg-soft" href="apps-script.gs" target="_blank" rel="noopener">' + icon('external') + 'ดูโค้ด</a>' +
        '</div>' +
      '</div>') +
  '</div>';
  paintIcons($('viewBody'));

  $('srcSheet').addEventListener('input', function () {
    var id = sheetIdFromUrl($('srcSheet').value);
    $('srcOpen').href = id ? sheetEditUrl(id) : '#';
  });
  $('srcCheck').addEventListener('click', function () { checkSheet(); });
  $('srcSheetForm').addEventListener('submit', saveSheetSource);
  $('scriptTest').addEventListener('click', function () { testScript(); });
  $('srcScriptForm').addEventListener('submit', saveScriptSource);
  $('scriptCopy').addEventListener('click', copyScript);
}

/** อ่านแท็บที่หน้าเว็บใช้จากชีตตามลิงก์ (ยิง Google ตรง) — กันบันทึกลิงก์ที่ยังไม่แชร์หรือไม่ใช่สำเนาของชีตเดิม */
async function checkSheet() {
  var out = $('srcResult');
  var id = sheetIdFromUrl($('srcSheet').value);
  if (!id) { out.innerHTML = notice('error', '', 'ไม่ใช่ลิงก์ Google Sheets — ลิงก์ต้องมี /spreadsheets/d/ อยู่ข้างใน'); paintIcons(out); return { ok: false }; }
  out.innerHTML = '<p class="m-0 fs-14 text-fg-mute">กำลังอ่านชีต…</p>';
  $('srcCheck').disabled = true;
  var results = await Promise.all(SHEET_TABS.map(async function (t) {
    var q = (/^\d+$/.test(String(t.source)) ? 'gid=' : 'sheet=') + encodeURIComponent(t.source) + '&headers=1';
    try {
      var res = await fetch(gvizUrl(id, q), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      var raw = await res.text();
      var m = raw.match(/setResponse\(([\s\S]*)\);?\s*$/);
      if (!m) return { t: t, ok: false, why: 'อ่านไม่ได้ (ยังไม่แชร์แบบทุกคนที่มีลิงก์?)' };
      var j = JSON.parse(m[1]);
      if (j.status !== 'ok') return { t: t, ok: false, why: 'ไม่พบแท็บนี้' };
      var body = JSON.stringify(j.table);
      if (t.need && body.indexOf(t.need) < 0) return { t: t, ok: false, why: 'ไม่พบหัวคอลัมน์ “' + t.need + '” — gid อาจไม่ตรง', sig: body.slice(0, 2000) };
      return { t: t, ok: true, why: j.table.rows.length + ' แถว', sig: body.slice(0, 2000) };
    } catch (err) {
      return { t: t, ok: false, why: 'อ่านไม่สำเร็จ: ' + (err.message || err) };
    }
  }));
  // แท็บที่ไม่มีอยู่จริง gviz ส่งแท็บแรกของไฟล์กลับมาเงียบ ๆ — สองแท็บได้ข้อมูลเดียวกันเป๊ะ = ผิดสังเกต
  // ตรวจหลังได้ครบทุกแท็บ (ไม่ใช่ตามลำดับที่ตอบกลับมา) ผลจะได้เหมือนกันทุกครั้ง
  // กลุ่มที่ปนกันระหว่างแท็บอ้าง gid กับแท็บอ้างชื่อ = แท็บอ้างชื่อคือตัวที่ไม่มีอยู่จริง · ซ้ำกันเองล้วน ๆ = ผิดทั้งกลุ่ม
  var byName = function (r) { return !/^\d+$/.test(String(r.t.source)); };
  var flags = results.map(function (r) {
    if (!r.ok) return null;
    var twins = results.filter(function (x) { return x !== r && x.sig && x.sig === r.sig; });
    if (!twins.length) return null;
    if (!byName(r) && twins.every(byName)) return null;
    return twins[0].t.label;
  });
  results.forEach(function (r, i) {
    if (flags[i]) { r.ok = false; r.why = 'ข้อมูลซ้ำกับแท็บ “' + flags[i] + '” — ไม่มีแท็บนี้ หรือ gid ไม่ตรง'; }
  });
  $('srcCheck').disabled = false;
  var bad = results.filter(function (r) { return !r.ok && !r.t.optional; });
  out.innerHTML =
    (bad.length ? notice('error', 'ใช้ชีตนี้ไม่ได้ — ' + bad.length + ' แท็บมีปัญหา', 'ชีตใหม่ต้องทำสำเนาจากชีตเดิม และแชร์แบบ “ทุกคนที่มีลิงก์ดูได้”')
      : notice('ok', '', 'อ่านได้ครบ ✓ ใช้ชีตนี้ได้')) +
    '<ul class="mt-3 mb-0 flex list-none flex-col divide-y divide-line rounded-sm border border-line p-0">' +
      results.map(function (r) {
        return '<li class="flex items-center gap-3 px-3.5 py-2 fs-14">' +
          '<span class="' + (r.ok ? 'text-done-ink' : r.t.optional ? 'text-gold-ink' : 'text-destructive') + '">' + (r.ok ? '✓' : r.t.optional ? '–' : '✗') + '</span>' +
          '<span class="min-w-0 flex-1">' + esc(r.t.label) + (r.t.optional ? ' <span class="fs-12.5 text-fg-mute">(ไม่บังคับ)</span>' : '') + '</span>' +
          '<span class="fs-13 text-fg-mute">' + esc(r.why) + '</span></li>';
      }).join('') +
    '</ul>';
  paintIcons(out);
  return { ok: !bad.length, id: id };
}

async function saveSheetSource(event) {
  event.preventDefault();
  var link = $('srcSheet').value.trim();
  $('srcSave').disabled = true;
  try {
    var res;
    if (!link) {
      if (!confirm('ล้างลิงก์ แล้วกลับไปใช้ชีตตั้งต้นในโค้ด?')) return;
      res = await db.from('site_settings').delete().eq('key', SHEET_KEYS.url);
    } else {
      var check = await checkSheet();
      if (!check.id) return;
      if (!check.ok && !confirm('ตรวจชีตไม่ผ่าน — หน้าเว็บอาจไม่มีข้อมูลจนกว่าจะแก้\nบันทึกต่อไปหรือไม่?')) return;
      if (check.id === activeSheetId() && source.url) { setSaveState('ลิงก์เดิม ไม่มีอะไรเปลี่ยน'); return; }
      res = await db.from('site_settings').upsert({ key: SHEET_KEYS.url, value: sheetEditUrl(check.id) }, { onConflict: 'key' });
    }
    if (res.error) throw res.error;
    await loadSource();
    setSaveState('บันทึกแล้ว — หน้าเว็บเปลี่ยนชีตภายในราว 1–2 นาที');
    renderSourceView();
  } catch (err) {
    setPanelError(friendlyError(err));
  } finally {
    if ($('srcSave')) $('srcSave').disabled = false;
  }
}

async function testScript() {
  var out = $('scriptResult');
  var url = $('srcScript').value.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\b/.test(url)) {
    out.innerHTML = notice('error', '', 'URL ต้องเป็นของเว็บแอป Apps Script รูปแบบ https://script.google.com/macros/s/…/exec');
    paintIcons(out);
    return false;
  }
  out.innerHTML = '<p class="m-0 fs-14 text-fg-mute">กำลังเชื่อมต่อ…</p>';
  $('scriptTest').disabled = true;
  try {
    var r = await callScript('ping', {}, url);
    var other = r.sheetId !== activeSheetId();
    out.innerHTML = other
      ? notice('warn', 'เชื่อมต่อได้ แต่สคริปต์นี้อยู่ในชีตอื่น', 'สคริปต์อยู่ในชีต “' + esc(r.sheetName) + '” ไม่ใช่ชีตที่หน้าเว็บใช้ — สิ่งที่แก้จะไม่ขึ้นบนเว็บ ติดตั้งสคริปต์ในชีตที่ตั้งไว้ด้านบนแทน')
      : notice('ok', 'เชื่อมต่อได้ ✓', 'ชีต “' + esc(r.sheetName) + '” · ตรวจสิทธิ์ผ่านในชื่อ ' + esc(r.user));
    paintIcons(out);
    return !other;
  } catch (err) {
    out.innerHTML = notice('error', 'เชื่อมต่อไม่ได้', esc(err.message));
    paintIcons(out);
    return false;
  } finally {
    $('scriptTest').disabled = false;
  }
}

async function saveScriptSource(event) {
  event.preventDefault();
  var url = $('srcScript').value.trim();
  $('scriptSave').disabled = true;
  try {
    var res;
    if (!url) {
      res = await db.from('site_settings').delete().eq('key', SHEET_KEYS.script);
    } else {
      if (!(await testScript()) && !confirm('ทดสอบไม่ผ่าน — บันทึกต่อไปหรือไม่?')) return;
      res = await db.from('site_settings').upsert({ key: SHEET_KEYS.script, value: url }, { onConflict: 'key' });
    }
    if (res.error) throw res.error;
    await loadSource();
    setSaveState(url ? 'บันทึกตัวเชื่อมแล้ว' : 'ล้างตัวเชื่อมแล้ว');
  } catch (err) {
    setPanelError(friendlyError(err));
  } finally {
    if ($('scriptSave')) $('scriptSave').disabled = false;
  }
}

async function copyScript() {
  var btn = $('scriptCopy');
  try {
    var code = await (await fetch('apps-script.gs', { cache: 'no-store' })).text();
    await navigator.clipboard.writeText(code);
    setSaveState('คัดลอกโค้ดแล้ว — ไปวางใน Apps Script ได้เลย');
  } catch (err) {
    btn.insertAdjacentHTML('afterend', '<span class="fs-13.5 text-destructive">คัดลอกไม่ได้ — กด “ดูโค้ด” แล้วคัดลอกเอง</span>');
  }
}

/* =========================================================
   สลับหมวด
   ========================================================= */

function selectView(id) {
  var views = VIEWS.filter(function (v) { return v.id; });
  current = views.filter(function (v) { return v.id === id; })[0] || views[0];
  clearInterval(statsTimer);
  query = '';
  rows = [];
  setPanelError('');

  $('panelTitle').textContent = current.title;
  $('crumb').textContent = current.title;
  $('panelHint').textContent = current.hint;
  $('panelActions').innerHTML = '';

  document.querySelectorAll('[data-view]').forEach(function (b) {
    if (b.dataset.view === current.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  try { localStorage.setItem('cms2-tab', current.id); } catch (e) {}
  $('app').dataset.side = 'closed';
  $('scrim').hidden = true;

  if (current.kind === 'table') {
    $('panelActions').innerHTML = '<button class="btn" type="button" id="addBtn">' + icon('plus') + 'เพิ่มรายการ</button>';
    paintIcons($('panelActions'));
    $('addBtn').addEventListener('click', function () { openEditor(null); });
    loading = true;
    renderTableView();
    refreshTable();
  } else if (current.kind === 'stats') {
    renderStatsActions();
    renderStatsShell();
    refreshStats();
    statsTimer = setInterval(function () { if (!document.hidden) refreshStats(); }, 60000);
  } else if (current.kind === 'backup') {
    pendingRestore = null;
    renderBackupView();
  } else if (current.kind === 'gallery') {
    renderGalleryView();
  } else if (current.kind === 'heroes') {
    renderHeroView();
  } else if (current.kind === 'sheet') {
    renderSheetView();
  } else if (current.kind === 'source') {
    renderSourceView();
  }
}

/** ปุ่ม/ลิงก์ที่มี data-go="<หมวด>" = สลับไปหมวดนั้น */
function bindGoLinks(root) {
  root.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { selectView(b.dataset.go); });
  });
}

function renderNav() {
  $('tabNav').innerHTML = VIEWS.map(function (v) {
    if (v.group) return '<p class="' + NAV_GROUP + '">' + esc(v.group) + '</p>';
    return '<button class="' + NAV_ITEM + '" type="button" data-view="' + v.id + '">' +
      '<i class="icon-mask size-[18px] opacity-75 group-aria-[current=page]/nav:opacity-100" data-ic="' + v.icon + '"></i>' +
      '<span class="min-w-0 leading-snug">' + esc(v.title) + '</span></button>';
  }).join('');
  $('tabNav').querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { selectView(b.dataset.view); });
  });
  paintIcons($('tabNav'));
}

/* =========================================================
   ข้อความสถานะ
   ========================================================= */
function setEditorError(text) { var n = $('editorError'); n.textContent = text; n.hidden = !text; }
function setPanelError(text) { var n = $('panelError'); n.textContent = text; n.hidden = !text; }
var saveStateTimer = null;
function setSaveState(text) {
  $('saveState').textContent = text;
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(function () { $('saveState').textContent = ''; }, 4000);
}

/* =========================================================
   เข้าสู่ระบบ
   ========================================================= */
function show(screen) {
  ['setupScreen', 'loginScreen', 'app'].forEach(function (id) { $(id).hidden = id !== screen; });
}

async function loadSports() {
  var res = await db.from('sports').select('id,name,entered,sort_order').order('sort_order', { ascending: true });
  sports = res.data || [];
}

/* พลุกระดาษตอนเข้าสู่ระบบสำเร็จ (ตามต้นแบบการ์ดล็อกอินที่ผู้ดูแลส่งมา)
   ใช้ Web Animations API — ไม่โดนกฎ animation:none ทั้งเว็บใน input.css ที่ปิดเฉพาะอนิเมชันของ CSS
   ผู้ใช้ที่ตั้งเครื่องให้ลดการเคลื่อนไหว = ไม่มีพลุ แค่หน่วงให้อ่านคำว่า "ยินดีต้อนรับ" ทัน
   สีจากชุดสีของเว็บ: ทอง เขียว ฟ้า ชมพู ทองแดง */
var CONFETTI = ['var(--color-gold)', 'var(--color-done)', 'var(--color-live)', 'var(--color-brand)', 'var(--color-bronze)'];

function celebrate(from) {
  return new Promise(function (done) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTimeout(done, 700); return; }
    var r = from.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 36; i++) {
      (function (i) {
        var p = document.createElement('span');
        p.className = 'pointer-events-none fixed z-[200] size-3 ' + (i % 3 ? 'rounded-full' : 'rounded-[2px]');
        p.style.left = (cx - 6 + (Math.random() - 0.5) * r.width * 0.6) + 'px';
        p.style.top = (cy - 6) + 'px';
        p.style.backgroundColor = CONFETTI[i % CONFETTI.length];
        document.body.appendChild(p);
        var rot = Math.random() * 360;
        var anim = p.animate([
          { transform: 'translate(0, 0) rotate(' + rot + 'deg) scale(1)', opacity: 1 },
          { transform: 'translate(' + ((Math.random() - 0.5) * 320) + 'px, ' + (-60 - Math.random() * 260) + 'px) rotate(' + (rot + Math.random() * 360) + 'deg) scale(0)', opacity: 0 }
        ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2, .8, .3, 1)' });
        anim.onfinish = function () { p.remove(); };
      })(i);
    }
    setTimeout(done, 1100);
  });
}

async function onSignedIn(session, fromLogin) {
  // ตรวจสิทธิ์กับฐานข้อมูลเสมอ ไม่เชื่อแค่ว่า "ล็อกอินผ่าน" — คนที่ไม่ใช่ผู้ดูแลได้ลิสต์ว่างกลับมา
  var res = await db.from('app_admins').select('user_id,display_name').eq('user_id', session.user.id);
  if (res.error || !res.data || !res.data.length) {
    await db.auth.signOut();
    show('loginScreen');
    showAuthForm('login');
    showLoginError('บัญชี ' + session.user.email + ' ยังไม่ได้รับสิทธิ์ผู้ดูแล — แจ้งผู้ดูแลระบบให้เพิ่มบัญชีนี้ในตาราง app_admins');
    return;
  }

  var name = res.data[0].display_name || session.user.email;

  // เพิ่งกดเข้าสู่ระบบ (ไม่ใช่เปิดหน้ามาแล้วจำ session ไว้) = ฉลองก่อนเข้าหน้าทำงาน
  if (fromLogin) {
    $('loginTitle').textContent = 'ยินดีต้อนรับ!';
    $('loginSub').textContent = 'สวัสดี ' + name;
    $('loginNote').hidden = true;
    var btn = $('loginBtn');
    btn.textContent = 'เข้าสู่ระบบแล้ว!';
    // ปุ่มยังปิดอยู่ (กันกดซ้ำ) แต่ไม่ให้จางเหมือนใช้ไม่ได้ — เปลี่ยนเป็นกรอบ/ตัวหนังสือสีเขียวบอกว่าสำเร็จ
    btn.style.opacity = '1';
    btn.style.setProperty('--fx-line', 'var(--color-done)');
    btn.style.setProperty('--fx-fg', 'var(--color-done-ink)');
    await celebrate(btn);
  }

  $('userEmail').textContent = name;
  $('userSub').textContent = res.data[0].display_name ? session.user.email : 'ผู้ดูแล';
  // วงกลมรูปประจำตัว = ตัวแรกของชื่อที่แสดง
  $('userAvatar').textContent = Array.from(name.trim())[0] || '?';
  show('app');
  await Promise.all([loadSports(), loadSource()]);
  renderNav();

  var saved = null;
  try { saved = localStorage.getItem('cms2-tab'); } catch (e) {}
  selectView(saved || 'stats');
}

function showLoginError(text) { var n = $('loginError'); n.textContent = text; n.hidden = !text; }

async function onLogin(event) {
  event.preventDefault();
  showLoginError('');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'กำลังเข้าสู่ระบบ…';
  try {
    var res = await db.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (res.error) throw res.error;
    $('password').value = '';
    await onSignedIn(res.data.session, true);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    showLoginError(
      /invalid login credentials/i.test(msg) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' :
      /invalid api key|no api key/i.test(msg) ? 'คีย์ใน admin/config.js ไม่ถูกต้อง — ใช้ publishable key จาก Dashboard → Project Settings → API Keys' :
      /email not confirmed/i.test(msg) ? 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล — ติ๊ก "Auto Confirm User" ตอนสร้างผู้ใช้ หรือยืนยันใน Dashboard' :
      /failed to fetch|network/i.test(msg) ? 'เชื่อมต่อฐานข้อมูลไม่ได้ — ตรวจอินเทอร์เน็ต หรือดูว่าโปรเจกต์ Supabase ถูกพักไว้หรือไม่' :
      msg);
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'เข้าสู่ระบบ';
  }
}

/* =========================================================
   เริ่มทำงาน
   ========================================================= */
function initChrome() {
  var root = document.documentElement;
  var saved = null; try { saved = localStorage.getItem('dash-theme'); } catch (e) {}
  if (saved) root.setAttribute('data-theme', saved);

  $('themeToggle').addEventListener('click', function () {
    var isDark = root.getAttribute('data-theme') === 'dark' ||
      (!root.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('dash-theme', next); } catch (e) {}
  });

  var app = $('app'), scrim = $('scrim');
  function setSide(open) { app.dataset.side = open ? 'open' : 'closed'; scrim.hidden = !open; }
  $('menuBtn').addEventListener('click', function () { setSide(app.dataset.side !== 'open'); });
  scrim.addEventListener('click', function () { setSide(false); });
  paintIcons();
}

/* =========================================================
   ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่
   Supabase ส่งอีเมลที่มีลิงก์กลับมาหน้านี้ พร้อม #...type=recovery ต่อท้าย URL
   supabase-js อ่านลิงก์นั้นแล้วล็อกอินให้ชั่วคราว — ต้องจับให้ได้ก่อน ไม่งั้นหน้าจะพาเข้า CMS
   ทันทีโดยที่ผู้ใช้ยังไม่ได้ตั้งรหัสผ่านใหม่ (แล้วครั้งหน้าก็ยังจำรหัสไม่ได้อยู่ดี)
   ========================================================= */

var recovering = false;

function showAuthForm(name) {
  ['loginForm', 'forgotForm', 'resetForm'].forEach(function (id) { $(id).hidden = id !== name + 'Form'; });
  var first = $(name + 'Form').querySelector('input');
  if (first) setTimeout(function () { first.focus(); }, 0);
}

function setForgotMsg(text, tone) {
  var n = $('forgotMsg');
  n.textContent = text;
  n.hidden = !text;
  n.className = 'm-0 rounded-lg border px-3.5 py-2.5 fs-14 ' + (tone === 'error'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : 'border-done/30 bg-done-bg text-done');
}

async function onForgot(event) {
  event.preventDefault();
  setForgotMsg('');
  $('forgotBtn').disabled = true;
  try {
    var res = await db.auth.resetPasswordForEmail($('forgotEmail').value.trim(), {
      // ลิงก์ในอีเมลพากลับมาหน้านี้ — URL นี้ต้องอยู่ใน Redirect URLs ของ Supabase ด้วย (ดู README)
      redirectTo: location.origin + location.pathname
    });
    if (res.error) throw res.error;
    // ตอบเหมือนกันทุกกรณี ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่ — กันคนนอกใช้หน้านี้ไล่เดาอีเมลทีมงาน
    setForgotMsg('ถ้าอีเมลนี้มีบัญชีอยู่ จะได้รับลิงก์ตั้งรหัสผ่านใหม่ภายในไม่กี่นาที (ดูในกล่องจดหมายขยะด้วย)');
  } catch (err) {
    var msg = (err && err.message) || String(err);
    setForgotMsg(/rate limit|too many|seconds/i.test(msg)
      ? 'ขอลิงก์ถี่เกินไป — รอสักครู่แล้วลองใหม่ (ระบบอีเมลของ Supabase ส่งได้จำกัดต่อชั่วโมง)'
      : 'ส่งไม่สำเร็จ: ' + msg, 'error');
  } finally {
    $('forgotBtn').disabled = false;
  }
}

async function onReset(event) {
  event.preventDefault();
  var pw = $('newPassword').value, pw2 = $('newPassword2').value;
  var err = $('resetError');
  err.hidden = true;
  if (pw.length < 8) { err.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'; err.hidden = false; return; }
  if (pw !== pw2) { err.textContent = 'รหัสผ่านสองช่องไม่ตรงกัน'; err.hidden = false; return; }

  $('resetBtn').disabled = true;
  try {
    var res = await db.auth.updateUser({ password: pw });
    if (res.error) throw res.error;
    recovering = false;
    history.replaceState(null, '', location.pathname);   // ล้าง #token ออกจากแถบที่อยู่
    var s = await db.auth.getSession();
    setSaveState('ตั้งรหัสผ่านใหม่แล้ว');
    await onSignedIn(s.data.session);
  } catch (e) {
    var msg = (e && e.message) || String(e);
    err.textContent = /different from the old/i.test(msg) ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม'
      : /session|expired|jwt/i.test(msg) ? 'ลิงก์หมดอายุแล้ว — กด "ลืมรหัสผ่าน?" เพื่อขอลิงก์ใหม่'
      : 'บันทึกไม่สำเร็จ: ' + msg;
    err.hidden = false;
  } finally {
    $('resetBtn').disabled = false;
  }
}

/** ปุ่มรูปตาท้ายช่องรหัสผ่าน — data-pw-toggle บอกว่าคุมช่องไหน */
function initPasswordToggles() {
  document.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.dataset.pwToggle);
      var shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      btn.setAttribute('aria-pressed', String(!shown));
      btn.setAttribute('aria-label', shown ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน');
      btn.querySelector('[data-eye="show"]').classList.toggle('hidden', !shown);
      btn.querySelector('[data-eye="hide"]').classList.toggle('hidden', shown);
      input.focus();
    });
  });
}

async function init() {
  initChrome();
  if (!hasSupabase()) { show('setupScreen'); return; }

  // อ่าน hash ก่อนสร้าง client — supabase-js จะลบมันออกจาก URL ทันทีที่อ่านเสร็จ
  var hash = new URLSearchParams(location.hash.slice(1));
  recovering = hash.get('type') === 'recovery';
  var linkError = hash.get('error_code') || hash.get('error');

  db = createClient(SUPABASE_URL, SUPABASE_KEY);
  db.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') recovering = true; });

  $('loginForm').addEventListener('submit', onLogin);
  $('forgotForm').addEventListener('submit', onForgot);
  $('resetForm').addEventListener('submit', onReset);
  $('forgotLink').addEventListener('click', function () {
    $('forgotEmail').value = $('email').value;
    setForgotMsg('');
    showAuthForm('forgot');
  });
  $('backToLogin').addEventListener('click', function () { showAuthForm('login'); });
  initPasswordToggles();
  $('logoutBtn').addEventListener('click', async function () { await db.auth.signOut(); location.reload(); });
  $('editorForm').addEventListener('submit', save);
  $('cancelBtn').addEventListener('click', function () { $('editor').close(); });
  $('editorClose').addEventListener('click', function () { $('editor').close(); });
  $('deleteBtn').addEventListener('click', remove);

  var res = await db.auth.getSession();
  var session = res.data && res.data.session;

  if (recovering && session) {
    show('loginScreen');
    $('resetFor').textContent = 'สำหรับบัญชี ' + session.user.email;
    showAuthForm('reset');
  } else if (session) {
    await onSignedIn(session);
  } else {
    show('loginScreen');
    showAuthForm('login');
    if (linkError) {
      history.replaceState(null, '', location.pathname);
      showLoginError(/expired/i.test(linkError + ' ' + (hash.get('error_description') || ''))
        ? 'ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว — กด "ลืมรหัสผ่าน?" เพื่อขอลิงก์ใหม่'
        : 'ลิงก์ใช้ไม่ได้: ' + (hash.get('error_description') || linkError));
    }
  }
}

init();
