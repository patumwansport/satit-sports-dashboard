/* =========================================================
   venues.js — รูปสนามและลิงก์นำทาง Google Maps ของแผง "สนามแข่งขันวันนี้" ในหน้าหลัก
   จับคู่กับช่อง "สถานที่" ในแท็บ "ตารางการแข่งขัน" ด้วยชื่อตรงตัว (ไม่สนช่องว่างซ้ำ) — ชื่อในชีตเปลี่ยน ต้องแก้ name ที่นี่ด้วย

   รูป: วางไฟล์ public/assets/venue/<file>.webp (แนวนอน ~800×500 แปลงด้วย cwebp -q 82 -resize 800 0)
        ยังไม่มีไฟล์ = การ์ดขึ้นพื้นสีกับหมุดแทน ไม่ต้องแก้โค้ด
   แผนที่: map = คำค้นที่ Google Maps หาเจอตรงสนาม · mapUrl = ลิงก์ปักหมุดที่คัดลอกจาก Google Maps (ถ้ามี ใช้อันนี้แทน)
   สนามที่ไม่อยู่ในรายการ = ไม่มีรูป และค้นแผนที่ด้วยชื่อในชีตตรง ๆ
   ========================================================= */
export var VENUES = [
  { name: 'มหาวิทยาลัยราชภัฏเชียงราย', file: 'crru', map: 'มหาวิทยาลัยราชภัฏเชียงราย' },
  { name: 'ยิมเนเซียม มรภ.เชียงราย', file: 'crru-gym', map: 'อาคารยิมเนเซียม มหาวิทยาลัยราชภัฏเชียงราย' },
  { name: 'หอประชุมพญางำเมือง ม.พะเยา', file: 'up-phaya-ngam-mueang', map: 'หอประชุมพญางำเมือง มหาวิทยาลัยพะเยา' },
  { name: 'โรงยิม รร.พะเยาพิทยาคม', file: 'phayaopit-gym', map: 'โรงเรียนพะเยาพิทยาคม' },
  { name: 'วิทยาลัยเทคนิค จ.พะเยา', file: 'phayao-tech', map: 'วิทยาลัยเทคนิคพะเยา' },
  { name: 'สนามเทนนิส อบจ.เชียงราย', file: 'cr-pao-tennis', map: 'สนามเทนนิส อบจ.เชียงราย' },
  { name: 'โรงเรียนดอกคำใต้วิทยาคม', file: 'dokkhamtai', map: 'โรงเรียนดอกคำใต้วิทยาคม' }
];

function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

/** ชื่อสนามในชีต → { photo, mapUrl } · photo ว่าง = ไม่มีรูปในรายการ */
export function venueInfo(name) {
  var v = VENUES.filter(function (x) { return norm(x.name) === norm(name); })[0] || {};
  return {
    photo: v.file ? 'assets/venue/' + v.file + '.webp' : '',
    // dir/?destination= เปิดโหมดนำทางจากตำแหน่งปัจจุบัน (มือถือเด้งเข้าแอป Google Maps)
    mapUrl: v.mapUrl || 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(v.map || norm(name))
  };
}
