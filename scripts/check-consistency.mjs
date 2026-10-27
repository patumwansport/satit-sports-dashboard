/**
 * scripts/check-consistency.mjs — ตรวจค่าที่ต้อง "ตรงกันหลายไฟล์" ก่อน build (npm run check · อยู่ใน npm run build แล้ว)
 *
 * เว็บนี้มีค่าคงที่ซ้ำกันข้ามไฟล์โดยจำเป็น (ตัวกลางบน Vercel เป็น CommonJS แยกจากโค้ดเบราว์เซอร์ / Edge Function เป็น Deno)
 * แก้ไฟล์เดียวแล้วลืมอีกไฟล์ = เว็บยังทำงานแต่พังเงียบ ๆ เช่นแท็บข้ามแคชไปยิง Google ทุกครั้ง
 * หรือตัวกลางกลับไปใช้ชีตเก่าตอน Supabase ล่ม — สคริปต์นี้ทำให้ build ล้มแทน ทั้งบน GitHub Pages และ Vercel
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_SHEET_ID, SHEET_TABS, BUNDLE_QUERIES } from '../public/js/sheets.js';
import { DRIVE_FOLDER, DAY_FILES_FOLDER, MEDAL_POSTERS_FOLDER, AWARD_POSTERS_FOLDER, GOOGLE_API_KEY } from '../public/js/gallery-config.js';

const require = createRequire(import.meta.url);
const gviz = require('../api/gviz.js').internals;
const drive = require('../api/drive.js').internals;
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const problems = [];
function same(what, a, b, fix) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) problems.push(what + '\n    ' + x + '\n    ' + y + '\n    → ' + fix);
}
const sorted = (list) => list.slice().sort();
const folderId = (url) => (/\/folders\/([\w-]{10,})/.exec(url) || [])[1] || url;
function grab(file, re, label) {
  const m = re.exec(read(file));
  if (!m) problems.push('หา ' + label + ' ใน ' + file + ' ไม่เจอ — แก้ regex ใน scripts/check-consistency.mjs ให้ตรงกับโค้ด');
  return m ? m[1] : null;
}

// ---- Google Sheets: public/js/sheets.js ↔ api/gviz.js ----
same('DEFAULT_SHEET_ID (sheets.js ↔ api/gviz.js)', DEFAULT_SHEET_ID, gviz.DEFAULT_SHEET_ID, 'แก้ให้ตรงกันทั้งสองไฟล์');
const tabs = SHEET_TABS.map((t) => String(t.source));
same('แท็บที่หน้าเว็บอ่าน (SHEET_TABS) ↔ ALLOWED ใน api/gviz.js',
  { gid: sorted(tabs.filter((t) => /^\d+$/.test(t))), sheet: sorted(tabs.filter((t) => !/^\d+$/.test(t))) },
  { gid: sorted(gviz.ALLOWED.gid), sheet: sorted(gviz.ALLOWED.sheet) },
  'แท็บที่ไม่อยู่ใน ALLOWED จะข้ามแคชไปยิง Google ตรงทุกครั้ง');
same('BUNDLE_QUERIES (sheets.js) ↔ BUNDLE (api/gviz.js)', BUNDLE_QUERIES, gviz.BUNDLE, 'ชุดรวมไม่ตรง = แท็บนั้นขอแยกเอง เปลืองโควตา Vercel');
same('HIDE_HEADER คอลัมน์ "ซ่อนจากเว็บ" (sheets.js ↔ api/gviz.js)',
  grab('public/js/sheets.js', /const HIDE_HEADER = \/(.+)\/;/, 'HIDE_HEADER'), gviz.HIDE_HEADER.source,
  'ไม่ตรง = ตัวกลางกับเส้นทางยิง Google ตรงซ่อนแถวคนละแบบ');

// ---- Google Drive: public/js/gallery-config.js ↔ api/drive.js ----
same('คีย์ Drive ของเบราว์เซอร์ (gallery-config.js ↔ BROWSER_KEY ใน api/drive.js)', GOOGLE_API_KEY, drive.BROWSER_KEY, 'แก้ให้ตรงกัน');
same('โฟลเดอร์ Drive ที่ตัวกลางตอบให้ (gallery-config.js ↔ ALLOWED_ROOTS ใน api/drive.js)',
  sorted([folderId(DRIVE_FOLDER), folderId(DAY_FILES_FOLDER), folderId(MEDAL_POSTERS_FOLDER), folderId(AWARD_POSTERS_FOLDER)].filter(Boolean)), sorted(drive.ALLOWED_ROOTS),
  'โฟลเดอร์ที่ไม่อยู่ในรายการ ตัวกลางตอบ 403 แล้วเบราว์เซอร์ถาม Drive ตรงทุกครั้ง');

// ---- ชื่องาน: sheets.js ↔ supabase-data.js ----
same('ชื่องาน meta.title (sheets.js ↔ supabase-data.js)',
  grab('public/js/sheets.js', /title: '([^']+)'/, 'meta.title'),
  grab('public/js/supabase-data.js', /settings\.title \|\| '([^']+)'/, 'meta.title'),
  'เปลี่ยนชื่องานต้องแก้ทั้งสองไฟล์');

// ---- บัญชีผู้ดูแล: admin.js ↔ Edge Function admin-users ----
// ข้ามบน Vercel: .vercelignore ไม่ส่งโฟลเดอร์ supabase/ ขึ้นไป (GitHub Actions ตรวจส่วนนี้ให้แล้ว)
const FN = 'supabase/functions/admin-users/index.ts';
const hasFn = existsSync(new URL('../' + FN, import.meta.url));
if (hasFn) same('NO_EMAIL_DOMAIN (admin.js ↔ ' + FN + ')',
  grab('public/admin/admin.js', /var NO_EMAIL_DOMAIN = '([^']+)'/, 'NO_EMAIL_DOMAIN'),
  grab(FN, /const NO_EMAIL_DOMAIN = '([^']+)'/, 'NO_EMAIL_DOMAIN'), 'แก้ให้ตรงกัน');
const roleOptions = hasFn && grab('public/admin/admin.js', /var ROLE_OPTIONS = \[([\s\S]*?)\];/, 'ROLE_OPTIONS');
const fnRoles = hasFn && grab(FN, /const ROLES = \[([^\]]*)\]/, 'ROLES');
if (roleOptions && fnRoles) {
  same('ระดับสิทธิ์ (ROLE_OPTIONS ใน admin.js ↔ ROLES ใน ' + FN + ')',
    sorted([...roleOptions.matchAll(/value: '([^']+)'/g)].map((m) => m[1])),
    sorted([...fnRoles.matchAll(/'([^']+)'/g)].map((m) => m[1])),
    'เพิ่มระดับสิทธิ์ = migration check + ROLE_OPTIONS + ROLES');
}

if (problems.length) {
  console.error('ค่าที่ต้องตรงกันหลายไฟล์ไม่ตรงกัน ' + problems.length + ' จุด:\n\n- ' + problems.join('\n\n- '));
  process.exit(1);
}
console.log('✓ ค่าที่ซ้ำกันข้ามไฟล์ตรงกันครบ');
