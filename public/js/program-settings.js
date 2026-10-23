/* สถานะโปรแกรมแข่งขันแยกวัน: site_settings หนึ่ง key ต่อวันที่ ไม่ส่ง Final ข้ามวัน */
export function programStatusKey(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) throw new Error('วันที่ไม่ถูกต้อง');
  var date = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('วันที่ไม่ถูกต้อง');
  return 'next_program_status_' + iso;
}
export function programStatus(value) { return value === 'final' ? 'final' : 'pending'; }
export function programDateLabel(iso) {
  programStatusKey(iso);
  var parts = iso.split('-');
  var months = ['มกรา', 'กุมภา', 'มีนา', 'เมษา', 'พฤษภา', 'มิถุนา', 'กรกฎา', 'สิงหา', 'กันยา', 'ตุลา', 'พฤศจิกา', 'ธันวา'];
  return +parts[2] + ' ' + months[+parts[1] - 1] + ' ' + parts[0].slice(-2);
}

function bangkokParts(now) {
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  var d = {};
  parts.forEach(function (p) { d[p.type] = p.value; });
  return d;
}
/** ก่อน 12:01 ไทย = วันนี้ · ตั้งแต่ 12:01 = พรุ่งนี้ รวมวันสิ้นเดือน/ปี */
export function programDateAt(now = new Date()) {
  var d = bangkokParts(now);
  return new Date(Date.UTC(+d.year, +d.month - 1, +d.day + (+d.hour * 60 + +d.minute >= 721 ? 1 : 0))).toISOString().slice(0, 10);
}
export function programTitleAt(now = new Date()) {
  var d = bangkokParts(now);
  return 'โปรแกรมการแข่งขัน' + (+d.hour * 60 + +d.minute >= 721 ? 'วันพรุ่งนี้' : 'วันนี้');
}
export function msUntilProgramChange(now = new Date()) {
  var d = bangkokParts(now);
  var noon = Date.parse(d.year + '-' + d.month + '-' + d.day + 'T12:01:00+07:00');
  return noon + (now.getTime() >= noon ? 86400000 : 0) - now.getTime();
}
/** เปลี่ยนตอน 12:01 โดยไม่รีเฟรช · กลับจากพักหน้าจอตรวจใหม่ทันที · ลองหาโฟลเดอร์ที่เพิ่งเพิ่มทุกนาที */
export function watchProgramDate(onTick, options = {}) {
  var now = options.now || function () { return new Date(); };
  var schedule = options.setTimeout || globalThis.setTimeout;
  var cancel = options.clearTimeout || globalThis.clearTimeout;
  var page = options.document || globalThis.document;
  var timer;
  function tick() {
    cancel(timer);
    var date = now();
    onTick(programDateAt(date), date);
    timer = schedule(tick, Math.min(msUntilProgramChange(date), 60000));
  }
  function resume() { if (!page.hidden) tick(); }
  page.addEventListener('visibilitychange', resume);
  tick();
  return function () { cancel(timer); page.removeEventListener('visibilitychange', resume); };
}
