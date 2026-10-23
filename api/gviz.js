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
 *
 * ?bundle=main → { tabs: { "<query ของแท็บ>": ข้อความดิบของ gviz } } แท็บที่ทุกหน้าใช้ในคำตอบเดียว (ดู BUNDLE)
 *   แผนฟรีของ Vercel นับโควตาทุกคำขอ แม้ CDN ตอบจากแคช — เดิมเปิดหนึ่งหน้าขอแท็บละคำขอ 5–6 ครั้ง เหลือครั้งเดียว
 *
 * Google ตอบช้า/ล่ม/จำกัดอัตรา (429) → ตอบชุดล่าสุดที่ดึงสำเร็จจากหน่วยความจำของฟังก์ชันแทน (ดู STALE_MAX_MS)
 *   ไม่งั้นเบราว์เซอร์ทุกเครื่องจะถอยไปยิง Google ตรงพร้อมกัน ซึ่งยิ่งโดนจำกัดอัตราหนักขึ้น
 * คำตอบมี ETag — เบราว์เซอร์ที่มีชุดเดิมอยู่แล้วได้ 304 ไม่ต้องโหลดซ้ำ (ประหยัด bandwidth ของแผนฟรี)
 * scripts/check-consistency.mjs อ่าน DEFAULT_SHEET_ID / ALLOWED / BUNDLE จาก module.exports.internals ไปเทียบกับ sheets.js
 */

const crypto = require('crypto');
const { readSetting } = require('./_settings');

const DEFAULT_SHEET_ID = '1W0kFccDAHhzPUH8kunlGqW6vX5uQRxqYHFJd6xLH0Kw';
const TIMEOUT_MS = 8000;

const SHEET_MEMO_MS = 60 * 1000;   // เปลี่ยนลิงก์ใน CMS แล้วมีผลภายใน ~1 นาที (+ อายุแคช CDN)

function sheetIdFromUrl(url) {
  const s = String(url || '').trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{25,}$/.test(s) ? s : '';
}

/* จำ id ไว้ในตัวฟังก์ชัน (Fluid Compute ใช้ instance ซ้ำ) — ไม่ต้องถาม Supabase ทุกคำขอ
   อ่านไม่สำเร็จ = ใช้ค่าที่จำไว้ล่าสุด (หรือค่าตั้งต้น) แล้วลองใหม่ใน 10 วินาที ไม่ทำให้ชีตล่มตาม Supabase
   known = เคยอ่าน CMS สำเร็จใน instance นี้ · false = ฟังก์ชันเพิ่งเปิดแล้ว Supabase ไม่ตอบ (ล่ม/ถูกพักเพราะไม่มีใช้งาน)
   id ตอนนั้นเป็นแค่การเดาว่าเป็นชีตตั้งต้น — บอกเบราว์เซอร์ทางหัว X-Sheet-Id-Source: default ไม่ให้จำทับ
   และแคช CDN สั้น ๆ ให้กลับมาใช้ชีตที่ตั้งใน CMS ทันทีที่ Supabase ตอบ
   (กันพลาดอีกชั้น: sync-sheets.yml ตรวจทุกรอบว่าลิงก์ใน CMS ยังตรงกับ DEFAULT_SHEET_ID ถ้าไม่ตรงจะขึ้นสีแดงเตือน) */
let memo = { id: DEFAULT_SHEET_ID, at: 0, known: false };
async function currentSheet() {
  if (Date.now() - memo.at < SHEET_MEMO_MS) return memo;
  try {
    memo = { id: sheetIdFromUrl(await readSetting('sheet_url')) || DEFAULT_SHEET_ID, at: Date.now(), known: true };
  } catch (err) {
    memo = { id: memo.id, at: Date.now() - SHEET_MEMO_MS + 10 * 1000, known: memo.known };
  }
  return memo;
}

/* แท็บที่ยอมให้ถาม (ตรงกับค่าคงที่บนหัว public/js/sheets.js) — ถ้ารับ gid อะไรก็ได้
   คนที่ยิงเลขสุ่มจะข้ามแคชไปถึง Google ได้ทุกครั้ง · แท็บที่ไม่อยู่ในรายการได้ 400 แล้วหน้าเว็บยิง Google ตรงเอง */
const ALLOWED = {
  gid: ['1195929060', '1253612074', '2119468784', '1146003336', '1636287265'],
  sheet: ['img']
};

/* ชุดรวม: query ของแท็บแบบที่ fetchGvizTable ใน sheets.js สร้าง — ต้องตรงกับ BUNDLE_QUERIES ใน public/js/sheets.js
   (ไม่ตรง = แท็บนั้นไม่มีในชุด เบราว์เซอร์ขอแยกเองแบบเดิม ยังทำงานแต่เปลืองคำขอ)
   แท็บภาพ (img) ไม่อยู่ในชุด: ตอบช้าที่สุด รวมเข้ามาแล้วทุกหน้าต้องรอมันด้วย */
const BUNDLE = [
  'gid=1195929060&headers=1',   // สถิติเหรียญรางวัล
  'gid=1253612074&headers=0',   // รวมเหรียญ
  'gid=2119468784',             // ผลการแข่งขัน
  'gid=1146003336',             // ตารางการแข่งขัน
  'gid=1636287265&headers=1'    // MVP
];

/* CDN: สดได้ 30 วินาที เลยจากนั้นยังตอบชุดเดิมไปก่อน (สูงสุด 5 นาที) ระหว่างไปดึงชุดใหม่เบื้องหลัง
   ผู้ชมจึงไม่ต้องรอ Google เลย ยกเว้นคนแรกของภูมิภาคหลังเงียบไปนานเกิน 5 นาที */
const CDN_CACHE = 'max-age=30, stale-while-revalidate=300';
/* เบราว์เซอร์จำคำตอบ 15 วินาที — กดเปลี่ยนหน้าในเว็บติด ๆ กันไม่ต้องขอซ้ำ (แต่ละหน้าโหลดข้อมูลชุดเดียวกันทั้งหมด)
   ผลใหม่จึงช้าสุดราว 45 วินาที (CDN 30 + เบราว์เซอร์ 15) */
const BROWSER_CACHE = 'public, max-age=15';
/* คำตอบที่ไม่แน่ใจ (ชุดเก่าตอน Google ล่ม / เดาชีตตอน Supabase ล่ม) แคช CDN แค่ 10 วินาที ให้หายเองเร็วเมื่อต้นทางกลับมา */
const CDN_CACHE_SHORT = 'max-age=10';

/* ชุดล่าสุดที่ดึงสำเร็จ แยกตามชีต + query ของแท็บ (ทั้งหมด 6 แท็บ ไม่กี่ร้อย KB) — ใช้ตอน Google ตอบไม่ได้
   เก่ากว่า STALE_MAX_MS ไม่ใช้แล้ว (ให้เบราว์เซอร์ไปใช้ชุดที่จำไว้เองหรือยิง Google ตรงแทน) */
const STALE_MAX_MS = 30 * 60 * 1000;
const lastGood = new Map();   // sheetId + ' ' + query → { raw, at }

/** ข้อความดิบของ gviz หนึ่งแท็บ · error ที่ gviz ห่อมาเป็น status 200 ถือว่าล้มเหลว (ต้องไม่ค้างอยู่บน CDN) */
async function fetchFresh(sheetId, query) {
  let upstream;
  try {
    upstream = await fetch('https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:json&' + query, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? 'ไม่ตอบภายใน ' + TIMEOUT_MS / 1000 + ' วินาที' : err.message);
  }
  if (!upstream.ok) throw new Error('Google ตอบกลับ ' + upstream.status);
  const raw = await upstream.text();
  if (!/setResponse\(/.test(raw) || !/"status":"ok"/.test(raw)) throw new Error('ชีตตอบกลับในรูปแบบที่ไม่ถูกต้อง');
  return raw;
}

/** { raw, stale } — ดึงไม่สำเร็จแต่มีชุดล่าสุดที่ยังไม่เก่าเกิน = ใช้ชุดนั้น (stale: true) · ไม่มี = throw */
async function fetchRaw(sheetId, query) {
  const key = sheetId + ' ' + query;
  try {
    const raw = await fetchFresh(sheetId, query);
    lastGood.set(key, { raw: raw, at: Date.now() });
    return { raw: raw, stale: false };
  } catch (err) {
    const prev = lastGood.get(key);
    if (prev && Date.now() - prev.at < STALE_MAX_MS) {
      console.warn(query + ': ' + err.message + ' — ตอบชุดเมื่อ ' + Math.round((Date.now() - prev.at) / 1000) + ' วินาทีก่อนแทน');
      return { raw: prev.raw, stale: true };
    }
    throw err;
  }
}

/** ส่งคำตอบ 200 พร้อม ETag · เบราว์เซอร์ส่ง If-None-Match ตรงกัน = 304 ไม่ต้องส่งเนื้อซ้ำ */
function sendCached(req, res, body, contentType, cdnCache) {
  const etag = '"' + crypto.createHash('sha1').update(body).digest('base64url') + '"';
  res.setHeader('ETag', etag);
  res.setHeader('Vercel-CDN-Cache-Control', cdnCache);
  res.setHeader('Cache-Control', BROWSER_CACHE);
  res.setHeader('Content-Type', contentType);
  if ((req.headers || {})['if-none-match'] === etag) return res.status(304).end();
  return res.status(200).send(body);
}

/** ?bundle=main — ถามทุกแท็บในชุดพร้อมกัน แท็บที่พังได้ null (เบราว์เซอร์ขอแท็บนั้นแยกเอง)
    พังบางแท็บ / มีชุดเก่าปน / เดาชีต = แคช CDN สั้น ๆ ไม่ให้ชุดที่ไม่สมบูรณ์ค้างอยู่ครึ่งนาที · พังหมด = 502 ไม่แคช */
async function sendBundle(req, res, sheet) {
  const got = await Promise.all(BUNDLE.map(function (q) {
    return fetchRaw(sheet.id, q).catch(function (err) { console.warn('ชุดรวม ' + q + ': ' + err.message); return null; });
  }));
  const tabs = {};
  BUNDLE.forEach(function (q, i) { tabs[q] = got[i] ? got[i].raw : null; });
  const ok = got.filter(Boolean);
  if (!ok.length) return res.status(502).send('ดึงชีตไม่สำเร็จทุกแท็บ');
  const sure = sheet.known && ok.length === BUNDLE.length && !ok.some(function (g) { return g.stale; });
  return sendCached(req, res, JSON.stringify({ tabs: tabs }), 'application/json; charset=utf-8', sure ? CDN_CACHE : CDN_CACHE_SHORT);
}

/** หัวบอกเบราว์เซอร์ว่าใช้ชีตไหน — default = เดาเอง (อ่าน CMS ไม่ได้) อย่าจำทับ ดู rememberProxySheet ใน sheets.js */
function setSheetHeaders(res, sheet) {
  res.setHeader('X-Sheet-Id', sheet.id);
  res.setHeader('X-Sheet-Id-Source', sheet.known ? 'cms' : 'default');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'X-Sheet-Id, X-Sheet-Id-Source');
  res.setHeader('Cache-Control', 'no-store');

  const q = req.query || {};
  if (q.bundle === 'main') {
    const sheet = await currentSheet();
    setSheetHeaders(res, sheet);
    return sendBundle(req, res, sheet);
  }

  const gid = typeof q.gid === 'string' ? q.gid : '';
  const sheet = typeof q.sheet === 'string' ? q.sheet : '';
  const headers = typeof q.headers === 'string' ? q.headers : '';
  if ((gid ? ALLOWED.gid.indexOf(gid) < 0 : ALLOWED.sheet.indexOf(sheet) < 0) || (headers && !/^[01]$/.test(headers))) {
    return res.status(400).send('แท็บนี้ไม่อยู่ในรายการที่ตัวกลางให้บริการ (ALLOWED ใน api/gviz.js)');
  }

  const current = await currentSheet();
  setSheetHeaders(res, current);
  let got;
  try {
    got = await fetchRaw(current.id, (gid ? 'gid=' + gid : 'sheet=' + encodeURIComponent(sheet)) + (headers ? '&headers=' + headers : ''));
  } catch (err) {
    return res.status(502).send('ดึงชีตไม่สำเร็จ: ' + err.message);
  }
  return sendCached(req, res, got.raw, 'text/plain; charset=utf-8', current.known && !got.stale ? CDN_CACHE : CDN_CACHE_SHORT);
};

module.exports.internals = { DEFAULT_SHEET_ID: DEFAULT_SHEET_ID, ALLOWED: ALLOWED, BUNDLE: BUNDLE };
