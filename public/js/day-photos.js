/* =========================================================
   day-photos.js — ภาพการแข่งขันรายวัน ใช้ร่วมกันระหว่างหน้าหลัก (แถบภาพบรรยากาศ) กับหน้าผลการแข่งขัน (ไฮไลต์)
   แหล่งเดียวกับหน้าประมวลภาพ: โฟลเดอร์ Google Drive (กีฬา → โฟลเดอร์วัน) อ่านโครงโฟลเดอร์ครั้งเดียวตอนเปิดหน้า
   แล้วโหลดรูปเฉพาะวันที่ขอ (เก็บไว้ใช้ซ้ำ ขอวันเดิมซ้ำไม่โหลดใหม่)
   ยังไม่ตั้งค่า Drive / อ่านไม่ได้ → ใช้ภาพจากแท็บภาพในชีตที่มากับข้อมูลหลัก (คัดตามวันที่ของภาพ)
   ========================================================= */
import { hasDrive, loadDriveTree, loadUnitPhotos, setDriveConfig } from './drive-photos.js';
import { loadGallerySettings } from './gallery-settings.js';

/** โครงโฟลเดอร์ Drive (หน่วย กีฬา×วัน) — null = ไม่มีแหล่ง Drive ให้ใช้ภาพจากชีตแทน */
export var photoUnits = loadGallerySettings().then(function (settings) {
  setDriveConfig(settings);
  if (!hasDrive()) return null;
  return loadDriveTree().catch(function (err) {
    console.error('อ่านโฟลเดอร์ภาพใน Google Drive ไม่สำเร็จ — ใช้ภาพจากชีตแทน:', err.message);
    return null;
  });
});

var byIso = {};

/**
 * ภาพของวัน (iso 'YYYY-MM-DD') → [{ link, sportText, caption }]
 * @param {Array|null} units - ผลของ photoUnits (null = ใช้แท็บภาพในชีต)
 */
export function photosOfDay(units, data, iso) {
  if (!units) {
    return Promise.resolve(((data && data.photos) || []).filter(function (p) { return p.iso === iso && (p.link || p.src); })
      .map(function (p) { return { link: p.link || p.src, sportText: p.sportText || '', caption: p.caption || '' }; }));
  }
  if (!byIso[iso]) {
    var mine = units.filter(function (u) { return u.key === iso; });
    byIso[iso] = mine.length ? loadUnitPhotos(mine).catch(function (err) {
      delete byIso[iso];
      console.error('โหลดภาพของวัน ' + iso + ' ไม่สำเร็จ:', err.message);
      return [];
    }) : Promise.resolve([]);
  }
  return byIso[iso];
}

/** วันที่ (iso) ที่มีภาพ เรียงจากเก่าไปใหม่ — จากโฟลเดอร์วันใน Drive หรือวันที่ของภาพในชีต
    @param {function(string): boolean} [ofSport] - นับเฉพาะภาพของกีฬาที่ผ่าน (รับชื่อกีฬาของโฟลเดอร์/ภาพ) */
export function photoDates(units, data, ofSport) {
  var seen = {}, ok = ofSport || function () { return true; };
  (units || []).forEach(function (u) { if (/^\d{4}-\d{2}-\d{2}$/.test(u.key) && ok(u.sport || '')) seen[u.key] = 1; });
  if (!units) ((data && data.photos) || []).forEach(function (p) { if (p.iso && ok(p.sportText || '')) seen[p.iso] = 1; });
  return Object.keys(seen).sort();
}
