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
 * ใช้ได้กับชีตของเราและแท็บใน ALLOWED เท่านั้น จะเอาไปเป็นพร็อกซีชีตอื่นไม่ได้
 *
 * "ชีตของเรา" = ลิงก์ที่ผู้ดูแลตั้งในหน้า CMS (site_settings key sheet_url — เขียนได้เฉพาะผู้ดูแลตาม RLS)
 * ไม่ได้ตั้ง / อ่าน Supabase ไม่ได้ = DEFAULT_SHEET_ID (ต้องตรงกับ public/js/sheets.js)
 * บอก id ที่ใช้จริงกลับไปในหัว X-Sheet-Id ให้เบราว์เซอร์จำไว้ใช้ตอนตัวกลางล่ม
 */

const DEFAULT_SHEET_ID = '1W0kFccDAHhzPUH8kunlGqW6vX5uQRxqYHFJd6xLH0Kw';
const TIMEOUT_MS = 8000;

/* Supabase ชุดเดียวกับ public/admin/config.js (publishable key เปิดเผยได้ อ่าน site_settings ได้อย่างเดียว)
   ตั้ง env SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY บน Vercel เพื่อทับได้ */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrnblsmwfixxijawaevl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_1zfYu-Mhs9R0jJYWVNxDPw_r-C230n9';
const SHEET_MEMO_MS = 60 * 1000;   // เปลี่ยนลิงก์ใน CMS แล้วมีผลภายใน ~1 นาที (+ อายุแคช CDN)

function sheetIdFromUrl(url) {
  const s = String(url || '').trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{25,}$/.test(s) ? s : '';
}

/* จำ id ไว้ในตัวฟังก์ชัน (Fluid Compute ใช้ instance ซ้ำ) — ไม่ต้องถาม Supabase ทุกคำขอ
   อ่านไม่สำเร็จ = ใช้ค่าที่จำไว้ล่าสุด (หรือค่าตั้งต้น) แล้วลองใหม่ใน 10 วินาที ไม่ทำให้ชีตล่มตาม Supabase */
let memo = { id: DEFAULT_SHEET_ID, at: 0 };
async function currentSheetId() {
  if (Date.now() - memo.at < SHEET_MEMO_MS) return memo.id;
  try {
    const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/site_settings?select=value&key=eq.sheet_url', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) throw new Error('Supabase ' + res.status);
    const rows = await res.json();
    memo = { id: sheetIdFromUrl(rows[0] && rows[0].value) || DEFAULT_SHEET_ID, at: Date.now() };
  } catch (err) {
    memo = { id: memo.id, at: Date.now() - SHEET_MEMO_MS + 10 * 1000 };
  }
  return memo.id;
}

/* แท็บที่ยอมให้ถาม (ตรงกับค่าคงที่บนหัว public/js/sheets.js) — ถ้ารับ gid อะไรก็ได้
   คนที่ยิงเลขสุ่มจะข้ามแคชไปถึง Google ได้ทุกครั้ง · แท็บที่ไม่อยู่ในรายการได้ 400 แล้วหน้าเว็บยิง Google ตรงเอง */
const ALLOWED = {
  gid: ['1195929060', '1253612074', '2119468784', '1146003336', '1636287265'],
  sheet: ['img']
};

/* CDN: สดได้ 30 วินาที เลยจากนั้นยังตอบชุดเดิมไปก่อน (สูงสุด 5 นาที) ระหว่างไปดึงชุดใหม่เบื้องหลัง
   ผู้ชมจึงไม่ต้องรอ Google เลย ยกเว้นคนแรกของภูมิภาคหลังเงียบไปนานเกิน 5 นาที
   เบราว์เซอร์ไม่แคช (no-store) — แคชมีชั้นเดียวคือ CDN จะได้ไม่ซ้อนอายุกัน */
const CDN_CACHE = 'max-age=30, stale-while-revalidate=300';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'X-Sheet-Id');
  res.setHeader('Cache-Control', 'no-store');

  const q = req.query || {};
  const gid = typeof q.gid === 'string' ? q.gid : '';
  const sheet = typeof q.sheet === 'string' ? q.sheet : '';
  const headers = typeof q.headers === 'string' ? q.headers : '';
  if ((gid ? ALLOWED.gid.indexOf(gid) < 0 : ALLOWED.sheet.indexOf(sheet) < 0) || (headers && !/^[01]$/.test(headers))) {
    return res.status(400).send('แท็บนี้ไม่อยู่ในรายการที่ตัวกลางให้บริการ (ALLOWED ใน api/gviz.js)');
  }

  const sheetId = await currentSheetId();
  res.setHeader('X-Sheet-Id', sheetId);
  const url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:json&' +
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
