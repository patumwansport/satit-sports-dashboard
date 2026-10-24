// ทดสอบการอ่านชีต: ตัวกลางเติมช่องที่ gviz ทิ้ง / ซ่อนแถวตามคอลัมน์ "ซ่อนจากเว็บ" และการแปลงแท็บผลการแข่งขัน
// รัน: node --test scripts/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadFromSheets } from '../public/js/sheets.js';

const { fillFromCsv, rowsFromCsv } = createRequire(import.meta.url)('../api/gviz.js').internals;

const raw = (cols, rows) => '/*O_o*/\ngoogle.visualization.Query.setResponse(' +
  JSON.stringify({ version: '0.6', status: 'ok', table: { cols, rows: rows.map((c) => ({ c })) } }) + ');';
const table = (text) => JSON.parse(text.match(/setResponse\(([\s\S]*)\);?\s*$/)[1]).table;
const col = (id, label, type = 'string') => ({ id, label, type });
const s = (v) => (v == null ? null : { v, f: v });

// ผังเดียวกับแท็บ "ตารางการแข่งขัน" (ย่อคอลัมน์)
const PLAN_COLS = [col('A', 'วันที่', 'date'), col('B', 'รายการ'), col('C', 'ประเภท'), col('D', 'รอบ'), col('E', 'สาย'),
  col('F', 'เวลา', 'datetime'), col('G', 'ระหว่าง'), col('H', ''), col('I', ''), col('J', 'สถานที่')];
const day = { v: 'Date(2026,9,24)', f: '24/10/2026' };
const PLAN_CSV = [
  'วันที่,รายการ,ประเภท,รอบ,สาย,เวลา,ระหว่าง,,,สถานที่',
  '24/10/2026,เปตอง,เปตอง : เดี่ยว,Q1,G,8:30,สาธิต มศว ปทุมวัน,พบ,สาธิต ม.เกษตร,สนามเปตอง',
  '24/10/2026,แบดมินตัน,แบดมินตัน : ทีม,Semi final (ถ้าผ่าน),,10:00,สาธิต มศว ปทุมวัน,พบ,,สนามแบด',
  '24/10/2026,ฟุตบอล,ฟุตบอล : ทีม,รอบที่ 1,A,9:00,สาธิต มศว ปทุมวัน,พบ,สาธิตจุฬาฯ,สนามกลาง'
].join('\n');
// gviz: แถวแบดมินตันถูกตัวกรองซ่อน (ไม่ส่งมา) · เวลา "8:30" ที่เก็บเป็นข้อความในคอลัมน์เวลา ได้ null
const PLAN_GVIZ = raw(PLAN_COLS, [
  [day, s('เปตอง'), s('เปตอง : เดี่ยว'), s('Q1'), s('G'), null, s('สาธิต มศว ปทุมวัน'), s('พบ'), s('สาธิต ม.เกษตร'), s('สนามเปตอง')],
  [day, s('ฟุตบอล'), s('ฟุตบอล : ทีม'), s('รอบที่ 1'), s('A'), { v: 'Date(1899,11,30,9,0,0)', f: '9:00' }, s('สาธิต มศว ปทุมวัน'), s('พบ'), s('สาธิตจุฬาฯ'), s('สนามกลาง')]
]);

test('เติมเวลาที่ gviz ทิ้งจาก CSV โดยไม่เอาแถวที่ตัวกรองซ่อนไว้มาด้วย', () => {
  const out = fillFromCsv(PLAN_GVIZ, PLAN_CSV);
  const t = table(out.raw);
  assert.equal(out.filled, 1);
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0].c[5].v, '8:30');
  assert.equal(t.rows[1].c[5].v, 'Date(1899,11,30,9,0,0)');
});

test('จับคู่แถวไม่ได้ = ส่ง gviz เดิม ไม่เดาเติม', () => {
  const other = PLAN_CSV.replace('สาธิต ม.เกษตร', 'สาธิต ม.อื่น').replace('สาธิตจุฬาฯ', 'สาธิต ม.อื่น');
  const out = fillFromCsv(PLAN_GVIZ, other);
  assert.equal(out.filled, 0);
  assert.equal(out.raw, PLAN_GVIZ);
});

test('ไม่มีคอลัมน์ "ซ่อนจากเว็บ" = ใช้ตัวกรองแบบเดิม', () => {
  assert.equal(rowsFromCsv(PLAN_GVIZ, PLAN_CSV), null);
});

test('มีคอลัมน์ "ซ่อนจากเว็บ" = ไม่สนตัวกรอง ซ่อนเฉพาะแถวที่ติ๊ก', () => {
  const cols = PLAN_COLS.concat(col('K', 'ซ่อนจากเว็บ'));
  const csv = PLAN_CSV.split('\n').map((line, i) => line + (i === 0 ? ',ซ่อนจากเว็บ' : i === 3 ? ',x' : ',')).join('\n');
  const t = table(rowsFromCsv(raw(cols, []), csv));
  assert.deepEqual(t.rows.map((r) => r.c[1].v), ['เปตอง', 'แบดมินตัน']);
  assert.equal(t.rows[0].c[0].v, 'Date(2026,9,24)');
  assert.equal(t.rows[0].c[5].v, '8:30');
});

test('รูปแบบวันที่ในชีตเปลี่ยนจนอ่านไม่ออก = ไม่ใช้แถวจาก CSV', () => {
  const cols = PLAN_COLS.concat(col('K', 'ซ่อนจากเว็บ'));
  const csv = PLAN_CSV.replaceAll('24/10/2026', '24 ต.ค. 2569').split('\n').map((l, i) => l + (i ? ',' : ',ซ่อนจากเว็บ')).join('\n');
  assert.equal(rowsFromCsv(raw(cols, []), csv), null);
});

test('แท็บเหรียญ: จำนวนที่พิมพ์เป็นข้อความถูกเติม ไม่กลายเป็น 0', () => {
  const cols = [col('A', 'โรงเรียน'), col('B', 'ทอง', 'number'), col('C', 'เงิน', 'number'), col('D', 'ทองแดง', 'number')];
  const g = raw(cols, [[s('สาธิต ก'), { v: 3, f: '3' }, null, { v: 1, f: '1' }], [s('สาธิต ข'), { v: 2, f: '2' }, { v: 2, f: '2' }, null]]);
  const csv = 'โรงเรียน,ทอง,เงิน,ทองแดง\nสาธิต ก,3,2 ,1\nสาธิต ข,2,2,-';
  const t = table(fillFromCsv(g, csv).raw);
  assert.equal(Number(t.rows[0].c[2].v), 2);
  assert.equal(t.rows[1].c[3].v, '-');
});

// ---------- แท็บผลการแข่งขัน ผ่านตัวแปลงจริงของหน้าเว็บ (loadFromSheets) ----------
const RESULT_HEAD = ['วันที่', 'กีฬา', '', 'รอบ', 'สาย', 'ระหว่าง', 'ผลการแข่งขัน', 'สถานะ', 'ซ่อนจากเว็บ'];
function resultRow(cells) { return cells.map((v) => s(v)); }
function sheetsFetch(tabs) {
  return async (url) => {
    const gid = (/gid=(\d+)/.exec(url) || [])[1] || (/sheet=([^&]+)/.exec(url) || [])[1];
    const body = tabs[gid];
    if (body == null) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
  };
}
function baseTabs(resultRows) {
  const L = (labels) => labels.map((l, i) => col(String.fromCharCode(65 + i), l));
  return {
    1195929060: raw([col('A', 'โรงเรียน'), col('B', 'ทอง', 'number'), col('C', 'เงิน', 'number'), col('D', 'ทองแดง', 'number')],
      [[s('โรงเรียนสาธิตมหาวิทยาลัยศรีนครินทรวิโรฒ ปทุมวัน'), { v: 1, f: '1' }, { v: 0, f: '0' }, { v: 2, f: '2' }]]),
    1253612074: raw(L(['', '', '', '', '']), [resultRow(['ประเภทกีฬา', 'ทอง', 'เงิน', 'ทองแดง', 'รวม']), [s('ฟุตบอล'), { v: 1, f: '1' }, { v: 0, f: '0' }, { v: 0, f: '0' }, { v: 1, f: '1' }]]),
    // gviz จับหัวไม่ได้: หัวตารางมาเป็นแถวข้อมูลแถวแรก (เหมือนแท็บจริงตอนนี้)
    2119468784: raw(L(RESULT_HEAD.map(() => '')), [resultRow(RESULT_HEAD)].concat(resultRows)),
    1146003336: PLAN_GVIZ,
    1636287265: raw([col('A', 'ชื่อ')], []),
    img: raw([col('A', 'ลิงก์รูป')], [])
  };
}

test('แท็บผล: คู่แข่งในช่องเดียว สกอร์ข้อความ สถานะ วันที่แบบข้อความ และแถวที่ติ๊กซ่อน', async () => {
  global.fetch = sheetsFetch(baseTabs([
    resultRow(['24/10/2026', 'ฟุตบอล', 'ฟุตบอล : ทีม ชาย', 'รอบที่ 1', 'A', 'สาธิต มศว ปทุมวัน พบ สาธิตจุฬาฯ', '2-1', 'ไม่เป็นทางการ', '']),
    resultRow(['24/10/2569', 'เปตอง', 'เปตอง : เดี่ยว', 'Q1', '', 'สาธิต มศว ปทุมวัน', 'อันดับ 3', 'เสร็จสิ้น', '']),
    resultRow(['25/10/2026', 'แบดมินตัน', 'แบดมินตัน : ทีม', 'SF (ถ้าผ่าน)', '', 'สาธิต มศว ปทุมวัน พบ', '', '', 'ซ่อน'])
  ]));
  const data = await loadFromSheets();
  assert.equal(data.days.length, 1, 'แถวที่ติ๊กซ่อนต้องไม่สร้างวันที่ 25 ขึ้นมา');
  assert.equal(data.days[0].iso, '2026-10-24', 'ปี พ.ศ. 2569 ในช่องวันที่ต้องอ่านเป็นปี 2026');
  const [football, petanque] = data.days[0].items;
  assert.equal(football.teams, 'สาธิต มศว ปทุมวัน พบ สาธิตจุฬาฯ');
  assert.equal(football.score, '2-1');
  assert.equal(football.status, 'done');
  assert.equal(football.unofficial, true);
  assert.equal(football.round, 'รอบที่ 1');
  assert.equal(petanque.score, 'อันดับ 3');
  assert.equal(petanque.status, 'done');
  // ตารางแข่ง: เวลาที่ตัวกลางเติมให้ แสดงเป็น 08:30
  const plan = (await (global.fetch = sheetsFetch(Object.assign(baseTabs([]), { 1146003336: fillFromCsv(PLAN_GVIZ, PLAN_CSV).raw })), loadFromSheets())).schedule;
  assert.deepEqual(plan[0].items.map((i) => i.time), ['08:30', '09:00']);
});
