/* =========================================================
   img-retry.js — รูปจาก Google Drive ที่โหลดไม่ขึ้น: สลับลิงก์สำรอง แล้วลองซ้ำแบบเว้นระยะ ก่อนยอมแพ้

   รูปทุกรูปโหลดจากเซิร์ฟเวอร์ของ Google ตรงจากเครื่องผู้ชม (lh3.googleusercontent.com) ไม่ผ่านแคชของเรา
   คนดูในสนามส่วนใหญ่ใช้ Wi-Fi เดียวกัน = IP เดียวกันในสายตา Google เปิดดูรูปพร้อมกันมาก ๆ Google จะตอบ 429
   (ขอถี่เกิน) ชั่วครู่ ซึ่งรอสักพักก็หาย — เดิมลองลิงก์สำรองครั้งเดียวแล้วยอมแพ้ ผู้ชมเห็นรูปแตกค้างทั้งที่ไฟล์ปกติ

   ลำดับ: ลิงก์หลัก (lh3) → ลิงก์สำรอง (data-fb · drive.google.com/thumbnail) ทันที
          → รอ ~2 / ~6 / ~15 วินาที สลับลองลิงก์หลักกับสำรอง → ยังไม่ได้ = ยอมแพ้
   ระยะรอสุ่มบวกลบ 25% — รูปที่พังพร้อมกันทั้งหน้าจะได้ไม่กลับไปขอพร้อมกันอีกรอบ

   ใช้กับ <img> ที่มี data-fb เท่านั้น (รูปจาก Drive ที่หน้าเว็บใส่ลิงก์สำรองไว้) รูปอื่นไม่ยุ่ง
   ดัก error แบบ capture ที่ document ตัวเดียว (error ของรูปไม่ bubble) แล้ว stopPropagation ระหว่างยังลองอยู่
   ตัวดัก error ของแต่ละหน้า (ขึ้น "โหลดภาพนี้ไม่ได้" / มาสคอตแทน) จึงทำงานเฉพาะตอนยอมแพ้จริงเท่านั้น
   common.js import ไฟล์นี้ให้ทุกหน้าแล้ว
   ========================================================= */

var DELAYS_MS = [2000, 6000, 15000];

document.addEventListener('error', function (e) {
  var img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  var d = img.dataset;

  // ครั้งแรก: จำลิงก์ทั้งสองไว้ แล้วสลับไปลิงก์สำรองทันที
  if (d.fb) {
    d.retryA = img.getAttribute('src') || '';
    d.retryB = d.fb;
    d.retryN = '0';
    delete d.fb;
    e.stopPropagation();
    img.src = d.retryB;
    return;
  }
  if (d.retryN == null) return;

  var n = Number(d.retryN);
  if (n >= DELAYS_MS.length) {   // ยอมแพ้ — ปล่อยให้ตัวดักของหน้าจัดการต่อ
    delete d.retryN;
    return;
  }
  d.retryN = String(n + 1);
  e.stopPropagation();
  setTimeout(function () {
    if (img.isConnected) img.src = n % 2 === 0 ? d.retryA : d.retryB;
  }, DELAYS_MS[n] * (0.75 + Math.random() * 0.5));
}, true);
