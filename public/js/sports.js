import {
  el, esc, loadData, onFreshData, initChrome, sportIcon, sportMascotImg,
  CHIP, LIVE_DOT, showLoadError
} from './common.js';

var chrome = initChrome('sports');

/* ภาพประจำกีฬา — มาสคอตเป็นภาพหลัก กีฬาที่ยังไม่มีมาสคอตถอยไปใช้ไอคอนกีฬาขนาดใหญ่แทน
   ความสูงของกรอบส่งมาตอนเรียก จึงแยกออกจากคลาสชุดนี้ */
var ART = 'relative flex items-end justify-center px-3 pt-3.5';
var ART_TONE_LIVE = ' bg-linear-[165deg,var(--color-live-bg),var(--color-surface-soft)]';
var ART_TONE = ' bg-linear-[165deg,var(--color-brand-100),var(--color-surface-soft)]';

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
  document.getElementById('sportsCount').textContent = data.sports.length + ' ชนิด · แตะการ์ดเพื่อดูตารางการแข่งขันของกีฬานั้น';
  data.sports.forEach(function (sp) {
    // การ์ดพาไปหน้าตารางการแข่งขันที่กรองเฉพาะกีฬานี้ไว้แล้ว (fixture-table.js อ่าน ?sport=)
    var card = el('a',
      'flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left text-fg no-underline shadow-panel' +
      ' transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card' +
      ' active:translate-y-0 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand' +
      ' motion-reduce:transition-none',
      artBlock(sp, 'h-[200px]', 'size-[104px]') +
      '<div class="px-[15px] pt-[13px] pb-3.5">' +
        '<p class="m-0 font-display text-[17px]">' + esc(sp.name) + '</p>' +
      '</div>');
    card.href = 'schedule.html?sport=' + encodeURIComponent(sp.id);
    card.setAttribute('aria-label', 'ตารางการแข่งขัน ' + sp.name);
    host.appendChild(card);
  });
}

function renderAll(data) {
  renderSports(data);
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
