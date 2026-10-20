/* =========================================================
   ตัวเชื่อม CMS → Google Sheets (Google Apps Script)

   หน้า CMS (admin/) เป็นไฟล์นิ่ง เขียนลงชีตเองไม่ได้ สคริปต์นี้อยู่ในชีตและรันด้วยสิทธิ์ของเจ้าของชีต
   รับคำขอจากหน้า CMS แล้วอ่าน/แก้แถวให้ — ก่อนทำอะไรทุกครั้งจะตรวจกับ Supabase ว่าคนที่ส่งมา
   "เข้าสู่ระบบอยู่ และอยู่ในตาราง app_admins" ลิงก์ของสคริปต์จึงเปิดเผยได้ ไม่ใช่รหัสลับ

   วิธีติดตั้ง (ครั้งเดียว):
     1) เปิดชีต → ส่วนขยาย → Apps Script → ลบโค้ดเดิม วางไฟล์นี้ทั้งไฟล์ → บันทึก
     2) ทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่ → ประเภท "เว็บแอป"
        เรียกใช้ในฐานะ: ฉัน · ผู้มีสิทธิ์เข้าถึง: ทุกคน → ทำให้ใช้งานได้ → อนุญาตสิทธิ์
     3) คัดลอก "URL ของเว็บแอป" (ลงท้าย /exec) ไปวางที่ CMS → ตั้งค่าแหล่งข้อมูล → ตัวเชื่อมสำหรับแก้ไขชีต
   แก้โค้ดนี้ทีหลัง ต้อง "จัดการการทำให้ใช้งานได้ → แก้ไข → เวอร์ชันใหม่" ไม่งั้น URL เดิมยังรันโค้ดเก่า

   กฎการแก้:
     - แท็บที่ตั้ง "ป้องกันชีต" ไว้ = อ่านอย่างเดียว · ช่องที่เป็นสูตร = ไม่แตะ (ค่าคำนวณเอง)
     - ช่วงที่ตั้ง "ป้องกันช่วง" ทับแถวไหน แถวนั้นแก้/ลบไม่ได้
     - แก้/ลบต้องส่งค่าเดิมของแถวมาด้วย ถ้าในชีตไม่ตรงแล้ว (มีคนแก้หรือแทรกแถวระหว่างนั้น) จะปฏิเสธ
       ให้ CMS โหลดใหม่ — กันการเขียนทับแถวผิดเพราะเลขแถวเลื่อน
   ========================================================= */

var SUPABASE_URL = 'https://nrnblsmwfixxijawaevl.supabase.co';
var SUPABASE_KEY = 'sb_publishable_1zfYu-Mhs9R0jJYWVNxDPw_r-C230n9';   // publishable key เปิดเผยได้

function doGet() {
  return json_({ ok: true, app: 'satit-sheet-bridge', version: 2 });   // 2 = เก็บสกอร์เป็นข้อความ (ต.ค. 2569)
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verifyAdmin_(req.token);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (req.action === 'ping') {
      return json_({ ok: true, app: 'satit-sheet-bridge', version: 2, user: who, sheetId: ss.getId(), sheetName: ss.getName() });
    }
    if (req.action === 'tabs') {
      return json_({ ok: true, sheetId: ss.getId(), tabs: ss.getSheets().map(tabInfo_) });
    }
    if (req.action === 'read') return json_(readTab_(sheetByGid_(ss, req.gid)));
    if (req.action === 'update') return json_(locked_(function () { return updateRow_(sheetByGid_(ss, req.gid), req); }));
    if (req.action === 'append') return json_(locked_(function () { return appendRow_(sheetByGid_(ss, req.gid), req); }));
    if (req.action === 'delete') return json_(locked_(function () { return deleteRow_(sheetByGid_(ss, req.gid), req); }));
    throw new Error('ไม่รู้จักคำสั่ง ' + req.action);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------- ตรวจสิทธิ์ ---------- */

/** token = access token ของ Supabase จากหน้า CMS → อีเมลผู้ดูแล · จำผลไว้ 5 นาทีไม่ต้องถามซ้ำทุกคำขอ */
function verifyAdmin_(token) {
  if (!token) throw new Error('ไม่ได้เข้าสู่ระบบ CMS');
  var cache = CacheService.getScriptCache();
  var key = 'adm:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var hit = cache.get(key);
  if (hit) return hit;

  var auth = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token };
  var u = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', { headers: auth, muteHttpExceptions: true });
  if (u.getResponseCode() !== 200) throw new Error('การเข้าสู่ระบบหมดอายุ — รีเฟรชหน้า CMS แล้วลองใหม่');
  var user = JSON.parse(u.getContentText());

  var a = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/app_admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id),
    { headers: auth, muteHttpExceptions: true });
  if (a.getResponseCode() !== 200 || !JSON.parse(a.getContentText()).length) {
    throw new Error('บัญชี ' + user.email + ' ไม่มีสิทธิ์ผู้ดูแล');
  }
  cache.put(key, user.email, 300);
  return user.email;
}

/* ---------- อ่าน ---------- */

function tabInfo_(sh) {
  return { gid: String(sh.getSheetId()), name: sh.getName(), rows: sh.getLastRow(), cols: sh.getLastColumn(), readOnly: isReadOnly_(sh) };
}

function isReadOnly_(sh) {
  return sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length > 0;
}

function sheetByGid_(ss, gid) {
  var hit = ss.getSheets().filter(function (sh) { return String(sh.getSheetId()) === String(gid); })[0];
  if (!hit) throw new Error('ไม่พบแท็บ gid ' + gid + ' ในชีตนี้');
  return hit;
}

/** ค่าที่ "เห็น" ในชีต (ตามรูปแบบตัวเลข/วันที่) + ธงช่องสูตร — CMS แสดงและส่งค่าเดิมกลับมาตรวจ */
function readTab_(sh) {
  var info = tabInfo_(sh);
  if (!info.rows || !info.cols) return { ok: true, tab: info, rows: [] };
  var range = sh.getRange(1, 1, info.rows, info.cols);
  var values = range.getDisplayValues();
  var formulas = range.getFormulas();
  return {
    ok: true,
    tab: info,
    rows: values.map(function (r, i) {
      return { n: i + 1, v: r, f: formulas[i].map(function (f) { return f ? 1 : 0; }), locked: rowProtected_(sh, i + 1) ? 1 : 0 };
    })
  };
}

function rowProtected_(sh, row) {
  return sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) {
    var r = p.getRange();
    return row >= r.getRow() && row <= r.getLastRow();
  });
}

/* ---------- เขียน ---------- */

function locked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('มีคนกำลังบันทึกอยู่ — ลองใหม่อีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}

function assertWritable_(sh, row) {
  if (isReadOnly_(sh)) throw new Error('แท็บ "' + sh.getName() + '" ถูกป้องกันไว้ในชีต แก้จาก CMS ไม่ได้');
  if (row && rowProtected_(sh, row)) throw new Error('แถว ' + row + ' อยู่ในช่วงที่ถูกป้องกันไว้ในชีต');
}

/** แถวในชีตตอนนี้ยังตรงกับที่ CMS เห็นอยู่ไหม — ไม่ตรง = มีคนแก้/แทรกแถวระหว่างนั้น */
function assertSame_(sh, row, expect) {
  if (!Array.isArray(expect)) throw new Error('ไม่มีค่าเดิมของแถวมาให้ตรวจ');
  if (row < 1 || row > sh.getLastRow()) throw new Error('แถว ' + row + ' ไม่มีอยู่แล้ว — โหลดข้อมูลใหม่');
  var now = sh.getRange(row, 1, 1, expect.length).getDisplayValues()[0];
  for (var c = 0; c < expect.length; c++) {
    if (String(now[c]) !== String(expect[c])) throw new Error('แถว ' + row + ' ถูกแก้ในชีตระหว่างนี้ — โหลดข้อมูลใหม่แล้วแก้อีกครั้ง');
  }
}

/** ตัวเลขล้วนเก็บเป็นตัวเลข (ให้สูตรรวมเหรียญคำนวณได้) · อย่างอื่นให้ชีตตีความเหมือนพิมพ์เอง */
function cellValue_(v) {
  var s = String(v == null ? '' : v);
  return /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : s;
}

/** สกอร์อย่าง "2-1" / "21 - 15" — ช่องรูปแบบอัตโนมัติ ชีตจะแปลงเป็นวันที่ (2 ม.ค.) แล้วหน้าเว็บขึ้นวันที่แทนผล
    (ต.ค. 2569 — แท็บผลการแข่งขันยังว่าง ไม่รู้ว่าคอลัมน์ผลตั้งเป็นข้อความไว้หรือยัง จึงกันที่ตัวเชื่อมเลย) */
function isScore_(v) {
  return /^\s*\d{1,3}\s*[-–]\s*\d{1,3}\s*$/.test(String(v == null ? '' : v));
}

/** เขียนช่องเดียว: สกอร์ = ตั้งช่องเป็นข้อความก่อนแล้วเขียน (ไม่ใช้ ' นำหน้า — ช่องที่เป็นข้อความอยู่แล้วจะเก็บ ' ไว้จริง) */
function writeCell_(range, v) {
  if (isScore_(v)) range.setNumberFormat('@').setValue(String(v).trim());
  else range.setValue(cellValue_(v));
}

function updateRow_(sh, req) {
  var row = Number(req.row);
  assertWritable_(sh, row);
  assertSame_(sh, row, req.expect);
  var formulas = sh.getRange(row, 1, 1, req.expect.length).getFormulas()[0];
  var changed = 0;
  for (var c = 0; c < req.values.length; c++) {
    if (formulas[c] || String(req.values[c]) === String(req.expect[c])) continue;   // ไม่แตะช่องสูตร/ช่องที่ไม่ได้แก้
    writeCell_(sh.getRange(row, c + 1), req.values[c]);
    changed++;
  }
  return { ok: true, row: row, changed: changed };
}

function appendRow_(sh, req) {
  assertWritable_(sh, 0);
  if (!Array.isArray(req.values) || !req.values.some(function (v) { return String(v || '').trim(); })) {
    throw new Error('แถวใหม่ว่างทั้งแถว');
  }
  sh.appendRow(req.values.map(cellValue_));
  var row = sh.getLastRow();
  // appendRow ตั้งรูปแบบช่องเองไม่ได้ — ช่องสกอร์ที่ชีตอาจแปลงเป็นวันที่ไปแล้ว เขียนซ้ำเป็นข้อความ
  req.values.forEach(function (v, c) { if (isScore_(v)) writeCell_(sh.getRange(row, c + 1), v); });
  return { ok: true, row: row };
}

function deleteRow_(sh, req) {
  var row = Number(req.row);
  assertWritable_(sh, row);
  assertSame_(sh, row, req.expect);
  sh.deleteRow(row);
  return { ok: true, row: row };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
