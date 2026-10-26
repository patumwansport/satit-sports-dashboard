/* =========================================================
   medals.js — ตารางอันดับเหรียญรางวัล
   ซ้าย: ตารางเต็ม (renderMedalTable ใน common.js) สลับแท็บไปดูเหรียญแยกประเภทกีฬาได้
   ขวา: กราฟ 5 อันดับแรก · สัดส่วนเหรียญของโรงเรียนเรา
   ล่าง: ภาพสรุปผลการแข่งขันจาก Google Drive (medal-posters.js) — โหลดแยก ไม่รอข้อมูลชีต
   ========================================================= */
import {
  loadData, onFreshData, initChrome, renderMedalTable, showLoadError, esc, paintUiIcons
} from './common.js';
import { MEDALS, total, emptyBox, stackedMedalChart, medalShareChart } from './charts.js';
import { openSchoolPopup, refreshSchoolPopup } from './school-popup.js';
import { renderMedalPosters } from './medal-posters.js';

var chrome = initChrome('medals');
var current = null; // ข้อมูลชุดล่าสุด ให้ป๊อปอัปโรงเรียนอ่านตอนแตะ

/* ---------- แท็บ ภาพรวม / แยกประเภทกีฬา ---------- */
function bindTabs() {
  var tabs = [['tabAll', 'medalList'], ['tabSport', 'sportTable']];
  tabs.forEach(function (t) {
    document.getElementById(t[0]).addEventListener('click', function () {
      tabs.forEach(function (u) {
        var on = u[0] === t[0];
        document.getElementById(u[0]).setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(u[1]).hidden = !on;
      });
    });
  });
}

function renderMedalList(data) {
  var rows = data.medalTable || [];
  renderMedalTable(document.getElementById('medalList'), rows, { onPick: function (m, row) { openSchoolPopup(current, m, row); } });
  document.getElementById('medalCount').textContent = rows.length ? 'ทั้งหมด ' + rows.length + ' โรงเรียน' : 'ยังไม่มีตารางเหรียญ';
}

/** ตารางเหรียญแยกประเภทกีฬา (แท็บ "รวมเหรียญ" ในชีต) — เรียงตามเหรียญรวมจากมากไปน้อย */
var SP_GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(52px,84px))] items-center gap-3 px-5 max-[560px]:grid-cols-[minmax(0,1fr)_repeat(4,44px)] max-[560px]:gap-1.5 max-[560px]:px-4';
function renderSportTable(data) {
  var host = document.getElementById('sportTable');
  var rows = (data.sports || []).slice().sort(function (a, b) { return total(b) - total(a) || b.gold - a.gold; });
  if (!rows.length) { host.innerHTML = emptyBox('ยังไม่มีข้อมูลเหรียญแยกประเภทกีฬา'); return; }
  host.innerHTML =
    '<div class="' + SP_GRID + ' border-b border-line bg-surface-soft py-3 fs-14.5 text-fg-soft" aria-hidden="true"><span>ประเภทกีฬา</span>' +
      MEDALS.map(function (k) { return '<span class="flex justify-end"><img class="size-[24px]" src="assets/medals/coin-' + k.n + '.webp" alt="" title="' + k.label + '" width="64" height="64" /></span>'; }).join('') +
      '<span class="text-right">รวม</span></div>' +
    rows.map(function (s) {
      return '<div class="' + SP_GRID + ' border-b border-line py-3 fs-16.5 text-fg last:border-b-0" role="group" aria-label="' + esc(s.name) + ' ทอง ' + s.gold + ' เงิน ' + s.silver + ' ทองแดง ' + s.bronze + ' รวม ' + total(s) + '">' +
        '<span class="min-w-0 break-words">' + esc(s.name) + '</span>' +
        MEDALS.map(function (k) { return '<b class="text-right font-mono font-normal tabular-nums' + (s[k.key] ? '' : ' opacity-35') + '">' + s[k.key] + '</b>'; }).join('') +
        '<b class="text-right font-mono fs-18 font-normal text-brand-strong tabular-nums' + (total(s) ? '' : ' opacity-35') + '">' + total(s) + '</b>' +
      '</div>';
    }).join('');
}

function renderSide(data) {
  var rows = data.medalTable || [];
  document.getElementById('top5').innerHTML = stackedMedalChart(rows.slice(0, 5));
  var me = rows.filter(function (m) { return m.isSelf; })[0];
  // ป้ายข้างหัวกราฟ = อันดับจริงของโรงเรียนเรา (ไม่มีเหรียญ = ไม่แสดง ไม่เดาแนวโน้ม)
  var badge = document.getElementById('top5Badge');
  badge.hidden = !(me && total(me) > 0);
  if (!badge.hidden) badge.innerHTML = '<i class="icon-mask" data-ic="medal" aria-hidden="true"></i>เราอันดับ ' + me.rank + ' จาก ' + rows.length;
  document.getElementById('shareWho').textContent = me ? me.school : '';
  document.getElementById('share').innerHTML = medalShareChart(me);
}

function renderAll(data) {
  current = data;
  renderMedalList(data);
  renderSportTable(data);
  renderSide(data);
  refreshSchoolPopup(data);
  paintUiIcons(document.getElementById('main'));
  chrome.onData(data);
}

bindTabs();
renderMedalPosters();
loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
