/* =========================================================
   admin.js — หน้าจัดการข้อมูลหลังบ้าน (CMS)

   หน้านี้คุยกับ Supabase ตรงจากเบราว์เซอร์ ไม่มีเซิร์ฟเวอร์ของเราคั่นกลาง (เว็บอยู่บน
   GitHub Pages) — สิทธิ์การเขียนจึงถูกบังคับที่ RLS ในฐานข้อมูล ไม่ใช่ที่โค้ดไฟล์นี้
   การซ่อนปุ่มในหน้านี้เป็นเรื่องของความสะดวก ไม่ใช่ความปลอดภัย: คนที่ไม่ได้อยู่ใน
   ตาราง app_admins ต่อให้เรียก API เองก็ถูกฐานข้อมูลปฏิเสธอยู่ดี

   ทุกหมวดข้อมูลใช้โค้ด render/แก้ไข/บันทึกชุดเดียวกัน ต่างกันแค่คำอธิบายใน RESOURCES
   ข้างล่าง — เพิ่มคอลัมน์ใหม่ในอนาคตจึงแก้ที่เดียว ไม่ต้องเขียนฟอร์มใหม่ทั้งหมวด
   ========================================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from './config.js';
import { esc, paintUiIcons, sportIcon } from './common.js';

/* =========================================================
   คำอธิบายหมวดข้อมูล
   columns = สิ่งที่เห็นในตาราง · fields = สิ่งที่แก้ได้ในกล่องแก้ไข
   ========================================================= */

var STATUS_OPTIONS = [
  { value: 'upcoming', label: 'รอเริ่ม' },
  { value: 'live', label: 'กำลังแข่ง' },
  { value: 'done', label: 'ประกาศผลแล้ว' }
];

/** ช่องกรอกของรายการแข่งที่ "ผลการแข่งขัน" กับ "ตารางการแข่งขัน" ใช้เหมือนกัน */
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

var RESOURCES = [
  {
    id: 'results', table: 'matches', pk: 'id', icon: 'results',
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
    id: 'plan', table: 'matches', pk: 'id', icon: 'calendar',
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
    id: 'schools', table: 'schools', pk: 'id', icon: 'medal',
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
      { key: 'short_name', label: 'ชื่อย่อที่แสดงในตาราง', type: 'text', hint: 'เว้นว่าง = ให้ระบบย่อให้เอง (ตัดคำว่า "โรงเรียน" และย่อ "มหาวิทยาลัย" เป็น ม.)' },
      { key: 'abbr', label: 'อักษรย่อ', type: 'text', hint: 'เช่น ปทว. — ใช้หาไฟล์โลโก้ใน assets/school/' },
      { key: 'logo', label: 'พาธโลโก้', type: 'text', hint: 'เว้นว่าง = หาจากอักษรย่อให้เอง' },
      { key: 'is_self', label: 'เป็นโรงเรียนของเรา', type: 'checkbox', hint: 'ติ๊กได้โรงเรียนเดียว — แถวนี้จะถูกไฮไลต์และขึ้นการ์ดสรุปบนหน้าแรก' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number' }
    ]
  },
  {
    id: 'sports', table: 'sports', pk: 'id', icon: 'sports',
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
        hint: 'ภาษาอังกฤษตัวพิมพ์เล็ก ต้องตรงกับชื่อไอคอนใน SPORT_ICONS (common.js) เช่น football' },
      { key: 'name', label: 'ชื่อกีฬา (ภาษาไทย)', type: 'text', required: true },
      { key: 'entered', label: 'ปีนี้ส่งเข้าแข่ง', type: 'checkbox', hint: 'ไม่ติ๊ก = ซ่อนกีฬานี้ออกจากทุกหน้าของเว็บ โดยไม่ต้องลบข้อมูลทิ้ง' },
      { key: 'gold', label: 'เหรียญทอง', type: 'number' },
      { key: 'silver', label: 'เหรียญเงิน', type: 'number' },
      { key: 'bronze', label: 'เหรียญทองแดง', type: 'number' },
      { key: 'sort_order', label: 'ลำดับการแสดง', type: 'number' }
    ]
  },
  {
    id: 'photos', table: 'photos', pk: 'id', icon: 'dashboard',
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
    id: 'settings', table: 'site_settings', pk: 'key', icon: 'table',
    title: 'ตั้งค่าเว็บ',
    hint: 'ชื่อรายการและคำโปรยที่ขึ้นหัวหน้าเว็บ',
    order: 'key.asc',
    columns: [
      { key: 'key', label: 'ค่า' },
      { key: 'value', label: 'ข้อความ' }
    ],
    fields: [
      { key: 'key', label: 'ชื่อค่า', type: 'text', required: true, createOnly: true },
      { key: 'value', label: 'ข้อความ', type: 'text' }
    ]
  }
];

/* =========================================================
   สถานะของหน้า
   ========================================================= */
var db = null;
var current = RESOURCES[0];
var rows = [];
var sports = [];        // ใช้เติมตัวเลือก "ชนิดกีฬา" และแปลง sport_id เป็นชื่อไทยในตาราง
var editing = null;     // แถวที่กำลังแก้ (null = กำลังเพิ่มรายการใหม่)

var $ = function (id) { return document.getElementById(id); };

/* =========================================================
   ชุดคลาสที่ใช้ซ้ำ
   ตัวสร้าง Tailwind อ่านสตริงในไฟล์ .js ด้วย จึงต้องเขียนชื่อคลาสเต็ม ๆ เสมอ
   ห้ามต่อชื่อคลาสจากตัวแปร (เช่น 'text-' + tone) ไม่งั้นคลาสนั้นจะไม่ถูกสร้างลงไฟล์ CSS
   ========================================================= */
var INPUT = 'input';
var TH = 'border-b border-line px-4 py-3 text-left fs-13.5 font-normal tracking-[.03em] text-fg-mute uppercase whitespace-nowrap';
var TD = 'border-b border-line px-4 py-3 align-middle';
var NAV_ITEM = 'group/nav flex w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-3.5 py-[11px] text-left fs-15 text-fg-soft transition-[background-color,color] duration-150 hover:bg-surface-soft hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand aria-[current=page]:bg-brand aria-[current=page]:text-on-ink aria-[current=page]:shadow-card motion-reduce:transition-none';
var CHIP = 'badge';

var STATUS_TONE = {
  live: 'badge-live',
  done: 'badge-done',
  upcoming: 'badge-upcoming'
};

/* =========================================================
   แสดงผลตาราง
   ========================================================= */

var MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDate(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MONTHS_TH[Number(p[1]) - 1];
}
function sportNameOf(id) {
  var s = sports.filter(function (x) { return x.id === id; })[0];
  return s ? s.name : (id || '—');
}

/** ค่าหนึ่งช่องในตาราง → HTML (ยัง escape ทุกค่าที่มาจากฐานข้อมูล) */
function cellHtml(col, row) {
  if (col.type === 'date') return esc(thaiDate(row.match_date));
  if (col.type === 'time') return row.start_time ? esc(String(row.start_time).slice(0, 5)) : '—';
  if (col.type === 'sport') return esc(sportNameOf(row.sport_id));
  if (col.type === 'sportName') return '<span class="flex items-center gap-2.5">' +
    '<span class="text-fg-soft">' + sportIcon(row.id, 'size-[22px]') + '</span>' +
    esc(row.name) + '</span>';
  if (col.type === 'versus') {
    var sides = [row.team_a, row.team_b].filter(Boolean);
    return sides.length ? esc(sides.join(' พบ ')) : '—';
  }
  if (col.type === 'status') {
    var tone = STATUS_TONE[row.status] || STATUS_TONE.upcoming;
    var label = (STATUS_OPTIONS.filter(function (o) { return o.value === row.status; })[0] || STATUS_OPTIONS[0]).label;
    return '<span class="' + CHIP + ' ' + tone + '">' + esc(label) +
      (row.unofficial ? ' · ไม่เป็นทางการ' : '') + '</span>';
  }
  if (col.type === 'flag') {
    return row[col.key]
      ? '<span class="' + CHIP + ' badge-done">ใช่</span>'
      : '<span class="text-fg-mute">—</span>';
  }
  if (col.type === 'num') return '<span class="tabular-nums">' + esc(row[col.key] == null ? 0 : row[col.key]) + '</span>';
  if (col.type === 'thumb') {
    // referrerpolicy: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    return '<img class="h-11 w-16 rounded-sm border border-line object-cover" src="' + esc(driveThumb(row.url)) +
      '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />';
  }
  var v = row[col.key];
  return v === '' || v == null ? '<span class="text-fg-mute">—</span>' : esc(v);
}

function driveThumb(url) {
  var m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?(?:[\w=&]*&)?id=)([\w-]{10,})/.exec(url || '');
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400' : (url || '');
}

function renderGrid() {
  var grid = $('grid');

  if (!rows.length) {
    grid.innerHTML = '<tbody><tr><td class="px-5 py-[34px] text-center fs-14.5 text-fg-mute">' +
      'ยังไม่มีข้อมูลในหมวดนี้ — กด "เพิ่มรายการ" เพื่อเริ่มกรอก</td></tr></tbody>';
    return;
  }

  var head = '<thead><tr>' + current.columns.map(function (c) {
    return '<th class="' + TH + '" scope="col">' + esc(c.label) + '</th>';
  }).join('') + '<th class="' + TH + '"><span class="sr-only">แก้ไข</span></th></tr></thead>';

  var body = '<tbody>' + rows.map(function (row, i) {
    var cells = current.columns.map(function (c) {
      return '<td class="' + TD + '">' + cellHtml(c, row) + '</td>';
    }).join('');
    // ปุ่มแก้ไขเป็นปุ่มจริง ไม่ใช่ทั้งแถวที่คลิกได้ — คนใช้คีย์บอร์ด/โปรแกรมอ่านหน้าจอ
    // ต้องแท็บไปถึงได้ และข้อความในช่องต้องเลือกคัดลอกได้ตามปกติ
    return '<tr class="hover:bg-surface-soft">' + cells +
      '<td class="' + TD + ' text-right">' +
        '<button class="btn btn-outline btn-sm" type="button" data-row="' + i + '">แก้ไข</button>' +
      '</td></tr>';
  }).join('') + '</tbody>';

  grid.innerHTML = head + body;
  grid.querySelectorAll('[data-row]').forEach(function (btn) {
    btn.addEventListener('click', function () { openEditor(rows[Number(btn.dataset.row)]); });
  });
}

/* =========================================================
   กล่องแก้ไข
   ========================================================= */

function fieldHtml(f, value) {
  var id = 'f_' + f.key;
  var label = '<label class="label mb-2" for="' + id + '">' + esc(f.label) +
    (f.required ? ' <span class="-ml-1 text-destructive">*</span>' : '') + '</label>';
  var hint = f.hint ? '<p class="mt-1.5 fs-13.5 text-fg-mute">' + esc(f.hint) + '</p>' : '';
  var input;

  if (f.type === 'select') {
    var opts = f.options === 'sports'
      ? sports.map(function (s) { return { value: s.id, label: s.name }; })
      : f.options;
    input = '<select class="' + INPUT + '" id="' + id + '" name="' + f.key + '">' +
      '<option value="">— ไม่ระบุ —</option>' +
      opts.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (String(value) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  } else if (f.type === 'checkbox') {
    // ช่องติ๊กวางป้ายไว้ข้างหลัง ไม่ใช่ข้างบนเหมือนช่องอื่น — กล่องเล็ก ๆ ลอยเดี่ยว
    // ใต้ป้ายของตัวเองอ่านยากว่ามันคู่กับข้อความไหน
    return '<div>' +
      '<label class="flex cursor-pointer items-center gap-2.5 fs-15 text-fg">' +
        '<input class="size-[17px] flex-none accent-brand" id="' + id + '" name="' + f.key + '" type="checkbox"' + (value ? ' checked' : '') + ' />' +
        esc(f.label) +
      '</label>' + hint + '</div>';
  } else {
    var type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text';
    input = '<input class="' + INPUT + '" id="' + id + '" name="' + f.key + '" type="' + type + '"' +
      (f.type === 'number' ? ' min="0" step="1"' : '') +
      (f.required ? ' required' : '') +
      ' value="' + esc(value == null ? '' : value) + '" />';
  }

  return '<div>' + label + input + hint + '</div>';
}

function openEditor(row) {
  editing = row || null;
  var isNew = !row;

  $('editorTitle').textContent = isNew ? 'เพิ่มรายการใน "' + current.title + '"' : 'แก้ไขรายการ';
  $('deleteBtn').hidden = isNew;
  setEditorError('');

  var fields = current.fields.filter(function (f) { return !f.createOnly || isNew; });
  $('editorFields').innerHTML = fields.map(function (f) {
    var v = row ? row[f.key] : defaultValue(f);
    if (f.type === 'time' && v) v = String(v).slice(0, 5);   // 'HH:MM:SS' ของ Postgres → ช่อง time รับแค่ HH:MM
    return fieldHtml(f, v);
  }).join('');

  $('editor').showModal();
  var first = $('editorFields').querySelector('input, select');
  if (first) first.focus();
}

function defaultValue(f) {
  if (f.key === 'match_date') {
    // วันที่วันนี้แบบเวลาท้องถิ่น — toISOString() ให้เป็น UTC ซึ่งในไทยจะกลายเป็น
    // "เมื่อวาน" ตลอดช่วงเที่ยงคืนถึง 7 โมงเช้า
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  if (f.type === 'number') return 0;
  if (f.type === 'checkbox') return f.key === 'entered';   // กีฬาที่เพิ่มใหม่ถือว่าส่งแข่ง
  return '';
}

/** อ่านค่าจากฟอร์ม → object ที่ส่งเข้าฐานข้อมูลได้ */
function collectValues(isNew) {
  var out = {};
  current.fields.forEach(function (f) {
    if (f.createOnly && !isNew) return;
    var node = $('f_' + f.key);
    if (!node) return;

    if (f.type === 'checkbox') { out[f.key] = node.checked; return; }

    var v = node.value.trim();
    if (f.type === 'number') { out[f.key] = v === '' ? 0 : Number(v); return; }
    // ช่องเวลาและ select เว้นว่างได้จริง ต้องส่ง null ไม่ใช่ '' — Postgres ปฏิเสธ
    // สตริงว่างสำหรับชนิด time และ foreign key ที่ชี้ไปยังแถวที่ไม่มีอยู่
    if ((f.type === 'time' || f.type === 'select') && v === '') { out[f.key] = null; return; }
    out[f.key] = v;
  });
  return out;
}

async function save(event) {
  event.preventDefault();
  var isNew = !editing;
  var values = collectValues(isNew);

  // สกอร์ที่กรอกแล้วแปลว่าแข่งจบ — เลื่อนสถานะให้เอง เหมือนกฎเดิมสมัยอ่านจากชีต
  // คนกรอกจะได้ไม่ต้องทำสองขั้นตอนทุกครั้งที่ประกาศผล (แต่ตั้ง "กำลังแข่ง" ทับเองได้)
  if (current.id === 'results' && values.score && values.status === 'upcoming') values.status = 'done';

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
    await refresh();
  } catch (err) {
    setEditorError(friendlyError(err));
  } finally {
    $('saveBtn').disabled = false;
  }
}

async function remove() {
  if (!editing) return;
  if (!confirm('ลบรายการนี้ออกจาก "' + current.title + '" ถาวร?\nการลบย้อนกลับไม่ได้')) return;

  try {
    var res = await db.from(current.table).delete().eq(current.pk, editing[current.pk]);
    if (res.error) throw res.error;
    $('editor').close();
    setSaveState('ลบแล้ว');
    await refresh();
  } catch (err) {
    setEditorError(friendlyError(err));
  }
}

/**
 * ข้อความ error ของ Postgres อ่านไม่รู้เรื่องสำหรับคนกรอกข้อมูล
 * แปลเฉพาะกรณีที่เจอจริงในหน้านี้ ที่เหลือแสดงของเดิมไว้ให้ไล่ปัญหาต่อได้
 */
function friendlyError(err) {
  var code = (err && err.code) || '';
  var msg = (err && err.message) || String(err);

  if (code === '23505' && /schools_one_self/.test(msg)) {
    return 'มีโรงเรียนที่ติ๊ก "เป็นโรงเรียนของเรา" อยู่แล้ว — เอาเครื่องหมายออกจากโรงเรียนเดิมก่อน';
  }
  if (code === '23505') return 'มีรายการนี้อยู่แล้ว (ชื่อหรือรหัสซ้ำกับที่มีอยู่)';
  if (code === '23503') return 'อ้างถึงข้อมูลที่ไม่มีอยู่ — ตรวจว่าเลือกชนิดกีฬาถูกต้อง';
  if (code === '23514') return 'ค่าที่กรอกไม่อยู่ในช่วงที่อนุญาต (จำนวนเหรียญต้องไม่ติดลบ)';
  if (code === '42501' || /row-level security/i.test(msg)) {
    return 'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูล — ต้องถูกเพิ่มในตาราง app_admins ก่อน';
  }
  return 'บันทึกไม่สำเร็จ: ' + msg;
}

function setEditorError(text) {
  var n = $('editorError');
  n.textContent = text;
  n.hidden = !text;
}
function setPanelError(text) {
  var n = $('panelError');
  n.textContent = text;
  n.hidden = !text;
}

var saveStateTimer = null;
function setSaveState(text) {
  $('saveState').textContent = text;
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(function () { $('saveState').textContent = ''; }, 4000);
}

/* =========================================================
   โหลดข้อมูลของหมวดที่เลือก
   ========================================================= */

async function refresh() {
  setPanelError('');
  var q = db.from(current.table).select('*');

  if (current.filter) {
    Object.keys(current.filter).forEach(function (k) { q = q.eq(k, current.filter[k]); });
  }
  current.order.split(',').forEach(function (part) {
    var bits = part.split('.');
    q = q.order(bits[0], { ascending: bits[1] !== 'desc', nullsFirst: false });
  });

  var res = await q;
  if (res.error) {
    rows = [];
    setPanelError('โหลดข้อมูลไม่สำเร็จ: ' + res.error.message);
  } else {
    rows = res.data || [];
  }
  renderGrid();
}

async function loadSports() {
  var res = await db.from('sports').select('id,name,entered,sort_order').order('sort_order', { ascending: true });
  sports = res.data || [];
}

function selectResource(id) {
  current = RESOURCES.filter(function (r) { return r.id === id; })[0] || RESOURCES[0];
  $('panelTitle').textContent = current.title;
  $('panelHint').textContent = current.hint;
  $('addBtn').textContent = '+ เพิ่มใน' + current.title;

  document.querySelectorAll('[data-res]').forEach(function (b) {
    if (b.dataset.res === current.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  // จำหมวดที่เปิดค้างไว้ รีเฟรชหน้าแล้วได้กลับมาที่เดิม ไม่ต้องไล่คลิกใหม่ทุกครั้ง
  try { localStorage.setItem('cms-tab', current.id); } catch (e) {}
  document.getElementById('app').dataset.side = 'closed';
  $('scrim').hidden = true;

  refresh();
}

function renderNav() {
  $('tabNav').innerHTML = RESOURCES.map(function (r) {
    return '<button class="' + NAV_ITEM + '" type="button" data-res="' + r.id + '">' +
      '<i class="icon-mask size-[18px] opacity-80 group-aria-[current=page]/nav:opacity-100" data-ic="' + r.icon + '"></i>' +
      '<span>' + esc(r.title) + '</span></button>';
  }).join('');
  $('tabNav').querySelectorAll('[data-res]').forEach(function (b) {
    b.addEventListener('click', function () { selectResource(b.dataset.res); });
  });
  paintUiIcons($('tabNav'));
}

/* =========================================================
   เข้าสู่ระบบ
   ========================================================= */

function show(screen) {
  ['setupScreen', 'loginScreen', 'app'].forEach(function (id) { $(id).hidden = id !== screen; });
}

async function onSignedIn(session) {
  // ตรวจสิทธิ์กับฐานข้อมูลเสมอ ไม่เชื่อแค่ว่า "ล็อกอินผ่าน"
  // (policy ของ app_admins ยอมให้เห็นแถวเฉพาะคนที่เป็นผู้ดูแลอยู่แล้ว
  //  คนที่ไม่ใช่จึงได้ลิสต์ว่างกลับมา ซึ่งคือคำตอบว่า "ไม่มีสิทธิ์")
  var res = await db.from('app_admins').select('user_id,display_name').eq('user_id', session.user.id);
  if (res.error || !res.data || !res.data.length) {
    await db.auth.signOut();
    show('loginScreen');
    showLoginError('บัญชี ' + session.user.email + ' ยังไม่ได้รับสิทธิ์ผู้ดูแล — แจ้งผู้ดูแลระบบให้เพิ่มบัญชีนี้ในตาราง app_admins');
    return;
  }

  $('userEmail').textContent = res.data[0].display_name || session.user.email;
  show('app');

  await loadSports();
  renderNav();

  var saved = null;
  try { saved = localStorage.getItem('cms-tab'); } catch (e) {}
  selectResource(saved || RESOURCES[0].id);
}

function showLoginError(text) {
  var n = $('loginError');
  n.textContent = text;
  n.hidden = !text;
}

async function onLogin(event) {
  event.preventDefault();
  showLoginError('');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'กำลังเข้าสู่ระบบ…';

  try {
    var res = await db.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    if (res.error) throw res.error;
    $('password').value = '';
    await onSignedIn(res.data.session);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    showLoginError(/invalid login credentials/i.test(msg) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : msg);
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'เข้าสู่ระบบ';
  }
}

/* =========================================================
   เริ่มทำงาน
   ========================================================= */

function initTheme() {
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

  // วาดไอคอนของ [data-ic] ที่มากับ HTML (ปุ่มเมนูบนแถบหัว) — ถ้าไม่เรียก คลาส icon-mask
  // จะย้อมสีทั้งกล่องโดยไม่มีรูปทรงมาครอบ ปุ่มจึงออกมาเป็นสี่เหลี่ยมทึบ
  // (renderNav() เรียกซ้ำอีกครั้งเฉพาะเมนูข้าง เพราะปุ่มชุดนั้นถูกสร้างด้วย JS ทีหลัง)
  paintUiIcons();
}

async function init() {
  initTheme();

  if (!hasSupabase()) { show('setupScreen'); return; }

  db = createClient(SUPABASE_URL, SUPABASE_KEY);

  $('loginForm').addEventListener('submit', onLogin);
  $('logoutBtn').addEventListener('click', async function () {
    await db.auth.signOut();
    location.reload();
  });
  $('addBtn').addEventListener('click', function () { openEditor(null); });
  $('editorForm').addEventListener('submit', save);
  $('cancelBtn').addEventListener('click', function () { $('editor').close(); });
  $('deleteBtn').addEventListener('click', remove);

  // เข้าหน้านี้ครั้งหน้าไม่ต้องล็อกอินใหม่ ถ้า session เดิมยังไม่หมดอายุ
  var res = await db.auth.getSession();
  if (res.data && res.data.session) await onSignedIn(res.data.session);
  else show('loginScreen');
}

init();
