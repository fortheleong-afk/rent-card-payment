-- Divercity Pay 신청 업무 흐름 확장
-- 실제 카드결제/계좌송금 API는 포함하지 않습니다.

alter table public.rent_applications
  add column if not exists application_number text unique,
  add column if not exists property_address text,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists contract_file_name text,
  add column if not exists contract_file_size integer,
  add column if not exists submitted_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists test_payment_status text default 'not_started';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'tenant' check (role in ('tenant', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (id = auth.uid());

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rent_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.rent_applications(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'status',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.application_status_history enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Admins can view all applications" on public.rent_applications;
create policy "Admins can view all applications" on public.rent_applications for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can update applications" on public.rent_applications;
create policy "Admins can update applications" on public.rent_applications for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can insert status history" on public.application_status_history;
create policy "Admins can insert status history" on public.application_status_history for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can insert notifications" on public.notifications;
create policy "Admins can insert notifications" on public.notifications for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Users can view own status history" on public.application_status_history;
create policy "Users can view own status history" on public.application_status_history for select using (
  exists (select 1 from public.rent_applications a where a.id = application_id and a.user_id = auth.uid())
);

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications for select using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications for update using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own contracts" on storage.objects;
create policy "Users can upload own contracts" on storage.objects for insert to authenticated
with check (bucket_id = 'contract-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can view own contracts" on storage.objects;
create policy "Users can view own contracts" on storage.objects for select to authenticated
using (bucket_id = 'contract-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins can view contracts" on storage.objects;
create policy "Admins can view contracts" on storage.objects for select to authenticated
using (bucket_id = 'contract-documents' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 기존 데이터에 신청번호가 없는 경우를 위한 일괄 생성
update public.rent_applications
set application_number = 'DP-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where application_number is null;
