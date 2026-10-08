import {
  el, esc, paintUiIcons, loadData, onFreshData, initChrome, sportIcon, sportName, statusChip,
  allDayItems, currentDay, isToday, dayLabel, dayPhotos, teamSides, splitScore,
  schoolCores, matchScore, schoolByText, schoolCrest,
  sportMascotImg, eventParts, EMPTY_TEXT, showLoadError
} from './common.js';
import { MONTHS_TH, WEEKDAYS_TH } from './format.js';

var chrome = initChrome('home');
var RESULTS_TOP = 4;      // จำนวนการ์ดผลที่ประกาศแล้วบนหน้าหลัก = 4 รายการล่าสุด (กริด 2×2)

/* =========================================================
   ภาพบรรยากาศ — ดึงลิงก์รูปจากแท็บ "img" ในชีต (ดู dayPhotos ใน common.js)
   ตอนนี้ชีตมีแค่ลิงก์ ภาพจึงหมุนวนได้ทุกวัน · ชีตยังไม่มีรูป = ซ่อนทั้งแถบ ไม่เว้นกล่องว่างไว้
   ========================================================= */
var SHOW_HERO = false;        // ปิดแถบภาพบนหน้าหลัก · เปลี่ยนเป็น true ถ้าอยากให้ภาพกลับมา
var HERO_MS = 6500;          // จังหวะเปลี่ยนรูปปกติ
var HERO_MS_REDUCED = 9000;   // โหมดลดการเคลื่อนไหว: ไม่มีเฟดคอยบอกล่วงหน้า จึงทิ้งจังหวะนานขึ้น

var hero = {
  key: null,    // รายการภาพชุดปัจจุบัน ใช้เทียบว่าข้อมูลรอบใหม่เปลี่ยนภาพหรือไม่ (null = ยังไม่เคยวาด)
  i: 0,
  n: 0,
  timer: null,
  paused: false
};

function heroReduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

/**
 * โหลดเฉพาะรูปที่กำลังแสดงกับรูปถัดไป
 * สไลด์ทุกใบซ้อนกันอยู่ในจอ loading="lazy" จึงไม่ช่วยอะไร — ถ้าใส่ src ครบตั้งแต่แรก
 * 15 รูปก็คือดาวน์โหลดหลายเมกฯ พร้อมกันตอนเปิดหน้า และยิงพร็อกซีรัวทีเดียว 15 คำขอ
 */
function heroLoad(i) {
  var stage = document.getElementById('heroStage');
  [i, (i + 1) % hero.n].forEach(function (k) {
    var img = stage.children[k] && stage.children[k].querySelector('img[data-src]');
    if (!img) return;
    img.src = img.getAttribute('data-src');
    img.removeAttribute('data-src');
  });
}

/** เส้นคืบหน้าที่ขอบล่าง — เริ่มนับใหม่ทุกครั้งที่เปลี่ยนรูป */
function heroTick() {
  var bar = document.getElementById('heroBar');
  if (!bar) return;
  if (hero.n < 2) { bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; return; }
  if (heroReduced()) {
    // เส้นวิ่งก็คือการเคลื่อนไหว โหมดนี้จึงบอกความคืบหน้าเป็นขั้น ๆ ตามรูปที่กำลังแสดงแทน
    bar.style.animation = 'none';
    bar.style.transform = 'scaleX(' + ((hero.i + 1) / hero.n) + ')';
    return;
  }
  bar.style.transform = '';
  bar.style.animation = 'none';
  void bar.offsetWidth;   // บังคับ reflow ไม่งั้นเบราว์เซอร์มองว่าเป็นอนิเมชันเดิมแล้วไม่เริ่มนับใหม่
  bar.style.animation = 'heroFill ' + HERO_MS + 'ms linear forwards';
  bar.style.animationPlayState = hero.paused ? 'paused' : 'running';
}

function heroShow(i) {
  var stage = document.getElementById('heroStage');
  if (!hero.n) return;
  hero.i = (i + hero.n) % hero.n;
  Array.prototype.forEach.call(stage.children, function (slide, k) {
    var on = k === hero.i;
    // สไลด์ที่กำลังแสดงบอกด้วย data-on ส่วนหน้าตา (จาง/ทึบ) อยู่ที่ตัวแปร data-[on=true] ในคลาสของสไลด์เอง
    slide.dataset.on = on ? 'true' : 'false';
    slide.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  document.getElementById('heroCount').textContent = (hero.i + 1) + ' / ' + hero.n;
  heroLoad(hero.i);
  heroTick();
}

function heroAutoplay() {
  clearInterval(hero.timer);
  if (hero.n < 2) return;
  // เครื่องที่เปิด "ลดการเคลื่อนไหว" ยังต้องได้เห็นภาพครบทุกใบ ไม่ใช่ค้างอยู่ใบแรกใบเดียว
  // จึงเลื่อนต่อแต่ตัดภาพทันทีไม่เฟด (ดู .hero-slide ใน styles.css)
  hero.timer = setInterval(function () {
    if (!hero.paused && !document.hidden) heroShow(hero.i + 1);
  }, heroReduced() ? HERO_MS_REDUCED : HERO_MS);
}

/** ชี้เมาส์/โฟกัสค้างไว้ = หยุดดูรูปนั้น เส้นคืบหน้าต้องหยุดตามไม่ให้ขัดกับสิ่งที่เห็น */
function heroPause(on) {
  hero.paused = on;
  var bar = document.getElementById('heroBar');
  if (bar && bar.style.animation && bar.style.animation !== 'none') {
    bar.style.animationPlayState = on ? 'paused' : 'running';
  }
}

function heroSlide(data, day, p, idx, total) {
  var sport = sportName(data, p.sportId);
  var item = ((day && day.items) || []).filter(function (i) {
    return i.sportId === p.sportId && (!p.time || i.time === p.time);
  })[0];
  var status = (item && item.status) || 'done';

  // ภาพจากชีตที่มีแต่ลิงก์ ไม่รู้ว่าเป็นกีฬาอะไรของวันไหน — ปล่อยเป็นภาพเปล่า
  // ดีกว่าติดป้ายสถานะที่เดาเอาเองแล้วผิด
  var titled = !!(p.caption || sport || p.venue || p.credit || p.time);

  var alt = titled
    ? 'ภาพการแข่งขัน ' + (p.caption || sport) + (p.venue ? ' ที่' + p.venue : '') + ' วัน' + dayLabel(day)
    : 'ภาพบรรยากาศการแข่งขัน ภาพที่ ' + (idx + 1) + ' จาก ' + total;

  // รูปแรกใส่ src เลย ที่เหลือพักไว้ใน data-src ให้ heroLoad() ค่อยเติมเมื่อใกล้ถึงคิว
  // no-referrer: เว็บฝากรูปหลายเจ้ากันการฝังรูปข้ามเว็บโดยดูจาก Referer แล้วตอบ error แทนรูป
  var media = p.src
    ? '<img class="block h-full w-full bg-surface-soft object-cover" ' + (idx === 0 ? 'src' : 'data-src') + '="' + esc(p.src) + '" ' +
      'alt="' + esc(alt) + '" width="1200" height="675" referrerpolicy="no-referrer" decoding="async" />'
    : '<span class="absolute inset-0 flex items-center justify-center bg-ink text-on-ink-soft">' +
        sportIcon(p.sportId, 'h-[30%] w-[30%] opacity-90') + '</span>';

  // ภาพที่ไม่มีคำบรรยายจะไม่มีแถบไล่สีของคำบรรยายรองอยู่ ต้องปูเงาบาง ๆ ให้จุดเลื่อนภาพยังมองเห็น
  var plain = " after:absolute after:inset-x-0 after:bottom-0 after:h-[84px] after:bg-linear-to-t" +
    " after:from-[oklch(16%_0.02_260/.55)] after:to-[oklch(16%_0.02_260/0)] after:content-['']";

  // ลดการเคลื่อนไหว = ตัดภาพทันที ไม่เฟด แต่ยังเลื่อนภาพต่อ (ดู heroAutoplay)
  var slide = el('figure',
    'pointer-events-none absolute inset-0 m-0 opacity-0 transition-opacity duration-[450ms] ease-out' +
    ' data-[on=true]:pointer-events-auto data-[on=true]:opacity-100 motion-reduce:transition-none' +
    (titled ? '' : plain),
    media +
    (titled
      ? '<figcaption class="absolute inset-x-0 bottom-0 bg-linear-to-t from-[oklch(16%_0.02_260/.94)] via-[oklch(16%_0.02_260/.72)] via-42% to-[oklch(16%_0.02_260/0)] px-[22px] pt-[46px] pb-5 max-[560px]:px-4 max-[560px]:pt-10 max-[560px]:pb-4">' +
          '<span class="mb-[9px] flex flex-wrap items-center gap-2">' +
            statusChip(status) +
            (sport ? '<span class="rounded-full bg-white/[.18] px-[11px] py-1 fs-13 text-white">' + esc(sport) + '</span>' : '') +
            (dayLabel(day) ? '<span class="rounded-full bg-white/[.18] px-[11px] py-1 fs-13 text-white">' + esc(dayLabel(day)) + '</span>' : '') +
          '</span>' +
          '<p class="m-0 max-w-[34ch] font-display fs-22.5 leading-[1.35] text-balance text-white max-[560px]:fs-20">' + esc(p.caption || sport) + '</p>' +
          '<p class="mt-1.5 fs-14 text-white/[.82]">' +
            [p.time, p.venue, p.credit ? 'ภาพ: ' + p.credit : ''].filter(Boolean).map(esc).join(' · ') +
          '</p>' +
        '</figcaption>'
      : ''));
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'ภาพ');
  slide.setAttribute('aria-label', (idx + 1) + ' จาก ' + total);
  return slide;
}

function renderHero(data, day) {
  var stage = document.getElementById('heroStage');
  var photos = SHOW_HERO ? dayPhotos(data, day) : [];

  var key = photos.map(function (p) { return p.id || p.src; }).join('|');
  if (key === hero.key) return;   // ภาพชุดเดิม — ไม่ต้องสร้างใหม่ให้สไลด์กระโดดกลับภาพแรก
  hero.key = key;

  stage.innerHTML = '';
  hero.n = photos.length;
  hero.i = 0;

  // ยังไม่มีภาพในชีต ให้ซ่อนทั้งแถบ ดีกว่าเว้นกล่องว่างไว้บนสุดของหน้า
  document.getElementById('hero').hidden = !photos.length;
  if (!photos.length) {
    clearInterval(hero.timer);
    return;
  }

  photos.forEach(function (p, i) { stage.appendChild(heroSlide(data, day, p, i, photos.length)); });

  // รูปเดียวไม่มีอะไรให้เลื่อน ตัวบอกตำแหน่งก็ไม่ต้องมี
  var single = photos.length < 2;
  document.getElementById('heroCount').hidden = single;
  document.getElementById('heroProgress').hidden = single;

  paintUiIcons(stage);
  heroShow(0);
  heroAutoplay();
}

function bindHero() {
  var box = document.getElementById('hero');
  // ไม่มีปุ่มลูกศรแล้ว แต่ยังรับลูกศรซ้าย/ขวาจากคีย์บอร์ด เผื่อคนที่ไม่ได้ใช้เมาส์
  ['pointerenter', 'focusin'].forEach(function (e) { box.addEventListener(e, function () { heroPause(true); }); });
  ['pointerleave', 'focusout'].forEach(function (e) { box.addEventListener(e, function () { heroPause(false); }); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { heroShow(hero.i - 1); heroAutoplay(); }
    if (e.key === 'ArrowRight') { heroShow(hero.i + 1); heroAutoplay(); }
  });
}

/* ===================== แมตช์ที่กำลังแข่ง ===================== */
/* =========================================================
   การ์ดแมตช์ — การ์ดที่กินความกว้างทั้งแถว (วันที่มีรายการเดียว หรือใบสุดท้ายของแถวที่ไม่เต็ม)
   เปลี่ยนเป็นแนวนอนตั้งแต่จอ 700px ขึ้นไป แทนการยืดการ์ดแนวตั้งให้กว้างจนเนื้อหาลอย
   ยกเว้นชุด 3 ใบ ที่พอถึง 1000px จะได้ 3 คอลัมน์เต็มแถวพอดี ใบสุดท้ายจึงกลับเป็นแนวตั้งเหมือนใบอื่น
   ========================================================= */
var CARD_PLAIN = { card: '', top: '', ic: '', icIcon: '', art: '', mascot: '', sport: '', kind: '', body: '', score: '', crest: '', foot: '' };

/** ชุดคลาสของการ์ดแนวนอน (มีผลตั้งแต่ 700px) */
var CARD_WIDE = {
  card: ' min-[700px]:grid min-[700px]:grid-cols-[minmax(0,1fr)_minmax(300px,42%)] min-[700px]:content-center min-[700px]:items-center min-[700px]:gap-x-[34px] min-[700px]:gap-y-2 min-[700px]:px-[26px] min-[700px]:py-[22px]',
  top: ' min-[700px]:col-start-1 min-[700px]:row-start-1 min-[700px]:gap-[13px]',
  ic: ' min-[700px]:size-[46px] min-[700px]:rounded-[14px]',
  icIcon: ' min-[700px]:size-[25px]',
  art: ' min-[700px]:min-h-[56px] min-[700px]:w-[46px]',
  mascot: ' min-[700px]:max-h-[60px]',
  sport: ' min-[700px]:fs-21.5',
  kind: ' min-[700px]:fs-15',
  body: ' min-[700px]:col-start-2 min-[700px]:row-span-2 min-[700px]:row-start-1 min-[700px]:border-l min-[700px]:border-line min-[700px]:py-1 min-[700px]:pl-[30px]',
  score: ' min-[700px]:fs-40.5',
  crest: ' min-[700px]:size-[52px] min-[700px]:fs-22.5',
  foot: ' min-[700px]:col-start-1 min-[700px]:row-start-2 min-[700px]:border-t-0 min-[700px]:pt-0.5'
};

/** ...แล้วถอยกลับเป็นการ์ดแนวตั้งที่ 1000px (เฉพาะใบสุดท้ายของชุด 3 ใบ) */
var CARD_REVERT = {
  card: ' min-[1000px]:flex min-[1000px]:flex-col min-[1000px]:items-stretch min-[1000px]:gap-3 min-[1000px]:px-[18px] min-[1000px]:pt-[15px] min-[1000px]:pb-3.5',
  top: ' min-[1000px]:gap-[11px]',
  ic: ' min-[1000px]:size-[38px] min-[1000px]:rounded-xl',
  icIcon: ' min-[1000px]:size-[22px]',
  art: ' min-[1000px]:min-h-[46px] min-[1000px]:w-[38px]',
  mascot: ' min-[1000px]:max-h-[50px]',
  sport: ' min-[1000px]:fs-17.5',
  kind: ' min-[1000px]:fs-14',
  body: ' min-[1000px]:border-l-0 min-[1000px]:py-0.5 min-[1000px]:pl-0',
  score: ' min-[1000px]:fs-30.5',
  crest: ' min-[1000px]:size-11 min-[1000px]:fs-20',
  foot: ' min-[1000px]:border-t min-[1000px]:pt-[11px]'
};

/** ตราหน้าการ์ด: หาโรงเรียนจากชื่อทีมเพื่อใช้โลโก้จริง ไม่เจอก็ใช้ตัวอักษรแรก */
function crest(data, name, size, isSelf) {
  return schoolCrest(schoolByText(data, name) || { school: name }, size,
    isSelf ? 'border-transparent bg-brand-100 text-brand-strong' : '');
}

/** @param {string} [mode] - '' การ์ดปกติ · 'wide' แนวนอน · 'wide-3' แนวนอนแล้วถอยกลับที่ 1000px */
function matchCard(data, item, cores, mode) {
  var sides = teamSides(item.teams);
  var score = splitScore(item.score);
  var sport = sportName(data, item.sportId);
  var head = eventParts(sport, item.event);

  // ป้าย "ยังไม่เป็นทางการ" ติดเฉพาะรายการที่มีผลกรอกไว้แล้ว รายการที่ยังไม่แข่งไม่มีผลให้พูดถึง
  var foot = [item.venue, (item.unofficial && item.score) ? 'ผลยังไม่เป็นทางการ' : '']
    .filter(Boolean).map(esc).join(' · ');

  var live = item.status === 'live';
  var w = mode ? CARD_WIDE : CARD_PLAIN;              // ชุดคลาสของการ์ดแนวนอน
  var r = mode === 'wide-3' ? CARD_REVERT : CARD_PLAIN; // ...และชุดที่ถอยกลับเป็นแนวตั้ง

  // ฝ่ายไหนนำ/ชนะ ใช้บอกด้วยสีของตัวเลข (เทียบเป็นตัวเลขเท่านั้น สกอร์ที่ไม่ใช่ตัวเลขไม่เน้นสี)
  // ผลที่ประกาศแล้ว: ฝ่ายชนะเป็นสีเน้น ฝ่ายแพ้จาง · แมตช์สดใช้สีสถานะทั้งคู่
  var lead = ['', ''];
  if (score && !live) {
    var a = parseInt(score[0], 10), b = parseInt(score[1], 10);
    if (!isNaN(a) && !isNaN(b) && a !== b) {
      lead = a > b ? ['text-win', 'text-fg-mute'] : ['text-fg-mute', 'text-win'];
    }
  }
  if (live) lead = ['text-live', 'text-live'];

  var crestSize = 'size-11 fs-20' + w.crest + r.crest;
  // ไม่ย่อลงบนมือถือ: มือถือคือจอหลักของเว็บนี้ และชื่อโรงเรียนคือสิ่งที่ต้องอ่านออก
  // ตั้งแต่แวบแรกว่าคู่ไหนเป็นของเรา
  var nameCls = 'fs-15 leading-[1.35] ';
  var scoreBox = '<div class="flex items-baseline gap-[7px] font-mono fs-30.5 tabular-nums' + w.score + r.score + '">';
  var bodyBox = '<div class="grid items-center gap-2.5 py-0.5' + w.body + r.body;

  var body;
  if (sides.length >= 2) {
    var selfA = matchScore(sides[0], cores) > 0, selfB = matchScore(sides[1], cores) > 0;
    // แยกตรากับชื่อเป็นคนละแถว: ตราสองฝั่งและสกอร์อยู่แนวเดียวกันเสมอ ชื่อชิดบนใต้ตรา
    // ชื่อยาวที่ตัดสองบรรทัดจึงไม่ดันตราฝั่งนั้นให้เยื้องขึ้นจากอีกฝั่ง · สองคอลัมน์ข้างกว้างเท่ากันเป๊ะ
    var nameA = 'col-start-1 row-start-2 min-w-0 self-start text-center ' + nameCls + (selfA ? 'text-fg' : 'text-fg-soft');
    var nameB = 'col-start-3 row-start-2 min-w-0 self-start text-center ' + nameCls + (selfB ? 'text-fg' : 'text-fg-soft');
    body =
      bodyBox + ' grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-y-2">' +
        '<div class="col-start-1 row-start-1 flex justify-center">' + crest(data, sides[0], crestSize, selfA) + '</div>' +
        scoreBox.replace('class="', 'class="col-start-2 row-start-1 self-center ') +
          (score
            ? '<span class="' + lead[0] + '">' + esc(score[0]) + '</span>' +
              '<span class="fs-21.5 text-fg-mute" aria-hidden="true">–</span>' +
              '<span class="' + lead[1] + '">' + esc(score[1]) + '</span>'
            : '<span class="font-body fs-15.5 text-fg-soft">' + esc(item.time || 'รอเริ่ม') + '</span>') +
        '</div>' +
        '<div class="col-start-3 row-start-1 flex justify-center">' + crest(data, sides[1], crestSize, selfB) + '</div>' +
        '<span class="' + nameA + '">' + esc(sides[0]) + '</span>' +
        '<span class="' + nameB + '">' + esc(sides[1]) + '</span>' +
      '</div>';
  } else {
    // รายการที่ไม่ใช่การพบกันสองฝ่าย: ทีมเดียวเรียงแนวนอนชิดซ้าย ไม่ต้องมีคอลัมน์ว่างคู่กัน
    body =
      bodyBox + ' grid-cols-[1fr_auto]">' +
        '<div class="flex min-w-0 flex-row items-center gap-2 text-left">' + crest(data, sides[0] || sport, crestSize) +
          '<span class="' + nameCls + 'text-fg-soft">' + esc(sides[0] || 'รวมทุกโรงเรียน') + '</span></div>' +
        scoreBox + '<span class="font-body fs-15.5 text-fg-soft">' + esc(item.score || item.time || '') + '</span></div>' +
      '</div>';
  }

  // หัวการ์ด: มาสคอตประจำกีฬายืนเต็มตัวข้างชื่อกีฬา ไม่มีกล่องครอบเพื่อให้ได้ขนาดใหญ่สุด
  // กีฬาที่ยังไม่มีมาสคอตใช้ไอคอนเส้นในกล่องสีเน้นเหมือนเดิม
  var mascot = sportMascotImg(item.sportId, 'max-h-[50px] w-full object-contain object-bottom' + w.mascot + r.mascot);
  var badge = mascot
    ? '<span class="flex min-h-[46px] w-[38px] flex-none items-end justify-center self-stretch' + w.art + r.art + '">' + mascot + '</span>'
    : '<span class="flex size-[38px] flex-none items-center justify-center overflow-hidden rounded-xl ' +
        (live ? 'bg-live-bg text-live' : 'bg-brand-100 text-brand-strong') + w.ic + r.ic + '">' +
        sportIcon(item.sportId, 'size-[22px]' + w.icIcon + r.icIcon) + '</span>';

  // การ์ดอยู่ในแผงสีขาวแล้ว จึงใช้พื้นอ่อนแทนเงา ให้เป็นภาษาเดียวกับตารางเหรียญ
  // การ์ดสด: ยกขึ้นเป็นพื้นขาวและตีกรอบสีสด ให้สะดุดตากว่าการ์ดที่ประกาศผลแล้ว
  return el('article',
    'flex flex-col gap-3 rounded-lg border px-[18px] pt-[15px] pb-3.5 ' +
    (live ? 'border-live bg-surface' : 'border-line bg-surface-soft') + w.card + r.card,
    // min-h ตรึงความสูงหัวการ์ดให้เท่ากันทุกใบ ใบที่ยังไม่มีมาสคอตจะได้ไม่ลอยสูงกว่าเพื่อน
    '<div class="flex min-h-[46px] items-start gap-2.5' + w.top + r.top + '">' +
      badge +
      '<span class="flex min-w-0 flex-1 flex-col gap-0.5">' +
        '<span class="font-display fs-17.5 leading-[1.3] text-fg' + w.sport + r.sport + '">' + esc(head.sport) + '</span>' +
        (head.kind ? '<span class="fs-14 leading-[1.4] text-fg-mute' + w.kind + r.kind + '">' + esc(head.kind) + '</span>' : '') +
      '</span>' +
      // สีสถานะเหลือไว้เฉพาะ "สด" ที่เป็นข้อมูลจริง ๆ ของแมตช์ที่กำลังเกิดขึ้น
      (live ? '<span class="mt-[3px] flex-none">' + statusChip('live') + '</span>' : '') +
    '</div>' +
    body +
    // ชีตกรอกว่า "ไม่เป็นทางการ" = กรรมการยังไม่รับรองผล ต้องบอกไว้ ไม่ปล่อยให้อ่านเป็นผลรับรองแล้ว
    (foot ? '<p class="m-0 border-t border-line pt-[11px] fs-14 text-fg-mute' + w.foot + r.foot + '">' + foot + '</p>' : ''));
}

/**
 * รายการที่ "ประกาศผลแล้วและกรอกสกอร์ไว้" เรียงจากที่ประกาศล่าสุดมาก่อน
 * ไล่จากท้ายรายการ เพราะชีตเรียงตามวันแล้วตามเวลาแข่ง รายการท้ายสุดคือที่เพิ่งกรอกผล
 * ดึงข้ามวันได้ วันที่เพิ่งเริ่มแข่งจะได้ไม่เหลือการ์ดแค่ใบเดียว
 */
function announcedResults(data, limit) {
  var rows = [];
  (data.days || []).forEach(function (d) {
    (d.items || []).forEach(function (i) {
      if (i.status === 'done' && i.score) rows.push({ item: i, day: d });
    });
  });
  return rows.slice(-limit).reverse();
}

/* จำนวนคอลัมน์ผูกกับจำนวนการ์ด ไม่ใช้ auto-fit เพราะ auto-fit ปล่อยให้แถวสุดท้าย
   เหลือช่องว่างเมื่อจำนวนการ์ดหารไม่ลงตัว — ใบสุดท้ายของแถวที่ไม่เต็มจะยืดกินคอลัมน์ที่เหลือแทน
   3 รายการต้องอยู่แถวเดียวกัน จึงเปิด 3 คอลัมน์ให้เร็วกว่าชุดอื่น (แคบกว่า 1000px การ์ดจะเหลือ
   กว้างไม่ถึง 170px ตราโรงเรียนสองข้างกับสกอร์จะเบียดกัน)
   4 รายการบนจอกว้างก็วางแถวเดียว — ที่ 1400px การ์ดยังกว้าง ~250px */
var GRID_BASE = 'grid grid-cols-1 gap-4';
var GRID_BY_COUNT = {
  1: GRID_BASE,
  2: GRID_BASE + ' min-[700px]:grid-cols-2',
  3: GRID_BASE + ' min-[700px]:grid-cols-2 min-[1000px]:grid-cols-3',
  4: GRID_BASE + ' min-[700px]:grid-cols-2 min-[1400px]:grid-cols-4',
  5: GRID_BASE + ' min-[700px]:grid-cols-2 min-[1080px]:grid-cols-3',
  6: GRID_BASE + ' min-[700px]:grid-cols-2 min-[1080px]:grid-cols-3'
};
/** ใบสุดท้ายของชุดที่แถวไม่เต็ม ยืดกินคอลัมน์ที่เหลือ */
var SPAN_LAST = { 3: 'min-[700px]:col-span-2 min-[1000px]:col-span-1', 5: 'min-[700px]:col-span-2' };
/** ...และเมื่อกว้างทั้งแถวแล้ว ก็เปลี่ยนเป็นการ์ดแนวนอนด้วย */
var WIDE_LAST = { 1: 'wide', 3: 'wide-3', 5: 'wide' };

function renderLive(data, day) {
  var host = document.getElementById('liveGrid'); host.innerHTML = '';
  var flag = document.getElementById('liveFlag');
  var title = document.getElementById('liveTitle');
  var self = data.medalTable.filter(function (m) { return m.isSelf; })[0];
  var cores = self ? schoolCores(self) : [];
  var items = (day && day.items) || [];

  // ลำดับความสำคัญ: กำลังแข่ง > ผลที่ประกาศแล้วล่าสุด > รายการถัดไป (เมื่อยังไม่มีผลเลย)
  var live = items.filter(function (i) { return i.status === 'live'; });
  var upcoming = items.filter(function (i) { return i.status === 'upcoming'; });
  var announced = announcedResults(data, RESULTS_TOP);

  var list, heading;
  if (live.length) {
    list = live.slice(0, 6);
    heading = 'กำลังแข่งขัน';
  } else if (announced.length) {
    list = announced.map(function (r) { return r.item; });
    var sameDay = announced.every(function (r) { return r.day === day; });
    heading = (sameDay && dayLabel(day)) ? 'ผลการแข่งขันวัน' + dayLabel(day) : 'ผลการแข่งขันล่าสุด';
  } else {
    list = upcoming.slice(0, 3);
    heading = 'รายการถัดไป';
  }

  flag.hidden = !live.length;
  title.textContent = heading;

  if (!list.length) {
    host.appendChild(el('div', EMPTY_TEXT, 'ยังไม่มีรายการแข่งขันของวัน' + esc(dayLabel(day) || 'นี้')));
    return;
  }

  host.className = GRID_BY_COUNT[list.length] || GRID_BY_COUNT[6];
  var last = list.length - 1;
  list.forEach(function (i, k) {
    var span = (k === last && SPAN_LAST[list.length]) || '';
    var card = matchCard(data, i, cores, k === last ? WIDE_LAST[list.length] : '');
    if (span) card.className += ' ' + span;
    host.appendChild(card);
  });
  paintUiIcons(host);
}

/* ===================== แถบอันดับของโรงเรียนเรา =====================
   หน้าหลักตอบคำถามเดียว: "ตอนนี้เราอยู่อันดับไหน" ตัวเลขอันดับจึงเป็นของชิ้นใหญ่สุดในแถบ
   ส่วนตารางอันดับทั้ง 16 โรงเรียนอยู่หน้า "อันดับเหรียญรางวัล" — ไม่เอามาย่อซ้ำที่นี่อีก
   ========================================================= */
var MEDAL_KINDS = [['gold', 'ทอง', 'bg-gold', 1], ['silver', 'เงิน', 'bg-silver-ink', 2], ['bronze', 'ทองแดง', 'bg-bronze', 3]];

var RB_MEDAL = 'inline-flex items-center gap-[6px] fs-15 whitespace-nowrap text-fg-soft';
var RB_NUM = 'font-mono fs-21 font-normal text-fg tabular-nums max-[860px]:fs-20';
/** จุดคั่นระหว่างวลีในแถบเลื่อน ให้อ่านเป็นประโยคเดียวต่อเนื่อง */
// เป็นวงกลมที่วาดเอง ไม่ใช่ตัว "·" — จุดกลางของฟอนต์ Srinakharinwirot เล็กมากและจมต่ำกว่ากลางบรรทัด
var RB_SEP = '<span class="mx-4 size-[5px] flex-none rounded-full bg-line-strong max-[560px]:mx-3" aria-hidden="true"></span>';

/** เหรียญของโรงเรียนเรา: รูปเหรียญ 1/2/3 ตามด้วยจำนวน · "รวม 129 เหรียญ"
    ใช้รูปเหรียญชุดเดียวกับหน้าอันดับเหรียญ (assets/medals/coin-N.webp) ไม่มีข้อความ ทอง/เงิน/ทองแดง
    — ชื่อชนิดอยู่ใน title (ชี้เมาส์) และข้อความ sr-only ให้โปรแกรมอ่านหน้าจอ · "รวม" เป็นผลบวก จึงไม่มีไอคอน */
function rankMedals(m) {
  return MEDAL_KINDS.map(function (c) {
    return '<span class="' + RB_MEDAL + '">' +
      '<img class="size-[26px] flex-none max-[560px]:size-[22px]" src="assets/medals/coin-' + c[3] + '.webp" alt="" title="' + c[1] + '" width="64" height="64" decoding="async" />' +
      '<span class="sr-only">' + c[1] + '</span><b class="' + RB_NUM + '">' + m[c[0]] + '</b></span>' + RB_SEP;
  }).join('') +
  '<span class="' + RB_MEDAL + '">รวม <b class="' + RB_NUM + '">' + (m.gold + m.silver + m.bronze) + '</b> เหรียญ</span>';
}

function renderRankBar(data) {
  var host = document.getElementById('rankBar');
  var all = data.medalTable || [];
  var self = all.filter(function (m) { return m.isSelf; })[0];
  // ชีตยังไม่มีแถวของโรงเรียนเรา = ไม่มีอะไรจะบอก ซ่อนทั้งแถบ ไม่ทิ้งกล่องว่างไว้
  if (!self) { host.hidden = true; return; }
  host.hidden = false;

  // แถบเป็นข้อความสไลด์เลื่อนอัตโนมัติ (ticker) — ชิ้นเดียวในเว็บที่ยังเคลื่อนไหว ตามที่ผู้ใช้ขอ
  // เนื้อหาเรียงบรรทัดเดียว ซ้ำสองชุดติดกัน แล้วเลื่อนไปครึ่งหนึ่งของความยาว = วนต่อกันไม่มีรอยต่อ
  // แต่ละชุดต้องกว้างอย่างน้อยเท่ากล่อง ไม่งั้นท้ายชุดที่สองจะโผล่ช่องว่างยาวก่อนรอบถัดไป
  // (จอกว้าง เนื้อหาหนึ่งรอบสั้นกว่ากล่อง) — tickerLayout() จึงซ้ำเนื้อหาในชุดให้พอดีความกว้างจริง
  // มีแค่รอบแรกของชุดแรกที่โปรแกรมอ่านหน้าจออ่าน ที่เหลือซ่อนไว้ ไม่งั้นจะอ่านซ้ำหลายรอบ
  host.innerHTML =
    '<div class="relative min-w-0 flex-1 overflow-hidden' +
      ' [mask-image:linear-gradient(90deg,transparent,#000_28px,#000_calc(100%-28px),transparent)]" id="rankViewport">' +
      '<div class="rank-ticker flex w-max motion-safe:animate-ticker hover:[animation-play-state:paused]" id="rankTrack"></div>' +
    '</div>';
  tickerItem = rankTickerItem(all, self);
  tickerCopies = 0;
  tickerLayout();
  // ความกว้างจริงรู้ได้หลังโลโก้โหลดเสร็จ — คำนวณจำนวนรอบและความเร็วใหม่ ไม่งั้นรอบแรกจะผิด
  Array.prototype.forEach.call(host.querySelectorAll('img'), function (img) {
    if (!img.complete) img.addEventListener('load', tickerLayout, { once: true });
  });
}

/** เนื้อหาหนึ่งรอบของแถบเลื่อน อ่านเป็นประโยคเดียว:
    "อันดับ 1 จาก 16 โรงเรียน · [ตรา] ชื่อโรงเรียน · ทอง 46 · เงิน 49 · ทองแดง 34 · รวม 129 เหรียญ"
    ทุกอย่างบรรทัดเดียว (เดิม "จาก 16 / โรงเรียน" ซ้อนสองบรรทัด พอเลื่อนผ่านขอบจะเหลือเป็นเศษอ่านไม่รู้เรื่อง)
    ท้ายรอบมีเครื่องหมายเหรียญคั่นกว้าง ๆ รอบถัดไปจะได้ไม่อ่านติดกันเป็น "…129 เหรียญ อันดับ 1" */
function rankTickerItem(all, self) {
  return '<p class="m-0 flex flex-none items-baseline gap-2 pl-6 whitespace-nowrap max-[560px]:pl-4">' +
      '<span class="fs-15 text-fg-soft">อันดับ</span>' +
      '<b class="font-mono fs-44 leading-[.9] font-normal text-brand-strong tabular-nums max-[860px]:fs-38">' + self.rank + '</b>' +
      '<span class="fs-15 text-fg-soft">จาก ' + all.length + ' โรงเรียน</span></p>' +
    RB_SEP +
    // โลโก้โรงเรียนฉบับเต็ม (ตรา + ชื่อในรูป) ชุดเดียวกับแถบเมนูซ้าย — โหมดมืดใช้ฉบับตัวขาว
    // สองไฟล์สัดส่วนเท่ากัน (3.63) สลับธีมแล้วความกว้างแถบไม่เปลี่ยน รอบเลื่อนจึงยังต่อกันพอดี
    '<span class="flex flex-none items-center">' +
      '<img class="block h-12 w-auto dark:hidden max-[560px]:h-10" src="assets/logo/satitpatumwan.png"' +
        ' alt="' + esc(self.fullName || self.school) + '" width="776" height="214" decoding="async" />' +
      '<img class="hidden h-12 w-auto dark:block max-[560px]:h-10" src="assets/logo/satitpatumwan-dark.webp"' +
        ' alt="' + esc(self.fullName || self.school) + '" width="537" height="148" decoding="async" />' +
    '</span>' +
    RB_SEP +
    '<div class="flex flex-none items-center">' + rankMedals(self) + '</div>' +
    // คั่นระหว่างรอบ: เว้นกว้างกว่าจุดคั่นปกติ และใช้ไอคอนเหรียญสีแบรนด์ให้เห็นชัดว่าจบหนึ่งรอบ
    '<span class="flex flex-none items-center px-10 max-[560px]:px-7" aria-hidden="true">' +
      '<i class="medal-mic size-[16px] bg-brand"></i></span>';
}

/* ความเร็วคงที่เป็นพิกเซลต่อวินาที ไม่ใช่เวลาต่อรอบ — ชื่อโรงเรียนยาว/สั้นหรือจอมือถือ ก็อ่านทันเท่ากัน */
var TICKER_PX_PER_SEC = 45;
var tickerItem = '', tickerCopies = 0;

/** จัดแถบเลื่อน: ใส่เนื้อหาซ้ำในแต่ละชุดให้ชุดกว้างไม่น้อยกว่ากล่อง แล้วตั้งความเร็วตามความยาวชุด */
function tickerLayout() {
  var track = document.getElementById('rankTrack');
  var viewport = document.getElementById('rankViewport');
  if (!track || !viewport || !tickerItem) return;

  // วัดความกว้างเนื้อหาหนึ่งรอบจากชุดแรกที่วาดอยู่ (รอบแรกยังไม่มี ใส่ไว้หนึ่งรอบก่อนแล้ววัด)
  if (!tickerCopies) { track.innerHTML = tickerGroup(1); tickerCopies = 1; }
  var itemWidth = track.firstChild.scrollWidth / tickerCopies;
  var need = itemWidth > 0 ? Math.max(1, Math.ceil(viewport.clientWidth / itemWidth)) : 1;
  if (need !== tickerCopies || track.children.length !== 2) {
    tickerCopies = need;
    track.innerHTML = tickerGroup(need) + tickerGroup(need, true);
  }
  track.style.animationDuration = Math.max(12, (track.scrollWidth / 2) / TICKER_PX_PER_SEC) + 's';
}

function tickerGroup(copies, hidden) {
  var html = '';
  for (var i = 0; i < copies; i++) {
    html += (!hidden && i === 0) ? tickerItem : '<div class="contents" aria-hidden="true">' + tickerItem + '</div>';
  }
  return '<div class="flex flex-none items-center"' + (hidden ? ' aria-hidden="true"' : '') + '>' + html + '</div>';
}
window.addEventListener('resize', tickerLayout);

/* ===================== ภาพประจำแถวในแผงรายการ =====================
   ใช้มาสคอตของกีฬาเหมือนการ์ดแมตช์ด้านบน · มาสคอตมีสีของตัวเองอยู่แล้ว จึงไม่ปูพื้นสีรอง
   กีฬาที่ยังไม่มีไฟล์มาสคอตถอยไปใช้ไอคอนในกล่องสีเหมือนเดิม (tone = สีกล่องของไอคอนสำรอง) */
function rowArt(sportId, tone) {
  var mascot = sportMascotImg(sportId, 'size-11 flex-none object-contain object-bottom');
  return mascot ||
    '<span class="flex size-11 flex-none items-center justify-center rounded-[11px] ' + tone + '">' +
      sportIcon(sportId, 'size-[24px]') + '</span>';
}

/* ===================== กำหนดการวันนี้ =====================
   ดึงรายการของวันนี้ตามปฏิทินจริงเท่านั้น (isToday เทียบวันที่เต็มพร้อมปี)
   วันนี้ไม่มีในตารางแข่ง = บอกตรง ๆ ว่าไม่มีการแข่งขัน ไม่เอาวันอื่นมาแสดงแทนให้สับสน
   แถวเป็นตัวอักษรล้วน ไม่มีไอคอน — เวลาอยู่หน้าสุดเพราะคือสิ่งที่คนมองหาในกำหนดการ */
var PLAN_TOP = 8;

/** ป้าย LIVE เคลื่อนไหว กดแล้วเปิดลิงก์ถ่ายทอดสดในแท็บใหม่ (ลิงก์ผ่าน webLink() ใน sheets.js มาแล้ว = http/https เท่านั้น) */
function liveLink(url) {
  return '<a class="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-live" href="' + esc(url) +
    '" target="_blank" rel="noopener noreferrer" title="ดูถ่ายทอดสด">' +
    '<img class="block h-[26px] w-auto" src="assets/icons/live.svg" alt="ดูถ่ายทอดสด" width="84" height="30" /></a>';
}

/** แถวเดียวกันในแท็บผลการแข่งขัน (กีฬา/ประเภท/เวลา/คู่แข่งตรงกัน) — ใช้หยิบผลและสถานะมาใส่กำหนดการ */
function sameMatch(a, b) {
  return a.sportId === b.sportId && a.event === b.event && a.time === b.time && a.teams === b.teams;
}

/**
 * รายการของวันนี้: ยึดแท็บ "ตารางการแข่งขัน" (ผังทั้งรายการ มีลิงก์ Live) เป็นหลัก
 * แท็บนั้นไม่มีช่องผล/สถานะ จึงเติมผลจากแท็บ "ผลการแข่งขัน" ของแถวที่ตรงกัน
 * ผังไม่มีวันนี้แต่แท็บผลมี = ใช้แท็บผลแทน (เหมือนก่อนแยกสองแท็บ)
 */
function todayPlan(data) {
  var plan = (data.schedule || []).filter(isToday)[0];
  var results = (data.days || []).filter(isToday)[0];
  if (!plan) return results;
  var done = (results && results.items) || [];
  return Object.assign({}, plan, {
    items: plan.items.map(function (i) {
      var r = done.filter(function (x) { return sameMatch(i, x); })[0];
      return r ? Object.assign({}, i, r, { liveUrl: i.liveUrl || r.liveUrl }) : i;
    })
  });
}

function renderPlan(data) {
  var host = document.getElementById('plan'); host.innerHTML = '';
  var today = todayPlan(data);
  document.getElementById('planDay').textContent = dayLabel(today || todayLabel());
  var items = ((today && today.items) || []).slice()
    .sort(function (a, b) { return String(a.time || '99').localeCompare(String(b.time || '99')); });
  if (!items.length) { host.appendChild(el('div', EMPTY_TEXT, 'วันนี้ไม่มีการแข่งขัน')); return; }

  items.slice(0, PLAN_TOP).forEach(function (i) {
    var head = eventParts(sportName(data, i.sportId), i.event);
    var where = [i.round, i.pool, i.venue].filter(Boolean).join(' · ');
    var done = i.status === 'done';
    // จบแล้วยังอยู่ในรายการ (ให้เห็นทั้งวัน) แต่ลดน้ำหนักลง และแสดงผลแทนป้าย
    var tail = i.status === 'live'
      ? statusChip('live')
      : done
        ? '<span class="font-mono fs-15.5 whitespace-nowrap text-fg-mute tabular-nums">' + esc(i.score || 'จบแล้ว') + '</span>'
        : '';
    // มีลิงก์ถ่ายทอดสดและยังไม่จบ = ป้าย LIVE แทนป้ายสถานะ (จบแล้วโชว์ผลตามเดิม)
    if (i.liveUrl && !done) tail = liveLink(i.liveUrl);
    host.appendChild(el('div', 'grid grid-cols-[52px_1fr_auto] items-center gap-[13px] border-t border-line py-3 first:border-t-0 max-[560px]:grid-cols-[44px_1fr_auto]' + (done ? ' text-fg-mute' : ''),
      '<span class="font-mono fs-15.5 tabular-nums ' + (i.status === 'live' ? 'text-live' : done ? 'text-fg-mute' : 'text-fg') + '">' + esc(i.time || '—') + '</span>' +
      '<span class="min-w-0">' +
        '<p class="mb-[3px] fs-17' + (done ? ' text-fg-soft' : '') + '">' + esc(head.sport) +
          (head.kind ? ' <span class="fs-14.5 text-fg-mute">' + esc(head.kind) + '</span>' : '') + '</p>' +
        '<p class="m-0 fs-14.5 ' + (done ? 'text-fg-mute' : 'text-fg-soft') + '">' + esc(i.teams || where || '') +
          (i.teams && where ? ' <span class="text-fg-mute">· ' + esc(where) + '</span>' : '') + '</p>' +
      '</span>' +
      '<span>' + tail + '</span>'));
  });
  if (items.length > PLAN_TOP) {
    host.appendChild(el('p', 'm-0 border-t border-line pt-3 fs-14 text-fg-mute',
      'และอีก ' + (items.length - PLAN_TOP) + ' รายการ'));
  }
}

/** วันนี้ในรูปแบบเดียวกับวันในข้อมูล — ใช้เป็นหัวแผงตอนตารางแข่งไม่มีวันนี้ */
function todayLabel() {
  var now = new Date();
  return { weekday: WEEKDAYS_TH[now.getDay()], date: now.getDate() + ' ' + MONTHS_TH[now.getMonth()] };
}

/* ===================== ประกาศผลล่าสุด ===================== */
/** สกอร์ในแผงผลล่าสุด: แต้มของโรงเรียนเราเป็นสีน้ำเงิน แต้มของโรงเรียนอื่นเป็นสีเทา
    สกอร์ที่แยกฝั่งไม่ได้ (ไม่ใช่ "ตัวเลข-ตัวเลข" หรือไม่ใช่การพบกันสองฝ่าย) ใช้สีเดียวทั้งก้อนตามว่ามีเราอยู่ในคู่ไหม */
function timelineScore(item, cores) {
  var sides = teamSides(item.teams);
  var score = splitScore(item.score);
  var tone = function (name) { return matchScore(name, cores) > 0 ? 'text-brand-strong' : 'text-fg-mute'; };
  if (!score || sides.length < 2) {
    return '<span class="' + tone(item.teams || '') + '">' + esc(item.score) + '</span>';
  }
  return '<span class="' + tone(sides[0]) + '">' + esc(score[0]) + '</span>' +
    '<span class="text-fg-mute">-</span>' +
    '<span class="' + tone(sides[1]) + '">' + esc(score[1]) + '</span>';
}

function renderTimeline(data) {
  var host = document.getElementById('timeline'); host.innerHTML = '';
  var items = allDayItems(data).filter(function (i) { return i.status !== 'upcoming'; })
    .sort(function (a, b) { return a.status === 'live' ? -1 : 1; }).slice(0, 6);
  if (!items.length) { host.appendChild(el('div', EMPTY_TEXT, 'ยังไม่มีผลการแข่งขันประกาศ')); return; }
  var self = data.medalTable.filter(function (m) { return m.isSelf; })[0];
  var cores = self ? schoolCores(self) : [];
  items.forEach(function (i) {
    var head = eventParts(sportName(data, i.sportId), i.event);
    host.appendChild(el('div', 'grid grid-cols-[auto_1fr_auto] items-center gap-[13px] border-t border-line py-3 first:border-t-0',
      // ผลที่ประกาศแล้วใช้สีเน้นเดียวกับไอคอนบนการ์ดแมตช์ เหลือสีสถานะไว้ให้ "สด" ใบเดียว
      rowArt(i.sportId, i.status === 'live' ? 'bg-live-bg text-live' : 'bg-brand-100 text-brand-strong') +
      '<span>' +
        '<p class="mb-[3px] fs-17">' + esc(head.sport) +
          (head.kind ? ' <span class="fs-14.5 text-fg-mute">' + esc(head.kind) + '</span>' : '') + '</p>' +
        '<p class="m-0 fs-14.5 text-fg-soft">' + esc(i.teams || i.score || '') + '</p>' +
      '</span>' +
      // ทั้งแผงคือผลที่ประกาศแล้ว ป้ายจึงเหลือไว้เฉพาะรายการที่ยังแข่งอยู่ ที่เหลือแสดงสกอร์แทน
      (i.status === 'live'
        ? statusChip('live')
        : (i.score
            ? '<span class="font-mono fs-19 whitespace-nowrap tabular-nums">' + timelineScore(i, cores) + '</span>'
            : ''))));
  });
  paintUiIcons(host);
}

/* ===================== หัวหน้า =====================
   ชื่องานกับข้อความสถานะเป็นข้อความนิ่ง
   จากข้อมูลจริงเท่านั้น (ไม่มีคำเชียร์) ประโยคไหนไม่มีข้อมูลก็ไม่ใส่
   อันดับกับเหรียญไม่ใส่ซ้ำตรงนี้ เพราะแถบอันดับข้างล่างบอกอยู่แล้ว
   ไม่มี "ประกาศผลแล้ว N รายการ": นับได้เฉพาะแถวที่กรอกสกอร์ในแท็บตารางแข่ง ตัวเลขจึงน้อยกว่าเหรียญ
   ที่ได้จริงมาก (เช่น 4 รายการ แต่ได้ 129 เหรียญ) อ่านแล้วขัดกันเอง */
function renderMasthead(data) {
  var meta = data.meta || {};
  document.getElementById('mastTitle').textContent = meta.title || 'กีฬาสาธิตสามัคคี ครั้งที่ 49 “คำมอกหลวงเกมส์”';

  var now = new Date();
  document.getElementById('mastDate').textContent =
    'วัน' + WEEKDAYS_TH[now.getDay()] + 'ที่ ' + now.getDate() + ' ' + MONTHS_TH[now.getMonth()] + ' ' + (now.getFullYear() + 543);

  var all = allDayItems(data);
  var live = all.filter(function (i) { return i.status === 'live'; }).length;
  var today = (data.days || []).filter(isToday)[0];
  var todayLeft = ((today && today.items) || []).filter(function (i) { return i.status === 'upcoming'; }).length;

  var facts = [];
  if (live) facts.push('กำลังแข่งสด ' + live + ' รายการ');
  if (todayLeft) facts.push('วันนี้เหลืออีก ' + todayLeft + ' รายการ');

  var box = document.getElementById('mastFacts');
  box.hidden = !facts.length;
  // จุดหน้าข้อความ: ชมพูกะพริบเฉพาะตอนมีแมตช์สดจริง นอกนั้นเป็นจุดเขียวนิ่ง ๆ ของ "ข้อมูลล่าสุด"
  document.getElementById('factDot').className = 'size-[7px] flex-none rounded-full ' +
    (live ? 'bg-live motion-safe:animate-blink' : 'bg-done');
  document.getElementById('factText').textContent = facts.join(' · ');
}

function renderAll(data) {
  var day = currentDay(data);
  renderMasthead(data);
  renderHero(data, day);
  renderLive(data, day);
  renderRankBar(data);
  renderPlan(data);
  renderTimeline(data);
  chrome.onData(data);
}

bindHero();

loadData().then(function (data) {
  renderAll(data);
  onFreshData(renderAll);
}).catch(showLoadError);
