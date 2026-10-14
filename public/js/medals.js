/* =========================================================
   medals.js — ตารางอันดับเหรียญรางวัล
   ซ้าย: ตารางเต็ม (renderMedalTable ใน common.js) สลับแท็บไปดูเหรียญแยกประเภทกีฬาได้
   ขวา: กราฟ 5 อันดับแรก · สัดส่วนเหรียญของโรงเรียนเรา · เปรียบเทียบสองโรงเรียน
   ========================================================= */
import {
  loadData, onFreshData, initChrome, renderMedalTable, showLoadError, esc, schoolCrest,
  schoolId, schoolKey, paintUiIcons
} from './common.js';
import { MEDALS, total, emptyBox, stackedMedalChart, medalShareChart } from './charts.js';
import { openSchoolPopup, refreshSchoolPopup } from './school-popup.js';

var chrome = initChrome('medals');
var current = null; // ข้อมูลชุดล่าสุด ให้ป๊อปอัปโรงเรียนอ่านตอนแตะ
var cmp = { a: null, b: null }; // โรงเรียนที่เลือกเปรียบเทียบ (id) — คงไว้ข้ามรอบข้อมูลใหม่

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

/* ---------- เปรียบเทียบสองโรงเรียน ----------
   ค่าตั้งต้น: โรงเรียนเรา กับโรงเรียนที่อยู่ติดกันข้างบน (เราอันดับ 1 = เทียบกับอันดับ 2) */
function idOf(m) { return schoolId(schoolKey(m)); }
function fillSelect(sel, rows, value) {
  sel.innerHTML = rows.map(function (m) {
    return '<option value="' + esc(idOf(m)) + '"' + (idOf(m) === value ? ' selected' : '') + '>' + esc(m.rank + '. ' + m.school) + '</option>';
  }).join('');
}
function renderCompare(data) {
  var rows = data.medalTable || [];
  var out = document.getElementById('cmpOut');
  var selA = document.getElementById('cmpA'), selB = document.getElementById('cmpB');
  if (rows.length < 2) { out.innerHTML = emptyBox('ต้องมีอย่างน้อยสองโรงเรียน'); return; }
  var ids = rows.map(idOf);
  var meIdx = Math.max(0, rows.findIndex(function (m) { return m.isSelf; }));
  if (ids.indexOf(cmp.a) < 0) cmp.a = ids[meIdx];
  if (ids.indexOf(cmp.b) < 0 || cmp.b === cmp.a) cmp.b = ids[meIdx === 0 ? 1 : meIdx - 1];
  fillSelect(selA, rows, cmp.a);
  fillSelect(selB, rows, cmp.b);

  var A = rows[ids.indexOf(cmp.a)], B = rows[ids.indexOf(cmp.b)];
  var lines = MEDALS.map(function (k) { return { label: k.label, a: A[k.key], b: B[k.key] }; })
    .concat([{ label: 'รวม', a: total(A), b: total(B), strong: true }]);
  function side(m) {
    return '<div class="flex min-w-0 flex-col items-center gap-1.5 text-center">' + schoolCrest(m, 'size-14 shadow-panel') +
      '<span class="fs-14 leading-[1.3] ' + (m.isSelf ? 'text-brand' : 'text-fg') + '">' + esc(m.school) + '</span>' +
      '<span class="fs-13 text-fg-mute">อันดับ ' + m.rank + '</span></div>';
  }
  out.innerHTML =
    '<div class="grid grid-cols-[1fr_auto_1fr] items-start gap-3">' + side(A) + '<span class="pt-4 fs-14 text-fg-mute">เทียบกับ</span>' + side(B) + '</div>' +
    '<div class="mt-4 flex flex-col gap-2">' + lines.map(function (l) {
      var max = Math.max(l.a, l.b, 1);
      // ฝั่งที่มากกว่าเป็นสีชมพู เท่ากันเป็นสีกลางทั้งคู่ — ตัวเลขกำกับทุกแท่ง ไม่ต้องเดาจากความยาว
      var tone = function (x, y) { return x > y ? 'bg-brand' : 'bg-line-strong'; };
      return '<div class="grid grid-cols-[34px_1fr_64px_1fr_34px] items-center gap-2 fs-15' + (l.strong ? ' mt-1 border-t border-line pt-3' : '') + '">' +
        '<b class="text-right font-mono font-normal tabular-nums ' + (l.a > l.b ? 'text-brand' : 'text-fg') + '">' + l.a + '</b>' +
        '<span class="flex h-2.5 justify-end overflow-hidden rounded-full bg-surface-soft"><span class="block h-full rounded-full ' + tone(l.a, l.b) + '" style="width:' + (l.a / max * 100) + '%"></span></span>' +
        '<span class="text-center fs-13.5 text-fg-soft">' + l.label + '</span>' +
        '<span class="flex h-2.5 overflow-hidden rounded-full bg-surface-soft"><span class="block h-full rounded-full ' + tone(l.b, l.a) + '" style="width:' + (l.b / max * 100) + '%"></span></span>' +
        '<b class="font-mono font-normal tabular-nums ' + (l.b > l.a ? 'text-brand' : 'text-fg') + '">' + l.b + '</b>' +
      '</div>';
    }).join('') + '</div>';
}
function bindCompare() {
  document.getElementById('cmpA').addEventListener('change', function (e) { cmp.a = e.target.value; if (current) renderCompare(current); });
  document.getElementById('cmpB').addEventListener('change', function (e) { cmp.b = e.target.value; if (current) renderCompare(current); });
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
  renderCompare(data);
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
bindCompare();
loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
