-- =========================================================
-- CMS หลังบ้านกีฬาสาธิตสามัคคี — โครงฐานข้อมูล
--
-- เว็บอยู่บน GitHub Pages ซึ่งเสิร์ฟได้แค่ไฟล์นิ่ง ๆ ไม่มีเซิร์ฟเวอร์ของเราเอง
-- เบราว์เซอร์จึงคุยกับ Supabase ตรง ๆ ด้วย publishable key ที่ commit ลง repo ได้
-- นั่นแปลว่า "ใครก็ยิง API นี้ได้" — ด่านกันจริงคือ RLS ในไฟล์นี้เท่านั้น ไม่ใช่การซ่อน key
--
-- กติกาเดียวทั้งไฟล์:  อ่าน = ทุกคน (เว็บเป็นของสาธารณะ)  ·  เขียน = ผู้ดูแลที่อยู่ใน app_admins
-- =========================================================

-- ---------------------------------------------------------
-- ผู้ดูแลระบบ
-- ผูกกับ auth.users ของ Supabase — สมัครผู้ใช้ในแดชบอร์ด แล้วค่อยเพิ่ม uid ลงตารางนี้
-- แยกตารางแทนการเช็ก "ล็อกอินอยู่ไหม" เฉย ๆ เพราะถ้าเปิด signup ทิ้งไว้เมื่อไร
-- คนนอกที่สมัครเองจะกลายเป็นคนแก้ข้อมูลได้ทันที
-- ---------------------------------------------------------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  display_name text,
  created_at timestamptz not null default now()
);

-- ตัวเช็กสิทธิ์ที่ทุก policy เรียกใช้
-- security definer: policy ของตารางอื่นต้องอ่าน app_admins ได้โดยไม่ติด RLS ของ app_admins เอง
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------
-- ตั้งค่าเว็บ (ชื่อรายการ / คำโปรย / ชื่อโรงเรียนเรา)
-- เก็บเป็น key-value เพราะเป็นค่าเดี่ยว ๆ ไม่กี่ตัว เพิ่มค่าใหม่ไม่ต้อง migrate ตาราง
-- ---------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- โรงเรียน + เหรียญรวมของแต่ละโรงเรียน (หน้า "อันดับเหรียญรางวัล")
-- อันดับไม่เก็บในฐานข้อมูล — คำนวณจากจำนวนเหรียญตอนอ่าน ไม่งั้นจะมีวันที่เหรียญ
-- กับอันดับขัดกันเองเมื่อมีคนแก้เหรียญแล้วลืมแก้อันดับ
-- ---------------------------------------------------------
create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null unique,          -- ชื่อเต็มตามประกาศ
  short_name text not null default '',       -- ชื่อที่ใช้แสดงในตาราง (ว่าง = ให้หน้าเว็บย่อให้เอง)
  abbr       text not null default '',       -- อักษรย่อ เช่น จฬม.
  logo       text not null default '',       -- พาธ/URL โลโก้ (ว่าง = ไม่มีโลโก้)
  is_self    boolean not null default false, -- โรงเรียนเรา (ไฮไลต์ในตาราง + การ์ดสรุปหน้าแรก)
  gold       integer not null default 0 check (gold   >= 0),
  silver     integer not null default 0 check (silver >= 0),
  bronze     integer not null default 0 check (bronze >= 0),
  updated_at timestamptz not null default now()
);

-- มีโรงเรียน "ของเรา" ได้แค่โรงเรียนเดียว — กันการติ๊ก is_self เผลอซ้ำจนการ์ดหน้าแรกสลับไปมา
create unique index if not exists schools_one_self on public.schools (is_self) where is_self;

-- ---------------------------------------------------------
-- ชนิดกีฬา + เหรียญรายกีฬา (หน้า "ชนิดกีฬาที่ส่งแข่ง")
-- id เป็นข้อความ เช่น 'football' เพราะต้องตรงกับชื่อไฟล์ไอคอนใน public/assets/icons/
-- ---------------------------------------------------------
create table if not exists public.sports (
  id         text primary key,
  name       text not null,                   -- ชื่อไทยที่แสดงบนเว็บ
  entered    boolean not null default true,    -- false = ปีนี้ไม่ได้ส่งแข่ง ซ่อนทั้งเว็บ
  gold       integer not null default 0 check (gold   >= 0),
  silver     integer not null default 0 check (silver >= 0),
  bronze     integer not null default 0 check (bronze >= 0),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- รายการแข่งขัน — ตารางเดียวเก็บทั้งสองหน้า แยกด้วย kind
--   'result' = "ผลการแข่งขัน" (มีสกอร์/สถานะ)
--   'plan'   = "ตารางการแข่งขัน" (ผังกำหนดการล้วน ไม่มีผล)
-- แยกเป็นคนละตารางไม่คุ้ม เพราะคอลัมน์เหมือนกันเกือบหมดและหน้าเว็บ render ด้วยโค้ดชุดเดียวกัน
-- ---------------------------------------------------------
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'result' check (kind in ('result', 'plan')),
  match_date date not null,
  sport_id   text references public.sports(id) on delete set null,
  event_type text not null default '',        -- ประเภท เช่น "ชายเดี่ยว รอบชิงชนะเลิศ"
  start_time time,                             -- ว่างได้ (บางรายการยังไม่กำหนดเวลา)
  team_a     text not null default '',
  team_b     text not null default '',
  score      text not null default '',         -- ข้อความอิสระ เช่น "2 - 1" หรือ "ทอง: ปทุมวัน"
  status     text not null default 'upcoming' check (status in ('upcoming', 'live', 'done')),
  unofficial boolean not null default false,   -- ผลยังไม่รับรอง ต้องบอกผู้อ่าน ไม่กลืนกับผลทางการ
  note       text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists matches_kind_date on public.matches (kind, match_date, start_time);

-- ---------------------------------------------------------
-- ภาพบรรยากาศ (แถบสไลด์หน้าแรก)
-- ---------------------------------------------------------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,                    -- ลิงก์แชร์ Google Drive ใส่ได้เลย หน้าเว็บแปลงให้เอง
  caption    text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- updated_at: ให้ฐานข้อมูลเป็นคนจด ไม่ใช่ฝั่งเบราว์เซอร์
-- (เวลาของเครื่องผู้ใช้เชื่อไม่ได้ และเป็นค่าที่หน้าเว็บใช้บอก "ซิงก์ล่าสุด")
-- ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['site_settings', 'schools', 'sports', 'matches', 'photos'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- =========================================================
-- RLS — เปิดทุกตาราง ไม่มีข้อยกเว้น
-- ตารางที่เปิด RLS แต่ไม่มี policy = ไม่มีใครเข้าถึงได้เลย จึงต้องเขียน policy ให้ครบทุกตาราง
-- =========================================================
alter table public.app_admins    enable row level security;
alter table public.site_settings enable row level security;
alter table public.schools       enable row level security;
alter table public.sports        enable row level security;
alter table public.matches       enable row level security;
alter table public.photos        enable row level security;

-- ตารางเนื้อหา: อ่านได้ทุกคน (รวม anon เพราะหน้าเว็บสาธารณะ) เขียนได้เฉพาะผู้ดูแล
do $$
declare t text;
begin
  foreach t in array array['site_settings', 'schools', 'sports', 'matches', 'photos'] loop
    execute format('drop policy if exists public_read  on public.%I', t);
    execute format('drop policy if exists admin_write on public.%I', t);

    execute format(
      'create policy public_read on public.%I for select to anon, authenticated using (true)', t);

    -- for all ครอบ insert/update/delete — using คุมแถวที่แก้ได้ with check คุมค่าที่เขียนลงไป
    -- ต้องใส่ทั้งคู่ ขาด with check แล้ว insert จะถูกปฏิเสธทั้งหมด
    execute format(
      'create policy admin_write on public.%I for all to authenticated
       using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- สิทธิ์ระดับตาราง — คนละชั้นกับ RLS และต้องผ่านทั้งสองชั้นถึงจะเข้าถึงข้อมูลได้
-- ปกติ Supabase ตั้ง default privileges ให้ตารางใหม่อยู่แล้ว แต่เขียนไว้ตรงนี้ด้วย
-- เพื่อให้ไฟล์ migration สร้างฐานข้อมูลที่ใช้งานได้จริงด้วยตัวมันเอง ไม่ขึ้นกับค่าตั้งต้นของโปรเจกต์
grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.schools, public.sports, public.matches, public.photos to anon, authenticated;
grant insert, update, delete on public.site_settings, public.schools, public.sports, public.matches, public.photos to authenticated;
grant select on public.app_admins to authenticated;

-- รายชื่อผู้ดูแล: ผู้ดูแลอ่านกันเองได้ (หน้า CMS แสดงว่าใครมีสิทธิ์บ้าง)
-- แต่ "เพิ่ม/ลบผู้ดูแล" ทำผ่านหน้านี้ไม่ได้ ต้องใช้ SQL Editor ในแดชบอร์ด
-- ตั้งใจให้ยากกว่างานแก้ข้อมูลทั่วไป เพราะมันคือการแจกกุญแจ
drop policy if exists admin_read_self on public.app_admins;
create policy admin_read_self on public.app_admins
  for select to authenticated using (public.is_admin());

-- =========================================================
-- ค่าตั้งต้น
-- =========================================================
insert into public.site_settings (key, value) values
  ('title',    'กีฬาสาธิตสามัคคี'),
  ('subtitle', 'การแข่งขันกีฬานักเรียนสาธิตสัมพันธ์แห่งประเทศไทย')
on conflict (key) do nothing;

-- ชนิดกีฬา 14 ชนิด — id ตรงกับไฟล์ไอคอนใน public/assets/icons/<id>.png
insert into public.sports (id, name, sort_order) values
  ('athletics',     'กรีฑา',            1),
  ('golf',          'กอล์ฟ',            2),
  ('tennis',        'เทนนิส',           3),
  ('tabletennis',   'เทเบิลเทนนิส',      4),
  ('basketball',    'บาสเกตบอล',        5),
  ('basketball3x3', 'บาสเกตบอล 3X3',    6),
  ('badminton',     'แบดมินตัน',        7),
  ('petanque',      'เปตอง',            8),
  ('football',      'ฟุตบอล',           9),
  ('dancesport',    'ลีลาศ',           10),
  ('swimming',      'ว่ายน้ำ',          11),
  ('boardgame',     'หมากกระดาน',       12),
  ('handball',      'แฮนด์บอล',         13),
  ('volleyball',    'วอลเลย์บอล',       14)
on conflict (id) do nothing;

insert into public.schools (full_name, is_self) values
  ('โรงเรียนสาธิตมหาวิทยาลัยศรีนครินทรวิโรฒ ปทุมวัน', true)
on conflict (full_name) do nothing;
