/* =========================================================
   mvp.js — นักกีฬา MVP ที่ผู้ดูแลลงใน CMS (ตาราง mvps ใน Supabase · admin/ → นักกีฬา MVP)
   หน้าผลการแข่งขันรวมรายการนี้กับแท็บ MVP ในชีต (matches.js → renderStars) · ผู้ดูแลขอ ต.ค. 2569

   admin/config.js ว่าง / Supabase ล่ม / ยังไม่ได้สร้างตาราง = คืนรายการว่าง (การ์ดยังแสดงคนจากชีตได้)
   ใช้ fetch ตรงเข้า PostgREST ไม่โหลด supabase-js เหมือน news.js
   mvpPhotoStyle() ใช้ร่วมกับ CMS (ตัวปรับรูปในฟอร์ม) — กรอบตัวอย่างในฟอร์มกับการ์ดจริงจัดรูปเหมือนกันเสมอ
   ========================================================= */
import { SUPABASE_URL, SUPABASE_KEY, hasSupabase } from '../admin/config.js';
import { safeUrl } from './news.js';

var TIMEOUT_MS = 8000;

function clampNum(v, lo, hi, def) {
  var n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
}

/** style ของ <img> ในกรอบสี่เหลี่ยม: จุดกึ่งกลาง (x, y เป็น %) + ซูม — จุดที่เลือกอยู่กับที่ตอนซูม */
export function mvpPhotoStyle(x, y, zoom) {
  x = clampNum(x, 0, 100, 50); y = clampNum(y, 0, 100, 25); zoom = clampNum(zoom, 1, 5, 1);
  return 'object-position:' + x + '% ' + y + '%;transform-origin:' + x + '% ' + y + '%' + (zoom > 1 ? ';transform:scale(' + zoom + ')' : '');
}

/** รายการที่เปิดอยู่ → รูปแบบเดียวกับ buildStars() ใน sheets.js (+ fx, fy, zoom) เรียงตามลำดับที่ผู้ดูแลตั้ง */
export async function loadMvps() {
  if (!hasSupabase()) return [];
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl && setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(SUPABASE_URL.replace(/\/+$/, '') +
      '/rest/v1/mvps?select=id,name,sport_id,kind,school,feat,role,photo_url,photo_x,photo_y,photo_zoom,award_date&order=sort_order.asc,created_at.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      signal: ctrl ? ctrl.signal : undefined
    });
    if (!res.ok) return [];
    var list = await res.json();
    return (Array.isArray(list) ? list : []).filter(function (r) { return r.name; }).map(function (r) {
      return {
        id: 'cms-' + r.id,
        name: r.name,
        iso: r.award_date || '',
        school: r.school || '',
        sportId: r.sport_id || '',
        sportText: '',            // ชื่อกีฬาเติมตอนวาด จากข้อมูลกีฬาของหน้า (matches.js)
        kind: r.kind || '',
        feat: r.feat || '',
        role: r.role || '',
        photo: safeUrl(r.photo_url),
        fx: r.photo_x, fy: r.photo_y, zoom: r.photo_zoom
      };
    });
  } catch (e) {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}
