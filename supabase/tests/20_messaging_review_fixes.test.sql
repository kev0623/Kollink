begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- 與 src/lib/messages/contact.test.ts 新增的案例相同（不可見字元、_ 與 / 分隔、astral 字元）；不需要任何 fixture
select ok(
  (select bool_and(public.has_contact_info(t)) from (values
    (E'0912­345678'), (E'0912​345⁠678'), (E'0912﻿345678'), ('0912_345_678'), ('0912/345/678'),
    (E'加\U0001F600\U0001F600賴')) x(t)),
  '不可見字元、底線、斜線分隔的電話與 astral 字元都偵測得到');
select ok(
  (select not bool_or(public.has_contact_info(t)) from (values
    ('2026/11/26 交稿'), ('12/1 到 12/15'), ('預算 NT$30,000 元'), ('2026-11-26 交稿'), ('訂單 123456789'),
    ('09123456789'), (E'加\n\n賴')) x(t)),
  '日期與一般內容不會誤判');

-- 速率限制加鎖（advisory lock 無法在單一交易內並發測試，改檢查函式內容）
select ok(pg_get_functiondef('public.send_message(uuid, text)'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''kollink.msg:''%',
  'send_message 計數前先取得 advisory lock');
select ok(pg_get_functiondef('public.start_conversation(uuid)'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''kollink.conv:''%',
  'start_conversation 計數前先取得 advisory lock');
select ok(not has_function_privilege('authenticated', 'public.has_contact_info(text)', 'EXECUTE'),
  'has_contact_info 仍不開放給 API 角色');
select ok(has_function_privilege('authenticated', 'public.send_message(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.send_message(uuid, text)', 'EXECUTE'),
  'send_message 權限不變');

select * from finish();
rollback;
