-- =========================================================
-- ภาพบรรยากาศแยกตามวัน (หน้า "ประมวลภาพ")
-- แท็บ img ในชีตมีคอลัมน์ วันที่ / คำบรรยาย / กีฬา แล้ว — ฐานข้อมูลสำรองต้องเก็บได้ครบเหมือนกัน
-- ไม่งั้นวันที่สลับมาอ่านจากฐานข้อมูล ภาพทั้งหมดจะไปกองอยู่ใน "ภาพอื่น ๆ"
-- =========================================================
alter table public.photos add column if not exists taken_on date;   -- ว่าง = ไม่ระบุวัน
alter table public.photos add column if not exists sport_id text references public.sports(id) on delete set null;

create index if not exists photos_day on public.photos (taken_on, sort_order);
