/* =========================================================
   stamp-assets.mjs — ติดเลขเวอร์ชัน (?v=แฮชเนื้อไฟล์) ให้ CSS/JS ในทุกหน้า HTML ของ public/

   ทำไมต้องมี: GitHub Pages สั่งเบราว์เซอร์ให้จำไฟล์ไว้ 10 นาที (Live Server เองก็ปล่อยให้
   เบราว์เซอร์เดาอายุไฟล์ได้) หลัง deploy คนที่เคยเปิดเว็บจึงได้ไฟล์เก่าปนไฟล์ใหม่ — เช่น
   ป๊อปอัปเวอร์ชันใหม่แต่ไอคอนกีฬายังเป็นอิโมจิจาก common.js ตัวเก่า
   พอชื่อไฟล์มีแฮชของเนื้อไฟล์ต่อท้าย ไฟล์ที่เนื้อเปลี่ยน = URL ใหม่ เบราว์เซอร์ต้องโหลดใหม่เสมอ
   ส่วนไฟล์ที่ไม่เปลี่ยนยังใช้ของที่จำไว้ได้ตามเดิม

   JS ของเว็บ import กันเองเป็นทอด ๆ (home.js → common.js → sheets.js …) ซึ่งเราไม่ได้แก้ข้อความ
   import ในไฟล์ .js — แต่ละหน้าจึงมี <script type="importmap"> ที่แมป js/xxx.js → js/xxx.js?v=แฮช
   ให้ทุก import ที่ชี้ไฟล์นั้น ไม่ว่าจากหน้า HTML หรือจากไฟล์ JS อื่น ได้ URL เวอร์ชันเดียวกัน

   รันซ้ำได้เรื่อย ๆ (ทับของเดิม) — อยู่ใน `npm run build` แล้ว ทั้ง GitHub Actions และ Vercel รันให้เอง
   ========================================================= */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = fileURLToPath(new URL('../public/', import.meta.url));
const hash = (file) => createHash('sha1').update(readFileSync(join(PUB, file))).digest('hex').slice(0, 10);

const jsFiles = readdirSync(join(PUB, 'js')).filter((f) => f.endsWith('.js')).sort();
const ver = Object.fromEntries(jsFiles.map((f) => ['js/' + f, hash('js/' + f)]));
ver['css/app.css'] = hash('css/app.css');

const importMap = '<script type="importmap">' + JSON.stringify({
  imports: Object.fromEntries(jsFiles.map((f) => ['./js/' + f, './js/' + f + '?v=' + ver['js/' + f]]))
}) + '</script>';

const MAP_RE = /\n?[ \t]*<!-- stamp:importmap -->[\s\S]*?<!-- \/stamp:importmap -->/;
const MAP_BLOCK = '\n  <!-- stamp:importmap -->\n  <!-- สร้างจาก scripts/stamp-assets.mjs — อย่าแก้เอง -->\n  ' + importMap + '\n  <!-- /stamp:importmap -->';

for (const page of readdirSync(PUB).filter((f) => f.endsWith('.html'))) {
  const path = join(PUB, page);
  let html = readFileSync(path, 'utf8');

  // src="js/x.js" / href="js/x.js" / href="css/app.css" (มี ?v= เก่าอยู่ก็ทับ)
  html = html.replace(/((?:src|href)=")((?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=[\w]+)?(")/g,
    (all, a, file, z) => (ver[file] ? a + file + '?v=' + ver[file] + z : all));

  // import map ต้องมาก่อน <script type="module"> และ modulepreload ทุกตัว จึงวางต่อท้าย <meta charset>
  html = html.replace(MAP_RE, '');
  html = html.replace(/(<meta charset="UTF-8" \/>)/, '$1' + MAP_BLOCK);

  writeFileSync(path, html);
}
console.log('stamped', Object.keys(ver).length, 'files');
