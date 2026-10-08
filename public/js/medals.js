import { loadData, onFreshData, initChrome, renderMedalTable, showLoadError, el, esc, schoolCrest } from './common.js';
import { openSchoolPopup, refreshSchoolPopup } from './school-popup.js';

var chrome = initChrome('medals');
var current = null; // ข้อมูลชุดล่าสุด ให้ป๊อปอัปโรงเรียนอ่านตอนแตะ

/* ---------- โพเดียม 3 อันดับแรก ----------
   ลำดับบนจอเป็น 2–1–3 เหมือนแท่นรับรางวัลจริง แต่ลำดับใน DOM เป็น 1–2–3
   (ใช้ order ของ grid สลับตำแหน่ง) โปรแกรมอ่านหน้าจอจึงอ่านอันดับ 1 ก่อนเสมอ
   ความสูงแท่นบอกอันดับ ตัวเลขบนแท่นซ้ำอีกชั้นเพื่อไม่ต้องพึ่งความสูงอย่างเดียว */
var PODIUM = {
  1: { order: 'order-2', crest: 'size-[120px] fs-44 max-[560px]:size-[72px] max-[560px]:fs-28', base: 'h-[132px] max-[560px]:h-[92px]', edge: 'border-t-gold', num: 'text-gold-ink' },
  2: { order: 'order-1', crest: 'size-[92px] fs-34 max-[560px]:size-[56px] max-[560px]:fs-22', base: 'h-[96px] max-[560px]:h-[66px]', edge: 'border-t-silver', num: 'text-silver-ink' },
  3: { order: 'order-3', crest: 'size-[92px] fs-34 max-[560px]:size-[56px] max-[560px]:fs-22', base: 'h-[70px] max-[560px]:h-[48px]', edge: 'border-t-bronze', num: 'text-bronze-ink' }
};
var COINS = [['gold', 1, 'ทอง'], ['silver', 2, 'เงิน'], ['bronze', 3, 'ทองแดง']];

function renderPodium(rows) {
  var host = document.getElementById('medalPodium');
  host.innerHTML = '';
  // ตำแหน่งบนแท่นมาจากลำดับในตาราง (อันดับที่เสมอกันยังได้แท่นคนละขั้น) ส่วนตัวเลขแสดงอันดับจริง
  var top = rows.slice(0, 3);
  host.hidden = !top.length;

  top.forEach(function (m, i) {
    var p = PODIUM[i + 1];
    var name = m.fullName || m.school;
    var total = m.gold + m.silver + m.bronze;
    // แท่นตอบสนองแค่ตอนชี้/แตะ (ตราลอยขึ้น ชื่อเปลี่ยนสี) — ไม่ใช่ปุ่ม กดแล้วไม่เปิดอะไร
    var col = el('div',
      'group/pod flex min-w-0 flex-col items-center text-center text-fg ' + p.order,
      // ตราโรงเรียนเป็นตัวเอกของแท่น (อันดับ 1 ใหญ่สุด) — สีอันดับบอกอยู่แล้วที่ขอบแท่นกับตัวเลข
      schoolCrest(m, p.crest + ' shadow-panel transition-transform duration-200 group-hover/pod:-translate-y-1 group-active/pod:scale-95 motion-reduce:transition-none') +
      '<span class="mt-3 flex w-full min-w-0 flex-col items-center gap-2 px-1 max-[560px]:mt-2 max-[560px]:gap-1.5">' +
        // มือถือแท่นกว้างแค่ ~110px ชื่อเต็ม ("โรงเรียนสาธิตมหาวิทยาลัย…") ยาว 4–5 บรรทัดจนสามแท่นสูงไม่เท่ากัน
        // จึงใช้ชื่อย่อ (สาธิตปทุมวัน) บนจอแคบ ชื่อเต็มยังอยู่ใน aria-label และบนจอกว้าง
        '<span class="w-full fs-16.5 leading-[1.3] break-words group-hover/pod:text-brand-strong max-[560px]:fs-14">' +
          '<span class="max-[560px]:hidden">' + esc(name) + '</span>' +
          '<span class="hidden max-[560px]:inline">' + esc(m.school || name) + '</span></span>' +
        '<span class="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 max-[560px]:gap-x-1.5">' +
          COINS.map(function (c) {
            return '<span class="flex items-center gap-1" title="' + c[2] + '">' +
              '<img class="size-[20px] flex-none max-[560px]:size-[15px]" src="assets/medals/coin-' + c[1] + '.webp" alt="" width="64" height="64" decoding="async" />' +
              '<b class="font-mono fs-16 font-normal tabular-nums max-[560px]:fs-13.5' + (m[c[0]] ? '' : ' opacity-35') + '">' + m[c[0]] + '</b>' +
            '</span>';
          }).join('') +
        '</span>' +
      '</span>' +
      // แท่น: พื้นอ่อน ขอบบนเป็นสีเหรียญ ตัวเลขอันดับตัวโตกลางแท่น
      '<span class="mt-3 flex w-full flex-none flex-col items-center justify-start rounded-t-lg border border-b-0 border-line border-t-[5px] bg-surface pt-2.5 shadow-panel ' +
        p.base + ' ' + p.edge + ' max-[560px]:mt-2 max-[560px]:pt-1.5">' +
        '<span class="font-display fs-34 leading-none max-[560px]:fs-24 ' + p.num + '">' + m.rank + '</span>' +
        '<span class="mt-1 fs-13.5 text-fg-mute max-[560px]:fs-12">รวม ' + total + ' เหรียญ</span>' +
      '</span>');
    col.setAttribute('role', 'group');
    col.setAttribute('aria-label',
      'อันดับ ' + m.rank + ' ' + name + (m.isSelf ? ' (โรงเรียนของเรา)' : '') +
      ' ทอง ' + m.gold + ' เงิน ' + m.silver + ' ทองแดง ' + m.bronze + ' รวม ' + total);
    host.appendChild(col);
  });
}

function renderMedalList(data) {
  var rows = data.medalTable || [];
  renderPodium(rows);
  // 1–3 อยู่บนโพเดียมแล้ว ตารางจึงเริ่มที่แถวที่ 4 — ถ้ามีไม่ถึง 4 โรงเรียนก็ซ่อนแผงตารางทั้งแผง
  var rest = rows.slice(3);
  var list = document.getElementById('medalList');
  renderMedalTable(list, rest, { onPick: function (m, row) { openSchoolPopup(current, m, row); } });
  list.parentElement.hidden = !rest.length;
  document.getElementById('medalCount').textContent = rest.length
    ? 'อันดับ ' + rest[0].rank + '–' + rest[rest.length - 1].rank + ' · ทั้งหมด ' + rows.length + ' โรงเรียน'
    : '';
}

function renderAll(data) {
  current = data;
  renderMedalList(data);
  refreshSchoolPopup(data);
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
