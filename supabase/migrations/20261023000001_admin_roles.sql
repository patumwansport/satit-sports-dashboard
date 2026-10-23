-- =========================================================
-- ผู้ดูแล: ชื่อผู้ใช้ + ระดับสิทธิ์
--
-- 1) username — หน้า CMS ให้กรอกชื่อผู้ใช้แทนอีเมลเต็ม (ไม่ต้องพิมพ์ @…)
--    Supabase Auth ล็อกอินได้ด้วยอีเมลเท่านั้น หน้าเข้าสู่ระบบจึงถาม login_email() ก่อนว่าชื่อนี้คืออีเมลอะไร
--    บัญชีที่สร้างจาก CMS โดยไม่ใส่อีเมลจะได้อีเมลแทน <username>@users.pds.invalid (โดเมน .invalid ส่งเมลไม่ได้แน่นอน)
--    = กด "ลืมรหัสผ่าน" ไม่ได้ ต้องให้ผู้ดูแลสูงสุดตั้งรหัสใหม่ให้
-- 2) role — owner = ผู้ดูแลสูงสุด (เพิ่ม/ลบผู้ดูแล เปลี่ยนสิทธิ์ ตั้งรหัสผ่านใหม่ให้คนอื่น) · admin = แก้ข้อมูลได้อย่างเดียว
--    การแก้ข้อมูลเว็บยังใช้ is_admin() ตัวเดิม (ทั้งสองระดับเขียนได้เท่ากัน)
--    การจัดการบัญชีทำผ่าน Edge Function admin-users (ต้องใช้ service role สร้างผู้ใช้ใน auth)
--    ตาราง app_admins จึงยังไม่มี policy เขียนสำหรับเบราว์เซอร์ — ใครยิง API เองก็แจกสิทธิ์ให้ตัวเองไม่ได้
-- เพิ่มระดับสิทธิ์ใหม่ภายหลัง = แก้ check ของ role ใน migration ใหม่ + ROLE_OPTIONS ใน admin.js + ROLES ใน admin-users
-- =========================================================

alter table public.app_admins add column if not exists username text;
alter table public.app_admins add column if not exists role text not null default 'admin';

-- บัญชีเดิม: ชื่อผู้ใช้ = ส่วนหน้า @ ของอีเมล · ทุกคนที่มีอยู่ตอนนี้เป็นผู้ดูแลสูงสุด (เดิมทุกคนสิทธิ์เท่ากัน)
update public.app_admins a
   set username = lower(split_part(coalesce(a.email, u.email), '@', 1)),
       role = 'owner'
  from auth.users u
 where u.id = a.user_id and a.username is null;

alter table public.app_admins alter column username set not null;

alter table public.app_admins drop constraint if exists app_admins_username_format;
alter table public.app_admins add constraint app_admins_username_format
  check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

alter table public.app_admins drop constraint if exists app_admins_role_check;
alter table public.app_admins add constraint app_admins_role_check
  check (role in ('owner', 'admin'));

create unique index if not exists app_admins_username_key on public.app_admins (username);

-- ผู้ดูแลสูงสุดหรือไม่ — Edge Function ใช้ตรวจผู้เรียก หน้า CMS ใช้ซ่อน/แสดงเมนู
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid() and a.role = 'owner');
$$;

-- ชื่อผู้ใช้ → อีเมลสำหรับล็อกอิน (anon เรียกได้ เพราะยังไม่ได้เข้าสู่ระบบ)
-- อ่านอีเมลจาก auth.users ตัวจริง ไม่ใช่สำเนาใน app_admins ที่อาจค้างของเก่า
-- ข้อแลกเปลี่ยน: คนที่เดาชื่อผู้ใช้ถูกจะเห็นอีเมลของบัญชีนั้น (รหัสผ่านยังต้องถูกอยู่ดี)
create or replace function public.login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
    from public.app_admins a
    join auth.users u on u.id = a.user_id
   where a.username = lower(trim(p_username));
$$;

revoke all on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;
