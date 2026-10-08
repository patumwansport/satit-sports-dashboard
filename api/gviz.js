/**
 * api/gviz.js — ตัวกลางแคชข้อมูล Google Sheets (Vercel Function)
 * -------------------------------------------------------------
 * เดิมเบราว์เซอร์ทุกเครื่องยิง gviz ของ Google เอง ผู้ชม 5,000 คน = คำขอหลายหมื่นครั้งเข้าชีตไฟล์เดียว
 * ซึ่ง Google ชะลอหรือตอบ error ได้โดยไม่บอกล่วงหน้า
 * ไฟล์นี้ดึงแท็บให้แล้วบอก CDN ของ Vercel ให้เก็บคำตอบไว้ 30 วินาที (แยกตาม gid/sheet/headers)
 * ผู้ชมกี่คนก็ตาม Google เห็นแค่ ~2 คำขอต่อนาทีต่อแท็บต่อภูมิภาค และผลใหม่ช้าสุดราวครึ่งนาที
 *
 * ส่งข้อความดิบของ gviz กลับไปตรง ๆ — ตัวแปลงยังอยู่ที่ public/js/sheets.js ที่เดียว
 * GitHub Pages เรียกข้ามโดเมนมาที่นี่ (CORS *) · บนเครื่องตัวเอง server.js เสิร์ฟไฟล์นี้ที่ /api/gviz ด้วย
 * ใช้ได้กับ SHEET_ID ของเราเท่านั้น จะเอาไปเป็นพร็อกซีชีตอื่นไม่ได้
 */

const SHEET_ID = '1BVnQOOoihXIPncU0JWPLL1YcR_Sk3bJTMwtoRDSqQzM';
const TIMEOUT_MS = 8000;

/* CDN: สดได้ 30 วินาที เลยจากนั้นยังตอบชุดเดิมไปก่อน (สูงสุด 5 นาที) ระหว่างไปดึงชุดใหม่เบื้องหลัง
   ผู้ชมจึงไม่ต้องรอ Google เลย ยกเว้นคนแรกของภูมิภาคหลังเงียบไปนานเกิน 5 นาที
   เบราว์เซอร์ไม่แคช (no-store) — แคชมีชั้นเดียวคือ CDN จะได้ไม่ซ้อนอายุกัน */
const CDN_CACHE = 'max-age=30, stale-while-revalidate=300';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const q = req.query || {};
  const gid = typeof q.gid === 'string' ? q.gid : '';
  const sheet = typeof q.sheet === 'string' ? q.sheet : '';
  const headers = typeof q.headers === 'string' ? q.headers : '';
  if ((gid ? !/^\d{1,12}$/.test(gid) : !sheet || sheet.length > 60) || (headers && !/^\d$/.test(headers))) {
    return res.status(400).send('ต้องระบุ gid (ตัวเลข) หรือ sheet (ชื่อแท็บ) อย่างใดอย่างหนึ่ง');
  }

  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&' +
    (gid ? 'gid=' + gid : 'sheet=' + encodeURIComponent(sheet)) + (headers ? '&headers=' + headers : '');

  let raw;
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!upstream.ok) throw new Error('Google ตอบกลับ ' + upstream.status);
    raw = await upstream.text();
  } catch (err) {
    return res.status(502).send('ดึงชีตไม่สำเร็จ: ' + (err.name === 'TimeoutError' ? 'ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : err.message));
  }
  // แคชเฉพาะคำตอบที่ใช้ได้ — error ที่ gviz ห่อมาเป็น status 200 ต้องไม่ค้างอยู่บน CDN
  if (!/setResponse\(/.test(raw) || !/"status":"ok"/.test(raw)) {
    return res.status(502).send('ชีตตอบกลับในรูปแบบที่ไม่ถูกต้อง');
  }

  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(raw);
};
