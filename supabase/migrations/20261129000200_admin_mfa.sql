-- 資安修正（資料庫）：管理員兩步驟驗證（brief Part A 13／audit-app App-M3）。
-- is_admin() 只在 JWT 的 aal claim 是 aal2（已通過 TOTP）時才成立；沒有通過第二步的管理員在資料庫裡就是一般使用者
-- （有 profile 的照自己的角色操作，沒有 profile 的什麼都不能做）。
-- admin_actor()（20261128000100_admin_core.sql）透過 is_admin() 判斷，所以也一起要求 aal2，不用改；
-- service_role 的 system 身分（admin_actor、transition_collaboration 等）不看 is_admin()，不受影響。
-- GoTrue 簽發的 access token 一律帶 aal（aal1／aal2），PostgREST 放在 request.jwt.claims，auth.jwt() 讀得到。

-- 來源：20261122000100_profiles.sql（授權見 20261128000100_admin_core.sql：authenticated、service_role）
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     -- 資安修正（App-M3）：管理員必須通過兩步驟驗證
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- 這個帳號是不是管理員（只看 admins 表、不看 aal）。app 用來判斷「是管理員但還沒通過第二步」→ 導到 /admin/mfa。
-- 不能拿來授權任何資料或動作（授權一律用 is_admin()）。
create function public.is_admin_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin_account() from public, anon, authenticated, service_role;
grant execute on function public.is_admin_account() to authenticated;
