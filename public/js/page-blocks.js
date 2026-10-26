/* =========================================================
   page-blocks.js — บล็อกบนหน้าเว็บที่เปิด/ปิด และหัวข้อที่แก้ข้อความได้จาก CMS (admin/ → จัดการหน้าเว็บ)
   (ผู้ดูแลขอ ต.ค. 2569)

   เก็บใน site_settings key เดียว (PAGE_BLOCKS_KEY) เป็น JSON:
     { "off": ["home.news", …], "text": { "home.news": "ข่าวสาร", "medals.page": "อันดับ", … } }
   ใช้ร่วมสองฝั่ง: admin/site.js (ซ่อนบล็อก/เปลี่ยนข้อความบนหน้าเว็บ) และหน้า CMS (ฟอร์มแก้) — รายการบล็อกอยู่ที่เดียว

   แต่ละบล็อก:
     el    = id ขององค์ประกอบที่ใช้หาบล็อก — หัวข้อ h2 ของบล็อก หรือตัวบล็อกเอง (บล็อกที่ไม่มีหัวข้อ)
             บล็อกจริง = el เอง ถ้าเป็น section/aside/nav · ไม่งั้นคือ section/aside ที่ครอบ el
     text  = ข้อความเดิมของหัวข้อ (มี = แก้ข้อความได้) · สคริปต์หน้าเว็บต่อท้ายหัวข้อบางอัน เช่น "วันนี้" ชื่อกีฬา
             site.js เปลี่ยนเฉพาะส่วนต้นที่ตรงกับ text ส่วนต่อท้ายยังมาตามเดิม (suffix = คำอธิบายให้ผู้ดูแลรู้)
   page.title = ชื่อหน้าตัวใหญ่บนแบนเนอร์ (h1#pageTitle + ป้ายเส้นทาง) — แก้ข้อความได้ ซ่อนไม่ได้
   ========================================================= */

export var PAGE_BLOCKS_KEY = 'page_blocks';

export var PAGE_BLOCKS = [
  {
    page: 'index.html', label: 'หน้าหลัก',
    blocks: [
      { key: 'home.stats', el: 'statStrip', label: 'แถบสรุปเหรียญของโรงเรียนเรา' },
      { key: 'home.sched', el: 'schedTitle', label: 'โปรแกรมการแข่งขัน (ตาราง)', text: 'โปรแกรมการแข่งขัน', suffix: 'วันนี้' },
      { key: 'home.wins', el: 'winsTitle', label: 'สรุปผลการแข่งขันที่ชนะ', text: 'สรุปผลการแข่งขันที่ชนะ', suffix: 'วันนี้' },
      { key: 'home.quick', el: 'quickTitle', label: 'เมนูลัด', text: 'เมนูลัด' },
      { key: 'home.sum', el: 'sumTitle', label: 'สรุปผลของวัน', text: 'สรุปผล', suffix: 'วันนี้ / วันที่ …' },
      { key: 'home.venue', el: 'venueTitle', label: 'สนามแข่งขัน', text: 'สนามแข่งขัน', suffix: 'วันนี้ / วันที่ …' },
      { key: 'home.next', el: 'nextBand', label: 'แบนเนอร์โปรแกรมรายวัน', title: 'nextTitle', text: 'โปรแกรมการแข่งขัน', suffix: 'วันนี้ / วันพรุ่งนี้' },
      { key: 'home.news', el: 'newsTitle', label: 'ข่าวสารและไฮไลต์', text: 'ข่าวสารและไฮไลต์' }
    ]
  },
  {
    page: 'schedule.html', label: 'ตารางแข่งขัน', title: 'ตารางการแข่งขัน',
    blocks: [
      { key: 'schedule.sports', el: 'sportRow', label: 'เมนูเลือกชนิดกีฬา' },
      { key: 'schedule.days', el: 'dayRow', label: 'แถบเลือกวัน' },
      { key: 'schedule.table', el: 'schedTitle', label: 'ตารางการแข่งขัน', text: 'ตารางการแข่งขัน', suffix: 'เลือกกีฬาอยู่ = ชื่อกีฬา' }
    ]
  },
  {
    page: 'matches.html', label: 'ผลการแข่งขัน', title: 'ผลการแข่งขัน',
    blocks: [
      { key: 'matches.sports', el: 'sportRow', label: 'เมนูเลือกชนิดกีฬา' },
      { key: 'matches.days', el: 'dayRow', label: 'แถบเลือกวัน' },
      { key: 'matches.featured', el: 'featured', label: 'แมตช์เด่น (คะแนนตัวโต — แสดงเฉพาะตอนเลือกกีฬา)' },
      { key: 'matches.wins', el: 'winsTitle', label: 'สรุปผลการแข่งขันที่ชนะ', text: 'สรุปผลการแข่งขัน', suffix: 'ชื่อกีฬา + ที่ชนะ + วันนี้' },
      { key: 'matches.photos', el: 'hlTitle', label: 'ภาพบรรยากาศ', text: 'ภาพบรรยากาศ', suffix: 'การแข่งขัน / ชื่อกีฬา' },
      { key: 'matches.sum', el: 'sumTitle', label: 'สรุปผลการแข่งขัน', text: 'สรุปผลการแข่งขัน', suffix: 'ชื่อกีฬา' },
      { key: 'matches.mvp', el: 'starTitle', label: 'นักกีฬา MVP', text: 'นักกีฬา MVP' },
      { key: 'matches.table', el: 'schedTitle', label: 'ตารางผลการแข่งขัน', text: 'ผลการแข่งขัน', suffix: 'ชื่อกีฬา + วัน' }
    ]
  },
  {
    page: 'medals.html', label: 'ตารางอันดับ', title: 'ตารางอันดับเหรียญรางวัล',
    blocks: [
      { key: 'medals.table', el: 'medalTitle', label: 'ตารางอันดับเหรียญรางวัล', text: 'ตารางอันดับเหรียญรางวัล' },
      { key: 'medals.top', el: 'topTitle', label: 'กราฟ 5 อันดับแรก', text: 'กราฟอันดับเหรียญรางวัล (Top 5)' },
      { key: 'medals.share', el: 'shareTitle', label: 'สัดส่วนเหรียญรางวัลรวม', text: 'สัดส่วนเหรียญรางวัลรวม' },
      { key: 'medals.posters', el: 'postersTitle', label: 'สรุปเหรียญการแข่งขัน (ภาพจาก Drive)', text: 'สรุปเหรียญการแข่งขัน' }
    ]
  },
  {
    page: 'gallery.html', label: 'ประมวลภาพ', title: 'ประมวลภาพ',
    blocks: []
  },
  {
    page: 'school.html', label: 'ผลงานรายโรงเรียน', title: 'ผลงานรายโรงเรียน',
    blocks: []
  }
];

/** key ของชื่อหน้า เช่น 'medals.page' */
export function pageTitleKey(page) { return page.replace(/\.html$/, '').replace(/^index$/, 'home') + '.page'; }

/** อ่านค่าที่บันทึกไว้ — ค่าเสีย/ว่าง = ไม่ซ่อนอะไร ไม่เปลี่ยนข้อความ */
export function parsePageBlocks(value) {
  var v = {};
  try { v = JSON.parse(value || '{}') || {}; } catch (e) {}
  var off = Array.isArray(v.off) ? v.off.filter(function (k) { return typeof k === 'string'; }) : [];
  var text = {};
  if (v.text && typeof v.text === 'object') {
    Object.keys(v.text).forEach(function (k) {
      var t = String(v.text[k] == null ? '' : v.text[k]).trim();
      if (t) text[k] = t.slice(0, 120);
    });
  }
  return { off: off, text: text };
}
