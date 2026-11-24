-- 明確授權 API 角色（anon / authenticated / service_role）
-- 新建的雲端 Supabase 專案不再自動把 public 資料表授權給 API 角色，
-- 本機環境仍會自動授權。這裡把本機在所有 migration 之後的最終權限明確寫出來，
-- 讓兩邊一致。之後新增資料表時，要在同一個 migration 裡寫明 grant。
-- 本檔由本機 information_schema 產生，對本機是無變化（idempotent）。

grant delete, insert, references, select, trigger, truncate, update on public.admins to service_role;
grant select on public.audit_logs to anon;
grant select on public.audit_logs to authenticated;
grant select on public.audit_logs to service_role;
grant select on public.brand_profiles to anon;
grant select on public.brand_profiles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.brand_profiles to service_role;
grant insert, select on public.brief_applications to anon;
grant insert, select on public.brief_applications to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.brief_applications to service_role;
grant delete, insert, select, update on public.briefs to anon;
grant delete, insert, select, update on public.briefs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.briefs to service_role;
grant select on public.collaborations to anon;
grant select on public.collaborations to authenticated;
grant select on public.collaborations to service_role;
grant insert, select on public.conversations to anon;
grant insert, select on public.conversations to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.conversations to service_role;
grant select on public.creator_profiles to anon;
grant select on public.creator_profiles to authenticated;
grant references, select, trigger, truncate on public.creator_profiles to service_role;
grant delete, insert, select, update on public.creator_rates to anon;
grant delete, insert, select, update on public.creator_rates to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.creator_rates to service_role;
grant select on public.creator_verifications to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.creator_verifications to service_role;
grant select on public.messages to anon;
grant select on public.messages to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.messages to service_role;
grant select on public.payments to anon;
grant select on public.payments to authenticated;
grant select on public.payments to service_role;
grant select on public.profiles to anon;
grant select on public.profiles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.profiles to service_role;

-- 欄位層級授權
grant insert (amount_twd, brand_id, brief_id, conversation_id, creator_id, deliverables, id, title) on public.collaborations to authenticated;
grant update (bio, categories, collab_types, engagement_rate, follower_count, ig_username, region, status, style_tags) on public.creator_profiles to service_role;
grant insert (body, conversation_id) on public.messages to authenticated;
grant insert (amount_twd, collaboration_id, merchant_trade_no, provider) on public.payments to service_role;

-- 函式執行權限（API 角色可呼叫的 public 函式）
grant execute on function public.audit_logs_block_mutation() to anon;
grant execute on function public.audit_logs_block_mutation() to authenticated;
grant execute on function public.audit_logs_block_mutation() to service_role;
grant execute on function public.check_categories(p text[]) to service_role;
grant execute on function public.check_logo_path(p_uid uuid, p_path text) to service_role;
grant execute on function public.clean_text(p text) to service_role;
grant execute on function public.collaborations_guard_update() to anon;
grant execute on function public.collaborations_guard_update() to authenticated;
grant execute on function public.collaborations_guard_update() to service_role;
grant execute on function public.create_brand_account(p_brand_name text, p_industry text, p_logo_path text) to authenticated;
grant execute on function public.create_brand_account(p_brand_name text, p_industry text, p_logo_path text) to service_role;
grant execute on function public.create_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) to authenticated;
grant execute on function public.create_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) to service_role;
grant execute on function public.creator_profiles_lock_handle() to anon;
grant execute on function public.creator_profiles_lock_handle() to authenticated;
grant execute on function public.creator_profiles_lock_handle() to service_role;
grant execute on function public.gen_verification_code() to service_role;
grant execute on function public.has_bidi(p text) to service_role;
grant execute on function public.hook_reject_password(event jsonb) to service_role;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_conversation_participant(p_conversation_id uuid) to anon;
grant execute on function public.is_conversation_participant(p_conversation_id uuid) to authenticated;
grant execute on function public.is_conversation_participant(p_conversation_id uuid) to service_role;
grant execute on function public.log_collaboration_created() to anon;
grant execute on function public.log_collaboration_created() to authenticated;
grant execute on function public.log_collaboration_created() to service_role;
grant execute on function public.my_role() to anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_role() to service_role;
grant execute on function public.null_encrypted_password() to service_role;
grant execute on function public.record_payment_success(p_merchant_trade_no text, p_amount_twd integer, p_provider_trade_no text, p_raw jsonb) to service_role;
grant execute on function public.transition_collaboration(p_collab_id uuid, p_action text, p_note text, p_published_url text) to authenticated;
grant execute on function public.transition_collaboration(p_collab_id uuid, p_action text, p_note text, p_published_url text) to service_role;
grant execute on function public.update_brand_account(p_brand_name text, p_industry text, p_logo_path text) to authenticated;
grant execute on function public.update_brand_account(p_brand_name text, p_industry text, p_logo_path text) to service_role;
grant execute on function public.update_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) to authenticated;
grant execute on function public.update_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) to service_role;
