-- Test-only workflow: status, audit history and notification commit together.
create or replace function public.review_rent_application(p_application_id uuid, p_status text, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare application public.rent_applications%rowtype; reason text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') or p_status is null then
    raise exception '허용되지 않은 심사 상태입니다.';
  end if;
  reason := nullif(btrim(left(coalesce(p_reason, ''), 1000)), '');
  update public.rent_applications set status = p_status,
    rejection_reason = case when p_status = 'rejected' then reason else null end
  where id = p_application_id and status = 'pending_review' returning * into application;
  if not found then return false; end if;
  insert into public.application_status_history(application_id, from_status, to_status, changed_by, reason)
    values(application.id, 'pending_review', p_status, auth.uid(), coalesce(reason, case when p_status = 'approved' then '관리자 승인' else '관리자 반려' end));
  insert into public.notifications(user_id, application_id, title, message, type)
    values(application.user_id, application.id, '신청 상태가 변경되었습니다',
      coalesce(application.application_number, upper(left(application.id::text, 8))) || case when p_status = 'approved' then ' 신청이 승인되었습니다.' else ' 신청이 반려되었습니다.' end || case when reason is not null and p_status = 'rejected' then ' 사유: ' || reason else '' end, 'status');
  return true;
end; $$;
revoke all on function public.review_rent_application(uuid, text, text) from public;
grant execute on function public.review_rent_application(uuid, text, text) to authenticated;

create or replace function public.cancel_rent_application(p_application_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare application public.rent_applications%rowtype;
begin
  update public.rent_applications set status = 'cancelled', cancelled_at = now()
    where id = p_application_id and user_id = auth.uid() and status = 'pending_review'
    returning * into application;
  if not found then return false; end if;
  insert into public.application_status_history(application_id, from_status, to_status, changed_by, reason)
    values(application.id, 'pending_review', 'cancelled', auth.uid(), '사용자 취소');
  insert into public.notifications(user_id, application_id, title, message, type)
    values(application.user_id, application.id, '신청이 취소되었습니다',
      coalesce(application.application_number, upper(left(application.id::text, 8))) || ' 신청이 취소되었습니다.', 'status');
  return true;
end; $$;
revoke all on function public.cancel_rent_application(uuid) from public;
grant execute on function public.cancel_rent_application(uuid) to authenticated;

