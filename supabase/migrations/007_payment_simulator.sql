-- Local database transitions only; deliberately no provider or HTTP integration.
begin;
alter table public.payment_orders add column version integer not null default 0;
alter table public.payment_orders add column updated_at timestamptz not null default now();
create table public.payment_order_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  order_id uuid not null references public.payment_orders(id),
  action text not null check (action in ('payment_success','payment_failure','payment_cancel','payout_start','payout_success','payout_failure','payout_cancel','payout_retry','reset')),
  from_payment text not null, to_payment text not null,
  from_payout text not null, to_payout text not null,
  changed_by uuid not null references auth.users(id),
  version integer not null,
  created_at timestamptz not null default now(),
  unique(order_id, version)
);
alter table public.payment_order_events enable row level security;
revoke all on public.payment_order_events from anon, authenticated;
grant select on public.payment_order_events to authenticated;
create policy "Read visible order events" on public.payment_order_events for select to authenticated
using (exists(select 1 from public.payment_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create or replace function public.simulate_test_payment_order(
  p_order_id uuid, p_action text, p_request_id uuid, p_expected_version integer
) returns public.payment_orders language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.payment_orders%rowtype; prior public.payment_order_events%rowtype;
  next_payment text; next_payout text; description text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 테스트 상태를 변경할 수 있습니다.' using errcode = '42501';
  end if;
  if p_request_id is null or p_expected_version is null or p_action is null then
    raise exception '테스트 요청 정보가 필요합니다.' using errcode = '22023';
  end if;
  select * into o from public.payment_orders where id = p_order_id for update;
  if not found or o.mode <> 'test' then
    raise exception '테스트 주문만 처리할 수 있습니다.' using errcode = '22023';
  end if;
  select * into prior from public.payment_order_events where request_id = p_request_id;
  if found then
    if prior.order_id <> o.id or prior.action <> p_action then
      raise exception '다른 작업에서 사용한 요청 번호입니다.' using errcode = '22023';
    end if;
    return o;
  end if;
  if o.version <> p_expected_version then
    raise exception '다른 화면에서 상태가 변경됐습니다. 최신 상태를 확인해주세요.' using errcode = '40001';
  end if;
  if not exists(select 1 from public.rent_applications where id = o.application_id and status = 'approved') then
    raise exception '승인된 신청의 테스트 주문만 처리할 수 있습니다.' using errcode = '22023';
  end if;
  next_payment := o.payment_status; next_payout := o.payout_status;
  case
    when p_action = 'payment_success' and o.payment_status in ('pending','failed') then
      next_payment := 'paid'; next_payout := 'pending'; description := '결제 성공';
    when p_action = 'payment_failure' and o.payment_status = 'pending' then
      next_payment := 'failed'; description := '결제 실패';
    when p_action = 'payment_cancel' and o.payment_status in ('pending','failed') then
      next_payment := 'cancelled'; next_payout := 'cancelled'; description := '결제 전 취소';
    when p_action = 'payment_cancel' and o.payment_status = 'paid' and o.payout_status in ('pending','failed','cancelled') then
      next_payment := 'refunded'; next_payout := 'cancelled'; description := '결제 취소·환불';
    when p_action = 'payout_start' and o.payment_status = 'paid' and o.payout_status = 'pending' then
      next_payout := 'processing'; description := '지급 시작';
    when p_action = 'payout_success' and o.payment_status = 'paid' and o.payout_status = 'processing' then
      next_payout := 'completed'; description := '지급 성공';
    when p_action = 'payout_failure' and o.payment_status = 'paid' and o.payout_status = 'processing' then
      next_payout := 'failed'; description := '지급 실패';
    when p_action = 'payout_cancel' and o.payment_status = 'paid' and o.payout_status in ('pending','failed') then
      next_payout := 'cancelled'; description := '지급 취소 (결제 유지)';
    when p_action = 'payout_retry' and o.payment_status = 'paid' and o.payout_status in ('failed','cancelled') then
      next_payout := 'pending'; description := '지급 재시도 준비';
    when p_action = 'reset' and (o.payment_status <> 'pending' or o.payout_status <> 'not_ready') then
      next_payment := 'pending'; next_payout := 'not_ready'; description := '테스트 초기화 (이력 유지)';
    else raise exception '현재 상태에서는 선택한 테스트를 실행할 수 없습니다.' using errcode = '22023';
  end case;
  update public.payment_orders set payment_status = next_payment, payout_status = next_payout,
    version = version + 1, updated_at = now() where id = o.id;
  insert into public.payment_order_events(request_id,order_id,action,from_payment,to_payment,from_payout,to_payout,changed_by,version)
    values(p_request_id,o.id,p_action,o.payment_status,next_payment,o.payout_status,next_payout,auth.uid(),o.version+1);
  insert into public.notifications(user_id,application_id,title,message,type)
    values(o.user_id,o.application_id,'[테스트] ' || description,
      o.order_number || ': ' || description || '. 실제 결제·송금은 실행되지 않았습니다.','status');
  select * into o from public.payment_orders where id = o.id;
  return o;
end; $$;
revoke all on function public.simulate_test_payment_order(uuid,text,uuid,integer) from public, anon;
grant execute on function public.simulate_test_payment_order(uuid,text,uuid,integer) to authenticated;
commit;
