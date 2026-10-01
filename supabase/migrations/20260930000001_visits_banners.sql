-- =========================================================
-- CMS สำรอง (public/admin/) — นับผู้เข้าชม + แบนเนอร์ประกาศ
--
-- ต่อจาก 20260923000001_cms_schema.sql ใช้ is_admin() / touch_updated_at() ตัวเดิม
-- กติกาเดิม: อ่านเนื้อหา = ทุกคน · เขียน = ผู้ดูแลใน app_admins
-- ข้อยกเว้นเดียวคือ "บันทึกการเข้าชม" ที่คนดูทั่วไปต้องเขียนได้ — ทำผ่านฟังก์ชัน track_visit()
-- เท่านั้น ไม่เปิด insert ตรงเข้าตาราง จะได้ตรวจ/ตัดค่าก่อนลงฐานข้อมูลทุกครั้ง
-- =========================================================

-- ---------------------------------------------------------
-- บันทึกการเข้าชม — แถวละหนึ่งการเปิดหน้า
-- visitor = รหัสสุ่มที่เบราว์เซอร์สร้างเก็บไว้ใน localStorage (ไม่ใช่ IP ไม่ผูกกับตัวบุคคล)
-- ใช้นับ "ผู้เข้าชมไม่ซ้ำ" ได้โดยไม่ต้องเก็บข้อมูลส่วนบุคคล
-- visited_on เก็บเป็นวันที่ตามเวลาไทย ไม่ใช่ UTC ไม่งั้นยอด "วันนี้" จะตัดรอบตอน 7 โมงเช้า
-- ---------------------------------------------------------
create table if not exists public.page_visits (
  id         bigint generated always as identity primary key,
  visited_on date not null default (now() at time zone 'Asia/Bangkok')::date,
  path       text not null default '',
  visitor    text not null default '',
  referrer   text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists page_visits_day on public.page_visits (visited_on);
create index if not exists page_visits_visitor_recent on public.page_visits (visitor, path, created_at desc);

alter table public.page_visits enable row level security;

-- ผู้ดูแลอ่านแถวดิบได้ (หน้า CMS ใช้ visit_stats() เป็นหลัก แต่เผื่อส่งออกไปวิเคราะห์ต่อ)
-- ไม่มี policy insert/update/delete เลย = ไม่มีใครเขียนตรงได้ นอกจากผ่าน track_visit()
drop policy if exists admin_read on public.page_visits;
create policy admin_read on public.page_visits
  for select to authenticated using (public.is_admin());

grant select on public.page_visits to authenticated;

/**
 * บันทึกการเปิดหน้าหนึ่งครั้ง — หน้าเว็บสาธารณะเรียกผ่าน /rest/v1/rpc/track_visit
 * security definer: เขียนตารางที่ anon ไม่มีสิทธิ์เขียนได้ เพราะฟังก์ชันนี้คือด่านตรวจเอง
 *   - ตัดความยาวทุกช่อง กันคนยิงข้อความยาว ๆ มาถมฐานข้อมูล
 *   - คนเดิมเปิดหน้าเดิมซ้ำภายใน 30 นาที ไม่นับเพิ่ม (กดรีเฟรชรัว ๆ ยอดไม่พอง)
 */
create or replace function public.track_visit(p_path text, p_visitor text, p_referrer text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path    text := left(coalesce(p_path, ''), 120);
  v_visitor text := left(regexp_replace(coalesce(p_visitor, ''), '[^A-Za-z0-9-]', '', 'g'), 40);
  v_ref     text := left(coalesce(p_referrer, ''), 200);
begin
  if v_visitor = '' then return; end if;

  if exists (
    select 1 from page_visits
    where visitor = v_visitor and path = v_path and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into page_visits (path, visitor, referrer) values (v_path, v_visitor, v_ref);
end;
$$;

revoke all on function public.track_visit(text, text, text) from public;
grant execute on function public.track_visit(text, text, text) to anon, authenticated;

/**
 * สรุปสถิติสำหรับหน้า CMS — คำนวณในฐานข้อมูลทีเดียว ไม่ต้องดึงแถวดิบเป็นหมื่นแถวมานับในเบราว์เซอร์
 * เฉพาะผู้ดูแล: คนอื่นเรียกได้แต่จะได้ error กลับไป
 */
create or replace function public.visit_stats(p_days integer default 14)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_days  integer := greatest(1, least(coalesce(p_days, 14), 90));
  result  json;
begin
  if not public.is_admin() then
    raise exception 'ต้องเป็นผู้ดูแลระบบ' using errcode = '42501';
  end if;

  select json_build_object(
    'total_views',    (select count(*) from page_visits),
    'total_visitors', (select count(distinct visitor) from page_visits),
    'today_views',    (select count(*) from page_visits where visited_on = v_today),
    'today_visitors', (select count(distinct visitor) from page_visits where visited_on = v_today),
    'online_now',     (select count(distinct visitor) from page_visits where created_at > now() - interval '5 minutes'),
    'daily', (
      select coalesce(json_agg(json_build_object('day', d.day::date, 'views', coalesce(s.views, 0), 'visitors', coalesce(s.visitors, 0)) order by d.day), '[]'::json)
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as d(day)
      left join (
        select visited_on, count(*) as views, count(distinct visitor) as visitors
        from page_visits where visited_on > v_today - v_days
        group by visited_on
      ) s on s.visited_on = d.day::date
    ),
    'pages', (
      select coalesce(json_agg(p order by p.views desc), '[]'::json)
      from (
        select path, count(*) as views, count(distinct visitor) as visitors
        from page_visits where visited_on > v_today - v_days
        group by path order by count(*) desc limit 10
      ) p
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.visit_stats(integer) from public;
grant execute on function public.visit_stats(integer) to authenticated;

-- ---------------------------------------------------------
-- แบนเนอร์ประกาศ — แถบข้อความ/รูปที่ขึ้นบนสุดของหน้าเว็บสาธารณะ
-- ตั้งช่วงเวลาแสดงได้ (starts_at / ends_at) ไม่ต้องคอยเข้ามาปิดเองตอนหมดเวลา
-- ---------------------------------------------------------
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  message    text not null default '',
  image_url  text not null default '',          -- ว่าง = แบนเนอร์ข้อความ · มีลิงก์ = แบนเนอร์รูป
  link_url   text not null default '',
  link_label text not null default '',
  tone       text not null default 'info' check (tone in ('info', 'success', 'warning', 'danger')),
  placement  text not null default 'all' check (placement in ('all', 'home')),
  active     boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.banners;
create trigger set_updated_at before update on public.banners
  for each row execute function public.touch_updated_at();

alter table public.banners enable row level security;

-- คนทั่วไปเห็นเฉพาะแบนเนอร์ที่เปิดอยู่และอยู่ในช่วงเวลา — กรองที่ฐานข้อมูล ไม่ใช่ที่หน้าเว็บ
-- แบนเนอร์ที่ยังร่างอยู่ (active = false) จึงไม่หลุดออกไปทาง API ก่อนเวลา
drop policy if exists public_read on public.banners;
create policy public_read on public.banners
  for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

-- ผู้ดูแลเห็นและแก้ได้ทุกแถว (policy รวมกันแบบ OR จึงเห็นแบนเนอร์ร่างด้วย)
drop policy if exists admin_write on public.banners;
create policy admin_write on public.banners
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
