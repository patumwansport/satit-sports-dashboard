/* =========================================================
   admin-users — จัดการบัญชีผู้ดูแล CMS (เรียกจากหน้า "ผู้ดูแลระบบ" ใน public/admin/admin.js)

   ต้องอยู่ฝั่งเซิร์ฟเวอร์เพราะการสร้าง/ลบผู้ใช้ใน Supabase Auth ต้องใช้ service role
   ซึ่งห้ามอยู่ในเบราว์เซอร์เด็ดขาด — ฟังก์ชันนี้ได้ SUPABASE_SERVICE_ROLE_KEY จาก Supabase เอง

   ผู้เรียกต้องส่ง access token ของ Supabase (supabase-js ใส่ให้เองใน functions.invoke)
   และต้องเป็น role 'owner' ใน app_admins · ตอบ 200 + { ok, error } เสมอ ให้หน้า CMS อ่านข้อความง่าย
   (แบบเดียวกับตัวเชื่อม apps-script.gs)

   คำสั่งที่ไม่ต้องเข้าสู่ระบบ (หน้าเข้าสู่ระบบเรียก — แทน RPC login_email() เดิมที่ใครถามชื่อผู้ใช้ก็ได้อีเมลกลับไป):
     login  { username, password }       → { session: { access_token, refresh_token } } ชื่อไม่มี/รหัสผิด ตอบเหมือนกัน
     forgot { username, redirect_to }     ส่งลิงก์ตั้งรหัสใหม่ไปอีเมลของบัญชี · ตอบ ok เสมอ ไม่บอกว่ามีบัญชีนี้ไหม
     อีเมลไม่เคยออกจากฟังก์ชันนี้ — คนนอกเดาชื่อผู้ใช้ถูกก็ไม่รู้อีเมลของทีมงาน
     จำกัดความถี่: Supabase Auth นับตาม IP ที่เรียกมันซึ่งตอนนี้คือฟังก์ชันนี้ (ทุกคนใช้โควตาเดียวกัน ~30 ครั้ง/5 นาที)
     — ทีมงานไม่กี่คนไม่ชน แต่คนนอกที่ไล่เดารหัสจะทำให้ทุกคนล็อกอินด้วยชื่อผู้ใช้ไม่ได้ชั่วคราว (พิมพ์อีเมลเต็มยังเข้าได้ตามปกติ)

   คำสั่งของผู้ดูแลสูงสุด:
     create { username, password, display_name?, email?, role }
     update { user_id, username, display_name?, role, password? }   password ว่าง = ไม่เปลี่ยน
     delete { user_id }                                              ลบบัญชีใน auth ด้วย (แถว app_admins หายตาม cascade)

   กันล็อกตัวเองออก: ผู้ดูแลสูงสุดลดสิทธิ์หรือลบบัญชีตัวเองไม่ได้ → มีผู้ดูแลสูงสุดเหลืออย่างน้อยหนึ่งคนเสมอ

   deploy: supabase functions deploy admin-users  (verify_jwt = false ใน supabase/config.toml — ตรวจ token เองข้างล่าง)
   ========================================================= */

// ล็อกเวอร์ชันไว้ — @2 เฉย ๆ จะได้รุ่นล่าสุดทุกครั้งที่ deploy พฤติกรรมเปลี่ยนเองได้โดยไม่ได้แก้โค้ด
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const ROLES = ['owner', 'admin'];
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
// บัญชีที่ไม่ใส่อีเมล — ต้องตรงกับ NO_EMAIL_DOMAIN ใน admin.js และคำอธิบายใน migration 20261023000001
const NO_EMAIL_DOMAIN = 'users.pds.invalid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

class UserError extends Error {}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ข้อความเดียวกับที่ Supabase Auth ตอบตอนรหัสผิด — admin.js แปลเป็น "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
const BAD_LOGIN = 'Invalid login credentials';

/** ชื่อผู้ใช้ → อีเมลใน auth.users (ตัวจริง ไม่ใช่สำเนาใน app_admins) · ไม่มี = null */
async function emailOf(username: string) {
  if (!USERNAME_RE.test(username)) return null;
  const row = await admin.from('app_admins').select('user_id').eq('username', username).maybeSingle();
  if (!row.data) return null;
  const u = await admin.auth.admin.getUserById(row.data.user_id);
  return u.data?.user?.email ?? null;
}

async function login(req: Record<string, unknown>) {
  const password = String(req.password ?? '');
  const email = await emailOf(String(req.username ?? '').trim().toLowerCase());
  if (!email || !password) throw new UserError(BAD_LOGIN);
  // ยิง Auth ตรง ไม่ใช้ client ตัว admin — signInWithPassword จะเปลี่ยน client นั้นเป็นสิทธิ์ของผู้ใช้
  const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new UserError('ลองเข้าสู่ระบบถี่เกินไป — รอสักครู่แล้วลองใหม่ หรือพิมพ์อีเมลเต็มแทนชื่อผู้ใช้');
    throw new UserError(String(json.msg ?? json.error_description ?? json.message ?? BAD_LOGIN));
  }
  return { session: { access_token: json.access_token, refresh_token: json.refresh_token } };
}

async function forgot(req: Record<string, unknown>) {
  const email = await emailOf(String(req.username ?? '').trim().toLowerCase());
  // บัญชีที่ไม่ได้ผูกอีเมลส่งลิงก์ไม่ได้ — ตอบเหมือนกันทุกกรณี (หน้า CMS บอกวิธีให้ผู้ดูแลสูงสุดตั้งรหัสให้แทน)
  if (email && !email.endsWith('@' + NO_EMAIL_DOMAIN)) {
    const sent = await admin.auth.resetPasswordForEmail(email, { redirectTo: String(req.redirect_to ?? '') || undefined });
    // error (เช่นส่งอีเมลเกินโควตาต่อชั่วโมง) ไม่บอกผู้ขอ — บอกแล้วคนนอกจะรู้ว่าชื่อนี้มีบัญชี
    if (sent.error) console.warn('forgot:', sent.error.message);
  }
  return {};
}

function cleanUsername(v: unknown) {
  const u = String(v ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    throw new UserError('ชื่อผู้ใช้ต้องยาว 3–32 ตัว ใช้ได้เฉพาะ a-z 0-9 จุด ขีดกลาง ขีดล่าง และขึ้นต้นด้วยตัวอักษรหรือตัวเลข');
  }
  return u;
}

function cleanRole(v: unknown) {
  const r = String(v ?? '');
  if (!ROLES.includes(r)) throw new UserError('ระดับสิทธิ์ไม่ถูกต้อง');
  return r;
}

function checkPassword(pw: unknown) {
  if (typeof pw !== 'string' || pw.length < 8) throw new UserError('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  return pw;
}

/** ข้อความจาก Postgres/Auth → ภาษาไทยที่คนกรอกเข้าใจ */
function friendly(msg: string) {
  if (/app_admins_username_key|duplicate key/i.test(msg)) return 'ชื่อผู้ใช้นี้มีคนใช้แล้ว';
  if (/already been registered|already exists/i.test(msg)) return 'อีเมลนี้มีบัญชีอยู่แล้ว';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (/password/i.test(msg)) return 'รหัสผ่านไม่ผ่านเงื่อนไขของระบบ: ' + msg;
  return msg;
}

async function createAdmin(req: Record<string, unknown>) {
  const username = cleanUsername(req.username);
  const role = cleanRole(req.role);
  const password = checkPassword(req.password);
  const displayName = String(req.display_name ?? '').trim() || null;
  const email = String(req.email ?? '').trim().toLowerCase() || username + '@' + NO_EMAIL_DOMAIN;

  // ชื่อซ้ำ = ปฏิเสธก่อนสร้างผู้ใช้ใน auth จะได้ไม่มีบัญชีค้าง
  const dup = await admin.from('app_admins').select('user_id').eq('username', username).maybeSingle();
  if (dup.data) throw new UserError('ชื่อผู้ใช้นี้มีคนใช้แล้ว');

  const made = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName, username }
  });
  if (made.error) throw new UserError(friendly(made.error.message));

  const ins = await admin.from('app_admins').insert({
    user_id: made.data.user.id, email, username, display_name: displayName, role
  });
  if (ins.error) {
    await admin.auth.admin.deleteUser(made.data.user.id);   // ย้อนกลับ ไม่ทิ้งผู้ใช้ที่ไม่มีสิทธิ์ไว้
    throw new UserError(friendly(ins.error.message));
  }
  return { user_id: made.data.user.id };
}

async function updateAdmin(req: Record<string, unknown>, me: string) {
  const id = String(req.user_id ?? '');
  const username = cleanUsername(req.username);
  const role = cleanRole(req.role);
  if (id === me && role !== 'owner') throw new UserError('ลดสิทธิ์ของตัวเองไม่ได้ — ให้ผู้ดูแลสูงสุดคนอื่นเป็นคนเปลี่ยน');

  const upd = await admin.from('app_admins')
    .update({ username, role, display_name: String(req.display_name ?? '').trim() || null })
    .eq('user_id', id).select('user_id');
  if (upd.error) throw new UserError(friendly(upd.error.message));
  if (!upd.data?.length) throw new UserError('ไม่พบบัญชีนี้ — อาจถูกลบไปแล้ว รีเฟรชหน้าแล้วลองใหม่');

  if (req.password) {
    const pw = await admin.auth.admin.updateUserById(id, { password: checkPassword(req.password) });
    if (pw.error) throw new UserError(friendly(pw.error.message));
  }
  return {};
}

async function deleteAdmin(req: Record<string, unknown>, me: string) {
  const id = String(req.user_id ?? '');
  if (id === me) throw new UserError('ลบบัญชีของตัวเองไม่ได้');
  const row = await admin.from('app_admins').select('user_id').eq('user_id', id).maybeSingle();
  if (!row.data) throw new UserError('ไม่พบบัญชีนี้ — อาจถูกลบไปแล้ว');
  const del = await admin.auth.admin.deleteUser(id);
  if (del.error) throw new UserError(friendly(del.error.message));
  return {};
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const req = await request.json();
    if (req.action === 'login') return reply({ ok: true, ...(await login(req)) });
    if (req.action === 'forgot') return reply({ ok: true, ...(await forgot(req)) });

    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const who = token ? await admin.auth.getUser(token) : null;
    if (!who || who.error || !who.data.user) throw new UserError('การเข้าสู่ระบบหมดอายุ — รีเฟรชหน้า CMS แล้วลองใหม่');
    const me = who.data.user.id;

    const mine = await admin.from('app_admins').select('role').eq('user_id', me).maybeSingle();
    if (mine.data?.role !== 'owner') throw new UserError('เฉพาะผู้ดูแลสูงสุดเท่านั้นที่จัดการบัญชีผู้ดูแลได้');

    if (req.action === 'create') return reply({ ok: true, ...(await createAdmin(req)) });
    if (req.action === 'update') return reply({ ok: true, ...(await updateAdmin(req, me)) });
    if (req.action === 'delete') return reply({ ok: true, ...(await deleteAdmin(req, me)) });
    throw new UserError('ไม่รู้จักคำสั่ง ' + req.action);
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    return reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
