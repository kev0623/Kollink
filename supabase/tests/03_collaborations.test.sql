begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', 'brand', '森林寵物食堂'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000a1', 'brand', '平台管理員');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', '森林寵物食堂');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

-- 額外夥伴：創作者 c2、品牌 b2 的 brief、同時是品牌的管理員 a2
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000c2', 'creator', '小華'),
  ('00000000-0000-0000-0000-0000000000a2', 'brand', '管理員品牌');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a2');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000a2', '管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c2', 'hua', 'hua.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a002',
   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1');
insert into public.briefs (id, brand_id, title, description, deadline) values
  ('00000000-0000-0000-0000-00000000b2b2',
   '00000000-0000-0000-0000-0000000000b2', 'b2 的 brief', '說明', current_date + 30);
-- 直接由 postgres 建立各狀態的合作案（INSERT 不受更新防護影響）
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-00000000cc02', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
   '待拒絕', 'x', 1000, 'invited', null),
  ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
   '待取消', 'x', 1000, 'awaiting_payment', null),
  ('00000000-0000-0000-0000-00000000cc04', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
   '未到期審核', 'x', 1000, 'in_review', now() + interval '1 day'),
  ('00000000-0000-0000-0000-00000000cc05', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
   '已到期審核', 'x', 1000, 'in_review', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000cc06', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a002',
   '管理員自己的邀約', 'x', 1000, 'invited', null),
  ('00000000-0000-0000-0000-00000000cc07', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a002',
   '管理員自己的撥款', 'x', 1000, 'awaiting_payout', null);

-- ===== 品牌 b1 建立邀約 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.collaborations
      (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-00000000cc01',
            '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001',
            '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500)$$,
  '42501', null, '計畫 6 起品牌不能直接建立合作案（改走 invite_creator）');
-- 之後的流程照舊：由擁有者建立同一筆邀約（JWT 仍是 b1，建立紀錄的身分是品牌）
reset role;
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
values ('00000000-0000-0000-0000-00000000cc01',
        '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000a001',
        '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500);
set local role authenticated;
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01' and action = 'create'),
  1, '建立邀約會寫入 audit log');
select throws_ok(
  $$insert into public.collaborations
      (brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2',
            '00000000-0000-0000-0000-00000000a001', 'x', 'x', 1000)$$,
  '42501', null, '品牌不能用別人的對話建立給其他創作者的合作案');
select throws_ok(
  $$insert into public.collaborations
      (brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000b2b2',
            '00000000-0000-0000-0000-00000000a001', 'x', 'x', 1000)$$,
  '42501', null, '不能掛上其他品牌的 brief');
select throws_ok(
  $$insert into public.audit_logs (actor_kind, action) values ('brand', 'x')$$,
  '42501', null, '使用者不能直接寫入 audit log');
select throws_ok(
  $$update public.collaborations set status = 'completed'
    where id = '00000000-0000-0000-0000-00000000cc01'$$,
  '42501', null, '不能直接改狀態欄位');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve')$$,
  '22023', null, '邀約階段不能審核通過');

-- ===== 創作者 c1 接受 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.collaborations
      (brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001', 'x', 'x', 1000)$$,
  '42501', null, '創作者不能建立合作案');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'accept'),
  'awaiting_payment'::public.collab_status, '創作者接受邀約');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc02', 'decline'),
  'declined'::public.collab_status, '創作者拒絕邀約');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid')$$,
  '22023', null, '創作者不能自己標記已付款');

-- ===== 第三方品牌 b2 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.collaborations), 0, '第三方看不到別人的合作案');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'cancel')$$,
  '42501', null, '第三方不能操作別人的合作案');

-- ===== 系統（service role）標記已付款 =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid')$$,
  '22023', null, '系統金鑰不能繞過付款紀錄直接標記已付款');
reset role;
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd) values
  ('00000000-0000-0000-0000-00000000cc01', 'ecpay', 'PT0001', 4500);
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_payment_success('PT0001', 4500, 'T-cc01', '{}'::jsonb),
  'paid', '系統經由付款紀錄函式標記已付款');
select throws_ok(
  $$insert into public.audit_logs (actor_kind, action) values ('system', 'x')$$,
  '42501', null, '系統角色也不能直接寫入 audit log');
select throws_ok(
  $$update public.collaborations set amount_twd = 1
    where id = '00000000-0000-0000-0000-00000000cc01'$$,
  '42501', null, '系統角色也不能直接改合作案金額');
select throws_ok(
  $$insert into public.collaborations
      (brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status) values
      ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
       '00000000-0000-0000-0000-00000000a001', '繞過', 'x', 1000, 'awaiting_payout')$$,
  '42501', null, '系統金鑰也不能直接建立任意狀態的合作案');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc04', 'auto_approve')$$,
  '22023', null, '未到期不能自動審核通過');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc05', 'auto_approve'),
  'awaiting_publish'::public.collab_status, '到期後系統自動審核通過');

-- ===== 創作者交稿 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select set_config('kollink.submitting_deliverables', 'on', true); -- 模擬 submit_deliverables（submit 只能由它觸發，見 16 號測試）
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者交稿');
select set_config('kollink.submitting_deliverables', 'off', true);

select ok(
  (select review_due_at > now() + interval '71 hours'
     from public.collaborations where id = '00000000-0000-0000-0000-00000000cc01'),
  '交稿後設定 3 天審核期限');

-- ===== 品牌要求修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes')$$,
  '22023', null, '要求修改必須填寫說明');
select throws_ok(
  format($$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes', %L)$$, E'\t\n'),
  '22023', null, '只有空白字元的說明視為未填寫');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes',
                                  '第二張色調再亮一點'),
  'awaiting_submission'::public.collab_status, '品牌要求修改，退回交稿');
select results_eq(
  $$select actor_kind, from_status::text, to_status::text, note
      from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01'
       and action = 'request_changes'
     order by id desc limit 1$$,
  $$values ('brand'::text, 'in_review'::text, 'awaiting_submission'::text, '第二張色調再亮一點'::text)$$,
  'audit 紀錄內容正確（身分、前後狀態、說明）');

-- ===== 再次交稿、審核通過、發佈 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select set_config('kollink.submitting_deliverables', 'on', true); -- 模擬 submit_deliverables（submit 只能由它觸發，見 16 號測試）
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者再次交稿');
select set_config('kollink.submitting_deliverables', 'off', true);


select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve'),
  'awaiting_publish'::public.collab_status, '品牌審核通過');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish')$$,
  '22023', null, '發佈必須附上貼文連結');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish', null, 'https://')$$,
  '22023', null, '只有 https:// 不是有效連結');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish', null, 'https://instagram.com')$$,
  '22023', null, '沒有路徑的連結不被接受');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish', null,
                                  'https://www.instagram.com/p/abc123/'),
  'awaiting_payout'::public.collab_status, '創作者發佈');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout')$$,
  '22023', null, '創作者不能自己撥款');

-- ===== 管理員撥款 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
-- 計畫 9 起撥款只能經由 admin_mark_payout（kollink.paying_out 旗標）；這裡直接模擬旗標，只測狀態機
select set_config('kollink.paying_out', 'on', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout'),
  'completed'::public.collab_status, '管理員撥款，結案');
select set_config('kollink.paying_out', 'off', true);
select is(
  (select published_url from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc01'),
  'https://www.instagram.com/p/abc123/', '已記錄貼文連結');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01'),
  9, '每個成功的動作都留下一筆紀錄（create + 8 次轉換）');

-- ===== 品牌 b1 取消 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc03', 'cancel'),
  'cancelled'::public.collab_status, '品牌取消待付款的合作案');

-- ===== 管理員同時是品牌：以品牌身分行動 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc06', 'cancel'),
  'cancelled'::public.collab_status, '管理員是品牌時可以取消自己的邀約');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc07', 'payout')$$,
  '22023', null, '管理員不能撥款自己品牌的合作案');

-- ===== audit log 不能修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$delete from public.audit_logs$$,
  '42501', null, '使用者不能刪除 audit log');

reset role;
select throws_ok(
  $$update public.collaborations set status = 'completed'
    where id = '00000000-0000-0000-0000-00000000cc07'$$,
  '42501', null, '擁有者也不能繞過狀態轉換直接改狀態');
select lives_ok(
  $$update public.collaborations set title = '改標題'
    where id = '00000000-0000-0000-0000-00000000cc07'$$,
  '擁有者可以修改不受保護的欄位');
select throws_ok(
  $$update public.audit_logs set note = 'tampered'$$,
  'P0001', null, '連資料庫擁有者也不能修改 audit log');
-- 註：交易內 TRUNCATE 最後會被 rollback，仍能驗證 trigger 擋下
select throws_ok(
  $$truncate public.audit_logs$$,
  'P0001', null, '連資料庫擁有者也不能清空 audit log');

select * from finish();
rollback;
