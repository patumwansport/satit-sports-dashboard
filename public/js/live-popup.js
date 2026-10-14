/* =========================================================
   live-popup.js — ป๊อปอัปของปุ่ม "แข่งสด" ในแถบบน: รายการที่มีลิงก์ถ่ายทอดสด (ช่อง Live ในแท็บ "🔒 ตารางการแข่งขัน")
   แยกตามวัน เปิดมาเจอ "วันนี้" ก่อน (ไม่มีรายการวันนี้ = วันถัดไปที่ใกล้ที่สุด) แตะแท็บวันเพื่อดูวันอื่น
   แต่ละรายการเป็นการ์ด: มาสคอตกีฬา + ประเภท + เวลา · กดการ์ดเพื่อไปดูถ่ายทอดสดตามลิงก์ในคอลัมน์ Live

   common.js โหลดไฟล์นี้ตอนกดปุ่มครั้งแรกเท่านั้น (import แบบไดนามิก)
   ดึงแท็บใหม่ทุกครั้งที่เปิด (ตัวกลางแคชไว้ 30 วินาทีอยู่แล้ว) ลิงก์ที่เพิ่งใส่ในชีตจึงโผล่โดยไม่ต้องรีเฟรชหน้า
   ========================================================= */
import { el, esc, sportIcon, sportMascotImg, paintUiIcons } from './common.js';
import { loadLive } from './sheets.js';
import { isoDate } from './format.js';

var TAB = 'flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 fs-14 whitespace-nowrap text-fg' +
  ' hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' +
  ' aria-pressed:border-transparent aria-pressed:bg-brand aria-pressed:text-white aria-pressed:hover:text-white';

/* โทนชมพู–น้ำเงินของงาน: ชมพูแบรนด์ (357) ไล่ไปน้ำเงิน (265) — ใช้กับกรอบมาสคอต */
var GRADIENT = 'bg-[linear-gradient(140deg,oklch(70%_0.19_357),oklch(52%_0.19_268))]';
/** ป้าย "ดูไลฟ์": พื้นแดงทึบ (ผู้ดูแลขอ ต.ค. 2569 — แทนพื้นไล่สีชมพู–น้ำเงินที่เลื่อนวน) + จุดมีวงกระเพื่อม
    (ต้องมี motion-ok ทุกชิ้นที่ขยับ ดู src/input.css) */
var LIVE_PILL = 'relative inline-flex flex-none items-center gap-1.5 rounded-full bg-[oklch(55%_0.22_27)] px-2.5 py-0.5 fs-12.5 font-semibold text-white';
var LIVE_DOT_PING = '<span class="relative flex size-2 flex-none" aria-hidden="true">' +
  '<span class="motion-ok absolute inset-0 rounded-full bg-white motion-safe:animate-live-ping"></span>' +
  '<span class="relative size-2 rounded-full bg-white"></span></span>';

var state = { days: null, iso: '', trigger: null, token: 0 };
var modal = null;

/* ป๊อปอัปไม่มีกรอบใหญ่ครอบ: การ์ดหัว (ชื่อ + แท็บวัน) กับการ์ดรายการแต่ละใบลอยอยู่บนฉากหลังเบลอ
   การ์ดหัวค้างอยู่บน ส่วนรายการเลื่อนได้ */
var FLOAT = 'rounded-[20px] bg-surface shadow-[0_10px_30px_oklch(20%_0.06_270/.18)] dark:border dark:border-line';

function ensureModal() {
  if (modal) return modal;
  // m-auto ต้องมี: preflight ของ Tailwind ล้าง margin ของ <dialog> ทิ้ง กล่องจะไปกองมุมซ้ายบน
  modal = el('dialog', 'm-auto w-[min(560px,calc(100vw-24px))] max-w-none overflow-visible border-0 bg-transparent p-0 text-fg backdrop:bg-[oklch(24%_0.03_260/.35)] backdrop:backdrop-blur-md');
  modal.id = 'liveModal';
  modal.setAttribute('aria-labelledby', 'liveModalTitle');
  modal.innerHTML =
    '<div class="motion-ok flex max-h-[calc(100dvh-32px)] flex-col gap-3 motion-safe:animate-pop-in">' +
      '<div class="relative flex-none px-4 py-3.5 ' + FLOAT + '">' +
        // หัวเป็นตัวหนังสือล้วน ไม่มีไอคอน ชื่อตัวโต (ผู้ดูแลขอ ต.ค. 2569)
        '<div class="min-w-0 pr-11">' +
          '<h2 class="m-0 font-display fs-28 leading-[1.2] font-normal text-brand-strong" id="liveModalTitle">ถ่ายทอดสด</h2>' +
          '<p class="m-0 mt-0.5 fs-13.5 text-fg-mute" data-sub></p>' +
        '</div>' +
        '<button class="absolute top-3 right-3 flex size-[38px] cursor-pointer items-center justify-center rounded-full text-fg-mute hover:bg-surface-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="button" data-close aria-label="ปิดหน้าต่างถ่ายทอดสด">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="mt-3 flex flex-wrap gap-2" data-tabs hidden></div>' +
      '</div>' +
      // p-1: เผื่อที่ให้เงาการ์ดกับลายจุด ไม่ถูกขอบกล่องเลื่อนตัดทิ้ง
      '<div class="-m-1 flex flex-col gap-3 overflow-y-auto overscroll-contain p-1" data-scroll></div>' +
    '</div>';
  document.body.appendChild(modal);

  // คลิกฉากหลัง (นอกการ์ด) หรือปุ่มกากบาท = ปิด — Esc เป็นของ <dialog> อยู่แล้ว
  // ช่องว่างระหว่างการ์ดก็นับเป็นฉากหลัง (ผู้ชมเห็นเป็นพื้นเบลอเหมือนกัน)
  modal.addEventListener('click', function (e) {
    var t = e.target;
    if (t === modal || t.hasAttribute('data-scroll') || (t.closest && t.closest('[data-close]'))) { modal.close(); return; }
    var tab = t.closest && t.closest('[data-iso]');
    if (tab) { state.iso = tab.getAttribute('data-iso'); paint(); }
  });
  modal.addEventListener('close', function () {
    if (state.trigger && document.contains(state.trigger)) state.trigger.focus();
    state.trigger = null;
  });
  return modal;
}

/** วันที่เปิดมาเจอก่อน: วันนี้ > วันถัดไปที่ใกล้ที่สุด > วันล่าสุด (งานจบไปแล้ว) */
function pickDay(days) {
  var today = isoDate(new Date());
  var exact = days.filter(function (d) { return d.iso === today; })[0];
  if (exact) return exact.iso;
  var next = days.filter(function (d) { return d.iso > today; })[0];
  return (next || days[days.length - 1]).iso;
}

/** ลายจุดตกแต่งรอบกรอบมาสคอต (มุมขวาบน + มุมซ้ายล่าง) */
var DOTS = 'pointer-events-none absolute bg-size-[7px_7px]';
var DOTS_PINK = 'bg-[radial-gradient(circle,oklch(76%_0.13_357)_1.6px,transparent_1.9px)]';
var DOTS_BLUE = 'bg-[radial-gradient(circle,oklch(70%_0.12_260)_1.6px,transparent_1.9px)]';

/** การ์ดรายการหนึ่งใบ: มาสคอตกีฬาซ้าย · ชนิดกีฬา / ประเภท / คู่แข่ง / เวลา ขวา
    มีลิงก์ = ทั้งใบกดไปดูถ่ายทอดสดได้ (เป้ากดใหญ่ บนมือถือแตะง่าย) */
function card(i, n) {
  // event = "ชนิดกีฬา — ประเภท" (ดู buildDays) แยกกลับมาให้ประเภทเป็นหัวเรื่องใหญ่
  var cut = i.event.indexOf(' — ');
  var sport = cut > -1 ? i.event.slice(0, cut) : i.event;
  var title = cut > -1 ? i.event.slice(cut + 3) : i.event;
  var detail = i.teams || [i.round && 'รอบ ' + i.round, i.pool && 'สาย ' + i.pool].filter(Boolean).join(' · ');
  if (i.venue) detail = [detail, i.venue].filter(Boolean).join(' · ');
  // มาสคอตลอยขึ้นลงช้า ๆ แต่ละใบเริ่มไม่พร้อมกัน (animation-delay ตามลำดับ) จะได้ไม่ขยับเป็นจังหวะเดียวทั้งรายการ
  var mascot = sportMascotImg(i.sportId, 'motion-ok absolute top-1.5 left-1/2 w-[86%] max-w-none -translate-x-1/2 motion-safe:animate-mascot-float');
  if (mascot) mascot = mascot.replace('<img ', '<img style="animation-delay:-' + (n * 0.7).toFixed(1) + 's" ');
  var tag = i.liveUrl ? 'a' : 'div';

  // การ์ดเลื่อนขึ้นมาทีละใบตอนเปิด (ไล่ช่วงละ 70ms)
  return '<' + tag + ' class="motion-ok group grid flex-none grid-cols-[auto_1fr] items-center gap-4 p-3 pr-4 text-fg no-underline max-[480px]:gap-3 motion-safe:animate-card-in ' + FLOAT +
      (i.liveUrl ? ' hover:ring-2 hover:ring-brand/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' : '') + '"' +
      ' style="animation-delay:' + (n * 70) + 'ms"' +
      (i.liveUrl ? ' href="' + esc(i.liveUrl) + '" target="_blank" rel="noopener" aria-label="ดูถ่ายทอดสด ' + esc(i.event + (i.time ? ' เวลา ' + i.time + ' น.' : '')) + '"' : '') + '>' +
    '<span class="relative block h-[112px] w-[124px] flex-none max-[480px]:h-[100px] max-[480px]:w-[96px]">' +
      '<span class="' + DOTS + ' ' + DOTS_PINK + ' -top-2 -right-2.5 h-14 w-11" aria-hidden="true"></span>' +
      '<span class="' + DOTS + ' ' + DOTS_BLUE + ' -bottom-2 -left-2 h-16 w-7" aria-hidden="true"></span>' +
      '<span class="relative flex size-full items-center justify-center overflow-hidden rounded-[16px] text-white ' + GRADIENT + '">' +
        (mascot || sportIcon(i.sportId, 'size-12')) + '</span>' +
    '</span>' +
    '<span class="flex min-w-0 flex-col self-stretch py-1">' +
      '<span class="flex items-start justify-between gap-2">' +
        // ชื่อชนิดกีฬาล้วน ไม่มีไอคอนนำหน้า (ผู้ดูแลขอ ต.ค. 2569 — มาสคอตซ้ายบอกชนิดกีฬาอยู่แล้ว)
        '<span class="min-w-0 truncate fs-14.5 text-fg-mute">' + esc(sport) + '</span>' +
        (i.liveUrl
          ? '<span class="' + LIVE_PILL + '">' + LIVE_DOT_PING + 'ดูไลฟ์</span>'
          : '<span class="flex-none rounded-full bg-surface-soft px-2.5 py-0.5 fs-12.5 text-fg-mute">ยังไม่มีลิงก์</span>') +
      '</span>' +
      '<span class="mt-1 block fs-19 leading-[1.3] font-semibold text-pretty text-brand-strong max-[480px]:fs-16.5">' + esc(title) + '</span>' +
      '<span class="mt-auto flex items-end justify-between gap-3 pt-2.5">' +
        '<span class="min-w-0 fs-13.5 leading-[1.4] text-fg-mute">' + esc(detail) + '</span>' +
        '<span class="flex-none font-mono fs-15 font-semibold whitespace-nowrap text-brand-ink tabular-nums">' + (i.time ? esc(i.time) + ' น.' : '—') + '</span>' +
      '</span>' +
    '</span>' +
  '</' + tag + '>';
}

/** กล่องข้อความแทนรายการ (กำลังโหลด / ว่าง / โหลดไม่ได้) — เป็นการ์ดลอยแบบเดียวกัน */
function note(text) {
  return '<p class="m-0 flex-none px-4 py-8 text-center fs-14.5 text-fg-mute ' + FLOAT + '">' + text + '</p>';
}

function paint() {
  var tabs = modal.querySelector('[data-tabs]');
  var body = modal.querySelector('[data-scroll]');
  var sub = modal.querySelector('[data-sub]');
  var days = state.days;

  if (days == null) {
    tabs.hidden = true;
    sub.textContent = '';
    body.innerHTML = note('โหลดรายการถ่ายทอดสดไม่สำเร็จ ลองใหม่อีกครั้ง');
    return;
  }
  if (!days.length) {
    tabs.hidden = true;
    sub.textContent = '';
    body.innerHTML = note('ยังไม่มีรายการถ่ายทอดสด');
    return;
  }

  var today = isoDate(new Date());
  var day = days.filter(function (d) { return d.iso === state.iso; })[0] || days[0];
  sub.textContent = (day.iso === today ? 'วันนี้ · ' : '') + day.weekday + ' ' + day.date + ' · ' + day.items.length + ' รายการ';

  // มีวันเดียวไม่ต้องมีแท็บ
  tabs.hidden = days.length < 2;
  tabs.innerHTML = days.map(function (d) {
    return '<button class="' + TAB + '" type="button" data-iso="' + esc(d.iso) + '" aria-pressed="' + (d.iso === day.iso) + '">' +
      esc(d.date) + (d.iso === today ? '<span class="fs-12 opacity-80">วันนี้</span>' : '') + '</button>';
  }).join('');

  body.innerHTML = day.items.map(card).join('');
  body.scrollTop = 0;
  paintUiIcons(modal);
}

/** เปิดป๊อปอัป · trigger = ปุ่มที่กด (คืนโฟกัสเมื่อปิด) */
export async function openLivePopup(trigger) {
  ensureModal();
  state.trigger = trigger || null;
  var token = ++state.token;

  modal.querySelector('[data-tabs]').hidden = true;
  modal.querySelector('[data-sub]').textContent = '';
  modal.querySelector('[data-scroll]').innerHTML = note('กำลังโหลด…');
  paintUiIcons(modal);
  if (!modal.open) modal.showModal();

  var days = await loadLive();
  if (token !== state.token || !modal.open) return; // ปิด/เปิดใหม่ระหว่างรอ — ผลรอบนี้ไม่ใช้แล้ว
  state.days = days;
  if (days && days.length) state.iso = pickDay(days);
  paint();
}
