/**
 * api/drive.js — ตัวกลางแคชรายชื่อไฟล์ในโฟลเดอร์ Google Drive (Vercel Function) ของหน้าประมวลภาพ
 * -------------------------------------------------------------
 * เดิมเบราว์เซอร์ทุกเครื่องถาม Drive API เอง หน้าละ ~20–40 คำขอ ชนโควตา 12,000 คำขอ/นาที/โปรเจกต์
 * ที่ผู้ชมราว 300 คน/นาที — เกินแล้ว Google ตอบ 403 หน้าเว็บถอยไปแท็บ img ในชีตที่มีภาพน้อยกว่ามาก
 * ไฟล์นี้ถามแทนแล้วให้ CDN ของ Vercel เก็บคำตอบของแต่ละโฟลเดอร์ไว้ (ดู CDN_CACHE) ผู้ชมกี่คนก็ใช้โควตาเท่าเดิม
 *
 * ?parent=<folder id>               → { files: [{ id, name, mimeType }] } ครบทุกหน้า (ไล่ nextPageToken ให้แล้ว)
 * ?parent=<folder id>&only=folders  → { files: [เฉพาะโฟลเดอร์], images: มีรูปวางอยู่ตรง ๆ ไหม }
 *   ใช้ตอนอ่านโครงกีฬา → วัน: โฟลเดอร์ที่มีรูปเป็นร้อย (พิธีเปิด 500+ รูป) ถามแบบเต็มใช้เวลา ~6 วินาที
 *   ทั้งหน้าต้องรอโฟลเดอร์ที่ช้าที่สุด — ถามแค่โฟลเดอร์ + มีไฟล์ไหม (1 รายการ) ใช้ไม่ถึงวินาที
 * ?tree=<root folder id>           → { root: { id, name, images: [file id…], folders: [โหนดแบบเดียวกัน…] } }
 *   ทั้งคลังภาพในคำตอบเดียว (ไม่มีชื่อไฟล์ — รหัสรูปเรียงตามชื่อไฟล์แบบที่ Drive แสดงแล้ว)
 *   เดิมเบราว์เซอร์ถามโฟลเดอร์ละคำขอ เป็นสามรอบต่อกัน (โฟลเดอร์แม่ → กีฬา → วัน) รวมกว่าร้อยคำขอ
 *   แคช CDN แยกตามภูมิภาคและแยกตามโฟลเดอร์ ช่วงคนเข้าน้อยแทบทุกคำขอเป็น MISS (0.5–1.3 วินาทีต่อคำขอ)
 *   ผู้ชมรอ 4–5 วินาทีกว่ารูปแรกจะเริ่มโหลด — รวมเป็นคำขอเดียวทำให้แคชอุ่นง่ายและรอแค่รอบเดียว
 *   ราว 7,800 รูป ≈ 280 KB (บีบอัดแล้ว ~200 KB) · เกินขนาดตอบกลับของ Vercel (4.5 MB) ต้องราว 120,000 รูป
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
const FOLDER = 'application/vnd.google-apps.folder';
const TIMEOUT_MS = 10000;
const MAX_PAGES = 20;   // หน้าละ 1000 รายการ — โฟลเดอร์เดียวเกินสองหมื่นไฟล์ถือว่าผิดปกติ
const TREE_DEPTH = 6;   // โฟลเดอร์แม่ → กีฬา → วัน → ช่วง/ระดับชั้น … (ของจริงลึกสุด 4 ชั้น)
const TREE_FOLDERS = 600;   // กันโฟลเดอร์วนลูก/ใหญ่ผิดปกติ (ของจริง ~100 โฟลเดอร์)

/* CDN: สด 2 นาที เลยจากนั้นตอบชุดเดิมทันที (นานสุด 1 วัน) แล้วถามชุดใหม่เบื้องหลังให้คนถัดไป
   เดิมเก็บแค่ 10 นาที ช่วงคนเข้าน้อยแคชหมดเกือบทุกครั้ง ผู้ชมต้องรอ Drive ตอบเอง 1–6 วินาทีต่อโฟลเดอร์
   รูปที่อัปโหลดใหม่ขึ้นเว็บช้าสุดราว 2 นาทีหลังมีคนเปิดดู
   เบราว์เซอร์เก็บ 1 นาที — สลับหน้าหลัก ↔ ประมวลภาพไม่ต้องถามโครงโฟลเดอร์ซ้ำ */
const CDN_CACHE = 'max-age=120, stale-while-revalidate=86400';
const BROWSER_CACHE = 'public, max-age=60';
/* ทั้งคลัง: สด 1 นาที แล้วให้แคช CDN เก่าได้อีกไม่เกิน 1 นาทีระหว่างถามชุดใหม่
   แคชในฟังก์ชันอุ่นไว้ 5 นาที และเมื่อหมดอายุจะรอข้อมูลใหม่ก่อนส่งกลับ */
const TREE_CDN_CACHE = 'max-age=60, stale-while-revalidate=60';

/* จำคำตอบ tree ไว้ในหน่วยความจำของฟังก์ชันด้วย — Vercel ใช้ instance เดิมซ้ำข้ามคำขอ (Fluid Compute)
   และฟังก์ชันอยู่ภูมิภาคเดียว ผู้ชมทุกประเทศ/ทุก edge ที่แคช CDN ยังเย็นจึงได้คำตอบทันทีแทนการไล่ Drive ใหม่
   เก่ากว่า TREE_FRESH_MS จะเริ่มโหลดใหม่และรอผล · ใช้ pending ร่วมกันไม่ให้คำขอพร้อมกันไล่ Drive ซ้ำ */
const TREE_FRESH_MS = 5 * 60 * 1000;
const treeMemo = new Map();   // root id → { at, body, pending }

class DriveError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** files.list ไล่ครบทุกหน้า · limit = หยุดเมื่อได้ครบเท่านี้ (ใช้ถามแค่ว่า "มีไหม") */
async function listAll(q, limit) {
  let files = [], token = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      q: q,
      key: API_KEY,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: String(limit || 1000),
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (!limit) params.set('orderBy', 'name_natural');
    if (token) params.set('pageToken', token);
    const upstream = await fetch(API + '?' + params, { headers: { Referer: REFERER }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await upstream.json().catch(function () { return {}; });
    if (!upstream.ok) throw new DriveError(upstream.status, (json.error && json.error.message) || 'Drive API ' + upstream.status);
    files = files.concat((json.files || []).map(function (f) { return { id: f.id, name: f.name, mimeType: f.mimeType }; }));
    token = json.nextPageToken || '';
    if (!token || limit) break;
  }
  return files;
}

/** ไล่ทั้งต้นไม้ทีละชั้น (โฟลเดอร์ในชั้นเดียวกันถามพร้อมกัน) → โหนด { id, name, images, folders } */
async function crawlTree(rootId) {
  const root = { id: rootId, name: '', images: [], folders: [] };
  let level = [root], count = 1;
  for (let depth = 0; level.length && depth < TREE_DEPTH; depth++) {
    const lists = await Promise.all(level.map(function (node) {
      return listAll("'" + node.id + "' in parents and trashed = false");
    }));
    const next = [];
    lists.forEach(function (files, i) {
      const node = level[i];
      files.forEach(function (f) {
        if (f.mimeType === FOLDER) {
          if (count++ >= TREE_FOLDERS) return;
          const child = { id: f.id, name: f.name, images: [], folders: [] };
          node.folders.push(child);
          next.push(child);
        } else if (/^image\//.test(f.mimeType)) {
          node.images.push(f.id);
        }
      });
    });
    level = next;
  }
  return { root: root };
}

/** คำตอบ tree จากหน่วยความจำ — เมื่อหมดอายุให้รอโหลดข้อมูลใหม่ เพื่อไม่ต่ออายุแคชของชื่อเก่า */
async function treeBody(rootId) {
  let memo = treeMemo.get(rootId);
  const refresh = function () {
    const entry = treeMemo.get(rootId) || {};
    if (!entry.pending) {
      entry.pending = crawlTree(rootId).then(function (body) {
        treeMemo.set(rootId, { at: Date.now(), body: body, pending: null });
        return body;
      }, function (err) {
        entry.pending = null;
        throw err;
      });
      treeMemo.set(rootId, entry);
    }
    return entry.pending;
  };
  if (memo && memo.body) {
    // ไล่ Drive ใหม่ไม่สำเร็จ = ตอบชุดเดิมไปก่อน ดีกว่าให้หน้าประมวลภาพถอยไปโหลดทีละโฟลเดอร์
    if (Date.now() - memo.at > TREE_FRESH_MS) return refresh().catch(function () { return memo.body; });
    return memo.body;
  }
  return refresh();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const query = req.query || {};
  if (typeof query.tree === 'string') {
    if (!/^[\w-]{10,100}$/.test(query.tree)) return res.status(400).json({ error: { message: 'tree ต้องเป็นรหัสโฟลเดอร์ Google Drive' } });
    try {
      const body = await treeBody(query.tree);
      res.setHeader('Cache-Control', BROWSER_CACHE);
      res.setHeader('Vercel-CDN-Cache-Control', TREE_CDN_CACHE);
      return res.status(200).json(body);
    } catch (err) {
      if (err instanceof DriveError) return res.status(err.status).json({ error: { message: err.message } });
      return res.status(502).json({ error: { message: err.name === 'TimeoutError' ? 'Drive ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : String(err.message || err) } });
    }
  }
  const parent = typeof query.parent === 'string' ? query.parent : '';
  if (!/^[\w-]{10,100}$/.test(parent)) {
    return res.status(400).json({ error: { message: 'ต้องระบุ parent เป็นรหัสโฟลเดอร์ Google Drive' } });
  }
  const inParent = "'" + parent + "' in parents and trashed = false";

  let body;
  try {
    if (query.only === 'folders') {
      const both = await Promise.all([
        listAll(inParent + " and mimeType = '" + FOLDER + "'"),
        listAll(inParent + " and mimeType contains 'image/'", 1)
      ]);
      body = { files: both[0], images: both[1].length > 0 };
    } else {
      body = { files: await listAll(inParent) };
    }
  } catch (err) {
    // ส่งสถานะเดิมของ Google ต่อ (404 = ไม่ได้แชร์ / 403 = โควตา/คีย์) — drive-photos.js แปลข้อความให้ผู้ดูแลจากสถานะนี้
    if (err instanceof DriveError) return res.status(err.status).json({ error: { message: err.message } });
    return res.status(502).json({ error: { message: err.name === 'TimeoutError' ? 'Drive ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : String(err.message || err) } });
  }

  res.setHeader('Cache-Control', BROWSER_CACHE);
  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE);
  return res.status(200).json(body);
};
