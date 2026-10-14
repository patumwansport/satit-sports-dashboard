/* =========================================================
   charts.js — กราฟที่ใช้ร่วมกันระหว่างหน้าหลักกับหน้าอันดับเหรียญ (SVG วาดเอง ไม่มีไลบรารี)
   กฎร่วม: แกนเดียว · สีเหรียญ (ทอง/เงิน/ทองแดง) เป็นความหมายจริง และมีคำอธิบายสีกำกับเสมอ
   ตัวเลข/ป้ายเป็นสีตัวหนังสือ ไม่ใช่สีของแท่ง · ชี้/แตะแท่งดูตัวเลขได้ (<title>)
   ยังไม่มีข้อมูล = คืนข้อความบอก ไม่วาดแกนเปล่า
   ========================================================= */
import { esc, EMPTY_TEXT } from './common.js';

export var MEDALS = [
  { key: 'gold', label: 'ทอง', n: 1, fill: 'fill-gold', stroke: 'stroke-gold', dot: 'bg-gold' },
  { key: 'silver', label: 'เงิน', n: 2, fill: 'fill-silver', stroke: 'stroke-silver', dot: 'bg-silver' },
  { key: 'bronze', label: 'ทองแดง', n: 3, fill: 'fill-bronze', stroke: 'stroke-bronze', dot: 'bg-bronze' }
];
export function total(m) { return (m.gold || 0) + (m.silver || 0) + (m.bronze || 0); }
export function emptyBox(text) { return '<div class="' + EMPTY_TEXT + '">' + text + '</div>'; }

/** ชื่อใต้แท่ง: ตัด "สาธิต" กับวงเล็บท้ายชื่อทิ้ง ให้พอดีความกว้างแท่ง (ชื่อเต็มอยู่ใน <title>) */
export function shortName(m) { return String(m.school || '').replace(/^สาธิต/, '').replace(/\s*\(.*\)\s*/, '').trim() || m.school; }

export function medalLegend() {
  return '<div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 fs-13.5 text-fg-soft">' +
    MEDALS.map(function (k) { return '<span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full ' + k.dot + '"></span>' + k.label + '</span>'; }).join('') + '</div>';
}

/** สี่เหลี่ยมมุมโค้ง: rt = รัศมีมุมบน · rb = รัศมีมุมล่าง (0 = เหลี่ยม) */
function barPath(x, y, w, h, rt, rb) {
  rt = Math.min(rt, w / 2, h); rb = Math.min(rb, w / 2, h - rt);
  return 'M' + x + ' ' + (y + rt) + 'Q' + x + ' ' + y + ' ' + (x + rt) + ' ' + y + 'H' + (x + w - rt) +
    'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + rt) + 'V' + (y + h - rb) +
    'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - rb) + ' ' + (y + h) + 'H' + (x + rb) +
    'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - rb) + 'Z';
}

function niceMax(v) {
  if (v <= 5) return 5;
  var step = Math.pow(10, Math.floor(Math.log10(v)));
  var n = Math.ceil(v / step);
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * step;
}

/** กล่องตัวเลขตอนชี้/แตะแท่ง (หน้าตาแบบ tooltip ของ shadcn chart) — หัวเป็นชื่อเต็ม แถวละเหรียญ ปิดท้ายยอดรวม */
function barTip(m, idx) {
  var row = function (dot, label, val) {
    return '<div class="flex w-full items-center justify-between gap-2"><div class="flex items-center gap-1.5">' +
      (dot ? '<span class="size-2.5 shrink-0 rounded-xs ' + dot + '"></span>' : '') + '<span class="text-muted-foreground">' + label + '</span></div>' +
      '<span class="font-mono text-foreground tabular-nums">' + val + '</span></div>';
  };
  return '<div class="pointer-events-none absolute top-0 left-0 z-10 grid min-w-40 gap-2.5 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-xl" data-tip="' + idx + '" hidden>' +
    '<div class="mb-0.5 border-b border-border/50 pb-2 text-xs">' + esc(m.school) + '</div>' +
    MEDALS.map(function (k) { return row(k.dot, k.label, m[k.key] || 0); }).join('') +
    row('', 'รวม', total(m)) + '</div>';
}

/** แท่งซ้อน: ความสูงทั้งแท่ง = เหรียญรวม แบ่งชั้นทองแดง/เงิน/ทอง (ทองอยู่บนสุด) ยอดรวมกำกับบนแท่ง
    หน้าตาตามกราฟแท่งของ shadcn: เส้นตารางแนวนอนจาง ๆ ไม่มีเส้นแกน/ขีดแกน แท่งมุมโค้ง ชี้/แตะ/โฟกัสแท่งแล้วขึ้นกล่องตัวเลข */
export function stackedMedalChart(rows) {
  if (!rows.some(function (m) { return total(m) > 0; })) return emptyBox('ยังไม่มีการประกาศเหรียญรางวัล');
  var W = 360, H = 220, L = 4, B = 30, T = 22, plotH = H - B - T, plotW = W - L * 2;
  var max = niceMax(Math.max.apply(null, rows.map(total)));
  var gw = plotW / rows.length, bw = Math.min(48, gw * .62), grid = '', cols = '';
  for (var g = 0; g <= 4; g++) {
    var gy = T + plotH - plotH * g / 4;
    grid += '<line x1="' + L + '" x2="' + (W - L) + '" y1="' + gy + '" y2="' + gy + '" class="stroke-line" stroke-width="1"/>';
  }
  rows.forEach(function (m, idx) {
    var x = L + idx * gw + (gw - bw) / 2, y = T + plotH, layers = MEDALS.slice().reverse();
    var shown = layers.filter(function (k) { return m[k.key] > 0; }), bars = '';
    shown.forEach(function (k, i) {
      var h = plotH * m[k.key] / max;
      y -= h;
      // โค้งเฉพาะมุมบนของชั้นบนสุดกับมุมล่างของชั้นล่างสุด · เส้นขอบสีพื้นบาง ๆ แยกชั้นที่ติดกัน
      bars += '<path d="' + barPath(x, y, bw, h, i === shown.length - 1 ? 4 : 0, i === 0 ? 4 : 0) + '" class="' + k.fill + ' stroke-surface" stroke-width="1"/>';
    });
    var label = esc(m.school) + ' ทอง ' + (m.gold || 0) + ' เงิน ' + (m.silver || 0) + ' ทองแดง ' + (m.bronze || 0) + ' รวม ' + total(m);
    // ทั้งคอลัมน์เป็นพื้นที่ชี้ (เหมือน recharts) จึงชี้แท่งเตี้ย ๆ ได้ง่าย · โฟกัสด้วยคีย์บอร์ดได้
    cols += '<g data-col="' + idx + '" tabindex="0" role="img" aria-label="' + label + '" class="cursor-default outline-none transition-opacity duration-150 group-data-[active]/chart:not-data-[on]:opacity-45 motion-reduce:transition-none">' +
      '<rect x="' + (L + idx * gw) + '" y="0" width="' + gw + '" height="' + H + '" fill="transparent"/>' + bars +
      '<text x="' + (x + bw / 2) + '" y="' + (y - 7) + '" text-anchor="middle" font-size="13" class="fill-fg font-mono">' + total(m) + '</text>' +
      '<text x="' + (L + idx * gw + gw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" class="' + (m.isSelf ? 'fill-brand' : 'fill-fg-mute') + '">' + esc(shortName(m).slice(0, 10)) + '</text></g>';
  });
  return medalLegend() +
    '<div class="group/chart relative" data-bar-chart>' +
      '<svg class="block h-auto w-full overflow-visible font-body" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="เหรียญรวมของ ' + rows.length + ' อันดับแรก">' + grid + cols + '</svg>' +
      rows.map(barTip).join('') +
    '</div>';
}

/* กล่องตัวเลขของกราฟแท่ง: ผูกครั้งเดียวที่ document (กราฟถูกวาดใหม่ด้วย innerHTML บ่อย จึงไม่ผูกกับตัวกราฟ)
   ชี้ = กล่องตามเมาส์ทางขวา (ชนขอบแล้วพลิกไปซ้าย) · แตะ = ค้างจนแตะที่อื่น · โฟกัสคีย์บอร์ด = กล่องเหนือแท่ง */
function showTip(col, cx, cy) {
  var box = col.closest('[data-bar-chart]'), idx = col.getAttribute('data-col');
  hideTips();
  var tip = box.querySelector('[data-tip="' + idx + '"]');
  if (!tip) return;
  box.setAttribute('data-active', ''); col.setAttribute('data-on', '');
  tip.hidden = false;
  var r = box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, tw = tip.offsetWidth, th = tip.offsetHeight;
  var left = x + 12 + tw > r.width ? x - 12 - tw : x + 12;
  tip.style.transform = 'translate(' + Math.max(0, Math.min(left, r.width - tw)) + 'px,' + Math.max(0, Math.min(y - th / 2, r.height - th)) + 'px)';
}
function hideTips() {
  document.querySelectorAll('[data-bar-chart][data-active]').forEach(function (box) {
    box.removeAttribute('data-active');
    box.querySelectorAll('[data-on]').forEach(function (c) { c.removeAttribute('data-on'); });
    box.querySelectorAll('[data-tip]').forEach(function (t) { t.hidden = true; });
  });
}
if (typeof document !== 'undefined') {
  var onPointer = function (e) {
    var col = e.target.closest && e.target.closest('[data-bar-chart] [data-col]');
    if (col) showTip(col, e.clientX, e.clientY);
    else if (e.type !== 'pointermove' || e.pointerType === 'mouse') hideTips();
  };
  document.addEventListener('pointermove', onPointer);
  document.addEventListener('pointerdown', onPointer);
  document.addEventListener('focusin', function (e) {
    var col = e.target.closest && e.target.closest('[data-bar-chart] [data-col]');
    if (!col) return hideTips();
    if (col.hasAttribute('data-on')) return; // คลิกแท่งที่เปิดกล่องอยู่แล้ว ไม่ต้องย้ายกล่อง
    var b = col.getBoundingClientRect();
    showTip(col, b.left + b.width / 2, b.top + b.height / 3);
  });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('[data-bar-chart]')) hideTips(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTips(); });
}

/** วงโดนัทสัดส่วน ทอง/เงิน/ทองแดง ของโรงเรียนหนึ่ง — สามสีมีความหมายจริง ตัวเลขกับ % อยู่ในคำอธิบายข้าง ๆ */
export function medalShareChart(m) {
  var sum = total(m || {});
  if (!sum) return emptyBox('ยังไม่มีเหรียญรางวัล');
  var R = 38, C = 2 * Math.PI * R, offset = 0, rings = '';
  MEDALS.forEach(function (k) {
    if (!m[k.key]) return;
    var len = C * m[k.key] / sum;
    // เว้นช่อง 1.5 หน่วยระหว่างชิ้น (เมื่อมีมากกว่าหนึ่งชิ้น) ให้เห็นรอยต่อ
    var gap = m[k.key] === sum ? 0 : 1.5;
    rings += '<circle cx="50" cy="50" r="' + R + '" fill="none" class="' + k.stroke + '" stroke-width="16" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"><title>' + k.label + ' ' + m[k.key] + '</title></circle>';
    offset += len;
  });
  return '<div class="flex items-center gap-5 max-[400px]:gap-3">' +
    '<div class="relative size-[132px] flex-none max-[400px]:size-[110px]">' +
      '<svg class="size-full -rotate-90" viewBox="0 0 100 100" role="img" aria-label="สัดส่วนเหรียญ ทอง ' + m.gold + ' เงิน ' + m.silver + ' ทองแดง ' + m.bronze + '">' + rings + '</svg>' +
      '<span class="absolute inset-0 flex flex-col items-center justify-center"><b class="font-display fs-28 leading-none font-normal text-brand-strong">' + sum + '</b><span class="fs-12.5 text-fg-mute">เหรียญ</span></span>' +
    '</div>' +
    '<ul class="m-0 flex flex-1 list-none flex-col gap-2 p-0 fs-14.5">' + MEDALS.map(function (k) {
      return '<li class="flex items-center gap-2"><span class="size-3 flex-none rounded-full ' + k.dot + '"></span><span class="flex-1 text-fg-soft">' + k.label + '</span>' +
        '<b class="font-mono font-normal text-fg tabular-nums">' + m[k.key] + '</b><span class="w-[52px] text-right fs-13 text-fg-mute tabular-nums">' + (m[k.key] / sum * 100).toFixed(1) + '%</span></li>';
    }).join('') + '</ul>' +
  '</div>';
}
