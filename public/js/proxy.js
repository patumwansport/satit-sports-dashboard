/* =========================================================
   proxy.js — ที่อยู่ของตัวกลางแคชบน Vercel (โฟลเดอร์ api/ ที่รากโปรเจกต์)
     api/gviz   ข้อมูล Google Sheets  (ใช้ใน sheets.js)
     api/drive  รายชื่อไฟล์ใน Drive    (ใช้ใน drive-photos.js)

   บนเครื่องตัวเองกับบน Vercel ใช้ /api/ ของโดเมนเดียวกัน (server.js เสิร์ฟให้บนเครื่อง)
   ที่อื่น (GitHub Pages ซึ่งรันโค้ดฝั่งเซิร์ฟเวอร์ไม่ได้) ข้ามไปเรียกที่ Vercel
   สคริปต์ Node (import-sheets.mjs) ไม่มี location → '' = ไม่ใช้ตัวกลาง ยิงต้นทางตรง
   ========================================================= */

/* บนเครื่องตัวเอง /api/ มีเฉพาะตอนรัน npm start (server.js พอร์ต 3000) — เปิดผ่านเซิร์ฟเวอร์ไฟล์นิ่งอื่น
   (เช่น Live Server ของ VS Code พอร์ต 5500/5501) ไม่มี /api/ จึงใช้ตัวกลางบน Vercel แทน (เปิด CORS ไว้แล้ว)
   ห้ามยิง Drive ตรง: API key จำกัด referer ไว้ที่โดเมนเว็บจริง 127.0.0.1:<พอร์ต> จะโดน 403 */
var LOCAL = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
var VERCEL_ORIGIN = 'https://satit-sports-dashboard-one.vercel.app';
export var PROXY_ORIGIN = typeof location === 'undefined' ? '' :
  LOCAL ? (location.port === '3000' ? location.origin : VERCEL_ORIGIN) :
  /\.vercel\.app$/.test(location.hostname) ? location.origin
    : VERCEL_ORIGIN;
