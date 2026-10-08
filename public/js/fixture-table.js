/* =========================================================
   fixture-table.js — ตารางรายการแข่งขันแบบกรองได้ ใช้ร่วมกันสองหน้า
   (ตารางการแข่งขัน = ผังกำหนดการ · ผลการแข่งขัน = ผลที่ประกาศแล้ว)

   ทั้งสองหน้าหน้าตาเดียวกันทุกอย่าง ต่างกันแค่ "อ่านวันจากไหน" กับ "คอลัมน์ท้ายตาราง"
   จึงรวมส่วนที่เหมือนกันไว้ที่นี่:
   - ดรอปดาวน์ชนิดกีฬา + ลิงก์เลือกวัน + ช่องค้นหาบนหัวตาราง
   - เรียงตามวันแล้วตามเวลา หนึ่งรายการในชีต = หนึ่งแถว
   - แบ่งหน้าละ 25/50/100 แถว
   - จอแคบ แต่ละแถวพับเป็นกริดเล็ก ๆ แทนการเลื่อนตารางกว้างไปด้านข้าง

   องค์ประกอบในหน้า (id เดียวกันทั้งสองหน้า): sportRow / sportSelect / sportClear / schedClear
   dayRow / dayJump / schedTitle / schedSearch / schedDays / schedPager / schedPerPage / schedRange
   pgFirst / pgPrev / pgNext / pgLast / schedNote
   ========================================================= */
import {
  el, esc, loadData, onFreshData, initChrome, sportName,
  dayLabel, isToday, eventParts, showLoadError
} from './common.js';

/* ---------- ชุดคลาสที่ใช้ซ้ำ (เขียนเต็มเสมอ ตัวสร้าง CSS อ่านจากสตริงพวกนี้) ---------- */
/* กล่องตารางแคบกว่า 800px ตารางหลายคอลัมน์อ่านไม่ออก — แต่ละแถวจึงกลายเป็นกริดสามคอลัมน์:
   วัดจากความกว้างกล่อง (@container ที่ <section> ในหน้า HTML) ไม่ใช่ความกว้างจอ
   เพราะช่วง 861–1100px แถบเมนูข้างกินที่ไป 252px ตารางเหลือที่น้อยกว่าบนมือถือเสียอีก
   บรรทัดแรก วัน · กีฬา กับเวลาชิดขวา แล้วคอลัมน์อื่นเรียงลงตามที่แต่ละหน้ากำหนด
   หัวตารางซ่อนไป เพราะแต่ละบรรทัดบอกตัวเองได้แล้ว */
var TH = 'px-4 py-3 text-left fs-14.5 font-normal whitespace-nowrap text-fg-soft first:pl-5 last:pr-5';
export var TD = 'px-4 py-3 align-top fs-15.5 text-fg first:pl-5 last:pr-5 @max-[800px]:p-0';
var TR = 'border-t border-line even:bg-stripe @max-[800px]:grid @max-[800px]:grid-cols-[auto_1fr_auto] @max-[800px]:items-baseline @max-[800px]:gap-x-2 @max-[800px]:gap-y-1 @max-[800px]:px-4 @max-[800px]:py-3';
/* จุดคั่น "วัน · กีฬา" บนจอแคบ — เขียนด้วยอัญประกาศคู่ ตัวสร้าง CSS จึงอ่านคลาสได้ตรงตัว */
var DOT_AFTER = " @max-[800px]:after:pl-2 @max-[800px]:after:text-fg-mute @max-[800px]:after:content-['·']";
/* บรรทัดรอง (วัน · กีฬา · รอบ/สาย) บนจอแคบ ตัวเล็กและจางกว่าเนื้อหาหลัก */
export var TD_SUB = ' @max-[800px]:fs-14 @max-[800px]:text-fg-soft';
/* เวลาเป็นสิ่งที่คนกวาดตาหาก่อนอย่างอื่น บนจอแคบจึงอยู่มุมขวาบนของบล็อก ตัวไม่เล็กลง */
export var TD_TIME = ' font-mono fs-17 whitespace-nowrap tabular-nums @max-[800px]:col-start-3 @max-[800px]:row-start-1';

/* ลิงก์เลือกวัน: ไม่มีกรอบ ยังไม่เลือก = ตัวสีดำ · วันที่เลือกอยู่ = ตัวสีน้ำเงินขีดเส้นใต้
   (ฟอนต์มีน้ำหนักเดียว จึงใช้เส้นใต้แทนตัวหนา) */
var DAY_LINK = 'inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-[7px] border-0 bg-transparent px-3 py-1.5 font-body fs-15.5 whitespace-nowrap' +
  ' underline-offset-[6px] transition-colors duration-150 hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-1' +
  ' focus-visible:outline-brand motion-reduce:transition-none max-[560px]:px-2.5 max-[560px]:fs-14.5';
var DAY_LINK_OFF = ' text-fg hover:text-brand hover:underline';
var DAY_LINK_ON = ' text-brand-strong underline decoration-2 decoration-brand';
/* วันที่กรองแล้วไม่เหลือรายการจางลงแต่ยังกดได้ — บอกล่วงหน้าว่ากดไปจะว่าง */
var DAY_LINK_EMPTY = ' opacity-45';
var DAY_SEP = '<span class="h-4 flex-none border-l border-line-strong" aria-hidden="true"></span>';

/* ปุ่มในสถานะว่าง (ล้างตัวกรอง) */
var FILTER_CHIP = 'cursor-pointer rounded-[11px] border border-line bg-surface-soft px-[15px] py-2 font-body fs-14.5 text-fg-soft' +
  ' transition-[border-color,color,background-color] duration-150 hover:border-line-strong hover:text-fg' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';

/** ช่องว่างในชีตขึ้นเป็นขีด ให้เห็นว่า "ยังไม่มีข้อมูล" ไม่ใช่ตารางแสดงผลตกหล่น */
export function orDash(text) {
  return text ? esc(text) : '<span class="text-fg-mute">-</span>';
}

/**
 * ติดตั้งตารางลงหน้า
 * @param {object} opts
 * @param {string} opts.page - ชื่อหน้าสำหรับเมนูข้าง ('schedule' / 'matches')
 * @param {function(object): Array} opts.days - วันทั้งหมดของตารางนี้ จากข้อมูลก้อนใหญ่
 * @param {function(object): object} opts.fields - ฟิลด์เพิ่มของหน้านี้ จากรายการหนึ่งรายการในชีต
 * @param {function(object): string} opts.searchText - ข้อความที่ช่องค้นหาใช้เทียบ
 * @param {Array<{head: string, cls: function(object): string, cell: function(object): string}>} opts.columns
 *   คอลัมน์ต่อจาก # / วันแข่งขัน / รายการแข่งขัน — cls(แถว) คืนคลาสของช่อง รวมตำแหน่งบนจอแคบ
 *   (เป็นฟังก์ชันเพราะบางช่องต้องซ่อนบนจอแคบเฉพาะแถวที่ช่องนั้นว่าง)
 * @param {string} opts.emptyText - ข้อความตอนชีตยังไม่มีข้อมูลเลย
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
        var extra = opts.fields(i);
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
  function rowEl(r, n, columns) {
    var tr = el('tr', TR);
    tr.innerHTML =
      '<td class="' + TD + ' font-mono fs-14 text-fg-mute tabular-nums @max-[800px]:hidden">' + n + '</td>' +
      // บนจอแคบ สองช่องนี้ต่อกันเป็นบรรทัดหัวของบล็อก: "เสาร์ 24 ต.ค. · กรีฑา"
      '<td class="' + TD + DOT_AFTER + TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-1 @max-[800px]:row-start-1">' +
        esc(dayLabel(r.day)) +
        (isToday(r.day) ? ' <span class="fs-13 text-fg-mute">(วันนี้)</span>' : '') + '</td>' +
      '<td class="' + TD + TD_SUB + ' whitespace-nowrap @max-[800px]:col-start-2 @max-[800px]:row-start-1 @max-[800px]:min-w-0 @max-[800px]:truncate">' +
        esc(r.sport) + '</td>' +
      columns.map(function (c) {
        return '<td class="' + TD + ' ' + c.cls(r) + '">' + c.cell(r) + '</td>';
      }).join('');
    return tr;
  }

  /** คอลัมน์ที่มี showIf จะโผล่เมื่อข้อมูลทั้งตาราง (ก่อนกรอง) เข้าเงื่อนไข เช่น มีชื่อนักกีฬาอย่างน้อยหนึ่งแถว */
  function visibleColumns(all) {
    return opts.columns.filter(function (c) { return !c.showIf || c.showIf(all); });
  }

  function tableEl(rows, offset, columns) {
    var table = el('table', 'w-full border-collapse @max-[800px]:block');
    table.innerHTML =
      '<thead class="@max-[800px]:hidden"><tr>' +
        '<th class="' + TH + ' w-12" scope="col">#</th>' +
        '<th class="' + TH + '" scope="col">วันแข่งขัน</th>' +
        '<th class="' + TH + '" scope="col">รายการแข่งขัน</th>' +
        columns.map(function (c) { return '<th class="' + TH + '" scope="col">' + esc(c.head) + '</th>'; }).join('') +
      '</tr></thead>';
    var body = el('tbody', '@max-[800px]:block');
    rows.forEach(function (r, i) { body.appendChild(rowEl(r, offset + i + 1, columns)); });
    table.appendChild(body);
    return table;
  }

  /* ---------- แถบตัวกรอง ---------- */
  function dayLink(html, on, dim, pick) {
    var b = el('button', DAY_LINK + (on ? DAY_LINK_ON : DAY_LINK_OFF) + (dim && !on ? DAY_LINK_EMPTY : ''), html);
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', pick);
    return b;
  }

  function renderDayBar(all) {
    var host = document.getElementById('dayJump');
    host.innerHTML = '';
    var pool = filterRows(all, 'day');
    var days = opts.days(state.data);

    host.appendChild(dayLink('ทุกวัน', state.dayId === 'all', false,
      function () { setFilter('dayId', 'all'); }));

    days.forEach(function (day) {
      var n = pool.filter(function (r) { return r.dayId === day.id; }).length;
      var on = state.dayId === day.id;
      // "วันนี้" (ตามปฏิทินจริง) ติดไว้ท้ายวันนั้นด้วย เพราะแถวนี้คือที่ที่คนมองหาว่าจะกดวันไหน
      host.insertAdjacentHTML('beforeend', DAY_SEP);
      host.appendChild(dayLink(esc(dayLabel(day) || ('วันที่ ' + day.id)) +
        (isToday(day) ? '<span class="fs-13 text-fg-mute">(วันนี้)</span>' : ''),
        on, !n, function () { setFilter('dayId', state.dayId === day.id ? 'all' : day.id); }));
    });
    document.getElementById('dayRow').hidden = days.length < 2;
  }

  /** ดรอปดาวน์ชนิดกีฬา — เรียงตามลำดับกีฬาในชีต แล้วต่อท้ายด้วยกีฬาที่มีในตารางแต่ยังไม่มีในตารางชนิดกีฬา */
  function renderSportBar(all) {
    var sel = document.getElementById('sportSelect');
    var order = (state.data.sports || []).map(function (s) { return s.id; });
    var seen = {}, sports = [];
    all.forEach(function (r) {
      if (!r.sportId || seen[r.sportId]) return;
      seen[r.sportId] = true;
      sports.push({ id: r.sportId, name: r.sport });
    });
    // กีฬาที่ลิงก์มากรองไว้แต่ยังไม่มีรายการในตาราง: ใส่ไว้ในดรอปดาวน์ด้วย
    // จะได้เห็นว่ากำลังกรองกีฬานั้นอยู่และขึ้น "ไม่พบรายการ" แทนที่จะเด้งกลับเป็นทุกชนิดกีฬาเงียบ ๆ
    if (state.sportId !== 'all' && !seen[state.sportId]) {
      var name = sportName(state.data, state.sportId);
      if (name) sports.push({ id: state.sportId, name: name });
    }
    sports.sort(function (a, b) {
      var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    sel.innerHTML = '<option value="all">ทุกชนิดกีฬา</option>' + sports.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
    }).join('');
    sel.value = state.sportId;
    // กีฬาที่เลือกไว้หายไปจากตารางหลังซิงก์ ก็กลับไปทุกชนิดกีฬา แทนที่จะค้างเป็นตัวกรองที่มองไม่เห็น
    if (sel.value !== state.sportId) { state.sportId = 'all'; sel.value = 'all'; syncSportParam(); }

    document.getElementById('sportClear').hidden = state.sportId === 'all';
    document.getElementById('sportRow').hidden = sports.length < 2;
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
      host.appendChild(tableEl(rows.slice(offset, offset + state.perPage), offset, visibleColumns(all)));
    }
    renderPager(rows.length);

    // หัวตารางบอกว่ากำลังดูกีฬาอะไรอยู่ — เลื่อนลงมาไกลจนดรอปดาวน์พ้นจอแล้วก็ยังรู้
    var title = document.getElementById('schedTitle');
    if (!title.dataset.base) title.dataset.base = title.textContent;
    var sport = state.sportId !== 'all' ? sportName(state.data, state.sportId) : '';
    title.textContent = sport || title.dataset.base;

    var dayCount = opts.days(state.data).length;
    document.getElementById('schedNote').textContent = hasFilter()
      ? 'แสดง ' + rows.length + ' จาก ' + all.length + ' รายการ'
      : dayCount + ' วันแข่งขัน · ' + all.length + ' รายการ · เรียงตามเวลา';

    // "ล้างตัวกรอง" โผล่เฉพาะตอนที่มีอะไรให้ล้างจริง — ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มที่ไม่ควรมี
    document.getElementById('schedClear').hidden = !hasFilter();
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
  document.getElementById('sportSelect').addEventListener('change', function (e) {
    setFilter('sportId', e.target.value);
  });
  document.getElementById('sportClear').addEventListener('click', function () {
    setFilter('sportId', 'all');
    document.getElementById('sportSelect').focus();
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

  function renderAll(data) {
    state.data = data;
    render();
    chrome.onData(data);
  }

  loadData().then(function (data) {
    renderAll(data);
    onFreshData(renderAll);
  }).catch(showLoadError);
}
