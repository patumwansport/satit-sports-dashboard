/* =========================================================
   fixture-table.js — ตารางรายการแข่งขันแบบกรองได้ ใช้ร่วมกันสองหน้า
   (ตารางการแข่งขัน = ผังกำหนดการ · ผลการแข่งขัน = ผลที่ประกาศแล้ว)

   ทั้งสองหน้าหน้าตาเดียวกันทุกอย่าง ต่างกันแค่ "อ่านวันจากไหน" กับ "คอลัมน์ท้ายตาราง"
   จึงรวมส่วนที่เหมือนกันไว้ที่นี่:
   - ชิปชนิดกีฬา + การ์ดเลือกวัน + ช่องค้นหาบนหัวตาราง
   - เรียงตามวันแล้วตามเวลา หนึ่งรายการในชีต = หนึ่งแถว
   - แบ่งหน้าละ 25/50/100 แถว
   - จอแคบ แต่ละแถวพับเป็นกริดเล็ก ๆ แทนการเลื่อนตารางกว้างไปด้านข้าง

   องค์ประกอบในหน้า (id เดียวกันทั้งสองหน้า): sportRow / sportChips / schedClear
   dayRow / dayJump / schedTitle / schedSearch / schedDays / schedPager / schedPerPage / schedRange
   pgFirst / pgPrev / pgNext / pgLast
   ========================================================= */
import {
  el, esc, loadData, onFreshData, initChrome, sportName,
  dayLabel, isToday, eventParts, showLoadError,
  teamSides, schoolByText, schoolCrest, selfSideTester, sportMascotImg, sportIcon, paintUiIcons, scrollToContent
} from './common.js';

/* ---------- ชุดคลาสที่ใช้ซ้ำ (เขียนเต็มเสมอ ตัวสร้าง CSS อ่านจากสตริงพวกนี้) ---------- */
/* กล่องตารางแคบกว่า 800px ตารางหลายคอลัมน์อ่านไม่ออก — แต่ละแถวจึงกลายเป็นกริดสามคอลัมน์:
   วัดจากความกว้างกล่อง (@container ที่ <section> ในหน้า HTML) ไม่ใช่ความกว้างจอ
   เพราะช่วง 861–1100px แถบเมนูข้างกินที่ไป 252px ตารางเหลือที่น้อยกว่าบนมือถือเสียอีก
   บรรทัดแรก วัน · กีฬา กับเวลาชิดขวา แล้วคอลัมน์อื่นเรียงลงตามที่แต่ละหน้ากำหนด
   หัวตารางซ่อนไป เพราะแต่ละบรรทัดบอกตัวเองได้แล้ว
   จอกว้างทุกช่องอยู่กึ่งกลางแนวตั้ง: ช่อง "ระหว่าง"/"ประเภท" สูงสองบรรทัด ถ้าชิดบนช่องเวลา/สกอร์ตัวโตจะดูลอยไม่ตรงกัน */
var TH = 'px-2.5 py-3 text-left fs-11.5 font-normal whitespace-nowrap text-fg-soft first:pl-5 last:pr-5';
/* จอแคบ p-0! — first:pl-5 / last:pr-5 ของโหมดตารางชนะ p-0 ธรรมดา บรรทัด "วัน · กีฬา" เลยเยื้องเข้าไป 20px ไม่ตรงกับบรรทัดอื่น */
export var TD = 'px-2.5 py-3 align-middle fs-15.5 text-fg first:pl-5 last:pr-5 @min-[800px]:fs-12 @max-[800px]:p-0!';
var TR = 'border-t border-line @max-[800px]:grid @max-[800px]:gap-x-2 @max-[800px]:gap-y-1 @max-[800px]:px-4 @max-[800px]:py-3';
/* กริดของแถวบนจอแคบ (หน้าไหนวางช่องเองทั้งหมดก็ส่ง opts.rowCls มาแทน) */
var TR_GRID = ' @max-[800px]:grid-cols-[auto_1fr_auto] @max-[800px]:items-baseline';
/* จุดคั่น "วัน · กีฬา" บนจอแคบ — เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var DOT_AFTER = " @max-[800px]:after:pl-2 @max-[800px]:after:text-fg-mute @max-[800px]:after:content-['·']";
/* บรรทัดรอง (วัน · กีฬา · รอบ/สาย) บนจอแคบ ตัวเล็กและจางกว่าเนื้อหาหลัก */
export var TD_SUB = ' @max-[800px]:fs-14 @max-[800px]:text-fg-soft';
/* เวลาเป็นสิ่งที่คนกวาดตาหาก่อนอย่างอื่น บนจอแคบจึงอยู่มุมขวาบนของบล็อก ตัวไม่เล็กลง */
export var TD_TIME = ' font-mono fs-17 whitespace-nowrap tabular-nums @min-[800px]:fs-13 @max-[800px]:col-start-3 @max-[800px]:row-start-1';

/* การ์ดเลือกวัน: วันที่บรรทัดเดียว ("ทุกวัน" / "24 ธ.ค.") — ผู้ดูแลขอให้ตัดบรรทัดรอง (จำนวนรายการ / ชื่อวัน) ออก
   เหลือบรรทัดรองเฉพาะการ์ดของวันนี้ ("วันนี้") ให้หาเจอเร็ว
   วันที่เลือกอยู่ = พื้นชมพูไล่เฉด ตัวขาว · จอแคบเลื่อนแนวนอนแทนการตกบรรทัด */
var DAY_CARD = 'flex min-h-11 min-w-[92px] flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] border px-3 py-2 font-body leading-[1.2]' +
  ' transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none max-[560px]:min-w-[78px]';
var DAY_CARD_OFF = ' border-line bg-surface text-fg hover:border-brand hover:text-brand';
var DAY_CARD_ON = ' border-transparent bg-brand text-white';
/* วันที่กรองแล้วไม่เหลือรายการจางลงแต่ยังกดได้ — บอกล่วงหน้าว่ากดไปจะว่าง */
var DAY_CARD_EMPTY = ' opacity-45';

/* ชิปชนิดกีฬา: ไอคอนกีฬาเหนือชื่อ · ชิปที่เลือกอยู่พื้นน้ำเงินเข้ม (navy) */
var SPORT_CHIP = 'flex min-w-[72px] flex-none cursor-pointer items-center justify-center rounded-[14px] border px-4 py-2.5 font-body fs-14.5 leading-[1.2] whitespace-nowrap' +
  ' transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none max-[560px]:min-w-[60px] max-[560px]:px-3 max-[560px]:fs-13.5';
var SPORT_CHIP_OFF = ' border-line bg-surface text-fg hover:border-brand';
var SPORT_CHIP_ON = ' border-transparent bg-navy text-white';
/* แบบเม็ดยาไร้กรอบ (หน้าที่ส่ง opts.sportPills มา): ชื่อกีฬาล้วนบนพื้นขาว ที่เลือกอยู่พื้นน้ำเงินเข้ม (navy) */
var SPORT_PILL = 'flex-none cursor-pointer rounded-full border-0 px-5 py-2.5 font-body fs-15 leading-[1.2] whitespace-nowrap' +
  ' transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none max-[560px]:px-4 max-[560px]:py-2 max-[560px]:fs-14';
var SPORT_PILL_OFF = ' bg-surface text-fg-soft hover:text-brand';
var SPORT_PILL_ON = ' bg-navy text-white';

/* แบบเมนูข้าง (หน้าที่ส่ง opts.sportMenu มา): มาสคอตกีฬา + ชื่อ + ลูกศร เรียงลงในคอลัมน์ซ้าย
   ทุกปุ่มหน้าตาเดียวกัน: ชี้/แตะ = พื้นน้ำเงินอ่อน · ที่เลือกอยู่ = พื้นชมพูทึบ (ผู้ดูแลขอ)
   แสดงกีฬาครบทุกชนิดในชีต — ชนิดที่ยังไม่มีรายการตัวหนังสือจาง กดได้ (ขึ้น "ไม่พบรายการ")
   จอ ≤1180px คอลัมน์ซ้ายหายไป เมนูกลายเป็นแถบชิปเลื่อนแนวนอนเหนือเนื้อหา */
var MENU_ITEM = 'flex w-full flex-none cursor-pointer items-center gap-3 rounded-[12px] border-0 px-3 py-2 text-left font-body fs-15.5 leading-[1.3]' +
  ' transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none' +
  ' max-[1180px]:w-auto max-[1180px]:gap-2 max-[1180px]:py-1.5 max-[1180px]:pr-4 max-[1180px]:pl-2 max-[1180px]:fs-15';
var MENU_ITEM_OFF = ' bg-transparent text-fg hover:bg-navy-100 active:bg-navy-100';
var MENU_ITEM_EMPTY = ' bg-transparent text-fg-mute hover:bg-navy-100 hover:text-fg active:bg-navy-100';
var MENU_ITEM_ON = ' bg-pink text-white';
var MENU_CHEVRON = '<svg class="ml-auto flex-none opacity-50 max-[1180px]:hidden" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function menuItemHtml(sp, on) {
  var art = sp.id === 'all'
    ? '<span class="flex size-9 flex-none items-center justify-center max-[1180px]:size-7"><i class="icon-mask size-[22px]" data-ic="sports"></i></span>'
    : '<span class="flex size-9 flex-none items-center justify-center max-[1180px]:size-7">' +
        (sportMascotImg(sp.id, 'size-full object-contain') || sportIcon(sp.id, 'size-[70%]')) + '</span>';
  return art + '<span class="min-w-0 max-[1180px]:whitespace-nowrap">' + esc(sp.name) + '</span>' + MENU_CHEVRON;
}

/* ปุ่มในสถานะว่าง (ล้างตัวกรอง) */
var FILTER_CHIP = 'cursor-pointer rounded-[11px] border border-line bg-surface-soft px-[15px] py-2 font-body fs-14.5 text-fg-soft' +
  ' transition-[border-color,color,background-color] duration-150 hover:border-line-strong hover:text-fg' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';

/* ตัวทดสอบ "ฝั่งนี้คือโรงเรียนเรา" สร้างใหม่เมื่อข้อมูลชุดใหม่มาถึง (teamsHtml ถูกเรียกทุกแถว จึงไม่สร้างซ้ำทุกแถว) */
var selfOf = { data: null, test: null };
export function isSelfFor(data) {
  if (selfOf.data !== data) selfOf = { data: data, test: selfSideTester(data) };
  return selfOf.test;
}

/** ช่อง "ระหว่าง" ของทั้งสองหน้า: "ตรา ชื่อ vs ตรา ชื่อ" ชื่อโรงเรียนเราเป็นสีชมพู
    โหมดตาราง (กล่อง ≥800px) อยู่บรรทัดเดียวเป็นแถบยาวเสมอ — กล่องแคบกว่าตารางก็เลื่อนตารางไปด้านข้างแทน (ดู render)
    โหมดพับเป็นบล็อก (กล่อง <800px) เรียงสองฝั่งซ้อนกันแบบป้ายคะแนน "ตรา ชื่อ" ฝั่งละบรรทัด ไม่มี vs
    (เดิมเรียงบรรทัดเดียว ชื่อยาวฝั่งที่สองหล่นไปบรรทัดใหม่ทีละครึ่งคู่ อ่านไม่ออกว่าใครพบใคร)
    หน้าผลการแข่งขันวางแต้มของแต่ละฝั่งชิดขวาตรงบรรทัดเดียวกัน (scoreHtml ใน matches.js) — ความสูงบรรทัดต้องตรงกับ SCORE_LINE
    รายการที่ไม่ใช่การพบกันสองฝ่าย (รวมทุกโรงเรียน) แสดงข้อความตามชีต */
/* ช่องคู่แข่งสูงเท่าตราโรงเรียนเสมอ แถวที่เป็นขีด "-" หรือข้อความล้วนจะได้สูงเท่าแถวที่มีตรา ตารางไม่สูงต่ำสลับกัน
   โหมดตาราง (≥800px) วางกลางคอลัมน์ ให้ "vs" อยู่ตรงกลางคอลัมน์ทุกแถว */
var TEAMS_ROW = 'flex min-h-9 items-center max-[560px]:min-h-7 @min-[800px]:min-h-7 @min-[800px]:justify-center';
/** หัวคอลัมน์ "ระหว่าง" อยู่กลางคอลัมน์ ตรงกับ "vs" ข้างล่าง */
export var TH_TEAMS = 'text-center!';

/** แบบป้ายคะแนน: "ชื่อ ตรา  vs  ตรา ชื่อ" — ทีมแรกชิดขวาเข้าหา vs ทีมที่สองชิดซ้าย
    แต่ละฝั่งกว้างเท่ากันทุกแถว (--team-a / --team-b = ชื่อที่ยาวที่สุดของฝั่งนั้นในตาราง alignTeams วัดให้) "vs" จึงตรงกันทั้งคอลัมน์
    ไม่บังคับสองฝั่งกว้างเท่ากัน: ทีมที่สองมักเป็นโรงเรียนเรา (ชื่อสั้น) ถ้าเผื่อเท่าชื่อยาวฝั่งแรก คอลัมน์จะกว้างจนช่องประเภทถูกบีบ */
export function teamsHtml(data, teams) {
  var sides = teamSides(teams);
  if (sides.length !== 2) return '<span class="' + TEAMS_ROW + '">' + orDash(teams) + '</span>';
  var isSelf = isSelfFor(data);
  function side(name, first) {
    var m = schoolByText(data, name) || { school: name };
    var crest = schoolCrest(m, 'size-9 flex-none @min-[800px]:size-7 max-[560px]:size-7');
    // min-w-0 (ยอมให้ชื่อหดแล้วตัดบรรทัด) ใช้เฉพาะโหมดพับ — โหมดตารางชื่อต้องกว้างเท่าตัวหนังสือเสมอ
    // ไม่งั้น Safari คิดความกว้างคอลัมน์จาก min-w-0 แล้วบีบชื่อจนท้ายชื่อมุดไปอยู่ใต้ตรา ("สาธิต มศว ปทุมวั")
    // และ alignTeams ก็วัดได้ความกว้างที่ถูกบีบนั้นไปตั้งเป็น --team-a ซ้ำอีก
    // โหมดตารางกว้างไม่เกิน 160px: คู่ที่ยังไม่รู้ผล ("สาธิตพิบูลบำเพ็ญ ม.บูรพา หรือ สาธิต มศว ประสานมิตร") ตัดเป็นสองบรรทัด
    // แทนการถ่างคอลัมน์จนตารางต้องเลื่อนซ้ายขวา (ผู้ดูแลขอให้ตารางพอดีกล่อง) — ชื่อโรงเรียนปกติยังอยู่บรรทัดเดียว
    // ฝั่งแรกชิดขวาเข้าหา vs ทั้งสองบรรทัด
    var label = '<span class="@max-[800px]:min-w-0 @min-[800px]:max-w-[160px] @min-[800px]:whitespace-normal' + (first ? ' @min-[800px]:text-right' : '') +
      (isSelf(name) ? ' text-brand' : '') + '">' + esc(name) + '</span>';
    // จอแคบ ฝั่งแรกกลับด้าน (row-reverse) ให้ตรามาก่อนชื่อเหมือนฝั่งที่สอง ตราสองฝั่งจึงตรงกันเป็นคอลัมน์
    return '<span class="inline-flex flex-none items-center @max-[800px]:min-w-0 @max-[800px]:flex-initial gap-2 whitespace-nowrap max-[560px]:gap-1.5 @max-[800px]:whitespace-normal ' + SCORE_LINE +
      (first ? ' justify-end @min-[800px]:min-w-[var(--team-a)] @max-[800px]:flex-row-reverse" data-team="a">' + label + crest
             : ' @min-[800px]:min-w-[var(--team-b)]" data-team="b">' + crest + label) + '</span>';
  }
  return '<span class="' + TEAMS_ROW + ' flex-wrap gap-x-3 gap-y-1.5 @min-[800px]:flex-nowrap @min-[800px]:gap-x-2 @max-[800px]:flex-col @max-[800px]:items-start">' + side(sides[0], true) +
    '<span class="fs-13 text-fg-mute @max-[800px]:sr-only">vs</span>' + side(sides[1]) + '</span>';
}
/** ความสูงขั้นต่ำของบรรทัดทีมบนจอแคบ (= ขนาดตรา) — แต้มที่วางข้างชื่อในหน้าผลการแข่งขันใช้ค่าเดียวกัน บรรทัดจึงตรงกัน */
export var SCORE_LINE = '@max-[800px]:min-h-9 max-[560px]:min-h-7';

/** ตั้งความกว้างแต่ละฝั่งของคู่แข่งให้เท่าชื่อที่ยาวที่สุดของฝั่งนั้นในตาราง (--team-a / --team-b)
    วัดซ้ำหลังฟอนต์เว็บโหลดเสร็จ เพราะความกว้างตัวอักษรเปลี่ยน */
function alignTeams(box) {
  function measure() {
    ['a', 'b'].forEach(function (k) {
      box.style.removeProperty('--team-' + k);
      var w = 0;
      box.querySelectorAll('[data-team="' + k + '"]').forEach(function (e) { w = Math.max(w, e.scrollWidth); });
      if (w) box.style.setProperty('--team-' + k, Math.ceil(w) + 'px');
    });
  }
  measure();
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(measure);
}

/* ---------- การ์ดแนะนำกีฬา (หน้าที่มีเมนูกีฬาข้าง: ผลการแข่งขัน · ตารางแข่งขัน) ----------
   ต้องมี <section id="sportIntro" hidden> ในหน้า · เลือกกีฬาจากเมนูซ้าย = การ์ดโผล่บนสุดของคอลัมน์ขวา
   มาสคอตตัวโต + ชื่อกีฬา · วันที่กีฬานี้มีแข่ง · ตัวเลขตลอดการแข่งขัน (ไม่ขึ้นกับวันที่เลือก) + ลิงก์ไปหน้าอื่นที่กรองกีฬานี้ไว้
   ไม่ได้เลือกกีฬา = ซ่อน */
/**
 * @param {object} ctx - ctx ของ onRender ({ data, all, sportId })
 * @param {function(Array): Array<{n: number, label: string, tone?: string}>} stats - ตัวเลขจากแถวทุกวันของกีฬานี้
 * @param {Array<{href: string, label: string}>} links - ปุ่มลิงก์มุมขวา
 */
export function renderSportIntro(ctx, stats, links) {
  var box = document.getElementById('sportIntro');
  if (!box) return;
  var id = ctx.sportId;
  box.hidden = !id;
  if (!id) return;
  var rows = ctx.all.filter(function (r) { return r.sportId === id; });
  var days = [], seen = {};
  rows.forEach(function (r) { if (r.day && !seen[r.dayId]) { seen[r.dayId] = 1; days.push(r.day); } });
  var tiles = rows.length ? stats(rows) : [];
  box.innerHTML =
    '<div class="flex flex-wrap items-center gap-x-6 gap-y-4">' +
      '<span class="flex size-28 flex-none items-center justify-center rounded-full bg-navy-100 max-[560px]:size-20"><span class="flex size-[84%] items-center justify-center">' +
        (sportMascotImg(id, 'size-full object-contain') || sportIcon(id, 'size-[70%] text-brand-strong')) + '</span></span>' +
      '<div class="min-w-0 flex-1">' +
        '<p class="m-0 fs-14 text-fg-mute">ประเภทกีฬา</p>' +
        '<h2 class="m-0 font-display fs-40 leading-[1.15] font-normal text-brand-strong max-[560px]:fs-30">' + esc(sportName(ctx.data, id)) + '</h2>' +
        (days.length
          ? '<p class="m-0 mt-2 flex flex-wrap items-center gap-1.5 fs-14 text-fg-soft"><span class="mr-1">แข่ง ' + days.length + ' วัน</span>' +
              days.map(function (d) {
                return '<span class="rounded-full px-2.5 py-0.5 ' + (isToday(d) ? 'bg-pink text-white' : 'bg-surface-soft text-fg') + '">' + esc(d.date || dayLabel(d)) + (isToday(d) ? ' · วันนี้' : '') + '</span>';
              }).join('') + '</p>'
          : '<p class="m-0 mt-2 fs-14.5 text-fg-mute">ยังไม่มีรายการแข่งขันของกีฬานี้ในชีต</p>') +
      '</div>' +
      '<div class="flex flex-none flex-wrap gap-2 max-[700px]:w-full">' +
        links.map(function (l) { return '<a class="btn-pill btn-pill-sm" href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('') +
      '</div>' +
    '</div>' +
    (tiles.length ? '<div class="mt-4 grid grid-cols-3 gap-2.5">' + tiles.map(function (t) {
      return '<div class="min-w-0 rounded-[14px] bg-surface-soft px-4 py-2.5 max-[560px]:px-3">' +
        '<span class="block font-display fs-28 leading-[1.15] tabular-nums ' + (t.tone || 'text-brand-strong') + '">' + t.n + '</span>' +
        '<span class="block fs-14 leading-[1.35] text-fg-soft">' + esc(t.label) + '</span></div>';
    }).join('') + '</div>' : '');
  // การเลื่อนขึ้นตอนกดกีฬาอยู่ที่ตัวกดชิปกีฬา (scrollToContent ใน common.js)
}

/* ช่องสถานที่ของทั้งสองหน้า (คอลัมน์ "สนาม"/"สถานที่" ในชีต): หมุดนำหน้าชื่อสถานที่ · ว่าง = ขีด */
var PIN = '<svg class="flex-none text-fg-mute" viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.7"/></svg>';
export function venueHtml(r) {
  return r.venue ? '<span class="inline-flex items-center gap-1.5">' + PIN + '<span>' + esc(r.venue) + '</span></span>' : orDash('');
}

/** ช่องว่างในชีตขึ้นเป็นขีด ให้เห็นว่า "ยังไม่มีข้อมูล" ไม่ใช่ตารางแสดงผลตกหล่น */
export function orDash(text) {
  return text ? esc(text) : '<span class="text-fg-mute">-</span>';
}

/**
 * ติดตั้งตารางลงหน้า
 * @param {object} opts
 * @param {string} opts.page - ชื่อหน้าสำหรับเมนูข้าง ('schedule' / 'matches')
 * @param {function(object): Array} opts.days - วันทั้งหมดของตารางนี้ จากข้อมูลก้อนใหญ่
 * @param {function(object, object): object} opts.fields - ฟิลด์เพิ่มของหน้านี้ จากรายการหนึ่งรายการในชีต (และข้อมูลทั้งก้อน)
 * @param {function(object)} [opts.onRender] - เรียกหลังวาดตารางทุกครั้ง { data, rows, all, sportId, dayRows, day } ใช้วาดแผงสรุปข้างตาราง (sportId = กีฬาที่เลือก · null = ทุกกีฬา)
 * @param {function(object): string} opts.searchText - ข้อความที่ช่องค้นหาใช้เทียบ
 * @param {Array<{head: string, headCls?: string, cls: function(object): string, cell: function(object): string}>} opts.columns
 *   คอลัมน์ต่อจาก # / วันแข่งขัน / รายการแข่งขัน — cls(แถว) คืนคลาสของช่อง รวมตำแหน่งบนจอแคบ · headCls = คลาสเสริมของหัวคอลัมน์นั้น
 *   (เป็นฟังก์ชันเพราะบางช่องต้องซ่อนบนจอแคบเฉพาะแถวที่ช่องนั้นว่าง)
 * @param {string} opts.emptyText - ข้อความตอนชีตยังไม่มีข้อมูลเลย
 *
 * ตัวเลือกเสริม (หน้าตารางการแข่งขันไม่ได้ใช้ หน้าตาจึงเหมือนเดิม):
 * @param {boolean} [opts.lead=true] - false = ไม่มีช่องวัน/กีฬานำหน้า คอลัมน์ของหน้าวางเองทั้งแถว
 * @param {function(Array): *} [opts.defaultDay] - วันที่เลือกไว้ตอนเปิดหน้า (id) ไม่มี = ทุกวัน
 * @param {boolean} [opts.sportPills] - ชิปกีฬาแบบเม็ดยาไร้กรอบ
 * @param {boolean} [opts.sportMenu] - ชิปกีฬาแบบเมนูข้าง (มาสคอต + ชื่อ) — ชื่อปุ่ม "ทั้งหมด" ใช้ opts.sportAllLabel
 * @param {string} [opts.rowCls] - กริดของแถวบนจอแคบ แทนกริดสามคอลัมน์ตั้งต้น
 * @param {string} [opts.headCls] - คลาสเสริมของหัวตาราง
 * @param {function(object): string} [opts.dayText] - ข้อความช่องวันแข่งขัน (ไม่ส่ง = dayLabel เช่น "เสาร์ 24 ต.ค.")
 * @param {function(object): string} [opts.detail] - รายละเอียดของแถว (ว่าง = ไม่มี) → ท้ายแถวมีปุ่มเปิด/ปิด
 * @param {string} [opts.detailCls] - ตำแหน่งปุ่มเปิดรายละเอียดบนจอแคบ
 * @param {string} [opts.sportColCls] - คลาสเสริมของหัวและช่อง "รายการแข่งขัน" (เช่นซ่อนบนจอกว้าง)
 * องค์ประกอบเสริมในหน้า (มีก็ผูกให้): dayPrev / dayNext / sportMore
 */
export function mountFixtureTable(opts) {
  var chrome = initChrome(opts.page);
  var state = {
    data: null,
    // ?sport=<id> ในลิงก์ = เปิดมาพร้อมกรองชนิดกีฬานั้นไว้ (การ์ดในหน้าชนิดกีฬาลิงก์มาแบบนี้)
    dayId: 'all', sportId: new URLSearchParams(location.search).get('sport') || 'all', q: '',
    page: 1, perPage: 25
  };

  /* ---------- แปลงวันเป็นรายการแถวเดียว พร้อมฟิลด์ที่ใช้กรอง ---------- */
  function allRows() {
    var rows = [];
    opts.days(state.data).forEach(function (day) {
      (day.items || []).forEach(function (i) {
        var sport = sportName(state.data, i.sportId);
        var head = eventParts(sport, i.event);
        var row = {
          dayId: day.id, day: day, time: i.time || '',
          sportId: i.sportId || '',
          sport: head.sport || sport || 'อื่น ๆ',
          kind: head.kind || ''
        };
        var extra = opts.fields(i, state.data);
        Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
        rows.push(row);
      });
    });
    return rows;
  }

  /**
   * กรองตามตัวกรองที่เลือกอยู่
   * @param {string} [skip] - ข้ามตัวกรองตัวหนึ่ง ('day') ใช้ตอนดูว่าวันไหนจะเหลือรายการบ้าง
   */
  function filterRows(rows, skip) {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (skip !== 'day' && state.dayId !== 'all' && r.dayId !== state.dayId) return false;
      if (state.sportId !== 'all' && r.sportId !== state.sportId) return false;
      if (q && (r.sport + ' ' + r.kind + ' ' + r.time + ' ' + opts.searchText(r)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function hasFilter() {
    return state.dayId !== 'all' || state.sportId !== 'all' || state.q.trim() !== '';
  }

  /**
   * เรียงตามลำดับวันในชีตก่อนเสมอ แล้วค่อยเรียงเวลาในวันเดียวกัน — เรียงด้วยเวลาล้วนจะสลับวันกัน
   * (08:00 ของวันที่สอง มาก่อน 08:30 ของวันแรก) เวลาในชีตเติมศูนย์หน้าชั่วโมงหลักเดียวมาแล้ว
   * จึงเทียบเป็นข้อความได้ตรง
   */
  function sortRows(rows) {
    var order = opts.days(state.data).map(function (d) { return d.id; });
    return rows.slice().sort(function (a, b) {
      var d = order.indexOf(a.dayId) - order.indexOf(b.dayId);
      return d || String(a.time).localeCompare(String(b.time));
    });
  }

  /* ---------- แถวตาราง ---------- */
  function rowEl(r, columns) {
    var tr = el('tr', TR + (opts.rowCls || TR_GRID));
    var ctx = { allDays: state.dayId === 'all' };
    tr.innerHTML =
      (opts.lead === false ? '' :
      // บนจอแคบ สองช่องนี้ต่อกันเป็นบรรทัดหัวของบล็อก: "เสาร์ 24 ต.ค. · กรีฑา"
      '<td class="' + TD + DOT_AFTER + TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-1 @max-[800px]:row-start-1">' +
        esc(opts.dayText ? opts.dayText(r.day) : dayLabel(r.day)) +
        (isToday(r.day) ? ' <span class="fs-13 text-fg-mute">(วันนี้)</span>' : '') + '</td>' +
      '<td class="' + TD + TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-2 @max-[800px]:row-start-1 @max-[800px]:min-w-0 @max-[800px]:truncate' + (opts.sportColCls || '') + '">' +
        esc(r.sport) + '</td>') +
      columns.map(function (c) {
        return '<td class="' + TD + ' ' + c.cls(r) + '">' + c.cell(r, ctx) + '</td>';
      }).join('');
    return tr;
  }

  /** ปุ่ม ˅ ท้ายแถว เปิด/ปิดแถวรายละเอียดที่ซ่อนอยู่ใต้แถวนั้น (แถวไม่มีรายละเอียด = ช่องว่าง) */
  function detailToggle(tr, detailTr) {
    var td = el('td', TD + ' w-12 text-right align-middle! ' + (opts.detailCls || ''));
    if (!detailTr) { tr.appendChild(td); return; }
    var btn = el('button', 'btn btn-ghost btn-icon size-9 rounded-full text-fg-mute hover:text-brand',
      '<svg class="transition-transform duration-150 motion-reduce:transition-none" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'ดูรายละเอียด');
    function toggle() {
      var open = detailTr.hidden;
      detailTr.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.firstChild.style.transform = open ? 'rotate(90deg)' : '';
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    // กดตรงไหนของแถวก็เปิดได้ ยกเว้นลิงก์/ปุ่มในแถว
    tr.classList.add('cursor-pointer');
    tr.addEventListener('click', function (e) { if (!e.target.closest('a,button')) toggle(); });
    td.appendChild(btn);
    tr.appendChild(td);
  }

  /** คอลัมน์ที่มี showIf จะโผล่เมื่อข้อมูลทั้งตาราง (ก่อนกรอง) เข้าเงื่อนไข เช่น มีชื่อนักกีฬาอย่างน้อยหนึ่งแถว */
  function visibleColumns(all) {
    return opts.columns.filter(function (c) { return !c.showIf || c.showIf(all); });
  }

  function tableEl(rows, columns) {
    var table = el('table', 'w-full border-collapse @max-[800px]:block');
    var span = columns.length + (opts.lead === false ? 0 : 2) + (opts.detail ? 1 : 0);
    table.innerHTML =
      '<thead class="@max-[800px]:hidden ' + (opts.headCls || '') + '"><tr>' +
        (opts.lead === false ? '' :
        '<th class="' + TH + '" scope="col">วันแข่งขัน</th>' +
        '<th class="' + TH + (opts.sportColCls || '') + '" scope="col">รายการแข่งขัน</th>') +
        columns.map(function (c) { return '<th class="' + TH + (c.headCls ? ' ' + c.headCls : '') + '" scope="col">' + esc(c.head) + '</th>'; }).join('') +
        (opts.detail ? '<th class="' + TH + '"><span class="sr-only">รายละเอียด</span></th>' : '') +
      '</tr></thead>';
    var body = el('tbody', '@max-[800px]:block');
    rows.forEach(function (r) {
      var tr = rowEl(r, columns);
      body.appendChild(tr);
      if (!opts.detail) return;
      var html = opts.detail(r), detailTr = null;
      if (html) {
        detailTr = el('tr', '@max-[800px]:block');
        detailTr.hidden = true;
        detailTr.innerHTML = '<td class="px-5 pt-1 pb-4 @max-[800px]:block @max-[800px]:px-4 @max-[800px]:pt-0" colspan="' + span + '">' + html + '</td>';
      }
      detailToggle(tr, detailTr);
      if (detailTr) body.appendChild(detailTr);
    });
    table.appendChild(body);
    return table;
  }

  /* ---------- แถบตัวกรอง ---------- */
  function dayCard(top, sub, on, dim, pick) {
    var b = el('button', DAY_CARD + (on ? DAY_CARD_ON : DAY_CARD_OFF) + (dim && !on ? DAY_CARD_EMPTY : ''),
      '<span class="fs-16.5 whitespace-nowrap">' + top + '</span>' +
      (sub ? '<span class="fs-12.5 whitespace-nowrap ' + (on ? 'text-white/85' : 'text-brand') + '">' + sub + '</span>' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', pick);
    return b;
  }

  /**
   * วันที่ให้เลือกบนแถบวัน: เฉพาะวันที่กีฬาที่เลือกอยู่มีแข่งจริง (ทุกกีฬา = วันที่มีรายการอย่างน้อยหนึ่งรายการ)
   * ผู้ดูแลขอ ต.ค. 2569 — เดิมขึ้นครบทุกวันของงานแล้วทำจางวันที่ว่าง เทนนิสแข่งวันเดียวก็มีการ์ดวันให้กดถึง 8 ใบ
   * ไม่คิดคำค้นตรงนี้ (พิมพ์ค้นแล้วการ์ดวันหายไปมาจะสับสน วันที่คำค้นไม่เจอยังใช้แบบจางเหมือนเดิม)
   * วันที่เลือกค้างไว้คงอยู่แม้กีฬานั้นไม่มีแข่ง จะได้เห็นว่ากรองวันอะไรอยู่และกดออกได้
   */
  function pickableDays(all) {
    var has = {};
    all.forEach(function (r) {
      if (state.sportId === 'all' || r.sportId === state.sportId) has[r.dayId] = true;
    });
    return opts.days(state.data).filter(function (d) { return has[d.id] || d.id === state.dayId; });
  }

  function renderDayBar(all) {
    var host = document.getElementById('dayJump');
    host.innerHTML = '';
    var pool = filterRows(all, 'day');
    var days = pickableDays(all);

    host.appendChild(dayCard('ทุกวัน', '', state.dayId === 'all', false,
      function () { setFilter('dayId', 'all'); }));

    var order = opts.days(state.data);
    days.forEach(function (day) {
      var n = pool.filter(function (r) { return r.dayId === day.id; }).length;
      var on = state.dayId === day.id;
      // บรรทัดรองมีเฉพาะการ์ดของวันนี้ (ตามปฏิทินจริง) — แถวนี้คือที่ที่คนมองหาว่าจะกดวันไหน
      // "วันที่ N" นับตามลำดับวันของทั้งงาน ไม่ใช่ลำดับในแถบที่ตัดวันว่างออกแล้ว
      host.appendChild(dayCard(esc(day.date || ('วันที่ ' + (order.indexOf(day) + 1))),
        isToday(day) ? 'วันนี้' : '',
        on, !n, function () { setFilter('dayId', state.dayId === day.id ? 'all' : day.id); }));
    });
    // ซ่อนทั้งแถบเฉพาะเมื่อทั้งงานมีวันแข่งไม่ถึงสองวัน — กีฬาที่แข่งวันเดียวยังเห็นแถบ (มีปุ่มล้างตัวกรองอยู่ในแถบนี้)
    document.getElementById('dayRow').hidden = opts.days(state.data).length < 2;

    // ตัวเลือกวันเสริมของหน้า (มีเฉพาะบางหน้า)
    var idx = days.map(function (d) { return d.id; }).indexOf(state.dayId);
    var prev = document.getElementById('dayPrev'), next = document.getElementById('dayNext');
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= days.length - 1;
    // การ์ดวันที่เลือกอยู่เลื่อนเข้ามาให้เห็นเสมอ (จอแคบที่แถบวันล้นกล่อง)
    var onCard = host.querySelector('[aria-pressed="true"]');
    if (onCard && host.scrollWidth > host.clientWidth) host.scrollLeft = onCard.offsetLeft - host.offsetLeft - 8;
  }

  /** ชิปชนิดกีฬา — เรียงตามลำดับกีฬาในชีต แล้วต่อท้ายด้วยกีฬาที่มีในตารางแต่ยังไม่มีในตารางชนิดกีฬา */
  function renderSportBar(all) {
    var order = (state.data.sports || []).map(function (s) { return s.id; });
    var seen = {}, sports = [];
    all.forEach(function (r) {
      if (!r.sportId || seen[r.sportId]) return;
      seen[r.sportId] = true;
      sports.push({ id: r.sportId, name: r.sport });
    });
    // กีฬาที่ลิงก์มากรองไว้แต่ยังไม่มีรายการในตาราง: ใส่เป็นชิปด้วย
    // จะได้เห็นว่ากำลังกรองกีฬานั้นอยู่และขึ้น "ไม่พบรายการ" แทนที่จะเด้งกลับเป็นทุกชนิดกีฬาเงียบ ๆ
    if (state.sportId !== 'all' && !seen[state.sportId]) {
      var name = sportName(state.data, state.sportId);
      if (name) { seen[state.sportId] = true; sports.push({ id: state.sportId, name: name, empty: true }); }
    }
    // เมนูข้าง: ใส่กีฬาที่เหลือในชีตให้ครบ แม้ยังไม่มีรายการ (ชื่อจาง)
    if (opts.sportMenu) (state.data.sports || []).forEach(function (s) {
      if (!s.id || seen[s.id]) return;
      seen[s.id] = true;
      sports.push({ id: s.id, name: s.name, empty: true });
    });
    sports.sort(function (a, b) {
      var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    var host = document.getElementById('sportChips');
    host.innerHTML = '';
    // กีฬาที่เลือกไว้หายไปจากตารางหลังซิงก์ ก็กลับไปทุกชนิดกีฬา แทนที่จะค้างเป็นตัวกรองที่มองไม่เห็น
    if (state.sportId !== 'all' && !sports.some(function (s) { return s.id === state.sportId; })) { state.sportId = 'all'; syncSportParam(); }
    [{ id: 'all', name: opts.sportAllLabel || 'ทั้งหมด' }].concat(sports).forEach(function (sp) {
      var on = state.sportId === sp.id;
      var b = opts.sportMenu
        ? el('button', MENU_ITEM + (on ? MENU_ITEM_ON : sp.empty ? MENU_ITEM_EMPTY : MENU_ITEM_OFF), menuItemHtml(sp, on))
        : opts.sportPills
        ? el('button', SPORT_PILL + (on ? SPORT_PILL_ON : SPORT_PILL_OFF), esc(sp.name))
        : el('button', SPORT_CHIP + (on ? SPORT_CHIP_ON : SPORT_CHIP_OFF), esc(sp.name));
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () { setFilter('sportId', sp.id === 'all' || on ? 'all' : sp.id); scrollToContent(); });
      host.appendChild(b);
    });
    if (opts.sportMenu) paintUiIcons(host);
    document.getElementById('sportRow').hidden = sports.length < 2;
    syncSportMore();
  }

  /** ปุ่ม › ท้ายแถวชิปกีฬา: โผล่เฉพาะตอนยังมีชิปล้นอยู่ทางขวา เลื่อนไปขวาทีละเกือบเต็มกล่อง */
  function syncSportMore() {
    var more = document.getElementById('sportMore');
    if (!more) return;
    var host = document.getElementById('sportChips');
    more.hidden = host.scrollLeft + host.clientWidth >= host.scrollWidth - 2;
  }

  /* ---------- แบ่งหน้า ---------- */
  function pageCount(total) {
    return Math.max(1, Math.ceil(total / state.perPage));
  }

  function renderPager(total) {
    var from = total ? (state.page - 1) * state.perPage + 1 : 0;
    var to = Math.min(total, state.page * state.perPage);
    document.getElementById('schedRange').textContent = from + '–' + to + ' จาก ' + total;
    document.getElementById('pgFirst').disabled = document.getElementById('pgPrev').disabled = state.page <= 1;
    document.getElementById('pgNext').disabled = document.getElementById('pgLast').disabled = state.page >= pageCount(total);
    document.getElementById('schedPager').hidden = !total;
  }

  /* ---------- วาดทั้งหน้า ---------- */
  function render() {
    var all = allRows();

    renderDayBar(all);
    renderSportBar(all);

    var rows = sortRows(filterRows(all));
    // ข้อมูลซิงก์ใหม่แล้วรายการลดลง หน้าที่ดูอยู่อาจเกินหน้าสุดท้าย — ดึงกลับมาหน้าสุดท้ายที่มีจริง
    state.page = Math.min(state.page, pageCount(rows.length));
    var offset = (state.page - 1) * state.perPage;

    var host = document.getElementById('schedDays');
    host.innerHTML = '';

    if (!opts.days(state.data).length) {
      host.appendChild(el('p', 'm-0 border-t border-line px-5 py-5 fs-14.5 text-fg-mute', esc(opts.emptyText)));
    } else if (!rows.length) {
      var empty = el('div', 'flex flex-col items-center gap-3 border-t border-line px-5 py-6 text-center',
        '<p class="m-0 fs-15 text-fg-mute">ไม่พบรายการที่ตรงกับตัวกรอง</p>');
      var clear = el('button', FILTER_CHIP, 'ล้างตัวกรองทั้งหมด');
      clear.type = 'button';
      clear.addEventListener('click', clearFilters);
      empty.appendChild(clear);
      host.appendChild(empty);
    } else {
      // ช่อง "ระหว่าง" ไม่ตัดบรรทัด กล่องที่แคบกว่าตารางจึงเลื่อนตารางไปด้านข้างได้ แทนที่คอลัมน์ท้ายจะหลุดขอบ
      // relative: ข้อความ sr-only (absolute) ในหัวตารางจะได้ไม่หลุดออกนอกกล่องแล้วดันทั้งหน้าให้เลื่อนข้างได้
      var scroller = el('div', 'relative overflow-x-auto');
      scroller.appendChild(tableEl(rows.slice(offset, offset + state.perPage), visibleColumns(all)));
      host.appendChild(scroller);
      alignTeams(scroller);
    }
    renderPager(rows.length);

    // หัวตารางบอกว่ากำลังดูกีฬาอะไรอยู่ — เลื่อนลงมาไกลจนแถวชิปพ้นจอแล้วก็ยังรู้
    var title = document.getElementById('schedTitle');
    if (!title.dataset.base) title.dataset.base = title.textContent;
    var sport = state.sportId !== 'all' ? sportName(state.data, state.sportId) : '';
    title.textContent = sport || title.dataset.base;

    // "ล้างตัวกรอง" โผล่เฉพาะตอนที่มีอะไรให้ล้างจริง — ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มที่ไม่ควรมี
    document.getElementById('schedClear').hidden = !hasFilter();

    // หน้าที่มีแผงสรุปข้าง ๆ (ผลการแข่งขัน) รับแถวของวันที่เลือกไว้ไปนับเอง — ไม่กรองกีฬา/คำค้น
    if (opts.onRender) {
      opts.onRender({
        data: state.data, rows: rows, all: all,
        sportId: state.sportId === 'all' ? null : state.sportId,
        dayRows: all.filter(function (r) { return state.dayId === 'all' || r.dayId === state.dayId; }),
        day: opts.days(state.data).filter(function (d) { return d.id === state.dayId; })[0] || null
      });
    }
  }

  /** เปลี่ยนตัวกรองแล้วกลับไปหน้าแรกเสมอ — อยู่หน้า 3 ของผลเดิมไม่มีความหมายกับผลชุดใหม่ */
  function setFilter(key, value) {
    state[key] = value;
    state.page = 1;
    syncSportParam();
    if (state.data) render();
  }

  /** เก็บกีฬาที่กรองไว้ใน URL (?sport=) — รีเฟรชหรือแชร์ลิงก์แล้วยังกรองอยู่ ไม่เพิ่มประวัติย้อนกลับ */
  function syncSportParam() {
    var url = new URL(location.href);
    if (state.sportId === 'all') url.searchParams.delete('sport');
    else url.searchParams.set('sport', state.sportId);
    if (url.href !== location.href) history.replaceState(null, '', url);
  }

  /** ล้างทุกตัวกรองกลับไปเป็นตารางเต็ม — ใช้ทั้งปุ่มบนแถบตัวกรองและปุ่มในสถานะว่าง */
  function clearFilters() {
    state.dayId = 'all'; state.sportId = 'all'; state.q = '';
    document.getElementById('schedSearch').value = '';
    setFilter('page', 1);
  }

  function goPage(page) {
    if (!state.data) return;
    var total = filterRows(allRows()).length;
    state.page = Math.max(1, Math.min(page, pageCount(total)));
    render();
    // กดเปลี่ยนหน้าจากท้ายตาราง ให้เลื่อนกลับขึ้นไปหัวตาราง ไม่ค้างอยู่ท้ายหน้ากับแถวชุดใหม่
    document.getElementById('schedTitle').scrollIntoView({ block: 'nearest' });
  }

  /* ---------- ตัวควบคุม (ผูกครั้งเดียว องค์ประกอบเหล่านี้อยู่ใน HTML ไม่ได้วาดใหม่) ---------- */
  document.getElementById('schedSearch').addEventListener('input', function (e) {
    setFilter('q', e.target.value);
  });
  document.getElementById('schedClear').addEventListener('click', clearFilters);

  document.getElementById('schedPerPage').addEventListener('change', function (e) {
    state.perPage = Number(e.target.value) || 25;
    setFilter('page', 1);
  });
  document.getElementById('pgFirst').addEventListener('click', function () { goPage(1); });
  document.getElementById('pgPrev').addEventListener('click', function () { goPage(state.page - 1); });
  document.getElementById('pgNext').addEventListener('click', function () { goPage(state.page + 1); });
  document.getElementById('pgLast').addEventListener('click', function () { goPage(Infinity); });

  /* ตัวเลือกวันเสริม: ‹ › เลื่อนไปวันก่อน/ถัดไป */
  function stepDay(step) {
    if (!state.data) return;
    var ids = pickableDays(allRows()).map(function (d) { return d.id; });
    var i = ids.indexOf(state.dayId) + step;
    if (i >= 0 && i < ids.length) setFilter('dayId', ids[i]);
  }
  bind('dayPrev', 'click', function () { stepDay(-1); });
  bind('dayNext', 'click', function () { stepDay(1); });
  bind('sportMore', 'click', function () {
    var host = document.getElementById('sportChips');
    host.scrollBy({ left: host.clientWidth * 0.8, behavior: 'smooth' });
  });
  window.addEventListener('resize', syncSportMore);
  bind('sportChips', 'scroll', syncSportMore);
  function bind(id, type, fn) {
    var n = document.getElementById(id);
    if (n) n.addEventListener(type, fn);
  }

  function renderAll(data) {
    // วันที่เลือกไว้ตอนเปิดหน้า: ตัดสินครั้งเดียวตอนข้อมูลชุดแรกมาถึง ชุดถัดไปไม่ย้ายวันใต้มือคนอ่าน
    if (!state.data && opts.defaultDay) {
      var picked = opts.defaultDay(opts.days(data));
      if (picked != null) state.dayId = picked;
    }
    state.data = data;
    render();
    chrome.onData(data);
  }

  loadData().then(function (data) {
    renderAll(data);
    onFreshData(renderAll);
  }).catch(showLoadError);
}
