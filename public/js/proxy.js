/* =========================================================
   proxy.js — ที่อยู่ของตัวกลางแคชบน Vercel (โฟลเดอร์ api/ ที่รากโปรเจกต์)
     api/gviz   ข้อมูล Google Sheets  (ใช้ใน sheets.js)
     api/drive  รายชื่อไฟล์ใน Drive    (ใช้ใน drive-photos.js)

   บนเครื่องตัวเองกับบน Vercel ใช้ /api/ ของโดเมนเดียวกัน (server.js เสิร์ฟให้บนเครื่อง)
   ที่อื่น (GitHub Pages ซึ่งรันโค้ดฝั่งเซิร์ฟเวอร์ไม่ได้) ข้ามไปเรียกที่ Vercel
   สคริปต์ Node (import-sheets.mjs) ไม่มี location → '' = ไม่ใช้ตัวกลาง ยิงต้นทางตรง
   ========================================================= */

export var PROXY_ORIGIN = typeof location === 'undefined' ? '' :
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /\.vercel\.app$/.test(location.hostname))
    ? location.origin
    : 'https://satit-sports-dashboard-one.vercel.app';
