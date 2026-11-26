begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 781 品牌、791 創作者；7d1 審核中、7d2 待發布
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000781', 'p6g-b1@test.local'),
  ('00000000-0000-0000-0000-000000000791', 'p6g-c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000781', 'brand', '守門品牌'),
  ('00000000-0000-0000-0000-000000000791', 'creator', '守門創作者');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000781', '守門品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000791', 'p6guard', 'p6guard', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c071', '00000000-0000-0000-0000-000000000781', '00000000-0000-0000-0000-000000000791');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-000000000781', '00000000-0000-0000-0000-000000000791',
   '00000000-0000-0000-0000-00000007c071', '審核中', 'IG 貼文', 3000, 'in_review', now() + interval '2 days'),
  ('00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-000000000781', '00000000-0000-0000-0000-000000000791',
   '00000000-0000-0000-0000-00000007c071', '待發布', 'IG 貼文', 3000, 'awaiting_publish', null);

-- 規則與 src/lib/validation/collab.ts 的 NOTE_MAX（1000）、POST_URL_MAX（500）一致
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000781","role":"authenticated"}', true);
select throws_ok(
  format($$select public.transition_collaboration('00000000-0000-0000-0000-0000000007d1', 'request_changes', %L)$$, repeat('字', 1001)),
  '22023', 'invalid note', '過長的備註被拒絕');
select throws_ok(
  format($$select public.transition_collaboration('00000000-0000-0000-0000-0000000007d1', 'request_changes', %L)$$, '改' || U&'\202E' || 'abc'),
  '22023', 'invalid note', '含 bidi 控制字元的備註被拒絕');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007d1'),
  'in_review', '被拒後狀態不變');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-0000000007d1', 'request_changes', E'  請改第二張​圖  '),
  'awaiting_submission'::public.collab_status, '正常的要求修改仍可執行');
select is(
  (select a.note from public.audit_logs a
    where a.collaboration_id = '00000000-0000-0000-0000-0000000007d1' and a.action = 'request_changes'),
  '請改第二張圖', '稽核紀錄存的是清理後的備註');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000791","role":"authenticated"}', true);
select throws_ok(
  format($$select public.transition_collaboration('00000000-0000-0000-0000-0000000007d2', 'publish', null, %L)$$,
         'https://www.instagram.com/p/' || repeat('a', 500)),
  '22023', 'invalid published_url', '過長的貼文網址被拒絕');
select throws_ok(
  format($$select public.transition_collaboration('00000000-0000-0000-0000-0000000007d2', 'publish', null, %L)$$,
         'https://www.instagram.com/p/a' || U&'\202E' || 'b'),
  '22023', 'invalid published_url', '含 bidi 控制字元的貼文網址被拒絕');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-0000000007d2', 'publish', null, ' https://www.instagram.com/p/abc123/ '),
  'awaiting_payout'::public.collab_status, '正常的貼文網址仍可發布');
select is(
  (select c.published_url from public.collaborations c where c.id = '00000000-0000-0000-0000-0000000007d2'),
  'https://www.instagram.com/p/abc123/', '儲存的是清理後的網址');

select * from finish();
rollback;
