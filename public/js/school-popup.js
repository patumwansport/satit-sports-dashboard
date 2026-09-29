/* =========================================================
   school-popup.js — ป๊อปอัปรายละเอียดโรงเรียน (แตะแถว/แท่นในหน้าอันดับเหรียญ)
   แทนหน้า school.html เดิม: ดูอันดับ เหรียญ รายการถัดไป และผลล่าสุดได้โดยไม่ต้องออกจากตาราง

   ใช้ <dialog> ของเบราว์เซอร์แบบเดียวกับป๊อปอัปชนิดกีฬา (sports.js): ปิดด้วย Esc ได้,
   โฟกัสไม่หลุดออกนอกกล่อง และมีฉากหลังให้เอง — ตัว <dialog> สร้างจากไฟล์นี้ หน้า HTML ไม่ต้องเตรียมอะไร
   ========================================================= */
import { el, esc, sportIcon, statusChip, schoolId, schoolKey, findSchool, schoolMatches, schoolCrest } from './common.js';

var MEDALS = [['gold', 1, 'ทอง'], ['silver', 2, 'เงิน'], ['bronze', 3, 'ทองแดง']];
var RESULTS_PREVIEW = 6; // ผลที่ประกาศแล้วแสดงไม่เกินเท่านี้ ป๊อปอัปต้องเป็นกล่องเล็ก ไม่ใช่หน้าใหม่ทั้งหน้า

var state = { data: null, id: '', trigger: null, painted: '' };
var modal = null;

function coin(n, size, label) {
  return '<img class="flex-none ' + size + '" src="assets/medals/coin-' + n + '.webp" alt="' + (label || '') + '"' +
    ' width="64" height="64" decoding="async" />';
}

function ensureModal() {
  if (modal) return modal;
  // m-auto ต้องมี: preflight ของ Tailwind ล้าง margin ของ <dialog> ทิ้ง กล่องจะไปกองมุมซ้ายบน
  modal = el('dialog', 'm-auto w-[min(440px,calc(100vw-24px))] max-w-none border-0 bg-transparent p-0 text-fg backdrop:bg-[oklch(24%_0.03_260/.5)]');
  modal.id = 'schoolModal';
  modal.setAttribute('aria-labelledby', 'schoolModalTitle');
  document.body.appendChild(modal);

  // คลิกฉากหลัง (นอกการ์ด) หรือปุ่มกากบาท = ปิด — Esc เป็นของ <dialog> อยู่แล้ว
  modal.addEventListener('click', function (e) {
    if (e.target === modal || (e.target.closest && e.target.closest('[data-close]'))) modal.close();
  });
  modal.addEventListener('close', function () {
    state.id = '';
    // คืนโฟกัสให้ตัวที่กดเปิด (แถวถูกวาดใหม่ทุกรอบข้อมูล ตัวเก่าอาจหลุดจากหน้าไปแล้ว)
    if (state.trigger && document.contains(state.trigger)) state.trigger.focus();
    state.trigger = null;
  });
  return modal;
}

/** แถวรายการแข่งหนึ่งแถว — ไอคอนกีฬา + ชื่อรายการ + คู่แข่ง · เวลา/สกอร์ชิดขวา */
function matchRow(i, live) {
  return '<li class="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0">' +
    '<span class="flex size-8 flex-none items-center justify-center rounded-[9px] border ' +
      (live ? 'border-[color-mix(in_oklch,var(--color-live)_25%,transparent)] bg-surface text-live' : 'border-line bg-surface-soft text-fg-soft') + '">' +
      sportIcon(i.sportId, 'size-[18px]') + '</span>' +
    '<span class="min-w-0">' +
      '<span class="block text-[15px] leading-[1.35]">' + esc(i.event) + '</span>' +
      '<span class="block text-[13px] leading-[1.35] text-fg-soft">' + esc(i.teams || '') + '</span>' +
    '</span>' +
    '<span class="flex flex-col items-end gap-0.5 text-right">' +
      '<span class="font-mono text-[12.5px] whitespace-nowrap text-fg-mute">' + esc(i.dayLabel) + ' · ' + esc(i.time) + '</span>' +
      // สกอร์แสดงเฉพาะรายการที่แข่งแล้ว: ชีตบางแถวมีตัวเลขค้างไว้ก่อนเริ่มแข่ง
      (i.score && i.status !== 'upcoming'
        ? '<span class="font-mono text-[17px] tabular-nums' + (live ? ' text-live' : '') + '">' + esc(i.score) + '</span>' : '') +
    '</span>' +
  '</li>';
}

function sectionHead(text, count) {
  return '<p class="m-0 mt-4 mb-1 flex items-center gap-2 text-[13.5px] text-fg-mute">' + text +
    (count != null ? ' <span class="rounded-full bg-surface-soft px-2 font-mono text-[12.5px] tabular-nums">' + count + '</span>' : '') + '</p>';
}

function paint(opening) {
  var data = state.data;
  var m = findSchool(data, state.id);
  if (!m) { modal.close(); return; }

  var list = data.medalTable;
  var total = m.gold + m.silver + m.bronze;
  var rows = schoolMatches(data, m);
  var live = rows.filter(function (i) { return i.status === 'live'; });
  var upcoming = rows.filter(function (i) { return i.status === 'upcoming'; })
    .sort(function (a, b) { return (a.dayId - b.dayId) || a.time.localeCompare(b.time); });
  var done = rows.filter(function (i) { return i.status === 'done'; })
    .sort(function (a, b) { return (b.dayId - a.dayId) || b.time.localeCompare(a.time); });
  /* ข้อมูลรอบใหม่มาทุก 20 วินาที ส่วนใหญ่เหมือนเดิม — วาดทับทั้งกล่องจะทำให้ที่เลื่อนค้างไว้ดีดกลับ
     จึงวาดเฉพาะตอนที่เปลี่ยนจริง */
  var key = [state.id, m.rank, list.length, m.gold, m.silver, m.bronze, JSON.stringify(rows)].join('|');
  if (!opening && key === state.painted) return;
  state.painted = key;

  var body = modal.querySelector('[data-scroll]');
  var scrolled = body ? body.scrollTop : 0;

  // สถานะตอนนี้: กำลังแข่ง > รายการถัดไป > ไม่มีรายการเหลือ
  var nowHtml;
  if (live.length) {
    nowHtml = '<div class="mt-4 rounded-md border border-[color-mix(in_oklch,var(--color-live)_32%,transparent)] bg-live-bg px-3.5 py-2.5">' +
      '<p class="m-0 flex items-center gap-2 text-[14px] text-live">' +
        '<span class="size-2 flex-none rounded-full bg-current motion-safe:animate-blink" aria-hidden="true"></span>' +
        'กำลังแข่งอยู่ตอนนี้ ' + live.length + ' รายการ</p>' +
      '<ul class="m-0 list-none p-0">' + live.map(function (i) { return matchRow(i, true); }).join('') + '</ul></div>';
  } else if (upcoming.length) {
    var next = upcoming[0];
    nowHtml = sectionHead('รายการถัดไป', upcoming.length) +
      '<div class="flex items-center gap-3 rounded-md border border-line bg-surface-soft p-2.5">' +
        '<span class="flex flex-none flex-col items-center rounded-[9px] bg-brand-100 px-3 py-1.5 text-brand-strong">' +
          '<span class="text-[12px]">' + esc(next.dayLabel) + '</span>' +
          '<span class="font-mono text-[20px] leading-[1.1] tabular-nums">' + esc(next.time) + '</span></span>' +
        '<span class="min-w-0">' +
          '<span class="flex items-center gap-1.5 text-[15px] leading-[1.35]"><span class="text-brand-strong">' + sportIcon(next.sportId, 'size-4') + '</span>' + esc(next.event) + '</span>' +
          '<span class="block text-[13px] text-fg-soft">' + esc(next.teams || '') + '</span></span>' +
      '</div>';
  } else {
    nowHtml = '<p class="m-0 mt-4 rounded-md border border-line bg-surface-soft px-3.5 py-2.5 text-[14px] text-fg-soft">' +
      (rows.length ? 'ไม่มีรายการที่ยังไม่แข่งเหลืออยู่' : 'ยังไม่มีรายการของโรงเรียนนี้ในตารางแข่งขัน') + '</p>';
  }

  var doneHtml = done.length
    ? sectionHead('ประกาศผลแล้ว', done.length) +
      '<ul class="m-0 list-none p-0">' + done.slice(0, RESULTS_PREVIEW).map(function (i) { return matchRow(i, false); }).join('') + '</ul>' +
      (done.length > RESULTS_PREVIEW ? '<p class="m-0 mt-1 text-[13px] text-fg-mute">และอีก ' + (done.length - RESULTS_PREVIEW) + ' รายการ ดูได้ที่หน้าผลการแข่งขัน</p>' : '')
    : '';

  modal.innerHTML =
    '<div class="relative flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card' +
      (opening ? ' motion-safe:animate-pop-in' : '') + '">' +

      // หัวกล่อง: ตรา + ชื่อ + ปุ่มปิด — ค้างอยู่บนเสมอ ส่วนเนื้อหาข้างล่างเลื่อนได้
      '<div class="flex items-center gap-3 border-b border-line bg-linear-[165deg,var(--color-brand-100),var(--color-surface-soft)] py-3.5 pr-14 pl-4">' +
        schoolCrest(m, 'size-12 text-[18px]') +
        '<div class="min-w-0">' +
          (m.isSelf ? '<span class="mb-1 inline-block rounded-full bg-surface px-2.5 py-px text-[12.5px] text-brand-strong">โรงเรียนเรา</span>' : '') +
          '<h2 class="m-0 font-display text-[18px] leading-[1.3] font-normal text-balance" id="schoolModalTitle">' + esc(m.fullName || m.school) + '</h2>' +
        '</div>' +
        '<button class="btn btn-outline btn-icon absolute top-3 right-3 size-[38px] rounded-full bg-surface/85 text-fg-soft hover:text-fg" type="button" data-close aria-label="ปิดหน้าต่างรายละเอียด">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="overflow-y-auto overscroll-contain px-4 pt-4 pb-5" data-scroll>' +
        // อันดับ + เหรียญ: สองตัวเลขที่คนเปิดมาดูก่อนอย่างอื่น
        '<div class="grid grid-cols-[auto_1fr] items-center gap-4 rounded-md border border-line bg-surface-soft px-4 py-3">' +
          '<div class="border-r border-line pr-4 text-center">' +
            '<p class="m-0 text-[12.5px] text-fg-mute">อันดับ</p>' +
            '<p class="m-0 font-mono text-[34px] leading-[1.05] text-brand-strong tabular-nums">' + m.rank + '</p>' +
            '<p class="m-0 text-[12px] text-fg-mute">จาก ' + list.length + '</p>' +
          '</div>' +
          '<div class="grid grid-cols-4 gap-1 text-center">' +
            MEDALS.map(function (k) {
              return '<div class="flex flex-col items-center gap-1">' + coin(k[1], 'size-6', k[2]) +
                '<span class="font-mono text-[19px] leading-none tabular-nums' + (m[k[0]] ? '' : ' opacity-35') + '">' + m[k[0]] + '</span></div>';
            }).join('') +
            '<div class="flex flex-col items-center gap-1"><span class="flex h-6 items-center text-[12.5px] text-fg-mute">รวม</span>' +
              '<span class="font-mono text-[19px] leading-none text-brand-strong tabular-nums">' + total + '</span></div>' +
          '</div>' +
        '</div>' +
        nowHtml + doneHtml +
      '</div>' +
    '</div>';

  body = modal.querySelector('[data-scroll]');
  if (body) body.scrollTop = scrolled;
}

/** เปิดป๊อปอัปของโรงเรียน m · trigger = ตัวที่กด (คืนโฟกัสเมื่อปิด) */
export function openSchoolPopup(data, m, trigger) {
  ensureModal();
  state.data = data;
  state.id = schoolId(schoolKey(m));
  state.trigger = trigger || null;
  paint(true);
  if (!modal.open) modal.showModal();
}

/** ข้อมูลรอบใหม่มาระหว่างเปิดอยู่: วาดเนื้อหาข้างในใหม่ให้ตรงกับของจริง */
export function refreshSchoolPopup(data) {
  state.data = data;
  if (modal && modal.open && state.id) paint(false);
}
