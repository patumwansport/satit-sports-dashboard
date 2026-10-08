/**
 * server.js — เว็บเซิร์ฟเวอร์สำหรับ "ดูบนเครื่องตัวเอง" เท่านั้น
 * -------------------------------------------------------------
 * เว็บจริงอยู่บน GitHub Pages ซึ่งเสิร์ฟไฟล์ใน public/ ตรง ๆ ไม่มีโค้ดฝั่งเซิร์ฟเวอร์
 * การดึง Google Sheets ทำในเบราว์เซอร์ (public/js/sheets.js) ผ่านตัวกลางแคช api/gviz.js บน Vercel
 * ไฟล์นี้เสิร์ฟ /api/gviz ตัวเดียวกันให้ด้วย บนเครื่องจะได้ทำงานเหมือนบนเว็บจริง (ไม่มีแคช CDN)
 * มีไว้เพราะหน้าเว็บใช้ fetch กับ ES module ซึ่งเปิดจาก file:// ไม่ได้ ต้องเสิร์ฟผ่าน http://
 *
 * ถ้าอยากใช้ตัวอื่นก็ได้เหมือนกัน เช่น  python3 -m http.server -d public 3000
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/gviz', require('./api/gviz'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n  แดชบอร์ดกีฬาสาธิตสามัคคี พร้อมใช้งาน`);
  console.log(`  เปิดที่  http://localhost:${PORT}\n`);
});
