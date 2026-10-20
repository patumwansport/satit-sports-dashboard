-- =========================================================
-- ที่เก็บรูปภาพแบนเนอร์บนสุดของหน้า (Supabase Storage bucket "hero") — ปุ่ม "อัปโหลดรูป" ในเมนูภาพแบนเนอร์ของ CMS
-- กติกาเดียวกับ bucket "news": public อ่านได้ทุกคน · อัปโหลด/แก้/ลบได้เฉพาะผู้ดูแล (is_admin)
-- รวม policy ของสอง bucket เป็นชุดเดียว (เดิมเขียนไว้เฉพาะ news ใน 20261020000001)
-- CMS ย่อรูปและแปลงเป็น webp ในเบราว์เซอร์ก่อนอัปโหลด ไฟล์จริงจึงเล็กกว่าเพดานมาก
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero', 'hero', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists news_admin_insert on storage.objects;
drop policy if exists news_admin_update on storage.objects;
drop policy if exists news_admin_delete on storage.objects;
drop policy if exists news_admin_select on storage.objects;

drop policy if exists site_images_admin_insert on storage.objects;
create policy site_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('news', 'hero') and public.is_admin());

drop policy if exists site_images_admin_update on storage.objects;
create policy site_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('news', 'hero') and public.is_admin())
  with check (bucket_id in ('news', 'hero') and public.is_admin());

drop policy if exists site_images_admin_delete on storage.objects;
create policy site_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('news', 'hero') and public.is_admin());

-- ผู้ดูแลเห็นรายการไฟล์ได้ (คนทั่วไปโหลดรูปผ่าน URL สาธารณะได้อยู่แล้ว ไม่ต้องเปิด list ให้ anon)
drop policy if exists site_images_admin_select on storage.objects;
create policy site_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id in ('news', 'hero') and public.is_admin());
