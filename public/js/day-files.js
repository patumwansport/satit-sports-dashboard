/* =========================================================
   day-files.js — โฟลเดอร์โปรแกรมการแข่งขันรายวันในโฟลเดอร์ "DayByDay" ของ Google Drive (DAY_FILES_FOLDER ใน gallery-config.js)
   ใช้กับปุ่มในแถบ "โปรแกรมการแข่งขันวันถัดไป" ของหน้าหลัก — ปุ่มตามวันแข่งขันถัดไปเอง และเปิดโฟลเดอร์ของวันนั้นใน Drive

   โครงโฟลเดอร์:
     DayByDay
       ├── 24Oct        ← โฟลเดอร์ละวัน ชื่ออ่านด้วย parseThaiDate ("24Oct", "24 ต.ค.", "24/10/2569" …)
       ├── 25Oct
       └── Checklist    ← ไฟล์อื่นในโฟลเดอร์แม่ไม่เกี่ยว
   ยังไม่มีโฟลเดอร์ของวันนั้น = เปิดโฟลเดอร์ DayByDay ทั้งโฟลเดอร์แทน
   ถามผ่านตัวกลางแคช api/drive ก่อน (ล่ม = ถาม Drive ตรง) · ชื่อขึ้นต้นด้วย _ หรือ # = ไม่นับ
   ========================================================= */
import { DAY_FILES_FOLDER, GOOGLE_API_KEY } from './gallery-config.js';
import { driveFolderId, listFolder } from './drive-photos.js';
import { parseThaiDate } from './format.js';

var FOLDER = 'application/vnd.google-apps.folder';

/** ลิงก์เปิดโฟลเดอร์ใน Drive */
export function driveFolderUrl(id) {
  return 'https://drive.google.com/drive/folders/' + id;
}

/** ลิงก์โฟลเดอร์ DayByDay ทั้งโฟลเดอร์ — ใช้ได้ทันทีระหว่างรอ Drive ตอบ / ไม่เจอโฟลเดอร์ของวัน */
export function dayRootUrl() {
  var root = driveFolderId(DAY_FILES_FOLDER);
  return root ? driveFolderUrl(root) : '';
}

var rootList = null;

/**
 * โฟลเดอร์วันทั้งหมดใน DayByDay → [{ id, name, md: 'MM-DD' }] เรียงตามวัน · ไม่ได้ตั้งค่า = [] · อ่าน Drive ไม่ได้ = reject
 * เก็บแค่เดือน-วัน: ชื่อโฟลเดอร์มักไม่มีปี (parseThaiDate เติมปีปัจจุบันให้ ซึ่งอาจไม่ตรงปีของงานช่วงข้ามปี)
 */
async function dayFolders() {
  var root = driveFolderId(DAY_FILES_FOLDER);
  if (!root || !GOOGLE_API_KEY) return [];
  if (!rootList) rootList = listFolder(root).catch(function (err) { rootList = null; throw err; });
  return (await rootList).filter(function (f) {
    return f.mimeType === FOLDER && !/^[_#]/.test(String(f.name || '').trim()) && parseThaiDate(f.name);
  }).map(function (f) {
    return { id: f.id, name: f.name, md: parseThaiDate(f.name).slice(5) };
  }).sort(function (a, b) { return a.md < b.md ? -1 : a.md > b.md ? 1 : 0; });
}

/** โฟลเดอร์ของวัน (iso 'YYYY-MM-DD') → { id, name, md } · ไม่มี / ไม่ได้ตั้งค่า = null · อ่าน Drive ไม่ได้ = reject */
export async function dayFolder(iso) {
  if (!iso) return null;
  return (await dayFolders()).filter(function (f) { return f.md === iso.slice(5); })[0] || null;
}

/** โฟลเดอร์วันแรกที่เลยวันนี้ (iso) ไปแล้ว → { id, name, md } · ไม่มีแล้ว = null — ผู้ดูแลสร้างโฟลเดอร์ล่วงหน้า (24Oct…) ก่อนชีตมีรายการ */
export async function nextDayFolder(todayIso) {
  return (await dayFolders()).filter(function (f) { return f.md > todayIso.slice(5); })[0] || null;
}
