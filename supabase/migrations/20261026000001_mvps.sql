-- =========================================================
-- นักกีฬา MVP ที่ผู้ดูแลลงผ่าน CMS (admin/ → นักกีฬา MVP) — ผู้ดูแลขอ ต.ค. 2569 แทนการกรอกแท็บ MVP ในชีต
-- หน้าผลการแข่งขันรวมรายการจากตารางนี้กับแท็บ MVP ในชีต (js/mvp.js · matches.js → renderStars)
-- รูป: อัปโหลดเข้า bucket "mvp" หรือวางลิงก์ Drive · photo_x/photo_y/photo_zoom = จุดกึ่งกลางและการซูมของรูปในกรอบสี่เหลี่ยมของการ์ด
-- =========================================================
create table if not exists public.mvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sport_id   text,                               -- id กีฬาแบบเดียวกับ sports.id (ไม่ผูก foreign key — ตาราง sports มาจากการซิงก์ชีต)
  kind       text not null default '',           -- ประเภท/รุ่น เช่น Standard ระดับมัธยมศึกษาตอนปลาย
  school     text not null default '',
  feat       text not null default '',           -- ผลงาน/รางวัล (ป้ายเล็กใต้ชื่อ)
  role       text not null default '',           -- ตำแหน่งในทีม
  photo_url  text not null default '',
  photo_x    numeric not null default 50 check (photo_x between 0 and 100),
  photo_y    numeric not null default 30 check (photo_y between 0 and 100),
  photo_zoom numeric not null default 1 check (photo_zoom between 1 and 5),
  award_date date,                               -- ว่าง = ขึ้นทุกวัน
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.mvps;
create trigger set_updated_at before update on public.mvps
  for each row execute function public.touch_updated_at();

alter table public.mvps enable row level security;

-- คนทั่วไปเห็นเฉพาะรายการที่เปิดอยู่ (ฉบับร่างไม่หลุดออกทาง API)
drop policy if exists public_read on public.mvps;
create policy public_read on public.mvps
  for select to anon, authenticated
  using (active);

drop policy if exists admin_write on public.mvps;
create policy admin_write on public.mvps
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.mvps to anon, authenticated;
grant insert, update, delete on public.mvps to authenticated;

-- ---------------------------------------------------------
-- ที่เก็บรูป MVP — กติกาเดียวกับ bucket "news" / "hero" (20261020000002): อ่านได้ทุกคน เขียนได้เฉพาะผู้ดูแล
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mvp', 'mvp', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_images_admin_insert on storage.objects;
create policy site_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('news', 'hero', 'mvp') and public.is_admin());

drop policy if exists site_images_admin_update on storage.objects;
create policy site_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('news', 'hero', 'mvp') and public.is_admin())
  with check (bucket_id in ('news', 'hero', 'mvp') and public.is_admin());

drop policy if exists site_images_admin_delete on storage.objects;
create policy site_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('news', 'hero', 'mvp') and public.is_admin());

drop policy if exists site_images_admin_select on storage.objects;
create policy site_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id in ('news', 'hero', 'mvp') and public.is_admin());
