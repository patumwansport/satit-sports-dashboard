/**
 * api/_settings.js — อ่านค่าตั้งของเว็บจาก Supabase (ตาราง site_settings) ให้ตัวกลาง api/gviz.js และ api/drive.js
 * ชื่อขึ้นต้นด้วย _ = Vercel ไม่ทำเป็น endpoint (ไฟล์นี้เป็นแค่โค้ดที่ใช้ร่วมกัน)
 *
 * Supabase ชุดเดียวกับ public/admin/config.js (publishable key เปิดเผยได้ อ่าน site_settings ได้อย่างเดียว)
 * ตั้ง env SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY บน Vercel เพื่อทับได้
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrnblsmwfixxijawaevl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_1zfYu-Mhs9R0jJYWVNxDPw_r-C230n9';

/** ค่าของ key นั้น ('' = ยังไม่ได้ตั้ง) · Supabase ไม่ตอบใน 2 วินาที/ตอบ error = throw (ผู้เรียกตัดสินใจเองว่าจะใช้ค่าไหนแทน) */
async function readSetting(key) {
  const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/site_settings?select=value&key=eq.' + encodeURIComponent(key), {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    signal: AbortSignal.timeout(2000)
  });
  if (!res.ok) throw new Error('Supabase ' + res.status);
  const rows = await res.json();
  return String((rows[0] && rows[0].value) || '').trim();
}

module.exports = { readSetting };
