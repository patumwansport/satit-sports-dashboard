/* =========================================================
   news.js — ประกาศจาก CMS (ตาราง banners ใน Supabase ชุดเดียวกับแบนเนอร์ประกาศของ admin/site.js)
   ใช้กับแถบ "ข่าวสารและไฮไลต์" ของหน้าหลัก — ผู้ดูแลเพิ่ม/แก้/ตั้งเวลาประกาศในหน้า admin/ แล้วขึ้นที่นี่เอง
   ช่วงเวลาแสดงและสถานะเปิด/ปิดกรองที่ RLS แล้ว (ฉบับร่าง/หมดเวลาไม่หลุดมาถึงเบราว์เซอร์)

   admin/config.js ว่าง = ไม่มีคำขอออกไปไหน คืนรายการว่าง · Supabase ล่ม/ช้า = reject ให้หน้าบอกว่าโหลดไม่สำเร็จ
   ใช้ fetch ตรงเข้า PostgREST ไม่โหลด supabase-js เหมือน site.js
   newsCard() ใช้ร่วมกับ CMS (admin/admin.js) เป็นตัวอย่างสดในฟอร์มประกาศ — หน้าตาตรงกับหน้าหลักเสมอ
   ========================================================= */
import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from '../admin/config.js';
import { esc } from './common.js';
import { MONTHS_TH, isoDate, imageUrlAt, imageFallbackAt } from './format.js';

var TIMEOUT_MS = 8000;

/** ลิงก์จากฐานข้อมูลต้องเป็น http(s) หรือ path ในเว็บเท่านั้น — กัน javascript: หลุดเข้า href (กติกาเดียวกับ site.js) */
export function safeUrl(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w./#?=&-]+$/.test(u) && !/^[a-z]+:/i.test(u)) return u;
  return '';
}

/** ประกาศที่กำลังแสดงอยู่ เรียงตามลำดับที่ผู้ดูแลตั้ง แล้วใหม่ก่อน → [{ id, title, message, image_url, link_url, link_label, tone, starts_at, updated_at }] */
export async function loadNews() {
  if (!hasSupabase()) return [];
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl && setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(SUPABASE_URL.replace(/\/+$/, '') +
      '/rest/v1/banners?select=id,title,message,image_url,link_url,link_label,tone,starts_at,updated_at&order=sort_order.asc,updated_at.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      signal: ctrl ? ctrl.signal : undefined
    });
    if (!res.ok) throw new Error('Supabase ตอบ ' + res.status);
    var list = await res.json();
    return Array.isArray(list) ? list.filter(function (b) { return b.title || b.message || b.image_url; }) : [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------- การ์ดประกาศ ---------- */

/** ประเภทประกาศ (ช่อง tone) → ป้ายและสี — เขียนชื่อคลาสเต็ม Tailwind สแกนไฟล์นี้หาคลาส */
export var NEWS_TONE = {
  info: { label: 'ข่าวสาร', cls: 'bg-brand-100 text-brand-strong' },
  success: { label: 'ข่าวดี', cls: 'bg-done-bg text-done' },
  warning: { label: 'แจ้งเตือน', cls: 'bg-gold/15 text-gold-ink' },
  danger: { label: 'ด่วน', cls: 'bg-destructive/10 text-destructive' }
};
/** กรอบการ์ดในแถบข่าวสารของหน้าหลัก — จอ ≤1180px การ์ดกว้างคงที่ เลื่อนแนวนอน */
export var CARD_CLASS = 'group flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-line bg-surface no-underline max-[1180px]:w-[260px] max-[1180px]:flex-none max-[560px]:w-[220px]';
export var CARD_LINK = ' hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
var CLOCK = '<svg class="size-[14px] flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** 'YYYY-MM-DD' → "16 ต.ค. 2569" */
export function isoLabel(iso) {
  var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
  return d.getDate() + ' ' + MONTHS_TH[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** การ์ดประกาศหนึ่งใบ: มีรูป = การ์ดรูป (ป้ายประเภทมุมรูป) · ไม่มีรูป = การ์ดข้อความ · มีลิงก์ = ทั้งการ์ดเป็นลิงก์ */
export function newsCard(b) {
  var tone = NEWS_TONE[b.tone] || NEWS_TONE.info;
  var link = safeUrl(b.link_url), img = safeUrl(b.image_url);
  var when = new Date(b.starts_at || b.updated_at || Date.now());
  var title = b.title || b.message || 'ประกาศ';
  var body = b.title ? b.message : '';
  var fb = img ? imageFallbackAt(img, 800) : '';
  var top = img
    ? '<span class="relative block aspect-[16/10] flex-none overflow-hidden bg-navy">' +
        // no-referrer: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
        '<img class="absolute inset-0 block size-full object-cover" src="' + esc(imageUrlAt(img, 800)) + '"' + (fb ? ' data-fb="' + esc(fb) + '"' : '') +
          ' alt="' + esc(title) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
        '<span class="absolute bottom-0 left-0 rounded-tr-[10px] bg-pink px-3 py-0.5 fs-13 font-semibold text-white">' + esc(tone.label) + '</span>' +
      '</span>'
    : '<span class="flex-none px-3.5 pt-3.5"><span class="inline-flex rounded-full px-2.5 py-0.5 fs-13 font-semibold ' + tone.cls + '">' + esc(tone.label) + '</span></span>';
  var inner = top +
    '<span class="flex flex-1 flex-col gap-1 px-3.5 pt-2.5 pb-3">' +
      '<span class="line-clamp-2 fs-15.5 leading-[1.35] font-semibold text-brand-strong' + (link ? ' group-hover:text-brand' : '') + '">' + esc(title) + '</span>' +
      (body ? '<span class="' + (img ? 'line-clamp-2' : 'line-clamp-5') + ' fs-14 leading-[1.5] text-fg-soft">' + esc(body) + '</span>' : '') +
      '<span class="mt-auto flex items-center gap-1.5 pt-1 fs-13 text-fg-mute">' + CLOCK + esc(isoLabel(isoDate(when))) +
        (link ? '<span class="ml-auto font-semibold text-brand-strong group-hover:text-brand">' + esc(b.link_label || 'ดูรายละเอียด') + ' →</span>' : '') + '</span>' +
    '</span>';
  if (!link) return '<article class="' + CARD_CLASS + '">' + inner + '</article>';
  var external = /^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : '';
  return '<a class="' + CARD_CLASS + CARD_LINK + '" href="' + esc(link) + '"' + external + '>' + inner + '</a>';
}
