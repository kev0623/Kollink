-- 創作者註冊改成一步一題的流程：先領取公開頁網址，最後一步填報價（至少一種）。
-- 舊的 create_creator_account 保留（已部署的舊版網站還在呼叫），新流程改呼叫 create_creator_with_rates。

-- 1. 公開頁網址能不能用：格式正確、而且還沒有人使用。只給登入的人查（註冊第一步）。
--    只是提示，不保留網址；真正的唯一性仍由建立帳號時的 unique 約束決定（同時被搶走會回 handle taken）。
create function public.handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and coalesce(public.clean_text(p_handle) ~ '^[a-z0-9_.]{3,30}$', false)
     and not exists (select 1 from public.creator_profiles cp where cp.handle = public.clean_text(p_handle));
$$;
revoke execute on function public.handle_available(text) from public, anon, authenticated, service_role;
grant execute on function public.handle_available(text) to authenticated;

-- 2. 建立創作者帳號並存報價（同一個交易：任何一步失敗，帳號也不會建立）。
--    p_rates：[{ "collab_type": "Reels", "price_twd": 4500 }, …]，1–6 筆。
--    報價的合作形式同時成為「想接的合作」（collab_types）；逐筆檢查沿用 set_creator_rates。
create function public.create_creator_with_rates(
  p_display_name text,
  p_handle text,
  p_ig_username text,
  p_follower_count integer,
  p_region text,
  p_categories text[],
  p_rates jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_types text[];
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' or jsonb_array_length(p_rates) not between 1 and 6 then
    raise exception 'invalid rates' using errcode = '22023';
  end if;
  select array_agg(case when jsonb_typeof(e) = 'object' then e ->> 'collab_type' end order by ord)
    into v_types
    from jsonb_array_elements(p_rates) with ordinality as t(e, ord);
  v_types := public.check_text_list(v_types, 'collab_types', 6, 20);

  v_code := public.create_creator_account(p_display_name, p_handle, p_ig_username, p_follower_count, p_region, p_categories);
  update public.creator_profiles set collab_types = v_types where user_id = auth.uid();
  perform public.set_creator_rates(p_rates);
  return v_code;
end;
$$;
revoke execute on function public.create_creator_with_rates(text, text, text, integer, text, text[], jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_creator_with_rates(text, text, text, integer, text, text[], jsonb) to authenticated;
