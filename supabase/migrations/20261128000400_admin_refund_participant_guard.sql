-- 管理員是合作案的參與者時，不能處理該合作案的退款（資料庫層防線）。
create or replace function public.resolve_payment_refund(p_payment_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_actor text;
  v_note text := nullif(public.clean_text(p_note), '');
  p public.payments%rowtype;
  v_status public.collab_status;
begin
  if coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('role', true), '') = 'service_role' then
    v_actor := 'system';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'not admin' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) > 500 or public.has_bidi(v_note) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  -- 管理員是這個合作案的參與者時，不能用管理員身分處理（與 admin_lock_collab 相同；service_role 備用 SQL 不受限）
  if v_actor = 'admin' and exists (
    select 1 from public.collaborations c
    where c.id = p.collaboration_id and v_uid in (c.brand_id, c.creator_id)
  ) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  if not p.refund_required then
    raise exception 'refund not required' using errcode = '55000';
  end if;

  update public.payments
  set refund_required = false, refunded_at = now(), refund_note = v_note
  where id = p.id;

  select c.status into v_status from public.collaborations c where c.id = p.collaboration_id;
  insert into public.audit_logs
    (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values
    (p.collaboration_id, case when v_actor = 'admin' then v_uid end, v_actor, 'payment_refunded',
     v_status, v_status, null);  -- 管理員備註只存 payments.refund_note；audit_logs 參與者看得到，不放備註
end;
$$;
revoke execute on function public.resolve_payment_refund(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_payment_refund(uuid, text) to authenticated, service_role;
