/* =========================================================
   proxy.js — ที่อยู่ของตัวกลางแคชบน Vercel (โฟลเดอร์ api/ ที่รากโปรเจกต์)
     api/gviz   ข้อมูล Google Sheets  (ใช้ใน sheets.js)
     api/drive  รายชื่อไฟล์ใน Drive    (ใช้ใน drive-photos.js)

   บนเครื่องตัวเองกับบน Vercel ใช้ /api/ ของโดเมนเดียวกัน (server.js เสิร์ฟให้บนเครื่อง)
   ที่อื่น (GitHub Pages ซึ่งรันโค้ดฝั่งเซิร์ฟเวอร์ไม่ได้) ข้ามไปเรียกที่ Vercel
   สคริปต์ Node (import-sheets.mjs) ไม่มี location → '' = ไม่ใช้ตัวกลาง ยิงต้นทางตรง
   ========================================================= */

/* บนเครื่องตัวเอง /api/ มีเฉพาะตอนรัน npm start (server.js พอร์ต 3000) — เปิดผ่านเซิร์ฟเวอร์ไฟล์นิ่งอื่น
   (เช่น Live Server ของ VS Code พอร์ต 5500) ไม่มี /api/ ทุกคำขอได้ 404 ก่อนถอยไปต้นทาง จึงยิงต้นทางตรงเลย ('') */
var LOCAL = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export var PROXY_ORIGIN = typeof location === 'undefined' ? '' :
  LOCAL ? (location.port === '3000' ? location.origin : '') :
  /\.vercel\.app$/.test(location.hostname) ? location.origin
    : 'https://satit-sports-dashboard-one.vercel.app';
