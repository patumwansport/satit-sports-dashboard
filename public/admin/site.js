/* =========================================================
   admin/site.js — ส่วนของ CMS สำรองที่ทำงานบนหน้าเว็บสาธารณะ
     1) นับผู้เข้าชม: บอก Supabase ว่ามีคนเปิดหน้านี้ (ผ่าน rpc track_visit)
     2) แบนเนอร์ประกาศ: ดึงแบนเนอร์ที่เปิดอยู่มาแสดงบนสุดของ <main>

   ทุกหน้าโหลดไฟล์นี้แยกจากสคริปต์หลักของหน้า และไม่มีใคร import มัน
   พังหรือช้าแค่ไหนก็ไม่ลากแดชบอร์ดพังตาม — ทุกขั้นกลืน error ทิ้งเงียบ ๆ
   admin/config.js ว่าง = ไม่ทำอะไรเลย ไม่มีคำขอออกไปไหน

   ใช้ fetch ตรงเข้า PostgREST ไม่โหลด supabase-js — คนดูเว็บไม่ควรต้องโหลด JS เป็นแสนไบต์
   เพียงเพื่อส่งการนับหนึ่งครั้ง
   ========================================================= */

import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from './config.js';
import { directImageUrl } from '../js/format.js';

var DISMISS_KEY = 'banner-dismissed';

function api(path, init) {
  init = init || {};
  init.headers = Object.assign({
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  }, init.headers || {});
  return fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path, init);
}

/** ชื่อหน้า เช่น 'index.html' — หน้าแรกเปิดผ่าน '/' ก็นับเป็น index.html จะได้ไม่แตกเป็นสองแถว */
function pageName() {
  var last = location.pathname.split('/').pop();
  return last || 'index.html';
}

/* ---------- 1) นับผู้เข้าชม ---------- */

/** รหัสสุ่มประจำเบราว์เซอร์ — ใช้นับ "คนไม่ซ้ำ" โดยไม่ต้องรู้ว่าเป็นใคร */
function visitorId() {
  try {
    var id = localStorage.getItem('visitor-id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem('visitor-id', id);
    }
    return id;
  } catch (e) {
    // โหมดส่วนตัวบางตัวปิด localStorage — ยังนับยอดเปิดหน้าได้ แต่คนเดิมอาจถูกนับซ้ำ
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

function trackVisit() {
  var ref = '';
  // เก็บแค่ชื่อโดเมนที่พามา (เช่น facebook.com) ไม่เก็บ URL เต็มที่อาจมีข้อมูลส่วนตัวติดมา
  // และไม่นับการเดินระหว่างหน้าในเว็บเราเองว่าเป็น "แหล่งที่มา"
  try {
    if (document.referrer) {
      var host = new URL(document.referrer).hostname;
      if (host !== location.hostname) ref = host;
    }
  } catch (e) {}

  // keepalive: คนที่เปิดแล้วกดออกทันทีก็ยังถูกนับ คำขอไม่ถูกยกเลิกตอนปิดหน้า
  api('rpc/track_visit', {
    method: 'POST',
    keepalive: true,
    body: JSON.stringify({ p_path: pageName(), p_visitor: visitorId(), p_referrer: ref })
  }).catch(function () {});
}

/* ---------- 2) แบนเนอร์ประกาศ ---------- */

// เขียนชื่อคลาสเต็มทุกตัว — Tailwind สแกนไฟล์นี้หาคลาส ต่อสตริงจากตัวแปรแล้วคลาสจะไม่ถูกสร้าง
var TONE = {
  info: 'border-brand/25 bg-brand-100 text-brand-strong',
  success: 'border-done/30 bg-done-bg text-done',
  warning: 'border-gold/40 bg-gold/15 text-gold-ink',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive'
};

var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }

/** ลิงก์จากฐานข้อมูลต้องเป็น http(s) หรือ path ในเว็บเท่านั้น — กัน javascript: หลุดเข้า href */
function safeUrl(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w./#?=&-]+$/.test(u) && !/^[a-z]+:/i.test(u)) return u;
  return '';
}

function readDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch (e) { return []; }
}
function dismiss(key) {
  var list = readDismissed().filter(function (k) { return k !== key; });
  list.push(key);
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(list.slice(-30))); } catch (e) {}
}

function bannerHtml(b) {
  var link = safeUrl(b.link_url);
  var img = safeUrl(b.image_url);
  var external = /^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : '';
  var close = '<button class="btn btn-ghost btn-icon btn-sm size-8 flex-none text-current hover:bg-black/5" type="button" data-dismiss aria-label="ปิดประกาศนี้">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';

  if (img) {
    var pic = '<img class="block h-auto max-h-[260px] w-full object-cover" src="' + esc(directImageUrl(img)) + '" alt="' + esc(b.title || b.message || 'ประกาศ') +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />';
    return '<div class="relative overflow-hidden rounded-lg border border-line bg-surface shadow-panel">' +
      (link ? '<a class="block" href="' + esc(link) + '"' + external + '>' + pic + '</a>' : pic) +
      '<div class="absolute top-2 right-2 rounded-full bg-surface/90 text-fg">' + close + '</div></div>';
  }

  var tone = TONE[b.tone] || TONE.info;
  return '<div class="flex items-start gap-3 rounded-lg border px-4 py-3 ' + tone + '" role="status">' +
    '<div class="min-w-0 flex-1 fs-15 leading-[1.55]">' +
      (b.title ? '<strong class="font-semibold">' + esc(b.title) + '</strong> ' : '') +
      (b.message ? '<span>' + esc(b.message) + '</span>' : '') +
      (link ? ' <a class="font-semibold whitespace-nowrap text-current underline underline-offset-2" href="' + esc(link) + '"' + external + '>' +
        esc(b.link_label || 'ดูรายละเอียด') + ' →</a>' : '') +
    '</div>' + close + '</div>';
}

async function showBanners() {
  var main = document.getElementById('main');
  if (!main) return;

  // ช่วงเวลาและสถานะเปิด/ปิดกรองที่ RLS แล้ว ตรงนี้กรองแค่ "แสดงเฉพาะหน้าแรก"
  var res = await api('banners?select=id,title,message,image_url,link_url,link_label,tone,placement,updated_at&order=sort_order.asc,updated_at.desc');
  if (!res.ok) return;
  var list = await res.json();

  var isHome = pageName() === 'index.html';
  var dismissed = readDismissed();
  list = list.filter(function (b) {
    if (b.placement === 'home' && !isHome) return false;
    // ปิดแล้วไม่ขึ้นอีก — แต่ถ้าผู้ดูแลแก้ข้อความ (updated_at เปลี่ยน) ให้ขึ้นใหม่ คนจะได้เห็นฉบับแก้
    return dismissed.indexOf(b.id + '@' + b.updated_at) < 0;
  });
  if (!list.length) return;

  var wrap = document.createElement('section');
  wrap.className = 'flex flex-col gap-2.5';
  wrap.setAttribute('aria-label', 'ประกาศ');
  list.forEach(function (b) {
    var holder = document.createElement('div');
    holder.innerHTML = bannerHtml(b);
    var node = holder.firstChild;
    node.querySelector('[data-dismiss]').addEventListener('click', function () {
      dismiss(b.id + '@' + b.updated_at);
      node.remove();
      if (!wrap.children.length) wrap.remove();
    });
    wrap.appendChild(node);
  });
  main.prepend(wrap);
}

/* ---------- 3) แจ้งการใช้คุกกี้ (PDPA) ----------
   การนับผู้เข้าชมเก็บรหัสสุ่มไว้ในเบราว์เซอร์ จึงแจ้งผู้ชมให้รู้ — ขึ้นครั้งเดียว กด "ยอมรับ" แล้วไม่ขึ้นอีก
   รหัสนั้นไม่ผูกกับตัวบุคคล (ไม่มี IP ชื่อ หรืออีเมล) จึงใช้แบบ "แจ้งให้ทราบ" ไม่ได้หยุดนับระหว่างรอคำตอบ */

var CONSENT_KEY = 'cookie-consent';

function showCookieNotice() {
  try { if (localStorage.getItem(CONSENT_KEY)) return; } catch (e) { return; }   // เก็บค่าไม่ได้ = จะขึ้นทุกหน้า ไม่แสดงดีกว่า

  var box = document.createElement('section');
  box.className = 'fixed right-4 bottom-4 z-[60] w-[min(380px,calc(100vw-32px))] rounded-xl border border-line bg-surface px-5 py-4 text-fg shadow-card motion-safe:animate-pop-in';
  box.setAttribute('aria-label', 'การใช้คุกกี้');
  box.innerHTML =
    '<h2 class="m-0 fs-15.5 font-semibold">คุกกี้บนเว็บไซต์นี้</h2>' +
    '<p class="mt-1.5 mb-0 fs-14 leading-[1.6] text-fg-soft">เราใช้คุกกี้และพื้นที่เก็บข้อมูลในเบราว์เซอร์เท่าที่จำเป็น เพื่อให้เว็บไซต์ทำงานได้ราบรื่นและนับจำนวนผู้เข้าชม</p>' +
    '<div class="mt-2 fs-13.5 leading-[1.6] text-fg-mute" data-more hidden>' +
      '<ul class="m-0 flex list-disc flex-col gap-1 pl-5">' +
        '<li><strong class="font-semibold text-fg-soft">รหัสผู้เข้าชม</strong> — ตัวเลขสุ่มสำหรับนับว่ามีกี่คนเข้าชม ไม่เก็บชื่อ อีเมล หรือ IP และระบุตัวบุคคลไม่ได้</li>' +
        '<li><strong class="font-semibold text-fg-soft">การตั้งค่าหน้าจอ</strong> — โหมดสว่าง/มืด และประกาศที่กดปิดไปแล้ว</li>' +
      '</ul>' +
      '<p class="mt-1.5 mb-0">ลบได้ทุกเมื่อด้วยการล้างข้อมูลเว็บไซต์ในเบราว์เซอร์</p>' +
    '</div>' +
    '<div class="mt-3.5 flex gap-2.5">' +
      '<button class="btn h-9 rounded-full px-5" type="button" data-accept>ยอมรับ</button>' +
      '<button class="btn btn-outline h-9 rounded-full px-5" type="button" data-learn aria-expanded="false">เรียนรู้เพิ่มเติม</button>' +
    '</div>';

  box.querySelector('[data-accept]').addEventListener('click', function () {
    try { localStorage.setItem(CONSENT_KEY, new Date().toISOString()); } catch (e) {}
    box.remove();
  });
  box.querySelector('[data-learn]').addEventListener('click', function () {
    var more = box.querySelector('[data-more]');
    more.hidden = !more.hidden;
    this.setAttribute('aria-expanded', String(!more.hidden));
    this.textContent = more.hidden ? 'เรียนรู้เพิ่มเติม' : 'ย่อรายละเอียด';
  });
  document.body.appendChild(box);
}

if (hasSupabase()) {
  trackVisit();
  showBanners().catch(function () {});
  showCookieNotice();
}
