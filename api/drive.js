/**
 * api/drive.js — ตัวกลางแคชรายชื่อไฟล์ในโฟลเดอร์ Google Drive (Vercel Function) ของหน้าประมวลภาพ
 * -------------------------------------------------------------
 * เดิมเบราว์เซอร์ทุกเครื่องถาม Drive API เอง หน้าละ ~20–40 คำขอ ชนโควตา 12,000 คำขอ/นาที/โปรเจกต์
 * ที่ผู้ชมราว 300 คน/นาที — เกินแล้ว Google ตอบ 403 หน้าเว็บถอยไปแท็บ img ในชีตที่มีภาพน้อยกว่ามาก
 * ไฟล์นี้ถามแทนแล้วให้ CDN ของ Vercel เก็บคำตอบของแต่ละโฟลเดอร์ไว้ 60 วินาที ผู้ชมกี่คนก็ใช้โควตาเท่าเดิม
 * รูปที่อัปโหลดใหม่ขึ้นเว็บช้าสุดราว 1 นาที
 *
 * ?parent=<folder id> → { files: [{ id, name, mimeType }] } ครบทุกหน้า (ไล่ nextPageToken ให้แล้ว)
 * ตัวแปลงโครงโฟลเดอร์ยังอยู่ที่ public/js/drive-photos.js ที่เดียว — ที่นี่แค่ถามแทนและแคช
 * ตัวกลางล่ม/ยังไม่ได้ deploy = drive-photos.js ถาม Drive ตรงแบบเดิม
 *
 * คีย์: ตัวเดียวกับ public/js/gallery-config.js (เปิดเผยอยู่แล้ว · จำกัดเฉพาะ Drive API + โดเมนเรา)
 * คีย์จำกัดตาม referer — ฟังก์ชันไม่มี referer ของตัวเอง จึงแนบโดเมน Vercel ของเราไป (อยู่ใน Website restrictions)
 * เปลี่ยนคีย์ = แก้ทั้งสองไฟล์ หรือตั้ง env GOOGLE_API_KEY ใน Vercel
 */

const API = 'https://www.googleapis.com/drive/v3/files';
const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyC0PsQnP8AasWwvVA668cD7roOuWDHTGuA';
const REFERER = 'https://satit-sports-dashboard-one.vercel.app/';
const TIMEOUT_MS = 10000;
const MAX_PAGES = 20;   // หน้าละ 1000 รายการ — โฟลเดอร์เดียวเกินสองหมื่นไฟล์ถือว่าผิดปกติ

/* CDN: สด 60 วินาที เลยจากนั้นตอบชุดเดิมไปก่อน (สูงสุด 10 นาที) ระหว่างถามชุดใหม่เบื้องหลัง
   เบราว์เซอร์ไม่แคช — แคชมีชั้นเดียวคือ CDN */
const CDN_CACHE = 'max-age=60, stale-while-revalidate=600';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const parent = typeof (req.query || {}).parent === 'string' ? req.query.parent : '';
  if (!/^[\w-]{10,100}$/.test(parent)) {
    return res.status(400).json({ error: { message: 'ต้องระบุ parent เป็นรหัสโฟลเดอร์ Google Drive' } });
  }

  let files = [], token = '';
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        q: "'" + parent + "' in parents and trashed = false",
        key: API_KEY,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: '1000',
        orderBy: 'name_natural',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (token) params.set('pageToken', token);
      const upstream = await fetch(API + '?' + params, { headers: { Referer: REFERER }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const json = await upstream.json().catch(function () { return {}; });
      // ส่งสถานะเดิมของ Google ต่อ (404 = ไม่ได้แชร์ / 403 = โควตา/คีย์) — drive-photos.js แปลข้อความให้ผู้ดูแลจากสถานะนี้
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: { message: (json.error && json.error.message) || 'Drive API ' + upstream.status } });
      }
      files = files.concat((json.files || []).map(function (f) { return { id: f.id, name: f.name, mimeType: f.mimeType }; }));
      token = json.nextPageToken || '';
      if (!token) break;
    }
  } catch (err) {
    return res.status(502).json({ error: { message: err.name === 'TimeoutError' ? 'Drive ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : String(err.message || err) } });
  }

  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE);
  return res.status(200).json({ files: files });
};
