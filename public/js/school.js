import {
  el, esc, loadData, onFreshData, initChrome, sportIcon, statusChip,
  schoolId, schoolKey, findSchool, schoolMatches, schoolCrest, showLoadError
} from './common.js';

var chrome = initChrome('medals'); // หน้าโรงเรียนเป็นหน้าลูกของอันดับเหรียญ
var schoolIdParam = new URLSearchParams(location.search).get('id') || '';
var lastSig = '';
var lastScores = {};

/* =========================================================
   หน้าโรงเรียน — อ่านกลางแดดบนมือถือเป็นหลัก ตัวใหญ่กว่าหน้าอื่น
   สีจัดปรากฏได้ 2 ที่เท่านั้น: สถานะกำลังแข่ง และแถบเหรียญ
   จอกว้าง (≥1180px): ตัวตนโรงเรียน + อันดับ + เหรียญ ค้างอยู่ซ้าย รายการแข่งขันเลื่อนอยู่ขวา
   ========================================================= */
// ระยะใต้แถวปุ่มย้อนกลับ: #schoolShell ไม่มี gap ของตัวเอง ถ้าไม่เว้นไว้ หัวโรงเรียนจะชิดปุ่มจนดูเป็นก้อนเดียว
var TOP_ROW = 'mb-7 flex flex-wrap items-center justify-between gap-3 max-[560px]:mb-5';
var COLS = 'flex flex-col gap-7 min-[1180px]:grid min-[1180px]:grid-cols-[1fr_1.4fr] min-[1180px]:items-start min-[1180px]:gap-11';
/* ระยะห่างใส่ตอนเรียก: utility ที่คุมสมบัติเดียวกันสองตัวในคลาสเดียว ตัวที่ชนะคือตัวที่อยู่หลังในไฟล์ CSS
   ไม่ใช่ตัวที่เขียนทีหลังใน class จึงห้ามใส่ค่าตั้งต้นไว้แล้วทับ */
var ASIDE = 'flex min-w-0 flex-col min-[1180px]:sticky min-[1180px]:top-[92px]';
var BODY = 'flex min-w-0 flex-col';
var SEC_HEAD = 'm-0 mb-1.5 flex items-baseline gap-[9px] font-display text-[19px] font-normal';
var NOTE = 'mt-2 text-[15.5px] text-fg-soft';
var MATCH_LIST = 'm-0 mt-1 flex list-none flex-col p-0';
var QUIET_BOX = 'rounded-lg border border-line bg-surface px-[22px] py-[18px] max-[560px]:mx-[-2px] max-[560px]:px-4 max-[560px]:pt-4 max-[560px]:pb-[18px]';
var QUIET_HEAD = 'm-0 mb-1.5 font-display text-[18px] font-normal';
var QUIET_TEXT = 'm-0 text-[15.5px] text-fg-soft';
/* การ์ดหลัก (อันดับ + เหรียญ): ไล่สีแบรนด์อ่อน ๆ ให้เป็นจุดสายตาแรกของหน้า */
var HERO_CARD = 'rounded-lg border border-line bg-linear-[165deg,var(--color-brand-100),var(--color-surface-soft)] px-[26px] py-[22px] shadow-panel max-[560px]:mx-[-2px] max-[560px]:px-4 max-[560px]:py-[18px]';
var DONE_PREVIEW = 4; // ผลที่ประกาศแล้วแสดงก่อน 4 รายการ ที่เหลือพับไว้

/* ไอคอนเส้นบนกริด 24 ชุดเดียวกับไอคอนกีฬา — ใช้แทนตัวอักษรสัญลักษณ์ (‹ ⌄ ⚠︎)
   ที่แต่ละฟอนต์/แพลตฟอร์มวาดไม่เหมือนกัน และบางเครื่องแสดงเป็นอิโมจิ */
var GLYPHS = {
  back: "<path d='M15 6l-6 6 6 6'/>",
  down: "<path d='M6 9l6 6 6-6'/>",
  warn: "<path d='M12 9v4M12 16.5v.01'/><path d='M10.3 4.2L2.8 17.3A2 2 0 0 0 4.5 20.3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z'/>"
};
function glyph(name, cls) {
  return '<svg class="flex-none ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GLYPHS[name] + '</svg>';
}

/* รูปเหรียญชุดเดียวกับหน้าอันดับเหรียญและหน้าหลัก (assets/medals/coin-N.webp)
   label ไปอยู่ใน title/alt ให้โปรแกรมอ่านหน้าจอยังรู้ชนิดเหรียญ ส่วนที่มีข้อความกำกับข้าง ๆ แล้วส่ง label ว่าง */
var MEDALS = [['gold', 1, 'ทอง'], ['silver', 2, 'เงิน'], ['bronze', 3, 'ทองแดง']];
function coin(n, size, label) {
  return '<img class="flex-none ' + size + '" src="assets/medals/coin-' + n + '.webp" alt="' + (label || '') + '"' +
    (label ? ' title="' + label + '"' : '') + ' width="64" height="64" decoding="async" />';
}
/** ตัวเลขเหรียญแบบย่อ (รูปเหรียญ + จำนวน) ใช้ในการ์ดรายกีฬา */
function coinCounts(s, size, gap) {
  return MEDALS.map(function (k) {
    return '<span class="inline-flex items-center ' + gap + '">' + coin(k[1], size, k[2]) + s[k[0]] + '</span>';
  }).join('');
}

/* โครงร่างระหว่างรอข้อมูล: รูปทรงตรงกับของจริง เพื่อไม่ให้เลย์เอาต์กระโดดตอนข้อมูลมาถึง */
function schoolSkeleton() {
  function sk(w, h) {
    return '<span class="block rounded-[10px] bg-surface-soft motion-safe:animate-skeleton" style="width:' + w + ';height:' + h + 'px"></span>';
  }
  return '<div class="' + TOP_ROW + '">' + backButtonHtml() + '</div>' +
    '<div class="' + COLS + '" role="status" aria-label="กำลังโหลดข้อมูลโรงเรียน">' +
      '<div class="' + ASIDE + ' gap-3.5">' +
        '<div class="flex items-center gap-3">' + sk('54px', 54) + sk('64%', 28) + '</div>' +
        sk('100%', 210) +
      '</div>' +
      '<div class="' + BODY + ' gap-3.5">' + sk('100%', 104) + sk('100%', 76) + sk('100%', 76) + '</div>' +
    '</div>';
}

function schoolNotFound() {
  return '<div class="' + TOP_ROW + '">' + backButtonHtml() + '</div>' +
    '<div class="py-2">' +
    '<h1 class="m-0 mb-2 font-display text-[23.5px] font-normal">ไม่พบโรงเรียนนี้ในตารางเหรียญ</h1>' +
    '<p class="m-0 mb-[18px] max-w-[52ch] text-[16px] text-fg-soft">ลิงก์อาจเก่า หรือชื่อโรงเรียนในชีตถูกแก้ไขไปแล้ว เลือกใหม่จากหน้าอันดับเหรียญได้เลย</p>' +
    '<a class="inline-flex min-h-[44px] items-center rounded-full bg-brand px-5 py-[11px] text-[15.5px] text-on-ink no-underline hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" href="medals.html">ไปที่อันดับเหรียญรางวัล</a>' +
    '</div>';
}

function backButtonHtml() {
  return '<a class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface py-2.5 pr-[18px] pl-3 text-[15.5px] text-fg-soft no-underline transition-[border-color,color] duration-150 hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none" href="medals.html">' +
    glyph('back', 'size-[18px]') + 'อันดับเหรียญรางวัล</a>';
}

/* ตัวเลขหลัก: อันดับ + เหรียญ อ่านได้ในระยะแขนกลางแดด
   รูปเหรียญนำหน้าคู่กับข้อความกำกับเสมอ (ทอง/เงิน/ทองแดง) ไม่สื่อความหมายด้วยสีอย่างเดียว */
var MEDAL_LINE = 'grid grid-cols-[28px_1fr_auto] items-center gap-3';

/* แถบสัดส่วนเหรียญ: เห็นภาพรวมทอง/เงิน/ทองแดงในแวบเดียว ตัวเลขจริงอยู่ในแถวด้านล่างอยู่แล้ว */
function medalBarHtml(m, total) {
  function seg(tone, n) {
    return n ? '<span class="block h-full ' + tone + '" style="width:' + (n / total * 100).toFixed(2) + '%"></span>' : '';
  }
  return '<div class="mb-1.5 flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-surface" aria-hidden="true">' +
    seg('bg-gold', m.gold) + seg('bg-silver', m.silver) + seg('bg-bronze', m.bronze) + '</div>';
}

function medalStatHtml(m, total) {
  function line(k) {
    var n = m[k[0]];
    return '<div class="' + MEDAL_LINE + '">' + coin(k[1], 'size-7') +
      '<span class="text-[16px] text-fg-soft">' + k[2] + '</span>' +
      '<span class="font-mono text-[23.5px] tabular-nums' + (n ? '' : ' opacity-35') + '">' + n + '</span></div>';
  }
  return medalBarHtml(m, total) + MEDALS.map(line).join('') +
    '<div class="col-span-full mt-1.5 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line pt-2.5">' +
      '<span class="text-[16px] text-fg">รวม</span>' +
      '<span class="font-mono text-[27.5px] tabular-nums">' + total + '</span></div>';
}

// opts.hideChip: ในกล่อง "กำลังแข่งอยู่ตอนนี้" หัวข้อบอกสถานะอยู่แล้ว ไม่ต้องติดป้ายซ้ำทุกแถว
// opts.live: แถวอยู่ในกล่องสด · opts.hideDay: มีหัวข้อวันอยู่ด้านบนแล้ว แสดงแค่เวลา
// จอแคบ: เวลา/สกอร์ย้ายลงบรรทัดใหม่ใต้ชื่อรายการ
function matchRowHtml(i, opts) {
  opts = opts || {};
  var liveBox = !!opts.live;
  return '<li class="grid grid-cols-[auto_1fr_auto] items-center gap-[15px] border-t py-[15px] first:border-t-0 max-[560px]:grid-cols-[auto_1fr] max-[560px]:gap-3 ' +
      (liveBox ? 'border-[color-mix(in_oklch,var(--color-live)_22%,transparent)]' : 'border-line') + '">' +
    '<span class="flex size-9 flex-none items-center justify-center rounded-[11px] border ' +
      (liveBox
        ? 'border-[color-mix(in_oklch,var(--color-live)_25%,transparent)] bg-surface text-live'
        : 'border-line bg-surface-soft text-fg-soft') + '">' +
      sportIcon(i.sportId, 'size-[21px]') + '</span>' +
    '<span class="min-w-0">' +
      '<p class="m-0 mb-[3px] text-[17px]">' + esc(i.event) + '</p>' +
      '<p class="m-0 text-[14.5px] text-fg-soft">' + esc(i.teams || '') + '</p>' +
    '</span>' +
    '<span class="flex flex-col items-end gap-[5px] text-right max-[560px]:col-start-2 max-[560px]:flex-row max-[560px]:flex-wrap max-[560px]:items-center max-[560px]:justify-start max-[560px]:gap-2.5 max-[560px]:text-left">' +
      '<span class="font-mono text-[14px] whitespace-nowrap text-fg-soft">' +
        (opts.hideDay ? '' : esc(i.dayLabel) + ' · ') + esc(i.time) + ' น.</span>' +
      // สกอร์แสดงเฉพาะรายการที่แข่งแล้ว: ชีตบางแถวมีตัวเลขค้างไว้ก่อนเริ่มแข่ง
      (i.score && i.status !== 'upcoming'
        ? '<span class="font-mono text-[21.5px] tabular-nums ' + (liveBox ? 'text-live' : '') + '">' + esc(i.score) + '</span>'
        : '') +
      (opts.hideChip ? '' : statusChip(i.status)) +
    '</span>' +
    '</li>';
}

/* รายการถัดไป: จัดกลุ่มตามวัน หัวข้อวันบอกครั้งเดียว แต่ละแถวเหลือแค่เวลา */
function groupedByDayHtml(items) {
  var groups = [];
  items.forEach(function (i) {
    var g = groups[groups.length - 1];
    if (!g || g.day !== i.dayLabel) groups.push(g = { day: i.dayLabel, items: [] });
    g.items.push(i);
  });
  return groups.map(function (g, n) {
    return '<h3 class="m-0 ' + (n ? 'mt-5' : 'mt-2') + ' flex items-center gap-2.5 text-[14.5px] tracking-[.03em] text-fg-mute">' +
        '<span>' + esc(g.day) + '</span><span class="h-px flex-1 bg-line" aria-hidden="true"></span>' +
        '<span class="font-mono tabular-nums">' + g.items.length + ' รายการ</span></h3>' +
      '<ul class="' + MATCH_LIST + '">' + g.items.map(function (i) { return matchRowHtml(i, { hideDay: true, hideChip: true }); }).join('') + '</ul>';
  }).join('');
}

/* ประกาศผลแล้ว: แสดงล่าสุดก่อนไม่กี่รายการ ที่เหลือพับไว้ หน้าไม่ยาวจนต้องเลื่อนผ่านนาน */
function doneListHtml(items) {
  var head = items.slice(0, DONE_PREVIEW), rest = items.slice(DONE_PREVIEW);
  function rowsOf(arr) { return arr.map(function (i) { return matchRowHtml(i, { hideChip: true }); }).join(''); }
  return '<ul class="' + MATCH_LIST + '">' + rowsOf(head) + '</ul>' +
    (rest.length
      ? '<details class="group/more" id="schDoneMore">' +
          '<summary class="mt-2 inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface px-[18px] text-[15.5px] text-fg-soft hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">' +
            '<span class="group-open/more:hidden">ดูผลอีก ' + rest.length + ' รายการ</span>' +
            '<span class="hidden group-open/more:inline">ย่อรายการ</span>' +
            glyph('down', 'size-[18px] transition-transform group-open/more:rotate-180 motion-reduce:transition-none') +
          '</summary>' +
          '<ul class="' + MATCH_LIST + ' border-t border-line">' + rowsOf(rest) + '</ul>' +
        '</details>'
      : '');
}

function announceScoreChanges(m, liveRows) {
  var changed = [];
  liveRows.forEach(function (i) {
    var key = schoolId(schoolKey(m)) + '|' + i.dayId + '|' + i.time + '|' + i.event;
    var prev = lastScores[key];
    if (prev !== undefined && prev !== i.score && i.score) changed.push(i.event + ' ' + i.score);
    lastScores[key] = i.score;
  });
  if (changed.length) document.getElementById('schoolLiveMsg').textContent = 'สกอร์อัปเดต: ' + changed.join(' · ');
}

function renderSchool(data) {
  var host = document.getElementById('schoolShell');
  if (!data) { host.innerHTML = schoolSkeleton(); return; }

  var m = findSchool(data, schoolIdParam);
  if (!m) { host.innerHTML = schoolNotFound(); return; }

  var list = data.medalTable;
  var total = m.gold + m.silver + m.bronze;
  var rows = schoolMatches(data, m);

  var live = rows.filter(function (i) { return i.status === 'live'; });
  var upcoming = rows.filter(function (i) { return i.status === 'upcoming'; })
    .sort(function (a, b) { return (a.dayId - b.dayId) || a.time.localeCompare(b.time); });
  var done = rows.filter(function (i) { return i.status === 'done'; })
    .sort(function (a, b) { return (b.dayId - a.dayId) || b.time.localeCompare(a.time); });

  /* ข้ามการวาดใหม่ถ้าข้อมูลยังเหมือนเดิม: กันโฟกัสคีย์บอร์ดหลุดทุกครั้งที่ซิงก์ (20 วินาที) */
  var sig = [
    schoolIdParam, m.rank, m.gold, m.silver, m.bronze,
    list.length,
    rows.map(function (i) { return i.status + i.score + i.time + i.event; }).join(';'),
    m.isSelf ? data.sports.map(function (sp) { return sp.gold + '-' + sp.silver + '-' + sp.bronze; }).join(',') : ''
  ].join('|');
  if (sig === lastSig && host.firstChild) { updateSchoolSync(); return; }
  lastSig = sig;

  // จำว่าผู้ใช้กางรายการผลไว้หรือไม่ วาดใหม่แล้วไม่หุบเอง
  var moreEl = document.getElementById('schDoneMore');
  var moreOpen = !!(moreEl && moreEl.open);

  /* --- แมตช์สด --- */
  var liveHtml;
  if (!rows.length) {
    // ไม่มีรายการของโรงเรียนนี้เลย: บอกครั้งเดียว ไม่ต้องขึ้นกล่องว่างซ้ำสามที่
    liveHtml = '<section class="' + QUIET_BOX + '">' +
      '<h2 class="' + QUIET_HEAD + '">ยังไม่มีรายการของโรงเรียนนี้ในตารางแข่งขัน</h2>' +
      '<p class="' + QUIET_TEXT + '">ชีตตารางแข่งขันยังไม่ได้ระบุชื่อโรงเรียนนี้ไว้ เมื่อกรรมการบันทึกรายการเข้ามา จะขึ้นที่นี่ทันที</p>' +
      '</section>';
  } else if (live.length) {
    // สถานะสด — จุดเดียวในหน้าที่ได้ใช้สีเต็ม
    liveHtml = '<section class="rounded-lg border border-[color-mix(in_oklch,var(--color-live)_32%,transparent)] bg-live-bg px-[22px] py-5 max-[560px]:mx-[-2px] max-[560px]:px-4 max-[560px]:pt-4 max-[560px]:pb-[18px]" aria-labelledby="schLiveHead">' +
      '<h2 class="m-0 mb-1 flex items-center gap-2.5 font-display text-[19px] font-normal text-live" id="schLiveHead">' +
        '<span class="relative flex size-2.5 flex-none" aria-hidden="true">' +
          '<span class="absolute inset-0 rounded-full bg-current opacity-45 motion-safe:animate-ping"></span>' +
          '<span class="relative size-2.5 rounded-full bg-current"></span></span>' +
        'กำลังแข่งอยู่ตอนนี้ ' + live.length + ' รายการ</h2>' +
      '<ul class="' + MATCH_LIST + '">' + live.map(function (i) { return matchRowHtml(i, { hideChip: true, live: true }); }).join('') + '</ul>' +
      '</section>';
  } else {
    // ไม่มีแมตช์สด: ยกรายการถัดไปขึ้นมาเป็นการ์ดเด่น ให้รู้ทันทีว่าต้องไปดูที่ไหนเมื่อไร
    var next = upcoming[0];
    liveHtml = next
      ? '<section class="' + QUIET_BOX + '" aria-labelledby="schLiveHead">' +
          '<p class="m-0 mb-1 text-[14px] tracking-[.04em] text-fg-mute">ตอนนี้ไม่มีรายการที่กำลังแข่ง</p>' +
          '<h2 class="m-0 font-display text-[18px] font-normal" id="schLiveHead">รายการถัดไปของโรงเรียน</h2>' +
          '<div class="mt-3 flex items-center gap-4">' +
            '<div class="flex flex-none flex-col items-center justify-center rounded-md bg-brand-100 px-4 py-2.5 text-brand-strong">' +
              '<span class="text-[13px]">' + esc(next.dayLabel) + '</span>' +
              '<span class="font-mono text-[26.5px] leading-[1.1] tabular-nums">' + esc(next.time) + '</span></div>' +
            '<div class="min-w-0"><p class="m-0 mb-0.5 flex items-center gap-2 text-[17.5px] text-fg">' +
                '<span class="text-brand-strong">' + sportIcon(next.sportId, 'size-5') + '</span>' + esc(next.event) + '</p>' +
              '<p class="m-0 text-[14.5px] text-fg-soft">' + esc(next.teams || '') + '</p></div>' +
          '</div></section>'
      : '<section class="' + QUIET_BOX + '" aria-labelledby="schLiveHead">' +
          '<h2 class="' + QUIET_HEAD + '" id="schLiveHead">ตอนนี้ไม่มีรายการที่กำลังแข่ง</h2>' +
          '<p class="' + QUIET_TEXT + '">ไม่มีรายการที่ยังไม่แข่งเหลืออยู่ในตารางของโรงเรียนนี้</p></section>';
  }

  /* --- เหรียญแยกรายกีฬา: ชีตกลางบันทึกไว้เฉพาะโรงเรียนของเรา --- */
  var sportsHtml;
  if (m.isSelf) {
    var withMedals = data.sports
      .filter(function (sp) { return (sp.gold + sp.silver + sp.bronze) > 0; })
      .sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });
    sportsHtml = '<section aria-labelledby="schSportsHead">' +
      '<h2 class="' + SEC_HEAD + '" id="schSportsHead">เหรียญแยกตามชนิดกีฬา</h2>' +
      (withMedals.length
        ? '<div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">' + withMedals.map(function (sp) {
            return '<div class="flex items-center gap-[11px] rounded-md border border-line bg-surface-soft px-3 py-2.5">' +
              '<span class="flex size-8 flex-none items-center justify-center rounded-[9px] border border-line bg-surface text-fg-soft">' +
                sportIcon(sp.id, 'size-[22px]') + '</span>' +
              '<div><p class="m-0 mb-0.5 text-[15.5px]">' + esc(sp.name) + '</p>' +
              '<p class="m-0 flex gap-2.5 font-mono text-[13.5px] tabular-nums text-fg-soft">' +
                coinCounts(sp, 'size-4', 'gap-1') +
              '</p></div></div>';
          }).join('') + '</div>'
        : '<p class="' + NOTE + '">ยังไม่มีชนิดกีฬาที่ได้เหรียญ</p>') +
      '</section>';
  } else {
    sportsHtml = '<section><h2 class="' + SEC_HEAD + '">เหรียญแยกตามชนิดกีฬา</h2>' +
      '<p class="' + NOTE + '">มีเฉพาะโรงเรียนของเรา เพราะชีตกลางบันทึกเหรียญรายกีฬาไว้เฉพาะของเรา</p></section>';
  }

  function section(id, title, count, bodyHtml, emptyText) {
    return '<section aria-labelledby="' + id + '">' +
      '<h2 class="' + SEC_HEAD + '" id="' + id + '">' + title +
        ' <span class="rounded-full bg-surface-soft px-2.5 py-0.5 font-mono text-[14px] text-fg-soft tabular-nums">' + count + '</span></h2>' +
      (count ? bodyHtml : '<p class="' + NOTE + '">' + emptyText + '</p>') +
      '</section>';
  }

  /* รายการแรกขึ้นการ์ดเด่นไปแล้วตอนไม่มีแมตช์สด — ลิสต์ด้านล่างจึงเริ่มจากรายการถัดจากนั้น
     ไม่ให้รายการเดียวกันโผล่ซ้ำสองที่ ถ้าไม่เหลืออะไรก็ไม่ต้องมีหัวข้อนี้เลย */
  function nextSection() {
    // ไม่มีแมตช์สดและไม่มีรายการเหลือ: กล่องด้านบนบอกไปแล้วว่าไม่มีรายการที่ยังไม่แข่ง ไม่ต้องขึ้นหัวข้อว่างซ้ำ
    if (!live.length && !upcoming.length) return '';
    var featured = !live.length && upcoming.length;
    var rest = featured ? upcoming.slice(1) : upcoming;
    if (featured && !rest.length) return '';
    return section('schNextHead', featured ? 'ถัดจากนั้น' : 'รายการถัดไป', rest.length, groupedByDayHtml(rest), 'ไม่มีรายการที่ยังไม่แข่ง');
  }

  host.innerHTML =
    '<div class="' + TOP_ROW + '">' + backButtonHtml() +
      '<span class="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--color-gold)_45%,transparent)] bg-[color-mix(in_oklch,var(--color-gold)_14%,transparent)] px-3.5 py-1.5 text-[14px] text-gold-ink tabular-nums" id="schSync" hidden></span></div>' +

    '<div class="' + COLS + '"><div class="' + ASIDE + ' gap-6">' +

    '<header class="flex items-center gap-5 max-[560px]:gap-3.5">' +
      schoolCrest(m, 'size-[60px] text-[22.5px] max-[560px]:size-12') +
      '<div class="flex min-w-0 flex-col items-start gap-2">' +
        (m.isSelf ? '<span class="rounded-full bg-brand-100 px-3 py-0.5 text-[13.5px] text-brand-strong">โรงเรียนเรา</span>' : '') +
        '<h1 class="m-0 font-display text-[26px] leading-[1.3] font-normal text-balance text-fg max-[560px]:text-[22px]">' +
          esc(m.fullName || m.school) + '</h1>' +
      '</div>' +
    '</header>' +

    // การ์ดหลัก: จอกว้างคอลัมน์ซ้ายแคบอยู่แล้ว อันดับกับเหรียญจึงเรียงลงกัน · จอกลางวางคู่กันได้
    '<div class="' + HERO_CARD + ' grid grid-cols-[minmax(120px,200px)_1fr] items-center gap-7' +
      ' min-[1180px]:grid-cols-1 min-[1180px]:gap-5 max-[560px]:grid-cols-1 max-[560px]:gap-5">' +
      '<div class="max-[560px]:flex max-[560px]:flex-wrap max-[560px]:items-baseline max-[560px]:gap-3">' +
        '<p class="m-0 text-[14px] tracking-[.08em] text-fg-soft max-[560px]:order-1">อันดับ</p>' +
        '<p class="mt-1 mb-1.5 font-mono text-[63.5px] leading-[.95] text-brand-strong tabular-nums max-[560px]:order-2 max-[560px]:m-0 max-[560px]:text-[55px]">' + m.rank + '</p>' +
        '<p class="m-0 text-[15px] text-fg-soft max-[560px]:order-3">จาก ' + list.length + ' โรงเรียน</p>' +
      '</div>' +
      '<div class="flex max-w-[300px] flex-col gap-2 min-[1180px]:max-w-none max-[560px]:max-w-none">' +
        (total ? medalStatHtml(m, total) : '<p class="m-0 text-[17px] text-fg-soft">ยังไม่ได้เหรียญ</p>') +
      '</div>' +
    '</div>' +

    '</div><div class="' + BODY + ' gap-7">' +

    liveHtml +

    (rows.length
      ? nextSection() +
        section('schDoneHead', 'ประกาศผลแล้ว', done.length, doneListHtml(done), 'ยังไม่มีผลที่ประกาศ')
      : '') +

    sportsHtml +

    '<p class="m-0 text-[14px] leading-[1.6] text-fg-mute">รายการแข่งขันแสดงเฉพาะรายการที่ระบุชื่อโรงเรียนนี้ไว้ในตารางแข่งขันหรือในผลการแข่งขัน</p>' +

    '</div></div>';

  if (moreOpen) {
    var again = document.getElementById('schDoneMore');
    if (again) again.open = true;
  }

  announceScoreChanges(m, live);
  updateSchoolSync();
}

/* ---------- ป้ายเวลาซิงก์บนหน้าโรงเรียน: บอกตรง ๆ เมื่อชุดที่แสดงเป็นของเก่า ----------
   คำนวณครั้งเดียวตอนวาด (เช่น วาดจาก cache แล้วดึงของสดไม่สำเร็จ) ไม่นับนาทีเดินไปเรื่อย ๆ */
function updateSchoolSync() {
  var out = document.getElementById('schSync');
  if (!out) return;
  var stale = chrome.secondsSinceSync() > 60;
  out.hidden = !stale;
  if (stale) out.innerHTML = glyph('warn', 'size-4') + 'ข้อมูลเมื่อ ' + Math.floor(chrome.secondsSinceSync() / 60) + ' นาทีที่แล้ว · รีเฟรชเพื่อดูผลล่าสุด';
}

renderSchool(null); // แสดงโครงหน้าก่อนข้อมูลมาถึง

// chrome.onData ก่อน renderSchool: ป้าย "ข้อมูลอาจไม่เป็นปัจจุบัน" อ่านอายุข้อมูลจากเวลาที่ chrome เพิ่งตั้ง
loadData().then(function (data) {
  chrome.onData(data);
  renderSchool(data);
  onFreshData(function (d) { chrome.onData(d); renderSchool(d); });
}).catch(showLoadError);