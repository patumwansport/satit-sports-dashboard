/* =========================================================
   format.js — ตัวช่วยแปลงค่าที่ "แหล่งข้อมูลไหนก็ต้องใช้เหมือนกัน"

   มีแหล่งข้อมูลสองทาง (supabase-data.js กับ sheets.js) ที่ต้องคืน JSON หน้าตาเดียวกันเป๊ะ
   ของพวกนี้จึงต้องอยู่ที่เดียว — ถ้าปล่อยให้แต่ละไฟล์มีสำเนาของตัวเอง วันที่แก้กฎย่อชื่อ
   โรงเรียนแล้วแก้ไม่ครบ เว็บจะแสดงชื่อคนละแบบขึ้นกับว่าวันนั้นโหลดจากแหล่งไหนได้
   ========================================================= */

export var WEEKDAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export var MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** ชื่อโรงเรียนของเรา — ใช้เป็นค่าสำรองเมื่อยังไม่มีแถวที่ติ๊ก "โรงเรียนของเรา" */
export var SELF_SCHOOL_NAME = 'โรงเรียนสาธิตมหาวิทยาลัยศรีนครินทรวิโรฒ ปทุมวัน';

export function pad2(n) { return String(n).padStart(2, '0'); }

/** Date (เวลาท้องถิ่น) → 'YYYY-MM-DD' — ไม่ใช้ toISOString() เพราะมันแปลงเป็น UTC ก่อน
    เวลาไทยช่วงเที่ยงคืนถึงเจ็ดโมงเช้าจะกลายเป็นวันก่อนหน้า */
export function isoDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** ชื่อยาวเต็มบรรทัดในตารางเหรียญอ่านยาก — ย่อส่วนที่ทุกโรงเรียนมีเหมือนกันทิ้ง */
export function shortSchoolName(name) {
  return String(name || '').trim()
    .replace(/^โรงเรียน/, '')
    .replace(/แห่งมหาวิทยาลัย/, 'ม.')
    .replace(/มหาวิทยาลัยศรีนครินทรวิโรฒ/, 'มศว')
    .replace(/มหาวิทยาลัย/, 'ม.')
    .trim();
}

/**
 * ลิงก์แชร์ของ Drive (…/file/d/<id>/view) เป็นหน้าเว็บ ไม่ใช่ไฟล์รูป เอาไปใส่ <img> ตรง ๆ ไม่ได้
 * ต้องแปลงเป็น endpoint รูปย่อของ Drive ซึ่งตอบไฟล์รูปจริงและเปิดให้ฝังข้ามเว็บได้
 * URL อื่นที่ไม่ใช่ Drive ปล่อยผ่านตามเดิม
 */
export function driveFileId(url) {
  var m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?(?:[\w=&]*&)?id=)([\w-]{10,})/.exec(url || '');
  return m ? m[1] : '';
}
export function directImageUrl(url) {
  return imageUrlAt(url, 1600);
}
/** ลิงก์รูปขนาดกว้าง width px — รูปจาก Drive ขอขนาดเล็กได้ (หน้าประมวลภาพใช้ 640 กับรูปย่อในกริด
    โหลดเร็วกว่ารูปเต็มหลายเท่า) · URL ที่ไม่ใช่ Drive ย่อเองไม่ได้ ปล่อยผ่านตามเดิม */
export function imageUrlAt(url, width) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + width : url;
}
/** ลิงก์ดาวน์โหลดไฟล์ต้นฉบับความละเอียดเต็ม — Drive ตอบ Content-Disposition: attachment
    เบราว์เซอร์จึงบันทึกไฟล์เลย ไม่เปิดหน้า Drive (ไฟล์ต้องแชร์แบบ "ทุกคนที่มีลิงก์") · ไม่ใช่ Drive คืน URL เดิม */
export function downloadImageUrl(url) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : url;
}
/** หน้าเปิดไฟล์ต้นฉบับใน Drive (ดาวน์โหลดรูปเต็มความละเอียดได้) — ไม่ใช่ลิงก์ Drive คืน URL เดิม */
export function originalImageUrl(url) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/file/d/' + id + '/view' : url;
}

var MONTHS_TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** ชื่อเดือน (ไทยย่อ/ไทยเต็ม/อังกฤษ) → 0–11 · ไม่รู้จัก = -1 */
function monthIndex(word) {
  var w = String(word || '').replace(/\.$/, '');
  var m = MONTHS_TH.findIndex(function (x) { return x.replace(/\.$/, '') === w; });
  if (m < 0) m = MONTHS_TH_FULL.indexOf(w);
  if (m < 0) m = MONTHS_EN.indexOf(w.slice(0, 3).toLowerCase());
  return m;
}

/**
 * วันที่ที่คนพิมพ์เป็นข้อความ (ช่องในชีต / ชื่อโฟลเดอร์ใน Drive) → 'YYYY-MM-DD' (อ่านไม่ออก = '')
 * รับ: "20/10/2569" · "20/10/69" · "20.12.68" · "2026-10-20" · "20 ต.ค." · "20 ตุลาคม 2569"
 *      "19ธันวาคม2568" (ไม่เว้นวรรค) · "18Dec68" · "24 Dec 2025" · "19 ธันวาคม 2568 (เพิ่มเติม)"
 * ปี พ.ศ. (เกิน 2400) แปลงเป็น ค.ศ. ให้เอง · ปีสองหลักเกิน 50 = พ.ศ. · ไม่ใส่ปี = ปีปัจจุบัน
 */
export function parseThaiDate(text, now) {
  var s = String(text || '')
    .replace(/\([^)]*\)/g, ' ')                       // "(เพิ่มเติม)" ท้ายชื่อโฟลเดอร์
    .replace(/(\d)(?=[^\d\s./-])/g, '$1 ')            // "19ธันวาคม2568" / "18Dec68" → เติมวรรคระหว่างเลขกับตัวอักษร
    .replace(/([^\d\s./-])(?=\d)/g, '$1 ')
    .trim().replace(/\s+/g, ' ');
  if (!s) return '';
  now = now || new Date();
  var d, m, y, hit;

  if ((hit = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { y = +hit[1]; m = +hit[2] - 1; d = +hit[3]; }
  else if ((hit = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s))) { d = +hit[1]; m = +hit[2] - 1; y = hit[3] ? +hit[3] : 0; }
  else if ((hit = /^(\d{1,2}) ?([ก-๙a-zA-Z.]+?)\.? ?(\d{2,4})?$/.exec(s))) {
    d = +hit[1];
    m = monthIndex(hit[2]);
    y = hit[3] ? +hit[3] : 0;
  } else return '';

  if (m < 0 || m > 11 || d < 1 || d > 31) return '';
  if (!y) y = now.getFullYear();
  else if (y < 100) y += y > 50 ? 2500 : 2000;   // "69" = พ.ศ. 2569 · "26" = ค.ศ. 2026
  if (y > 2400) y -= 543;
  return y + '-' + pad2(m + 1) + '-' + pad2(d);
}

/** ป้ายวันที่ที่หน้าเว็บใช้ ("20 ต.ค." + "อังคาร") — รับ Date ที่เป็นเวลาท้องถิ่นแล้ว */
export function dayLabel(date) {
  return { weekday: WEEKDAYS_TH[date.getDay()], label: date.getDate() + ' ' + MONTHS_TH[date.getMonth()] };
}
