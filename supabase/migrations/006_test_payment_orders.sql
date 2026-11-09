-- Test orders only. No financial provider or network calls.
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  application_id uuid not null unique references public.rent_applications(id),
  user_id uuid not null references auth.users(id),
  mode text not null default 'test' check (mode = 'test'),
  currency text not null default 'KRW' check (currency = 'KRW'),
  rent_amount bigint not null check (rent_amount between 1 and 1000000000),
  service_fee bigint not null default 0 check (service_fee = 0),
  total_amount bigint generated always as (rent_amount + service_fee) stored,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','cancelled','refunded')),
  payout_status text not null default 'not_ready' check (payout_status in ('not_ready','pending','processing','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  check (payout_status not in ('pending','processing','completed','failed') or payment_status = 'paid')
);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
grant select on public.payment_orders to authenticated;
create policy "Read own or admin orders" on public.payment_orders for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create or replace function public.create_test_payment_order(p_application_id uuid)
returns public.payment_orders language plpgsql security definer
set search_path = public, pg_temp as $$
declare a public.rent_applications%rowtype; o public.payment_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into a from public.rent_applications where id = p_application_id for update;
  if not found or (a.user_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Application unavailable.' using errcode = '42501';
  end if;
  if a.status <> 'approved' then
    raise exception 'Only approved applications can have a payment order.' using errcode = '22023';
  end if;
  select * into o from public.payment_orders where application_id = a.id;
  if found then return o; end if;
  if a.rent_amount is null or a.rent_amount < 1 or a.rent_amount > 1000000000 then
    raise exception 'Invalid approved rent amount.' using errcode = '22023';
  end if;
  insert into public.payment_orders(order_number,application_id,user_id,rent_amount)
    values ('DPT-' || upper(replace(gen_random_uuid()::text,'-','')),a.id,a.user_id,a.rent_amount)
    returning * into o;
  insert into public.notifications(user_id,application_id,title,message,type)
    values (a.user_id,a.id,'Test payment order ready',o.order_number || ': no payment or transfer has occurred.','status');
  return o;
end; $$;
revoke all on function public.create_test_payment_order(uuid) from public, anon;
grant execute on function public.create_test_payment_order(uuid) to authenticated;
