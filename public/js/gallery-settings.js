/* =========================================================
   gallery-settings.js — ค่าตั้งของหน้าประมวลภาพที่แก้ได้จากหน้า CMS (admin/ → ประมวลภาพ)

   เก็บในตาราง site_settings ของ Supabase (ตารางเดิม อ่านได้ทุกคน เขียนได้เฉพาะผู้ดูแล)
     gallery_drive_folder    ลิงก์โฟลเดอร์แม่ใน Google Drive
     gallery_hidden_folders  ชื่อโฟลเดอร์ที่ไม่แสดงบนเว็บ บรรทัดละชื่อ
   ใช้ร่วมกันสองฝั่ง: หน้าประมวลภาพ (อ่าน) และหน้า CMS (เขียน) — ชื่อ key อยู่ที่เดียว

   อ่านไม่ได้ / ยังไม่เคยตั้ง / CMS ปิดอยู่ (admin/config.js ว่าง) → คืน {} แล้วหน้าเว็บใช้ค่าใน gallery-config.js
   ========================================================= */

import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from '../admin/config.js';

export var GALLERY_KEYS = { folder: 'gallery_drive_folder', hidden: 'gallery_hidden_folders' };

// Supabase ช้า/ล่ม ต้องไม่ทำให้หน้าประมวลภาพค้าง — เกินเวลานี้ใช้ค่าในไฟล์ไปเลย
var TIMEOUT_MS = 2500;

/** ข้อความ "บรรทัดละชื่อ" (หรือคั่นด้วยจุลภาค) → รายชื่อโฟลเดอร์ */
export function parseHiddenFolders(text) {
  return String(text || '').split(/[\n,]/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/** @returns {Promise<{ folder?: string, hidden?: string[] }>} — ค่าที่ไม่ได้ตั้งใน CMS จะไม่มีใน object */
export async function loadGallerySettings() {
  if (!hasSupabase()) return {};
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var url = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/site_settings?select=key,value&key=in.(' +
      GALLERY_KEYS.folder + ',' + GALLERY_KEYS.hidden + ')';
    var res = await fetch(url, {
      signal: ctrl.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    });
    if (!res.ok) throw new Error('Supabase ' + res.status);
    var out = {};
    (await res.json()).forEach(function (r) {
      if (r.key === GALLERY_KEYS.folder && String(r.value || '').trim()) out.folder = r.value.trim();
      // แถวนี้มีอยู่ = ผู้ดูแลตั้งรายชื่อไว้แล้ว (เว้นว่าง = ไม่ซ่อนอะไร) ใช้แทนค่าในไฟล์เสมอ
      if (r.key === GALLERY_KEYS.hidden) out.hidden = parseHiddenFolders(r.value);
    });
    return out;
  } catch (err) {
    console.warn('อ่านค่าประมวลภาพจาก CMS ไม่ได้ — ใช้ค่าใน gallery-config.js:', err.message || err);
    return {};
  } finally {
    clearTimeout(timer);
  }
}
