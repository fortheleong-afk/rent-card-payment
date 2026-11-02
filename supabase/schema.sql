-- 금융사 계약 전 테스트용 스키마입니다. 실제 결제/송금 API 호출은 포함하지 않습니다.
create table if not exists public.rent_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  rent_amount integer not null, service_fee integer not null, total_amount integer not null,
  landlord_name text, landlord_bank text, landlord_account text, contract_file_path text,
  status text not null default 'pending_review', created_at timestamptz default now()
);
alter table public.rent_applications enable row level security;
create policy "Users can view own applications" on public.rent_applications for select using (auth.uid() = user_id);
create policy "Users can create own applications" on public.rent_applications for insert with check (auth.uid() = user_id);
create policy "Users can cancel own applications" on public.rent_applications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
