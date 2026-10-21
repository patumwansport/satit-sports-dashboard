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

/**
 * เรียงตารางเหรียญ ทอง → เงิน → ทองแดง แล้วใส่ r.rank (แก้ในที่ + คืนชุดเดิม)
 * เหรียญเท่ากันทุกสี = อันดับร่วม แบบ 1, 1, 3 — เดิมนับ 1, 2, 3 ตามลำดับแถวในชีต
 * โรงเรียนที่เหรียญเท่ากันจึงได้อันดับต่างกันโดยไม่มีเหตุผล
 * ทั้งงานยังไม่มีใครได้เหรียญ = rank 0 ทุกแถว (หน้าเว็บแสดง "—") ไม่ให้ขึ้นว่าเรา "อันดับ 1" ก่อนเริ่มแข่ง
 */
export function rankMedalTable(rows) {
  rows.sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });
  var any = rows.some(function (r) { return r.gold + r.silver + r.bronze > 0; });
  rows.forEach(function (r, i) {
    var prev = rows[i - 1];
    r.rank = !any ? 0
      : prev && prev.gold === r.gold && prev.silver === r.silver && prev.bronze === r.bronze ? prev.rank
      : i + 1;
  });
  return rows;
}

/** Date (เวลาท้องถิ่น) → 'YYYY-MM-DD' — ไม่ใช้ toISOString() เพราะมันแปลงเป็น UTC ก่อน
    เวลาไทยช่วงเที่ยงคืนถึงเจ็ดโมงเช้าจะกลายเป็นวันก่อนหน้า */
export function isoDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * วันที่ควรโชว์ภาพตอนนี้: วันนี้ (ถ้ามีภาพแล้ว) → วันล่าสุดก่อนวันนี้ที่มีภาพ → วันแรกที่มี
 * ไม่หยิบ "วันล่าสุดในคลัง" ตรง ๆ — โฟลเดอร์วันข้างหน้า (ทีมงานสร้างรอไว้) จะแย่งที่วันนี้
 * @param {string[]} dates - 'YYYY-MM-DD' ที่มีภาพ เรียงเก่า → ใหม่ (photoDates ใน day-photos.js)
 */
export function photoDayNow(dates) {
  var today = isoDate(new Date());
  var past = dates.filter(function (iso) { return iso <= today; });
  return past.length ? past[past.length - 1] : (dates[0] || '');
}

/** สำเนาของ list ที่สลับลำดับแบบสุ่ม (Fisher–Yates) — ไม่แตะ list เดิม */
export function shuffled(list) {
  var out = list.slice();
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = out[i];
    out[i] = out[j]; out[j] = t;
  }
  return out;
}

/**
 * สุ่มภาพไม่เกิน max รูป โดยยังกระจายทุกกีฬา: สุ่มลำดับกีฬา สุ่มรูปในแต่ละกีฬา แล้ววนหยิบกีฬาละรูป
 * (สุ่มจากกองรวมตรง ๆ วันที่กีฬาหนึ่งมี 500 รูป จะได้แต่กีฬานั้นเกือบทั้งแถว) · เปิดหน้าใหม่ได้ชุดใหม่ทุกครั้ง
 * @param {function(object): string} keyOf - กีฬาของรูป
 */
export function pickRandom(list, max, keyOf) {
  var groups = {}, keys = [];
  list.forEach(function (p) {
    var k = keyOf(p) || '';
    if (!groups[k]) { groups[k] = []; keys.push(k); }
    groups[k].push(p);
  });
  var piles = shuffled(keys).map(function (k) { return shuffled(groups[k]); }), picks = [];
  for (var round = 0; picks.length < max; round++) {
    var took = false;
    piles.forEach(function (pile) {
      if (picks.length < max && round < pile.length) { picks.push(pile[round]); took = true; }
    });
    if (!took) break;
  }
  return picks;
}

/** ชื่อยาวเต็มบรรทัดในตารางเหรียญอ่านยาก — ย่อส่วนที่ทุกโรงเรียนมีเหมือนกันทิ้ง */
export function shortSchoolName(name) {
  return String(name || '').trim()
    .replace(/^โรงเรียน/, '')
    .replace(/แห่งมหาวิทยาลัย/, 'ม.')
    .replace(/มหาวิทยาลัยศรีนครินทรวิโรฒ/, 'มศว')
    .replace(/มหาวิทยาลัย/, 'ม.')
    .replace(/สาธิตมศว(?=\s|$)/, 'สาธิต มศว')
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
    โหลดเร็วกว่ารูปเต็มหลายเท่า) · URL ที่ไม่ใช่ Drive ย่อเองไม่ได้ ปล่อยผ่านตามเดิม
    เรียก lh3.googleusercontent.com/d/<id> ตรง ๆ — เดิมใช้ drive.google.com/thumbnail ซึ่งแค่ส่งต่อ (302) มาที่นี่
    ขั้นส่งต่อนั้นวิ่งผ่านคุกกี้บัญชี Google ของผู้ชม เบราว์เซอร์ที่ล็อกอิน Google ไว้ (โดยเฉพาะหลายบัญชี)
    จึงค้างโหลดไม่จบ · เรียกตรงยังเร็วกว่าด้วยเพราะไม่ต้องรอส่งต่อ ถ้าตรงนี้ล้มค่อยถอยไป imageFallbackAt() */
export function imageUrlAt(url, width) {
  var id = driveFileId(url);
  return id ? 'https://lh3.googleusercontent.com/d/' + id + '=w' + width : url;
}
/** ทางสำรองเมื่อ lh3 โหลดไม่ได้: endpoint รูปย่อของ Drive แบบเดิม ('' = ไม่ใช่รูปจาก Drive ไม่มีทางสำรอง) */
export function imageFallbackAt(url, width) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + width : '';
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

export var MONTHS_TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
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
