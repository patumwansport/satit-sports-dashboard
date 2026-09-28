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
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' : url;
}

/** ป้ายวันที่ที่หน้าเว็บใช้ ("20 ต.ค." + "อังคาร") — รับ Date ที่เป็นเวลาท้องถิ่นแล้ว */
export function dayLabel(date) {
  return { weekday: WEEKDAYS_TH[date.getDay()], label: date.getDate() + ' ' + MONTHS_TH[date.getMonth()] };
}
