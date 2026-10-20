-- =========================================================
-- ที่เก็บรูปข่าว (Supabase Storage bucket "news")
-- รูปปกการ์ด "ข่าวสารและไฮไลต์" เก็บที่นี่ ไม่ต้อง commit/deploy เว็บใหม่ทุกครั้งที่ลงข่าว
-- public = อ่านได้ทุกคนผ่าน /storage/v1/object/public/news/<ไฟล์> · อัปโหลด/แก้/ลบได้เฉพาะผู้ดูแล (is_admin)
-- จำกัดชนิดและขนาดไฟล์ไว้ กันไฟล์แปลก ๆ หรือรูปใหญ่เกินจนการ์ดโหลดช้า
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists news_admin_insert on storage.objects;
create policy news_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'news' and public.is_admin());

drop policy if exists news_admin_update on storage.objects;
create policy news_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'news' and public.is_admin())
  with check (bucket_id = 'news' and public.is_admin());

drop policy if exists news_admin_delete on storage.objects;
create policy news_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'news' and public.is_admin());

-- ผู้ดูแลต้องเห็นรายการไฟล์ใน CMS ได้ (bucket public ให้คนทั่วไปโหลดรูปผ่าน URL ได้อยู่แล้ว ไม่ต้องเปิด list ให้ anon)
drop policy if exists news_admin_select on storage.objects;
create policy news_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'news' and public.is_admin());
