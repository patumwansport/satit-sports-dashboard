/* =========================================================
   drive-photos.js — อ่านภาพจากโฟลเดอร์ Google Drive ของฝ่ายประชาสัมพันธ์

   โครงโฟลเดอร์ที่ใช้จริง:
     โฟลเดอร์แม่
       ├── กรีฑา                       ← โฟลเดอร์กีฬา/กิจกรรม
       │     ├── 21 ธันวาคม 2568        ← โฟลเดอร์วัน (ชื่อเขียนได้หลายแบบ ดู parseThaiDate)
       │     │     └── รูป…  (หรือแบ่งโฟลเดอร์ย่อยอีกชั้น เช่น 01, 02 / ม.ต้น, ม.ปลาย — นับรวมเป็นวันนั้น)
       │     └── 22 ธันวาคม 2568
       ├── ลีลาศ                        ← ไม่มีโฟลเดอร์วัน วางรูปไว้ตรง ๆ = เป็นแท็บชื่อ "ลีลาศ"
       └── พิธีเปิดการแข่งขัน            ← เหมือนกัน
   ชื่อโฟลเดอร์ขึ้นต้นด้วย _ หรืออยู่ใน HIDDEN_FOLDERS = ซ่อนจากเว็บ (เช่น การประชุมคณะกรรมการ)

   รูปมีหลายพันรูป จึงโหลดสองจังหวะ:
     1) loadDriveTree()  — อ่านโฟลเดอร์แม่ + โฟลเดอร์กีฬา (~20 คำขอพร้อมกัน) → รู้ว่ามีวันไหน กีฬาไหน
     2) loadUnitPhotos() — อ่านรูปเฉพาะวันที่ผู้ชมเปิดดู (โฟลเดอร์วันของทุกกีฬา ~10–20 คำขอพร้อมกัน)
   ทุกคำขอผ่านตัวกลางแคช api/drive.js (CDN เก็บ 60 วินาที) — โควตา Drive API 12,000 คำขอ/นาที/โปรเจกต์
   จึงไม่ผูกกับจำนวนผู้ชมแล้ว · ตัวกลางใช้ไม่ได้เมื่อไร ถอยไปถามตรง ซึ่งรับได้ ~300 คน/นาที
   ใช้ Drive API v3 ด้วย API key ล้วน ๆ ไม่ต้องล็อกอิน — อ่านได้เพราะโฟลเดอร์แชร์แบบ "ทุกคนที่มีลิงก์"
   ========================================================= */

import { DRIVE_FOLDER, GOOGLE_API_KEY, HIDDEN_FOLDERS } from './gallery-config.js';
import { parseThaiDate } from './format.js';
import { PROXY_ORIGIN } from './proxy.js';

var API = 'https://www.googleapis.com/drive/v3/files';
var FOLDER = 'application/vnd.google-apps.folder';
var TIMEOUT_MS = 12000;
var MAX_DEPTH = 5;

/** ลิงก์แชร์โฟลเดอร์ทั้งเส้น หรือ ID เปล่า ๆ → ID */
export function driveFolderId(value) {
  var s = String(value || '').trim();
  var m = /\/folders\/([\w-]{10,})/.exec(s) || /[?&]id=([\w-]{10,})/.exec(s);
  return m ? m[1] : (/^[\w-]{10,}$/.test(s) ? s : '');
}

/* ค่าที่ใช้จริง — ตั้งต้นจาก gallery-config.js แล้วถูกแทนด้วยค่าจาก CMS (หน้า admin/ → ประมวลภาพ)
   ผ่าน setDriveConfig() ก่อนเริ่มโหลด · CMS ไม่ได้ตั้ง / ต่อ Supabase ไม่ได้ = ใช้ค่าในไฟล์ต่อไป */
var cfg = { folder: DRIVE_FOLDER, hidden: HIDDEN_FOLDERS || [] };

/** @param {{folder?: string, hidden?: string[]}} c - ค่าที่ไม่ได้ส่งมา (undefined) คงค่าเดิมไว้ */
export function setDriveConfig(c) {
  if (c && c.folder != null && driveFolderId(c.folder)) cfg.folder = c.folder;
  if (c && Array.isArray(c.hidden)) cfg.hidden = c.hidden;
}

export function hasDrive() {
  return Boolean(driveFolderId(cfg.folder) && GOOGLE_API_KEY);
}

/** files.list ไล่ครบทุกหน้า (หน้าละไม่เกิน 1000 รายการ) */
async function listAll(q, fields) {
  var out = [], token = '';
  do {
    var params = new URLSearchParams({
      q: q,
      key: GOOGLE_API_KEY,
      fields: 'nextPageToken,files(' + fields + ')',
      pageSize: '1000',
      orderBy: 'name_natural',          // "รูป2" มาก่อน "รูป10" เหมือนที่เห็นใน Drive
      // โฟลเดอร์อยู่ใน Shared Drive ก็อ่านได้ — ไม่ใส่สองค่านี้ API จะมองไม่เห็นไฟล์ในนั้น
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (token) params.set('pageToken', token);

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    var res;
    try {
      res = await fetch(API + '?' + params, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    var json = await res.json().catch(function () { return {}; });
    // ข้อความ error ของ Google บอกสาเหตุตรง ๆ (คีย์ผิด / ยังไม่เปิด Drive API / ถูกจำกัดโดเมน) — ส่งต่อให้เห็นใน console
    if (!res.ok) throw new Error('Drive API ' + res.status + ': ' + ((json.error && json.error.message) || res.statusText));
    out = out.concat(json.files || []);
    token = json.nextPageToken || '';
  } while (token);
  return out;
}

/** ทุกอย่างในโฟลเดอร์เดียว — API key (ผู้ชมไม่ได้ล็อกอิน) ถาม "a in parents or b in parents" ไม่ได้
    Google ตอบ 403 ทันที จึงต้องถามทีละโฟลเดอร์ แล้วยิงพร้อมกันแทน */
async function listChildren(id) {
  var cached = await viaProxy(id);
  return cached || listAll("'" + id + "' in parents and trashed = false", 'id,name,mimeType');
}

/* ถามผ่านตัวกลางแคชบน Vercel (api/drive.js) ก่อน — ผู้ชมทุกคนได้คำตอบชุดเดียวกันจาก CDN ไม่กินโควตา Drive
   ตัวกลางล่ม / ยังไม่ได้ deploy (Vercel ตอบหน้า HTML) / Google ตอบ error → null แล้วถาม Drive ตรงแบบเดิม
   error ของ Google จึงไปโผล่ที่ listAll ซึ่งแปลข้อความไว้แล้ว (เช่นโฟลเดอร์ไม่ได้แชร์) */
async function viaProxy(id) {
  if (!PROXY_ORIGIN) return null;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(PROXY_ORIGIN + '/api/drive?parent=' + encodeURIComponent(id), { cache: 'no-store', signal: ctrl.signal });
    var json = res.ok ? await res.json() : null;
    return json && Array.isArray(json.files) ? json.files : null;
  } catch (err) {
    console.warn('ตัวกลาง Drive ใช้ไม่ได้ (' + (err.name === 'AbortError' ? 'หมดเวลา' : err.message) + ') — ถาม Drive ตรงแทน');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function isFolder(f) { return f.mimeType === FOLDER; }
function isImage(f) { return /^image\//.test(f.mimeType); }

/** ซ่อนจากเว็บ: ขึ้นต้นด้วย _ หรือ # · หรืออยู่ในรายชื่อโฟลเดอร์ที่ซ่อน (CMS / gallery-config.js) */
function hidden(name, list) {
  var n = String(name || '').trim();
  return /^[_#]/.test(n) || (list || cfg.hidden).some(function (h) { return String(h).trim() === n; });
}

/**
 * อ่านโครงโฟลเดอร์ระดับกีฬา → วัน (ไม่อ่านรูป) แล้วจัดเป็น "หน่วย" — หน่วยละหนึ่งกีฬาในหนึ่งวัน
 * ใช้ 1 + จำนวนโฟลเดอร์กีฬา คำขอ (ยิงพร้อมกัน) — พอรู้ว่ามีวันไหนก็สร้างแท็บได้แล้ว
 * @returns {Promise<Array<{ key, sport, roots, exclude, order }>>}
 *   key = 'YYYY-MM-DD' · 'f:ชื่อโฟลเดอร์' (โฟลเดอร์ที่ไม่มีโฟลเดอร์วันข้างใน) · 'none' (ไม่ระบุวัน)
 *   roots = โฟลเดอร์ที่ต้องไล่อ่านรูป (รวมโฟลเดอร์ย่อยทุกชั้น) · exclude = โฟลเดอร์ที่ห้ามไล่เข้า
 */
export async function loadDriveTree() {
  var root = driveFolderId(cfg.folder);
  var top = await listChildren(root);
  var units = [], order = 0;

  // รูปที่วางไว้ในโฟลเดอร์แม่ตรง ๆ (ไม่ไล่เข้าโฟลเดอร์กีฬา)
  if (top.some(isImage)) units.push({ key: 'none', sport: '', roots: [root], exclude: top.filter(isFolder).map(function (f) { return f.id; }), order: order++, shallow: true });

  var tops = top.filter(isFolder).filter(function (f) { return !hidden(f.name); })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'th', { numeric: true }); });
  var kidsOf = await Promise.all(tops.map(function (t) { return listChildren(t.id); }));

  tops.forEach(function (t, i) {
    var name = t.name.trim();
    var kids = kidsOf[i].filter(function (k) { return !hidden(k.name); });
    var dated = kids.filter(function (k) { return isFolder(k) && parseThaiDate(k.name); });
    if (!dated.length) {
      // ไม่มีโฟลเดอร์วัน (พิธีเปิด / ลีลาศ / การประชุม …) — ทั้งโฟลเดอร์เป็นแท็บของมันเอง
      units.push({ key: 'f:' + name, sport: name, roots: [t.id], exclude: [], order: order++ });
      return;
    }
    dated.forEach(function (d) {
      units.push({ key: parseThaiDate(d.name), sport: name, roots: [d.id], exclude: [], order: order++ });
    });
    // ของในโฟลเดอร์กีฬาที่ไม่อยู่ในโฟลเดอร์วันไหน (รูปวางตรง ๆ / โฟลเดอร์ชื่ออื่น) → "ภาพอื่น ๆ"
    if (kids.some(function (k) { return isImage(k) || (isFolder(k) && dated.indexOf(k) < 0); })) {
      units.push({ key: 'none', sport: name, roots: [t.id], exclude: dated.map(function (d) { return d.id; }), order: order++ });
    }
  });
  return units;
}

/** รูปทั้งหมดใต้โฟลเดอร์ (ไล่โฟลเดอร์ย่อยทุกชั้น ชั้นละรอบ ยิงพร้อมกัน) — คืน [{ file, folderName }] */
async function imagesUnder(unit) {
  var out = [];
  var level = unit.roots.map(function (id) { return { id: id, name: '' }; });
  for (var depth = 0; level.length && depth < MAX_DEPTH; depth++) {
    var lists = await Promise.all(level.map(function (f) { return listChildren(f.id); }));
    var next = [];
    lists.forEach(function (items, i) {
      items.forEach(function (it) {
        if (isImage(it)) out.push({ file: it, folderName: level[i].name });
        else if (isFolder(it) && !hidden(it.name) && unit.exclude.indexOf(it.id) < 0 && !unit.shallow) next.push({ id: it.id, name: it.name.trim() });
      });
    });
    level = next;
  }
  return out;
}

/** ชื่อโฟลเดอร์ย่อยที่มีความหมาย (ม.ต้น / รอบชิง) ใช้เป็นคำบรรยายได้ — เลขลำดับล้วน (01, 002) ไม่ใช่ */
function meaningful(name) { return name && !/^[\d\s._-]+$/.test(name) && !parseThaiDate(name); }

/**
 * รูปทั้งหมดของหน่วยที่ให้มา (เช่นทุกกีฬาของวันหนึ่ง)
 * เรียงตามลำดับโฟลเดอร์กีฬา แล้วตามชื่อไฟล์ — ภาพกีฬาเดียวกันอยู่ติดกัน ไม่สลับไปมา
 */
export async function loadUnitPhotos(units) {
  var perUnit = await Promise.all(units.map(imagesUnder));
  var out = [];
  units.forEach(function (u, i) {
    perUnit[i]
      .sort(function (a, b) { return a.file.name.localeCompare(b.file.name, 'en', { numeric: true }); })
      .forEach(function (x) {
        out.push({
          link: 'https://drive.google.com/file/d/' + x.file.id + '/view',
          sportText: u.sport,
          // ชื่อไฟล์จากกล้อง (Tennis-22Dec-2.jpg) ไม่ใช่คำบรรยาย — ใช้ชื่อกีฬา + โฟลเดอร์ย่อยที่มีความหมาย (ม.ต้น)
          caption: [u.sport, meaningful(x.folderName) && x.folderName !== u.sport ? x.folderName : ''].filter(Boolean).join(' · ')
        });
      });
  });
  return out;
}

/**
 * ตรวจลิงก์โฟลเดอร์ก่อนบันทึกในหน้า CMS — อ่านได้ไหม และเจอโฟลเดอร์อะไรบ้าง (ไม่อ่านรูป ใช้ 1 + จำนวนโฟลเดอร์ คำขอ)
 * @returns {Promise<{ ok: boolean, error?: string, folders?: Array<{ name: string, hidden: boolean, days: number }> }>}
 */
export async function checkDriveFolder(link, hiddenList) {
  var id = driveFolderId(link);
  if (!id) return { ok: false, error: 'ไม่ใช่ลิงก์โฟลเดอร์ Google Drive — คัดลอกจากปุ่ม "แชร์" ของโฟลเดอร์ (…/drive/folders/…)' };
  if (!GOOGLE_API_KEY) return { ok: false, error: 'ยังไม่ได้ใส่ GOOGLE_API_KEY ใน public/js/gallery-config.js' };
  try {
    var top = (await listChildren(id)).filter(isFolder)
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'th', { numeric: true }); });
    var kids = await Promise.all(top.map(function (t) { return listChildren(t.id); }));
    return {
      ok: true,
      folders: top.map(function (t, i) {
        return {
          name: t.name.trim(),
          hidden: hidden(t.name, hiddenList),
          days: kids[i].filter(function (k) { return isFolder(k) && parseThaiDate(k.name); }).length
        };
      })
    };
  } catch (err) {
    var msg = err.message || String(err);
    if (/404|not found/i.test(msg)) msg = 'ไม่พบโฟลเดอร์ หรือโฟลเดอร์ยังไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์ดูได้"';
    else if (/referer/i.test(msg)) msg = 'API key ไม่อนุญาตเว็บนี้ — เพิ่ม ' + location.origin + '/* ใน Website restrictions ของคีย์';
    return { ok: false, error: msg };
  }
}
