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
import { loadFromSheets } from '../js/sheets.js';
import { MONTHS_TH, directImageUrl } from '../js/format.js';
import { sheetRows } from './sheets-sync.js';

/* =========================================================
   ไอคอนเพิ่มเติมของหน้านี้ — วาดบนกริดเดียวกับ UI_ICONS (viewBox 24 เส้น 1.7)
   ========================================================= */
var ICONS = Object.assign({}, UI_ICONS, {
  visitors: "<circle cx='9' cy='8' r='3.6' stroke='%23000' stroke-width='1.7'/><path d='M3 19.5c.6-3.2 3-5.2 6-5.2s5.4 2 6 5.2' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/><path d='M15.5 4.6a3.6 3.6 0 010 6.8M18 14.6c1.6.7 2.7 2.4 3 4.9' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  banner: "<path d='M4 9.5v5a1.5 1.5 0 001.5 1.5H7l9 4.5V3.5L7 8H5.5A1.5 1.5 0 004 9.5z' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/><path d='M19.5 9a4 4 0 010 6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  photo: "<rect x='3.5' y='4.5' width='17' height='15' rx='2.5' stroke='%23000' stroke-width='1.7'/><circle cx='9' cy='10' r='1.8' stroke='%23000' stroke-width='1.7'/><path d='M4 17l4.5-4 3.5 3 3-2.5 5 4' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'/>",
  settings: "<circle cx='12' cy='12' r='3' stroke='%23000' stroke-width='1.7'/><path d='M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6' stroke='%23000' stroke-width='1.7' stroke-linecap='round'/>",
  backup: "<ellipse cx='12' cy='6' rx='7.5' ry='2.8' stroke='%23000' stroke-width='1.7'/><path d='M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6' stroke='%23000' stroke-width='1.7'/>"
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
  { value: 'all', label: 'ทุกหน้า' },
  { value: 'home', label: 'หน้าหลักเท่านั้น' }
];

function matchFields() {
  return [
    { key: 'match_date', label: 'วันที่', type: 'date', required: true },
    { key: 'start_time', label: 'เวลาเริ่ม', type: 'time', hint: 'เว้นว่างได้ถ้ายังไม่กำหนดเวลา' },
    { key: 'sport_id', label: 'ชนิดกีฬา', type: 'select', options: 'sports', required: true },
    { key: 'event_type', label: 'ประเภท', type: 'text', hint: 'เช่น ชายเดี่ยว รอบชิงชนะเลิศ' },
    { key: 'team_a', label: 'ทีม/ฝ่าย A', type: 'text' },
    { key: 'team_b', label: 'ทีม/ฝ่าย B', type: 'text', hint: 'รายการที่ไม่ได้แข่งเป็นคู่ (เช่น กรีฑา) เว้นว่างไว้' }
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
      { key: 'score', label: 'ผล' },
      { key: 'status', label: 'สถานะ', type: 'status' }
    ],
    fields: matchFields().concat([
      { key: 'score', label: 'ผลการแข่งขัน', type: 'text', hint: 'เช่น 2 - 1 หรือ ทอง: ปทุมวัน — กรอกแล้วรายการจะขึ้นเป็น "ประกาศแล้ว" โดยอัตโนมัติ' },
      { key: 'status', label: 'สถานะ', type: 'select', options: STATUS_OPTIONS },
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
      { key: 'gold', label: 'ทอง', type: 'num' },
      { key: 'silver', label: 'เงิน', type: 'num' },
      { key: 'bronze', label: 'ทองแดง', type: 'num' }
    ],
    fields: [
      { key: 'full_name', label: 'ชื่อเต็ม', type: 'text', required: true },
      { key: 'short_name', label: 'ชื่อย่อที่แสดงในตาราง', type: 'text', hint: 'เว้นว่าง = ให้ระบบย่อให้เอง' },
      { key: 'abbr', label: 'อักษรย่อ', type: 'text', hint: 'เช่น ปทว. — ใช้หาไฟล์โลโก้ใน assets/school/' },
      { key: 'logo', label: 'พาธโลโก้', type: 'text', hint: 'เว้นว่าง = หาจากอักษรย่อให้เอง' },
      { key: 'is_self', label: 'เป็นโรงเรียนของเรา', type: 'checkbox', hint: 'ติ๊กได้โรงเรียนเดียว — แถวนี้จะถูกไฮไลต์และขึ้นการ์ดสรุปบนหน้าแรก' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number' }
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
      { key: 'gold', label: 'ทอง', type: 'num' },
      { key: 'silver', label: 'เงิน', type: 'num' },
      { key: 'bronze', label: 'ทองแดง', type: 'num' }
    ],
    fields: [
      { key: 'id', label: 'รหัสกีฬา', type: 'text', required: true, createOnly: true,
        hint: 'ภาษาอังกฤษตัวพิมพ์เล็ก ตรงกับชื่อไอคอน เช่น football' },
      { key: 'name', label: 'ชื่อกีฬา (ภาษาไทย)', type: 'text', required: true },
      { key: 'entered', label: 'ปีนี้ส่งเข้าแข่ง', type: 'checkbox', default: true, hint: 'ไม่ติ๊ก = ซ่อนกีฬานี้ออกจากทุกหน้าของเว็บ โดยไม่ต้องลบข้อมูลทิ้ง' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number' },
      { key: 'sort_order', label: 'ลำดับการแสดง', type: 'number' }
    ]
  },
  {
    id: 'photos', kind: 'table', table: 'photos', pk: 'id', icon: 'photo',
    title: 'ภาพบรรยากาศ',
    hint: 'แถบสไลด์บนหน้าแรก — วางลิงก์แชร์จาก Google Drive ได้เลย ระบบแปลงเป็นลิงก์รูปให้เอง',
    order: 'sort_order.asc',
    columns: [
      { key: 'url', label: 'รูป', type: 'thumb' },
      { key: 'caption', label: 'คำบรรยาย' },
      { key: 'sort_order', label: 'ลำดับ', type: 'num' }
    ],
    fields: [
      { key: 'url', label: 'ลิงก์รูป', type: 'text', required: true,
        hint: 'ไฟล์ใน Drive ต้องตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์" ไม่งั้นรูปจะไม่ขึ้นบนเว็บ' },
      { key: 'caption', label: 'คำบรรยาย', type: 'text' },
      { key: 'sort_order', label: 'ลำดับการแสดง', type: 'number' }
    ]
  },
  {
    id: 'banners', kind: 'table', table: 'banners', pk: 'id', icon: 'banner',
    title: 'แบนเนอร์ประกาศ',
    hint: 'แถบประกาศบนสุดของหน้าเว็บ — ตั้งเวลาเริ่ม/หมดได้ ถึงเวลาแล้วขึ้นและหายเอง · ผู้ชมกดปิดได้ แก้ข้อความแล้วจะขึ้นให้เห็นใหม่',
    order: 'sort_order.asc,updated_at.desc',
    columns: [
      { key: 'title', label: 'ประกาศ', type: 'banner' },
      { key: 'placement', label: 'แสดงที่', type: 'placement' },
      { key: 'period', label: 'ช่วงเวลา', type: 'period' },
      { key: 'active', label: 'สถานะ', type: 'bannerState' }
    ],
    fields: [
      { key: 'title', label: 'หัวข้อ', type: 'text', hint: 'ตัวหนาหน้าข้อความ เช่น "เลื่อนการแข่งขัน"' },
      { key: 'message', label: 'ข้อความ', type: 'textarea' },
      { key: 'image_url', label: 'ลิงก์รูปแบนเนอร์', type: 'text',
        hint: 'ใส่เมื่อต้องการแบนเนอร์แบบรูป (แนะนำสัดส่วนกว้าง เช่น 1600×400) — ใส่แล้วจะแสดงรูปแทนข้อความ · ลิงก์แชร์ Drive ใช้ได้' },
      { key: 'link_url', label: 'ลิงก์เมื่อกด', type: 'text', hint: 'เว้นว่างได้ · ต้องขึ้นต้นด้วย https:// หรือเป็นหน้าในเว็บ เช่น matches.html' },
      { key: 'link_label', label: 'ข้อความปุ่มลิงก์', type: 'text', hint: 'เว้นว่าง = "ดูรายละเอียด"' },
      { key: 'tone', label: 'สีแบนเนอร์', type: 'select', options: TONE_OPTIONS, noBlank: true },
      { key: 'placement', label: 'แสดงที่', type: 'select', options: PLACEMENT_OPTIONS, noBlank: true },
      { key: 'starts_at', label: 'เริ่มแสดง', type: 'datetime', hint: 'เว้นว่าง = แสดงทันที' },
      { key: 'ends_at', label: 'หยุดแสดง', type: 'datetime', hint: 'เว้นว่าง = แสดงไปเรื่อย ๆ จนกว่าจะปิด' },
      { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox', default: true, hint: 'ไม่ติ๊ก = เก็บเป็นฉบับร่าง ยังไม่ขึ้นบนเว็บ' },
      { key: 'sort_order', label: 'ลำดับ', type: 'number', hint: 'เลขน้อยขึ้นก่อน' }
    ]
  },
  {
    id: 'settings', kind: 'table', table: 'site_settings', pk: 'key', icon: 'settings',
    title: 'ตั้งค่าเว็บ',
    hint: 'ชื่อรายการและคำโปรยที่ขึ้นหัวหน้าเว็บ',
    exclude: { key: 'last_sheet_sync' },   // ค่าภายในของระบบซิงก์ ไม่ใช่สิ่งที่ทีมงานต้องแก้
    order: 'key.asc',
    columns: [
      { key: 'key', label: 'ค่า' },
      { key: 'value', label: 'ข้อความ' }
    ],
    fields: [
      { key: 'key', label: 'ชื่อค่า', type: 'text', required: true, createOnly: true },
      { key: 'value', label: 'ข้อความ', type: 'text' }
    ]
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
  { table: 'banners', pk: 'id', label: 'แบนเนอร์' }
];

var PAGE_NAMES = {
  'index.html': 'หน้าหลัก', 'schedule.html': 'ตารางการแข่งขัน', 'matches.html': 'ผลการแข่งขัน',
  'medals.html': 'อันดับเหรียญ', 'sports.html': 'ชนิดกีฬา', 'school.html': 'หน้าโรงเรียน'
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
var TH = 'border-b border-line px-4 py-3 text-left text-[13.5px] font-normal tracking-[.03em] text-fg-mute uppercase whitespace-nowrap';
var TD = 'border-b border-line px-4 py-3 align-middle';
var NAV_ITEM = 'group/nav flex w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-3.5 py-[10px] text-left text-[15px] text-fg-soft transition-[background-color,color] duration-150 hover:bg-surface-soft hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand aria-[current=page]:bg-brand aria-[current=page]:text-on-ink aria-[current=page]:shadow-card motion-reduce:transition-none';
var NAV_GROUP = 'px-3.5 pt-4 pb-1 text-[12.5px] tracking-[.06em] text-fg-mute uppercase first:pt-1';
var PANEL = 'overflow-hidden rounded-lg border border-line bg-surface shadow-panel';
var CARD = 'rounded-lg border border-line bg-surface px-6 py-5 shadow-panel';
var STATUS_TONE = { live: 'badge-live', done: 'badge-done', upcoming: 'badge-upcoming' };
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
  if (!b.active) return { label: 'ฉบับร่าง', tone: 'badge-upcoming' };
  if (b.starts_at && new Date(b.starts_at) > now) return { label: 'ตั้งเวลาไว้', tone: 'badge-secondary' };
  if (b.ends_at && new Date(b.ends_at) <= now) return { label: 'หมดเวลาแล้ว', tone: 'badge-upcoming' };
  return { label: 'กำลังแสดง', tone: 'badge-done' };
}

/* =========================================================
   มุมมอง "ตาราง" — แก้ไขข้อมูลทีละแถว
   ========================================================= */

function cellHtml(col, row) {
  if (col.type === 'date') return esc(thaiDate(row.match_date));
  if (col.type === 'time') return row.start_time ? esc(String(row.start_time).slice(0, 5)) : '—';
  if (col.type === 'sport') return esc(sportNameOf(row.sport_id));
  if (col.type === 'sportName') return '<span class="flex items-center gap-2.5">' +
    '<span class="text-fg-soft">' + sportIcon(row.id, 'size-[22px]') + '</span>' + esc(row.name) + '</span>';
  if (col.type === 'versus') {
    var sides = [row.team_a, row.team_b].filter(Boolean);
    return sides.length ? esc(sides.join(' พบ ')) : '—';
  }
  if (col.type === 'status') {
    return '<span class="badge ' + (STATUS_TONE[row.status] || STATUS_TONE.upcoming) + '">' +
      esc(optionLabel(STATUS_OPTIONS, row.status || 'upcoming')) + (row.unofficial ? ' · ไม่เป็นทางการ' : '') + '</span>';
  }
  if (col.type === 'flag') {
    return row[col.key] ? '<span class="badge badge-done">ใช่</span>' : '<span class="text-fg-mute">—</span>';
  }
  if (col.type === 'num') return '<span class="tabular-nums">' + esc(row[col.key] == null ? 0 : row[col.key]) + '</span>';
  if (col.type === 'thumb') {
    // referrerpolicy: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    return '<img class="h-11 w-16 rounded-sm border border-line object-cover" src="' + esc(directImageUrl(row.url)) +
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
  if (col.type === 'placement') return esc(optionLabel(PLACEMENT_OPTIONS, row.placement));
  if (col.type === 'period') {
    if (!row.starts_at && !row.ends_at) return '<span class="text-fg-mute">ไม่จำกัด</span>';
    return '<span class="text-[14px] whitespace-nowrap">' + esc(row.starts_at ? thaiDateTime(row.starts_at) : 'ทันที') +
      ' → ' + esc(row.ends_at ? thaiDateTime(row.ends_at) : 'ไม่กำหนด') + '</span>';
  }
  if (col.type === 'bannerState') {
    var st = bannerState(row);
    return '<span class="badge ' + st.tone + '">' + esc(st.label) + '</span>';
  }
  var v = row[col.key];
  return v === '' || v == null ? '<span class="text-fg-mute">—</span>' : esc(v);
}

/** ข้อความทั้งแถวที่ช่องค้นหาใช้เทียบ (รวมชื่อกีฬาไทย ค้น "ฟุตบอล" แล้วเจอแถว football) */
function rowText(row) {
  return (Object.keys(row).map(function (k) { return row[k]; }).join(' ') + ' ' + sportNameOf(row.sport_id || row.id)).toLowerCase();
}

/** หมวดที่ซิงก์จาก Google Sheets ทุก 15 นาที — แก้ในหน้านี้แล้วจะถูกเขียนทับรอบถัดไป */
var SYNCED_FROM_SHEETS = ['results', 'plan', 'schools', 'sports', 'photos', 'settings'];

function renderTableView() {
  var synced = SYNCED_FROM_SHEETS.indexOf(current.id) > -1;
  $('viewBody').innerHTML =
    (synced ? '<p class="m-0 rounded-sm border border-gold/40 bg-gold/15 px-4 py-3 text-[14.5px] text-gold-ink">' +
      'ข้อมูลหมวดนี้คัดลอกจาก Google Sheets อัตโนมัติทุก 15 นาที — <strong class="font-semibold">ให้แก้ที่ชีต</strong> ' +
      'ถ้าแก้ที่นี่จะถูกเขียนทับในรอบถัดไป และหน้าเว็บก็ยังแสดงตามชีตอยู่ดี</p>' : '') +
    '<div class="flex items-center gap-3 max-[560px]:flex-col max-[560px]:items-stretch">' +
      '<label class="relative block w-full max-w-[360px] max-[560px]:max-w-none">' +
        '<span class="sr-only">ค้นหาในหมวดนี้</span>' +
        '<i class="icon-mask pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-mute" data-ic="search"></i>' +
        '<input class="input pl-9" id="search" type="search" placeholder="ค้นหา เช่น ชื่อทีม กีฬา วันที่" value="' + esc(query) + '" />' +
      '</label>' +
      '<span class="text-[14px] text-fg-mute" id="rowCount"></span>' +
    '</div>' +
    '<div class="' + PANEL + '"><div class="overflow-x-auto"><table class="w-full border-collapse text-[15px]" id="grid"></table></div></div>';
  paintIcons($('viewBody'));
  $('search').addEventListener('input', function (e) { query = e.target.value; renderGrid(); });
  renderGrid();
}

function renderGrid() {
  var grid = $('grid');
  if (!grid) return;
  if (loading) {
    $('rowCount').textContent = '';
    grid.innerHTML = '<tbody><tr><td class="px-5 py-[34px] text-center text-[14.5px] text-fg-mute">กำลังโหลด…</td></tr></tbody>';
    return;
  }
  var q = query.trim().toLowerCase();
  var shown = rows.map(function (r, i) { return { row: r, i: i }; })
    .filter(function (x) { return !q || rowText(x.row).indexOf(q) > -1; });

  $('rowCount').textContent = q ? 'พบ ' + fmtNum(shown.length) + ' จาก ' + fmtNum(rows.length) + ' รายการ' : fmtNum(rows.length) + ' รายการ';

  if (!shown.length) {
    grid.innerHTML = '<tbody><tr><td class="px-5 py-[34px] text-center text-[14.5px] text-fg-mute">' +
      (rows.length ? 'ไม่พบรายการที่ตรงกับคำค้น' : 'ยังไม่มีข้อมูลในหมวดนี้ — กด "เพิ่ม" เพื่อเริ่มกรอก') + '</td></tr></tbody>';
    return;
  }

  var head = '<thead><tr>' + current.columns.map(function (c) {
    return '<th class="' + TH + '" scope="col">' + esc(c.label) + '</th>';
  }).join('') + '<th class="' + TH + '"><span class="sr-only">แก้ไข</span></th></tr></thead>';

  var body = '<tbody>' + shown.map(function (x) {
    return '<tr class="hover:bg-surface-soft">' + current.columns.map(function (c) {
      return '<td class="' + TD + '">' + cellHtml(c, x.row) + '</td>';
    }).join('') +
      '<td class="' + TD + ' text-right"><button class="btn btn-outline btn-sm" type="button" data-row="' + x.i + '">แก้ไข</button></td></tr>';
  }).join('') + '</tbody>';

  grid.innerHTML = head + body;
  grid.querySelectorAll('[data-row]').forEach(function (btn) {
    btn.addEventListener('click', function () { openEditor(rows[Number(btn.dataset.row)]); });
  });
}

async function refreshTable() {
  setPanelError('');
  var view = current;
  var q = db.from(current.table).select('*');
  if (current.filter) Object.keys(current.filter).forEach(function (k) { q = q.eq(k, current.filter[k]); });
  if (current.exclude) Object.keys(current.exclude).forEach(function (k) { q = q.neq(k, current.exclude[k]); });
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
   กล่องแก้ไข
   ========================================================= */

function fieldHtml(f, value) {
  var id = 'f_' + f.key;
  var label = '<label class="label mb-2" for="' + id + '">' + esc(f.label) +
    (f.required ? ' <span class="-ml-1 text-destructive">*</span>' : '') + '</label>';
  var hint = f.hint ? '<p class="mt-1.5 text-[13.5px] text-fg-mute">' + esc(f.hint) + '</p>' : '';
  var input;

  if (f.type === 'select') {
    var opts = f.options === 'sports' ? sports.map(function (s) { return { value: s.id, label: s.name }; }) : f.options;
    input = '<select class="input" id="' + id + '" name="' + f.key + '">' +
      (f.noBlank ? '' : '<option value="">— ไม่ระบุ —</option>') +
      opts.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (String(value) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  } else if (f.type === 'checkbox') {
    return '<div><label class="flex cursor-pointer items-center gap-2.5 text-[15px] text-fg">' +
      '<input class="size-[17px] flex-none accent-brand" id="' + id + '" name="' + f.key + '" type="checkbox"' + (value ? ' checked' : '') + ' />' +
      esc(f.label) + '</label>' + hint + '</div>';
  } else if (f.type === 'textarea') {
    input = '<textarea class="textarea min-h-[92px]" id="' + id + '" name="' + f.key + '" rows="3">' + esc(value == null ? '' : value) + '</textarea>';
  } else {
    var type = { number: 'number', date: 'date', time: 'time', datetime: 'datetime-local' }[f.type] || 'text';
    input = '<input class="input" id="' + id + '" name="' + f.key + '" type="' + type + '"' +
      (f.type === 'number' ? ' min="0" step="1"' : '') + (f.required ? ' required' : '') +
      ' value="' + esc(value == null ? '' : value) + '" />';
  }
  return '<div>' + label + input + hint + '</div>';
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
  $('editorTitle').textContent = isNew ? 'เพิ่มรายการใน "' + current.title + '"' : 'แก้ไขรายการ';
  $('deleteBtn').hidden = isNew;
  setEditorError('');

  $('editorFields').innerHTML = current.fields.filter(function (f) { return !f.createOnly || isNew; }).map(function (f) {
    var v = row ? row[f.key] : defaultValue(f);
    if (f.type === 'time' && v) v = String(v).slice(0, 5);   // 'HH:MM:SS' ของ Postgres → ช่อง time รับแค่ HH:MM
    if (f.type === 'datetime') v = toLocalInput(v);
    return fieldHtml(f, v);
  }).join('');

  $('editor').showModal();
  var first = $('editorFields').querySelector('input, select, textarea');
  if (first) first.focus();
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
  var isNew = !editing;
  var values = collectValues(isNew);

  if (current.id === 'results' && values.score && values.status === 'upcoming') values.status = 'done';
  if (current.id === 'banners') {
    if (!values.title && !values.message && !values.image_url) {
      setEditorError('ใส่หัวข้อ ข้อความ หรือรูปอย่างน้อยหนึ่งอย่าง — แบนเนอร์ว่างจะขึ้นเป็นแถบเปล่าบนเว็บ');
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
  $('viewBody').innerHTML = '<div class="' + CARD + ' text-[14.5px] text-fg-mute">กำลังโหลดสถิติ…</div>';
}

function kpi(label, value, sub) {
  return '<div class="' + CARD + '">' +
    '<p class="m-0 text-[14px] text-fg-mute">' + esc(label) + '</p>' +
    '<p class="mt-1 mb-0 font-display text-[32px] leading-none text-fg tabular-nums">' + esc(fmtNum(value)) + '</p>' +
    (sub ? '<p class="mt-2 mb-0 text-[13.5px] text-fg-mute">' + esc(sub) + '</p>' : '') + '</div>';
}

function dailyChart(daily) {
  var max = Math.max.apply(null, daily.map(function (d) { return d.views; }).concat([1]));
  var every = daily.length > 16 ? Math.ceil(daily.length / 10) : 1;   // วันเยอะ ป้ายวันที่เว้นระยะไม่ให้ทับกัน
  var bars = daily.map(function (d, i) {
    var h = Math.round((d.views / max) * 100);
    var hv = Math.round((d.visitors / max) * 100);
    var label = thaiDate(d.day);
    return '<div class="group/bar flex min-w-0 flex-1 flex-col items-center gap-1.5" title="' + esc(label + ' · เปิดหน้า ' + fmtNum(d.views) + ' ครั้ง · ผู้เข้าชม ' + fmtNum(d.visitors) + ' คน') + '">' +
      '<span class="text-[12px] text-fg-mute tabular-nums opacity-0 group-hover/bar:opacity-100">' + esc(fmtNum(d.views)) + '</span>' +
      '<div class="relative flex h-[180px] w-full max-w-[34px] items-end">' +
        '<div class="absolute bottom-0 w-full rounded-t-[4px] bg-brand-100" style="height:' + h + '%"></div>' +
        '<div class="absolute bottom-0 left-1/2 w-1/2 -translate-x-1/2 rounded-t-[3px] bg-brand" style="height:' + hv + '%"></div>' +
      '</div>' +
      '<span class="h-4 text-[11.5px] whitespace-nowrap text-fg-mute">' + (i % every === 0 || i === daily.length - 1 ? esc(label) : '') + '</span>' +
    '</div>';
  }).join('');

  // ตารางซ่อนสำหรับโปรแกรมอ่านหน้าจอ — กราฟแท่งอ่านออกเสียงไม่ได้
  var table = '<table class="sr-only"><caption>ยอดเข้าชมรายวัน</caption><thead><tr><th>วันที่</th><th>เปิดหน้า</th><th>ผู้เข้าชม</th></tr></thead><tbody>' +
    daily.map(function (d) { return '<tr><td>' + esc(thaiDate(d.day)) + '</td><td>' + d.views + '</td><td>' + d.visitors + '</td></tr>'; }).join('') +
    '</tbody></table>';

  return '<div class="' + CARD + '">' +
    '<div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">' +
      '<h2 class="m-0 mr-auto text-[16px] font-semibold text-fg">ยอดเข้าชมรายวัน</h2>' +
      '<span class="flex items-center gap-1.5 text-[13.5px] text-fg-soft"><span class="size-2.5 rounded-[3px] bg-brand-100"></span>เปิดหน้า (ครั้ง)</span>' +
      '<span class="flex items-center gap-1.5 text-[13.5px] text-fg-soft"><span class="size-2.5 rounded-[3px] bg-brand"></span>ผู้เข้าชม (คน)</span>' +
    '</div>' +
    '<div class="flex items-end gap-1.5 overflow-x-auto" aria-hidden="true">' + bars + '</div>' + table + '</div>';
}

function pagesTable(pages) {
  if (!pages.length) return '<div class="' + CARD + ' text-[14.5px] text-fg-mute">ยังไม่มีการเข้าชมในช่วงนี้</div>';
  var max = Math.max.apply(null, pages.map(function (p) { return p.views; }).concat([1]));
  return '<div class="' + PANEL + '"><div class="border-b border-line px-5 py-4"><h2 class="m-0 text-[16px] font-semibold text-fg">หน้าที่เปิดมากที่สุด</h2></div>' +
    '<div class="overflow-x-auto"><table class="w-full border-collapse text-[15px]"><thead><tr>' +
      '<th class="' + TH + '" scope="col">หน้า</th><th class="' + TH + ' text-right" scope="col">เปิดหน้า</th><th class="' + TH + ' text-right" scope="col">ผู้เข้าชม</th>' +
    '</tr></thead><tbody>' + pages.map(function (p) {
      return '<tr><td class="' + TD + '"><div class="flex flex-col gap-1.5"><span>' + esc(PAGE_NAMES[p.path] || p.path || '—') +
        ' <span class="text-[13px] text-fg-mute">' + esc(p.path) + '</span></span>' +
        '<span class="block h-1.5 rounded-full bg-brand/70" style="width:' + Math.max(2, Math.round(p.views / max * 100)) + '%"></span></div></td>' +
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
      kpi('ผู้เข้าชมวันนี้', s.today_visitors, 'เปิดหน้า ' + fmtNum(s.today_views) + ' ครั้ง') +
      kpi('กำลังดูอยู่ตอนนี้', s.online_now, 'คนที่เปิดหน้าใน 5 นาทีล่าสุด') +
      kpi('เปิดหน้าใน ' + statsDays + ' วัน', rangeViews, 'เฉลี่ยวันละ ' + fmtNum(Math.round(rangeViews / Math.max(1, daily.length))) + ' ครั้ง') +
      kpi('ผู้เข้าชมทั้งหมด', s.total_visitors, 'เปิดหน้ารวม ' + fmtNum(s.total_views) + ' ครั้ง ตั้งแต่เริ่มนับ') +
    '</div>' +
    dailyChart(daily) +
    pagesTable(s.pages || []) +
    '<p class="m-0 text-[13.5px] text-fg-mute">อัปเดตเองทุก 1 นาที · ล่าสุด ' + esc(thaiDateTime(new Date())) +
      ' · "ผู้เข้าชม" นับจากรหัสสุ่มในเบราว์เซอร์ คนเดียวเปิดหลายเครื่องจะถูกนับหลายคน</p>';
}

function renderStatsActions() {
  $('panelActions').innerHTML = [7, 14, 30].map(function (d) {
    return '<button class="btn btn-sm ' + (d === statsDays ? '' : 'btn-outline') + '" type="button" data-days="' + d + '" aria-pressed="' + (d === statsDays) + '">' + d + ' วัน</button>';
  }).join('') + '<button class="btn btn-outline btn-sm" type="button" id="statsReload">รีเฟรช</button>';
  $('panelActions').querySelectorAll('[data-days]').forEach(function (b) {
    b.addEventListener('click', function () { statsDays = Number(b.dataset.days); renderStatsActions(); refreshStats(); });
  });
  $('statsReload').addEventListener('click', refreshStats);
}

/* =========================================================
   มุมมอง "สำรองและกู้คืน"
   ========================================================= */

var pendingRestore = null;

function renderBackupView() {
  $('viewBody').innerHTML =
    '<div class="grid grid-cols-3 gap-5 max-[1200px]:grid-cols-1">' +
      '<section class="' + CARD + ' flex flex-col gap-3">' +
        '<h2 class="m-0 text-[17px] font-semibold text-fg">ดาวน์โหลดไฟล์สำรอง</h2>' +
        '<p class="m-0 text-[14.5px] text-fg-soft">บันทึกข้อมูลทุกหมวด (ผล ตาราง เหรียญ กีฬา ภาพ แบนเนอร์ ตั้งค่า) เป็นไฟล์ .json เก็บไว้ในเครื่อง — ควรกดก่อนแก้ข้อมูลครั้งใหญ่ทุกครั้ง</p>' +
        '<button class="btn mt-auto self-start" type="button" id="exportBtn">ดาวน์โหลดไฟล์สำรอง</button>' +
      '</section>' +
      '<section class="' + CARD + ' flex flex-col gap-3">' +
        '<h2 class="m-0 text-[17px] font-semibold text-fg">กู้คืนจากไฟล์สำรอง</h2>' +
        '<p class="m-0 text-[14.5px] text-fg-soft">เลือกไฟล์ .json ที่เคยดาวน์โหลดไว้ ระบบจะแสดงจำนวนรายการให้ตรวจก่อนเขียนจริง</p>' +
        '<input class="input h-auto py-1.5 text-[14px]" id="restoreFile" type="file" accept="application/json,.json" />' +
        '<label class="flex cursor-pointer items-start gap-2.5 text-[14.5px] text-fg"><input class="mt-1 size-[16px] flex-none accent-brand" id="restoreReplace" type="checkbox" checked />' +
          '<span>แทนที่ทั้งหมด — ลบรายการในฐานข้อมูลที่ไม่มีอยู่ในไฟล์ (ไม่ติ๊ก = เพิ่ม/ทับเฉพาะที่มีในไฟล์)</span></label>' +
        '<div class="text-[14px] text-fg-soft" id="restoreSummary"></div>' +
        '<button class="btn btn-destructive mt-auto self-start" type="button" id="restoreBtn" disabled>กู้คืนข้อมูล</button>' +
      '</section>' +
      '<section class="' + CARD + ' flex flex-col gap-3">' +
        '<h2 class="m-0 text-[17px] font-semibold text-fg">ดึงข้อมูลล่าสุดจาก Google Sheets</h2>' +
        '<p class="m-0 text-[14.5px] text-fg-soft">อ่านชีตตัวเดียวกับที่หน้าเว็บใช้อยู่ แล้วเขียนทับลงฐานข้อมูลนี้ ให้ระบบสำรองมีข้อมูลตรงกับหน้าเว็บจริงเสมอ</p>' +
        '<p class="m-0 rounded-sm border border-gold/40 bg-gold/15 px-3.5 py-2.5 text-[14px] text-gold-ink">ข้อมูลการแข่งขันถูกเขียนทับจากชีตทุกรอบ — สิ่งที่แก้ในหน้านี้เอง (ยกเว้นแบนเนอร์) จะหายในรอบถัดไป ให้แก้ที่ชีตเท่านั้น</p>' +
        '<p class="m-0 text-[14px] text-fg-soft" id="lastSync">ซิงก์ล่าสุด: กำลังตรวจ…</p>' +
        '<button class="btn mt-auto self-start" type="button" id="syncBtn">ดึงจาก Google Sheets เดี๋ยวนี้</button>' +
      '</section>' +
    '</div>' +
    '<section class="' + PANEL + '"><div class="border-b border-line px-5 py-3.5"><h2 class="m-0 text-[15px] font-semibold text-fg">บันทึกการทำงาน</h2></div>' +
      '<ol class="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-y-auto px-5 py-4 font-mono text-[13.5px] text-fg-soft" id="log">' +
        '<li class="text-fg-mute">ยังไม่มีการทำงาน</li></ol></section>';

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
    '<br><span class="text-[13px] text-fg-mute">ระบบซิงก์ให้เองทุก 15 นาที' + (stale ? ' — ค้างเกิน 1 ชั่วโมง ตรวจแท็บ Actions ใน GitHub' : '') + '</span>';
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
  var old = btn.textContent;
  btn.textContent = 'กำลังทำงาน…';
  try {
    await task();
  } catch (err) {
    log('ล้มเหลว: ' + missingSchemaHint(err), 'error');
  } finally {
    busy.forEach(function (b) { b.disabled = false; });
    btn.textContent = old;
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
  log('กำลังอ่าน Google Sheets…');
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
    steps.push(['ภาพ', function () { return db.from('photos').insert(r.photos); }]);
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
    $('panelActions').innerHTML = '<button class="btn" type="button" id="addBtn">+ เพิ่ม' + esc(current.title) + '</button>';
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
  }
}

function renderNav() {
  $('tabNav').innerHTML = VIEWS.map(function (v) {
    if (v.group) return '<p class="' + NAV_GROUP + '">' + esc(v.group) + '</p>';
    return '<button class="' + NAV_ITEM + '" type="button" data-view="' + v.id + '">' +
      '<i class="icon-mask size-[18px] opacity-80 group-aria-[current=page]/nav:opacity-100" data-ic="' + v.icon + '"></i>' +
      '<span>' + esc(v.title) + '</span></button>';
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

async function onSignedIn(session) {
  // ตรวจสิทธิ์กับฐานข้อมูลเสมอ ไม่เชื่อแค่ว่า "ล็อกอินผ่าน" — คนที่ไม่ใช่ผู้ดูแลได้ลิสต์ว่างกลับมา
  var res = await db.from('app_admins').select('user_id,display_name').eq('user_id', session.user.id);
  if (res.error || !res.data || !res.data.length) {
    await db.auth.signOut();
    show('loginScreen');
    showAuthForm('login');
    showLoginError('บัญชี ' + session.user.email + ' ยังไม่ได้รับสิทธิ์ผู้ดูแล — แจ้งผู้ดูแลระบบให้เพิ่มบัญชีนี้ในตาราง app_admins');
    return;
  }

  $('userEmail').textContent = res.data[0].display_name || session.user.email;
  show('app');
  await loadSports();
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
    await onSignedIn(res.data.session);
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
  n.className = 'm-0 rounded-lg border px-3.5 py-2.5 text-[14px] ' + (tone === 'error'
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
