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
 * ตอบเฉพาะโฟลเดอร์ของเรา (ALLOWED_ROOTS + โฟลเดอร์ภาพที่ตั้งใน CMS และโฟลเดอร์ย่อยทุกชั้นของมัน) อย่างอื่นได้ 403
 *   ไม่งั้นใครก็ใช้ตัวกลางนี้ไล่อ่านโฟลเดอร์ Drive สาธารณะอื่นได้ โดยกินโควตา Drive ของคีย์เรา
 *   403 = drive-photos.js ถาม Drive ตรงเอง (เช่นปุ่มตรวจลิงก์โฟลเดอร์ใหม่ในหน้า CMS ที่ยังไม่ได้บันทึก)
 *
 * คีย์: ใช้ env GOOGLE_API_KEY ของ Vercel ถ้าตั้งไว้ (ควรตั้ง — ดู README หัวข้อคีย์ Google Drive)
 *   คีย์ฝั่งเซิร์ฟเวอร์ตัวนี้ไม่อยู่ในโค้ดที่ใครก็เปิดดูได้ จำกัดได้แค่ API restrictions = Google Drive API
 *   ถ้าอยู่คนละโปรเจกต์ Google Cloud กับคีย์ของเบราว์เซอร์ โควตาจะแยกกัน คนที่เอาคีย์ในเบราว์เซอร์ไปใช้ก็ทำให้ตัวกลางนี้ช้าไม่ได้
 * ไม่ได้ตั้ง = ใช้คีย์ตัวเดียวกับ public/js/gallery-config.js (BROWSER_KEY — เปิดเผยอยู่แล้ว จำกัด Drive API + โดเมนเรา)
 *   คีย์นั้นจำกัดตาม referer — ฟังก์ชันไม่มี referer ของตัวเอง จึงแนบโดเมน Vercel ของเราไป (อยู่ใน Website restrictions)
 * check-consistency.mjs ตรวจว่า BROWSER_KEY และ ALLOWED_ROOTS ตรงกับ gallery-config.js ทุกครั้งที่ build
 */

const crypto = require('crypto');
const { readSetting } = require('./_settings');

const API = 'https://www.googleapis.com/drive/v3/files';
const BROWSER_KEY = 'AIzaSyC0PsQnP8AasWwvVA668cD7roOuWDHTGuA';
const API_KEY = process.env.GOOGLE_API_KEY || BROWSER_KEY;
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
   แคชในฟังก์ชันอุ่นไว้ 1 นาที และเมื่อหมดอายุจะรอข้อมูลใหม่ก่อนส่งกลับ
   รวมแล้วรูปที่ลงใหม่ขึ้นเว็บภายในราว 2–3 นาที (เดิมจำในฟังก์ชัน 5 นาที ผู้ดูแลลงรูปแล้วรอนานจนคิดว่าไม่ขึ้น — ต.ค. 2569)
   ไล่ทั้งคลังหนึ่งรอบ ~20–100 คำขอ Drive ต่อนาที ยังห่างโควตา 12,000 คำขอ/นาทีมาก */
const TREE_CDN_CACHE = 'max-age=60, stale-while-revalidate=60';

/* จำคำตอบ tree ไว้ในหน่วยความจำของฟังก์ชันด้วย — Vercel ใช้ instance เดิมซ้ำข้ามคำขอ (Fluid Compute)
   และฟังก์ชันอยู่ภูมิภาคเดียว ผู้ชมทุกประเทศ/ทุก edge ที่แคช CDN ยังเย็นจึงได้คำตอบทันทีแทนการไล่ Drive ใหม่
   เก่ากว่า TREE_FRESH_MS จะเริ่มโหลดใหม่และรอผล · ใช้ pending ร่วมกันไม่ให้คำขอพร้อมกันไล่ Drive ซ้ำ */
const TREE_FRESH_MS = 60 * 1000;
const treeMemo = new Map();   // root id → { at, body, pending, ids }

/* โฟลเดอร์แม่ที่ตอบให้ — ตรงกับ DRIVE_FOLDER, DAY_FILES_FOLDER, MEDAL_POSTERS_FOLDER และ AWARD_POSTERS_FOLDER ใน public/js/gallery-config.js
   บวกโฟลเดอร์ภาพที่ผู้ดูแลตั้งใน CMS (site_settings key gallery_drive_folder) จำไว้ 1 นาทีเหมือน api/gviz.js */
const ALLOWED_ROOTS = ['16HYOVkIChgupBn3Z-LMXj5P1gkOmOugW', '1NA19U4btn25-GEucSH2jyXomKYw2VdGV', '1RwWZOo-h52ghy-iNQC6Rwe_mVSD8bxsW', '1xre-DGSZxZSfR9ZZZEpJov6zoPGKjbYF'];
const ROOTS_MEMO_MS = 60 * 1000;
let rootsMemo = { ids: ALLOWED_ROOTS, at: 0 };

function folderIdFromUrl(url) {
  const s = String(url || '').trim();
  const m = /\/folders\/([\w-]{10,})/.exec(s) || /[?&]id=([\w-]{10,})/.exec(s);
  return m ? m[1] : /^[\w-]{10,100}$/.test(s) ? s : '';
}

async function allowedRoots() {
  if (Date.now() - rootsMemo.at < ROOTS_MEMO_MS) return rootsMemo.ids;
  try {
    const cms = folderIdFromUrl(await readSetting('gallery_drive_folder'));
    rootsMemo = { ids: cms && ALLOWED_ROOTS.indexOf(cms) < 0 ? ALLOWED_ROOTS.concat(cms) : ALLOWED_ROOTS, at: Date.now() };
  } catch (err) {
    // อ่าน CMS ไม่ได้ = ใช้ชุดที่จำไว้ล่าสุด ลองใหม่ใน 10 วินาที
    rootsMemo = { ids: rootsMemo.ids, at: Date.now() - ROOTS_MEMO_MS + 10 * 1000 };
  }
  return rootsMemo.ids;
}

/** โฟลเดอร์นี้เป็นของเราไหม: เป็นโฟลเดอร์แม่ หรืออยู่ในต้นไม้ของโฟลเดอร์แม่ (ใช้ต้นไม้ชุดเดียวกับ ?tree= ที่จำไว้) */
async function isOurFolder(id) {
  const roots = await allowedRoots();
  if (roots.indexOf(id) > -1) return true;
  for (const root of roots) {
    const body = await treeBody(root).catch(function () { return null; });
    if (body && folderIds(root, body).has(id)) return true;
  }
  return false;
}

/** รหัสโฟลเดอร์ทุกชั้นในต้นไม้ (สร้างครั้งเดียวต่อชุด) */
function folderIds(root, body) {
  const entry = treeMemo.get(root);
  if (entry && entry.body === body && entry.ids) return entry.ids;
  const ids = new Set();
  (function walk(node) { ids.add(node.id); node.folders.forEach(walk); })(body.root);
  if (entry && entry.body === body) entry.ids = ids;
  return ids;
}

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

/** ส่ง JSON พร้อม ETag · เบราว์เซอร์ที่มีชุดเดิมอยู่แล้ว (ส่ง If-None-Match ตรงกัน) ได้ 304 ไม่ต้องโหลดทั้งคลัง ~200 KB ซ้ำ */
function sendJson(req, res, body, cdnCache) {
  const text = JSON.stringify(body);
  const etag = '"' + crypto.createHash('sha1').update(text).digest('base64url') + '"';
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', BROWSER_CACHE);
  res.setHeader('Vercel-CDN-Cache-Control', cdnCache);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if ((req.headers || {})['if-none-match'] === etag) return res.status(304).end();
  return res.status(200).send(text);
}

function notOurs(res) {
  return res.status(403).json({ error: { message: 'ตัวกลางตอบเฉพาะโฟลเดอร์ภาพ/DayByDay/ภาพสรุปผล/นักกีฬาดีเด่น ของเว็บนี้ (ALLOWED_ROOTS ใน api/drive.js หรือโฟลเดอร์ที่ตั้งใน CMS)' } });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const query = req.query || {};
  if (typeof query.tree === 'string') {
    if (!/^[\w-]{10,100}$/.test(query.tree)) return res.status(400).json({ error: { message: 'tree ต้องเป็นรหัสโฟลเดอร์ Google Drive' } });
    if ((await allowedRoots()).indexOf(query.tree) < 0) return notOurs(res);
    try {
      return sendJson(req, res, await treeBody(query.tree), TREE_CDN_CACHE);
    } catch (err) {
      if (err instanceof DriveError) return res.status(err.status).json({ error: { message: err.message } });
      return res.status(502).json({ error: { message: err.name === 'TimeoutError' ? 'Drive ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : String(err.message || err) } });
    }
  }
  const parent = typeof query.parent === 'string' ? query.parent : '';
  if (!/^[\w-]{10,100}$/.test(parent)) {
    return res.status(400).json({ error: { message: 'ต้องระบุ parent เป็นรหัสโฟลเดอร์ Google Drive' } });
  }
  if (!(await isOurFolder(parent))) return notOurs(res);
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

  return sendJson(req, res, body, CDN_CACHE);
};

module.exports.internals = { BROWSER_KEY: BROWSER_KEY, ALLOWED_ROOTS: ALLOWED_ROOTS };
