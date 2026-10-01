/**
 * scripts/import-sheets.mjs — ย้ายข้อมูลจาก Google Sheets เข้า Supabase (รันครั้งเดียวตอนเริ่มใช้ CMS)
 *
 * ใช้ตัวอ่านชีตตัวเดียวกับที่หน้าเว็บใช้ (public/js/sheets.js) ผลที่ได้จึงตรงกับ
 * สิ่งที่เว็บแสดงอยู่ตอนนี้เป๊ะ ไม่ใช่การตีความชีตใหม่อีกรอบที่อาจคลาดจากของจริง
 *
 * วิธีรัน:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service_role key> \
 *   node scripts/import-sheets.mjs
 *
 * ใช้ service_role key เพราะสคริปต์นี้เขียนข้อมูลโดยไม่ได้ล็อกอินเป็นผู้ดูแล
 * คีย์ตัวนี้ข้าม RLS ได้ทั้งหมด — ส่งผ่าน environment variable เท่านั้น
 * ห้าม commit ลงไฟล์ ห้ามเอาไปใส่ใน public/js/config.js เด็ดขาด
 *
 * รันซ้ำได้: เขียนทับด้วย upsert และล้างตาราง matches ก่อนทุกครั้ง
 * (ชีตไม่มี id ถาวรให้จับคู่รายแถว การ "อัปเดต" จึงทำไม่ได้ นอกจากเขียนใหม่ทั้งชุด)
 * >>> ข้อมูลที่แก้ไว้ในหน้า CMS จะหายถ้ารันซ้ำหลังเริ่มใช้งานจริงแล้ว <<<
 */

import { loadFromSheets } from '../public/js/sheets.js';
// กฎแปลงชีต → แถวตาราง ใช้ร่วมกับปุ่ม "ดึงจาก Google Sheets" ในหน้า admin/
import { sheetRows } from '../public/admin/sheets-sync.js';

// --dry-run: อ่านชีตและแปลงข้อมูลให้ดูว่าจะได้อะไร แต่ไม่เขียนลงฐานข้อมูล
// ใช้ตรวจว่าวันที่/คู่แข่งขันถูกแปลงถูกต้องก่อนจะไปแตะของจริง
const DRY = process.argv.includes('--dry-run');

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!DRY && (!URL_ || !KEY)) {
  console.error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_KEY ก่อนรัน (หรือใส่ --dry-run เพื่อลองดูผลก่อน)');
  process.exit(1);
}

const BASE = (URL_ || '').replace(/\/+$/, '') + '/rest/v1/';
const HEADERS = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

async function rest(method, path, body, extraPrefer) {
  if (DRY) {
    console.log('  [ลองรัน] ' + method + ' ' + path + (Array.isArray(body) ? ' · ' + body.length + ' แถว' : ''));
    if (Array.isArray(body) && body.length) console.log('           ตัวอย่างแถวแรก: ' + JSON.stringify(body[0]));
    return null;
  }
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({}, HEADERS, extraPrefer ? { Prefer: extraPrefer } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(method + ' ' + path + ' → ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function main() {
  console.log('กำลังอ่าน Google Sheets…');
  const data = await loadFromSheets();
  const rows = sheetRows(data);
  rows.skippedDays.forEach((d) => console.warn('  ข้ามวัน "' + d + '" — แปลงเป็นวันที่ไม่ได้'));
  console.log('  โรงเรียน ' + data.medalTable.length + ' · กีฬา ' + data.sports.length +
    ' · ผลการแข่งขัน ' + data.days.length + ' วัน · ผังกำหนดการ ' + data.schedule.length + ' วัน' +
    ' · ภาพ ' + data.photos.length);

  // ---- ตั้งค่าเว็บ ----
  await rest('POST', 'site_settings', rows.settings, 'resolution=merge-duplicates');
  console.log('✓ ตั้งค่าเว็บ');

  // ---- โรงเรียน ----
  // on_conflict=full_name: ชื่อเต็มคือกุญแจธรรมชาติของโรงเรียน (id เป็น uuid ที่ฝั่งชีตไม่มี)
  await rest('POST', 'schools?on_conflict=full_name', rows.schools, 'resolution=merge-duplicates');
  console.log('✓ โรงเรียน ' + data.medalTable.length + ' แถว');

  // ---- กีฬา ----
  await rest('POST', 'sports?on_conflict=id', rows.sports, 'resolution=merge-duplicates');
  console.log('✓ กีฬา ' + rows.sports.length + ' แถว');

  // ---- รายการแข่งขัน ----
  // neq.<uuid ที่เป็นไปไม่ได้> = "ทุกแถว" — PostgREST ปฏิเสธ DELETE ที่ไม่มีเงื่อนไข
  // เพื่อกันการลบทั้งตารางโดยไม่ตั้งใจ จึงต้องเขียนเงื่อนไขที่จริงเสมอมาหลอกมัน
  await rest('DELETE', 'matches?id=neq.00000000-0000-0000-0000-000000000000');
  const matches = rows.matches;
  if (matches.length) await rest('POST', 'matches', matches);
  console.log('✓ รายการแข่งขัน ' + matches.length + ' แถว');

  // ---- ภาพ ----
  // ชีตเก็บลิงก์รูปดิบ แต่ loadFromSheets() แปลงเป็นลิงก์ thumbnail ให้แล้ว
  // เก็บลงฐานข้อมูลได้ตามนั้น — supabase-data.js ปล่อยผ่าน URL ที่ไม่ใช่ลิงก์แชร์ Drive
  if (data.photos.length) {
    await rest('DELETE', 'photos?id=neq.00000000-0000-0000-0000-000000000000');
    await rest('POST', 'photos', rows.photos);
  }
  console.log('✓ ภาพ ' + data.photos.length + ' แถว');

  console.log(DRY
    ? '\nลองรันเสร็จแล้ว — ยังไม่ได้เขียนอะไรลงฐานข้อมูล ตัดคำว่า --dry-run ออกเมื่อพร้อมย้ายจริง'
    : '\nย้ายข้อมูลเสร็จแล้ว — เปิด admin.html เพื่อตรวจและแก้ต่อได้เลย');
}

main().catch((err) => {
  console.error('\nย้ายข้อมูลไม่สำเร็จ:', err.message);
  process.exit(1);
});
