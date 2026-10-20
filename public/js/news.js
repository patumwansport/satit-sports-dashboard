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
import { MONTHS_TH_FULL, imageUrlAt, imageFallbackAt } from './format.js';

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
/** กรอบการ์ดในแถบข่าวสารของหน้าหลัก — การ์ดแนวตั้ง 3:4 รูปเต็มใบ · จอใหญ่กว้าง 1/5 ของแถบ (gap-4 × 4 ช่อง = 4rem) · จอ ≤1180px กว้างคงที่ · เกินแถบเลื่อนแนวนอน */
export var CARD_CLASS = 'group relative isolate flex aspect-[3/4] w-[calc((100%-4rem)/5)] min-w-0 flex-none snap-start flex-col justify-end overflow-hidden rounded-[16px] bg-navy no-underline shadow-[0_4px_16px_oklch(25%_0.08_270/.12)] max-[1180px]:w-[260px] max-[560px]:w-[220px]';
var CARD_LINK = ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
var CALENDAR = '<svg class="size-[17px] flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.5 13.5h1M11.5 13.5h1M15.5 13.5h1M7.5 17h1M11.5 17h1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
var CHEVRON = '<svg class="size-[15px] flex-none transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Date → "7 ตุลาคม 2569" */
function dateLabel(d) {
  return d.getDate() + ' ' + MONTHS_TH_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** การ์ดประกาศหนึ่งใบ: รูปเต็มใบ เงาดำไล่จากล่าง แล้ววันที่ / หัวข้อ / "อ่านเพิ่มเติม" ทับบนรูป
    ไม่มีรูป = พื้นกรมท่าไล่สีแทนรูป และแสดงรายละเอียดเพิ่มใต้หัวข้อ (การ์ดว่างจะได้ไม่โล่ง)
    ประเภท "ข่าวสาร" เป็นค่าปกติ ไม่ติดป้าย · ข่าวดี/แจ้งเตือน/ด่วน ติดป้ายมุมซ้ายบน · มีลิงก์ = ทั้งการ์ดเป็นลิงก์ */
export function newsCard(b) {
  var tone = NEWS_TONE[b.tone] || NEWS_TONE.info;
  var link = safeUrl(b.link_url), img = safeUrl(b.image_url);
  var when = new Date(b.starts_at || b.updated_at || Date.now());
  var title = b.title || b.message || 'ประกาศ';
  var body = b.title ? b.message : '';
  var fb = img ? imageFallbackAt(img, 800) : '';
  var bg = img
    // no-referrer: Drive ตอบ 429 แทนรูปเมื่อเห็น Referer ข้ามโดเมน
    ? '<img class="absolute inset-0 -z-10 block size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" src="' + esc(imageUrlAt(img, 800)) + '"' + (fb ? ' data-fb="' + esc(fb) + '"' : '') +
        ' alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
      // เบลอบาง ๆ เฉพาะช่วงตัวหนังสือด้านล่าง (ยังเห็นรูปลาง ๆ) จางขึ้นไปหารูปชัด + เงาไล่ให้ตัวหนังสือขาวอ่านออกบนรูปสีอ่อน
      '<span class="absolute inset-x-0 bottom-0 -z-10 h-[46%] backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black_60%,transparent)]" aria-hidden="true"></span>' +
      '<span class="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/40 via-30% to-transparent to-60%" aria-hidden="true"></span>'
    : '<span class="absolute inset-0 -z-10 bg-linear-to-br from-navy-2 to-navy" aria-hidden="true"></span>';
  var badge = b.tone && b.tone !== 'info'
    ? '<span class="absolute top-3 left-3 rounded-full px-2.5 py-0.5 fs-13 font-semibold ' + tone.cls + '">' + esc(tone.label) + '</span>'
    : '';
  var inner = bg + badge +
    '<span class="flex flex-col gap-1.5 p-4 pt-10 text-white [text-shadow:0_1px_3px_rgb(0_0_0/.45)]">' +
      '<span class="flex items-center gap-1.5 fs-14 text-white/85">' + CALENDAR + esc(dateLabel(when)) + '</span>' +
      // การ์ดรูปจองที่หัวข้อ 2 บรรทัด และแถวลิงก์เสมอ (ไม่มีลิงก์ = แถวล่องหน) วันที่/หัวข้อของทุกใบในแถวจึงอยู่ระดับเดียวกัน
      '<span class="' + (img ? 'line-clamp-2 min-h-[2.7em]' : 'line-clamp-3') + ' fs-18 leading-[1.35] font-semibold">' + esc(title) + '</span>' +
      (body && !img ? '<span class="line-clamp-4 fs-14 leading-[1.5] text-white/80">' + esc(body) + '</span>' : '') +
      (link || img
        ? '<span class="mt-1.5 flex min-w-0 items-center gap-1.5 fs-14.5 text-white/90 group-hover:text-white' + (link ? '' : ' invisible') + '"' + (link ? '' : ' aria-hidden="true"') + '>' +
            '<span class="truncate">' + 'อ่านเพิ่มเติม' + '</span>' + CHEVRON + '</span>'
        : '') +
    '</span>';
  if (!link) return '<article class="' + CARD_CLASS + '">' + inner + '</article>';
  var external = /^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : '';
  return '<a class="' + CARD_CLASS + CARD_LINK + '" href="' + esc(link) + '"' + external + '>' + inner + '</a>';
}
