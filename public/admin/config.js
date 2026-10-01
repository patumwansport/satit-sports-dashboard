/* =========================================================
   admin/config.js — ที่อยู่ Supabase ของ "CMS สำรอง" (โฟลเดอร์ admin/)

   แยกจาก public/js/config.js โดยตั้งใจ:
     - js/config.js      ตัดสินว่า "หน้าเว็บอ่านข้อมูลการแข่งขันจากไหน" (ว่าง = Google Sheets)
     - admin/config.js   เปิดใช้ CMS สำรอง + นับผู้เข้าชม + แบนเนอร์ประกาศ
   กรอกไฟล์นี้อย่างเดียว เว็บยังดึงผลการแข่งขันจากชีตตามเดิม ไม่มีอะไรสลับแหล่งข้อมูล
   วันไหนชีตใช้ไม่ได้ ค่อยกรอก js/config.js ด้วยค่าเดียวกันเพื่อให้หน้าเว็บอ่านจากฐานข้อมูลนี้แทน

   publishable key เปิดเผยได้ (สิทธิ์จริงคุมด้วย RLS) · ห้ามใส่ service_role key ที่นี่เด็ดขาด
   เว้นว่าง = ปิดทั้งระบบ: หน้า admin/ ขึ้นวิธีตั้งค่า และหน้าเว็บสาธารณะไม่ยิงอะไรไป Supabase เลย
   ========================================================= */

export var SUPABASE_URL = 'https://nrnblsmwfixxijawaevl.supabase.co';
export var SUPABASE_KEY = 'sb_publishable_1zfYu-Mhs9R0jJYWVNxDPw_r-C230n9';

export function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
