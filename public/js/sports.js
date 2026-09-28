import {
  el, esc, loadData, schedulePolling, initChrome, sportIcon, sportMascotImg,
  statusChip, eventParts, dayLabel, CHIP, LIVE_DOT, showLoadError
} from './common.js';

var chrome = initChrome('sports');
var state = { data: null, openId: '', trigger: null };

/* ภาพประจำกีฬา — มาสคอตเป็นภาพหลัก กีฬาที่ยังไม่มีมาสคอตถอยไปใช้ไอคอนกีฬาขนาดใหญ่แทน
   ใช้ทั้งบนการ์ดและในป๊อปอัป ต่างกันแค่ความสูงของกรอบ จึงแยกความสูงออกจากคลาสชุดนี้ */
var ART = 'relative flex items-end justify-center px-3 pt-3.5';
var ART_TONE_LIVE = ' bg-linear-[165deg,var(--color-live-bg),var(--color-surface-soft)]';
var ART_TONE = ' bg-linear-[165deg,var(--color-brand-100),var(--color-surface-soft)]';

var MEDAL_KINDS = [['gold', 'ทอง', 'bg-gold'], ['silver', 'เงิน', 'bg-silver-ink'], ['bronze', 'ทองแดง', 'bg-bronze']];

function sportArt(sp, iconSize) {
  return sportMascotImg(sp.id, 'max-h-full max-w-full object-contain object-bottom drop-shadow-[0_6px_10px_oklch(30%_0.05_260/.18)]') ||
    '<span class="flex h-full w-full items-center justify-center text-brand-strong">' + sportIcon(sp.id, iconSize) + '</span>';
}

/** กรอบภาพพร้อมป้าย "สด" — ป้ายบนภาพเป็นพื้นสีเต็มเพื่อให้อ่านออกทับมาสคอต */
function artBlock(sp, height, iconSize) {
  var live = sp.status === 'live';
  return '<div class="' + ART + ' ' + height + (live ? ART_TONE_LIVE : ART_TONE) + '">' + sportArt(sp, iconSize) +
    (live ? '<span class="' + CHIP + ' absolute top-2.5 left-2.5 bg-live text-on-ink">' + LIVE_DOT + 'สด</span>' : '') +
  '</div>';
}

function renderSports(data) {
  var host = document.getElementById('sportGrid'); host.innerHTML = '';
  document.getElementById('sportsCount').textContent = data.sports.length + ' ชนิด · แตะการ์ดเพื่อดูรายละเอียด';
  data.sports.forEach(function (sp) {
    // การ์ดบอกแค่ว่ากีฬาอะไร ส่วนสถานะ/เหรียญ/รายการแข่ง อยู่ในป๊อปอัปเมื่อแตะการ์ดใบนั้น
    var card = el('button',
      'flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-surface text-left shadow-panel' +
      ' transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card' +
      ' active:translate-y-0 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' +
      ' motion-reduce:transition-none',
      artBlock(sp, 'h-[200px]', 'size-[104px]') +
      '<div class="px-[15px] pt-[13px] pb-3.5">' +
        '<p class="m-0 font-display text-[15px]">' + esc(sp.name) + '</p>' +
      '</div>');
    card.type = 'button';
    card.setAttribute('aria-haspopup', 'dialog');
    card.addEventListener('click', function () { openSport(sp.id, card); });
    // การ์ดถูกวาดใหม่ทุกรอบข้อมูล ถ้าใบที่เปิดป๊อปอัปอยู่โดนวาดทับ ให้จำใบใหม่ไว้คืนโฟกัสแทน
    if (state.openId === sp.id) state.trigger = card;
    host.appendChild(card);
  });
}

/* ---------- ป๊อปอัปรายละเอียดกีฬา ---------- */

var modal = document.getElementById('sportModal');
// ลายเซ็นของเนื้อหาที่วาดไว้ล่าสุด ใช้เทียบว่าข้อมูลรอบใหม่เปลี่ยนอะไรในกล่องนี้จริงไหม
var painted = '';

/** เหรียญของกีฬานี้ — ไอคอนคู่กับข้อความกำกับเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว */
function medalRow(sp) {
  return MEDAL_KINDS.map(function (c) {
    return '<span class="inline-flex items-baseline gap-[5px] text-[12px] text-fg-soft">' +
      '<i class="medal-mic size-[13px] ' + c[2] + ' self-center" aria-hidden="true"></i>' +
      '<b class="font-mono text-[17px] font-normal text-fg tabular-nums">' + (sp[c[0]] || 0) + '</b>' + c[1] +
    '</span>';
  }).join('');
}

/**
 * รายการแข่งของกีฬานี้ = ผังกำหนดการทั้งรายการ + แถวที่ประกาศผลแล้ว
 * สองชีตนี้ไม่เท่ากัน: ผังมีครบทุกรายการแต่ไม่มีสถานะ ส่วนแท็บผลมีเฉพาะรายการที่ลงคะแนนแล้ว
 * จึงเอาแถวจากแท็บผลขึ้นก่อน (สถานะจริง) แล้วเติมด้วยแถวในผังที่ยังไม่มีผล
 * เทียบกันด้วย "วัน + เวลา + ชื่อรายการ" เพราะสองแท็บนับเลขวันแยกกันคนละชุด
 */
function sportRows(sp) {
  var lists = [state.data.days || [], state.data.schedule || []];

  // ลำดับวันเอาจากผังก่อน (มีครบทั้งรายการ) แล้วต่อท้ายด้วยวันที่มีเฉพาะในแท็บผล
  var order = {}, next = 0;
  [lists[1], lists[0]].forEach(function (list) {
    list.forEach(function (d) { var k = dayLabel(d); if (!(k in order)) order[k] = next++; });
  });

  var rows = [], seen = {};
  lists.forEach(function (list) {
    list.forEach(function (d) {
      (d.items || []).forEach(function (i) {
        if (i.sportId !== sp.id) return;
        var day = dayLabel(d), key = day + '|' + i.time + '|' + i.event;
        if (seen[key]) return;
        seen[key] = true;
        rows.push({ day: day, date: d.date || day, time: i.time, event: i.event, teams: i.teams, status: i.status, score: i.score });
      });
    });
  });

  return rows.sort(function (a, b) {
    return (order[a.day] - order[b.day]) || String(a.time).localeCompare(String(b.time));
  });
}

/** รายการแข่งขันของกีฬานี้ เรียงตามวันและเวลาเหมือนที่อยู่ในตารางแข่งขัน */
function matchList(sp, rows) {
  if (!rows.length) return '<p class="m-0 py-2 text-[13px] text-fg-mute">ยังไม่มีรายการของกีฬานี้ในผังการแข่งขัน</p>';

  // กล่องเตี้ยกว่ารายการยาว ๆ เสมอ: ป๊อปอัปต้องเป็นกล่องเล็ก ไม่ใช่หน้าใหม่ที่ยาวเต็มจอ
  return '<ul class="m-0 flex max-h-[172px] list-none flex-col overflow-y-auto p-0">' +
    rows.map(function (m) {
      // ชื่อรายการในชีตขึ้นต้นด้วยชื่อกีฬาอยู่แล้ว ตัดออกเหลือเฉพาะ "ประเภท" เพราะหัวป๊อปอัปบอกชื่อกีฬาไปแล้ว
      var kind = eventParts(sp.name, m.event).kind || m.event;
      return '<li class="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0">' +
        '<span class="flex items-center justify-between gap-2">' +
          '<span class="font-mono text-[12px] text-fg-soft tabular-nums">' + esc(m.date) + ' · ' + esc(m.time) + '</span>' +
          statusChip(m.status) +
        '</span>' +
        '<span class="text-[13px] leading-[1.4] text-fg">' + esc(kind) + '</span>' +
        // คู่แข่งมีเฉพาะแถวจากแท็บผล (ผังกำหนดการยังไม่ระบุคู่) จึงขึ้นบรรทัดนี้เท่าที่มีจริง
        (m.teams ? '<span class="text-[12.5px] leading-[1.4] text-fg-soft">' + esc(m.teams) + '</span>' : '') +
        (m.score ? '<span class="font-mono text-[12.5px] text-fg-soft tabular-nums">ผล ' + esc(m.score) + '</span>' : '') +
      '</li>';
    }).join('') +
  '</ul>';
}

/**
 * วาดเนื้อหาป๊อปอัป
 * @param {boolean} [opening] - true = เพิ่งเปิด (เล่นอนิเมชันเด้งเข้า และวาดทับของเดิมเสมอ)
 */
function paintModal(opening) {
  var sp = (state.data.sports || []).filter(function (x) { return x.id === state.openId; })[0];
  if (!sp) { modal.close(); return; }
  var rows = sportRows(sp);

  /* ข้อมูลรอบใหม่มาทุก 20 วินาที ส่วนใหญ่เหมือนเดิมทุกตัวอักษร — วาดทับทั้งกล่องจะทำให้
     รายการที่เลื่อนค้างไว้ดีดกลับขึ้นบนและโฟกัสหลุดออกจากกล่องกลางคัน จึงวาดเฉพาะตอนที่เปลี่ยนจริง */
  var key = [sp.status, sp.gold, sp.silver, sp.bronze, JSON.stringify(rows)].join('|');
  if (!opening && key === painted) return;
  painted = key;

  var list = modal.querySelector('ul');
  var scrolled = list ? list.scrollTop : 0;

  modal.innerHTML =
    // ปุ่มปิดวางตัวเทียบกับการ์ดใบนี้ (relative) ไม่ใช่เทียบกับกรอบภาพซึ่งเป็นลูกของมันอีกที
    '<div class="relative overflow-hidden rounded-lg border border-line bg-surface shadow-card' +
      (opening ? ' motion-safe:animate-pop-in' : '') + '">' +
      artBlock(sp, 'h-[168px]', 'size-[92px]') +
      // ปุ่มปิดลอยอยู่บนภาพ พื้นทึบแสงพอให้เห็นเครื่องหมายกากบาททับมาสคอตสีอ่อน
      '<button class="btn btn-outline btn-icon absolute top-2.5 right-2.5 size-[38px] rounded-full bg-surface/85 text-fg-soft backdrop-blur-[6px] hover:text-fg" type="button" data-close aria-label="ปิดหน้าต่างรายละเอียด">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="px-[18px] pt-[15px] pb-[18px]">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<h2 class="m-0 font-display text-[19px] leading-[1.3] font-normal text-brand-strong" id="sportModalTitle">' + esc(sp.name) + '</h2>' +
          '<span class="flex-none">' + statusChip(sp.status) + '</span>' +
        '</div>' +
        '<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-line bg-surface-soft px-3.5 py-2.5">' +
          medalRow(sp) +
        '</div>' +
        '<p class="mt-4 mb-0.5 text-[11.5px] text-fg-mute">รายการแข่งขัน' + (rows.length ? ' · ' + rows.length + ' รายการ' : '') + '</p>' +
        matchList(sp, rows) +
      '</div>' +
    '</div>';

  list = modal.querySelector('ul');
  if (list) list.scrollTop = scrolled;
}

function openSport(id, trigger) {
  state.openId = id;
  state.trigger = trigger || null;
  paintModal(true);
  if (!modal.open) modal.showModal();
}

// คลิกฉากหลัง (นอกการ์ด) หรือปุ่มกากบาท = ปิด — ส่วน Esc เป็นของ <dialog> อยู่แล้ว
modal.addEventListener('click', function (e) {
  if (e.target === modal || (e.target.closest && e.target.closest('[data-close]'))) modal.close();
});
modal.addEventListener('close', function () {
  state.openId = '';
  /* คืนโฟกัสให้การ์ดที่กดเปิด: แตะ/คลิกปุ่มไม่ได้ทำให้ปุ่มมีโฟกัสในทุกเบราว์เซอร์
     <dialog> จึงไม่มีที่ให้คืนโฟกัสเอง แล้วโฟกัสจะเด้งไปเริ่มที่ต้นหน้าใหม่ทั้งหน้า
     (การ์ดถูกวาดใหม่ทุกครั้งที่ข้อมูลรอบใหม่มา ตัวเก่าจึงอาจหลุดจากหน้าไปแล้ว) */
  if (state.trigger && document.contains(state.trigger)) state.trigger.focus();
  state.trigger = null;
});

function renderAll(data) {
  state.data = data;
  renderSports(data);
  // ข้อมูลรอบใหม่มาระหว่างเปิดป๊อปอัปอยู่: วาดเนื้อหาข้างในใหม่ให้ตรงกับของจริง
  if (state.openId) paintModal();
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  schedulePolling(renderAll);
}).catch(showLoadError);
