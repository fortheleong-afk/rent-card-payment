begin;

alter table public.rent_applications
  add column rent_month date,
  add column rent_due_date date,
  add column revision integer not null default 0,
  add column correction_reason text,
  add column review_entered_at timestamptz;

alter table public.rent_applications drop constraint rent_applications_status_check;
alter table public.rent_applications add constraint rent_applications_status_check
  check (status in ('pending_review', 'needs_changes', 'approved', 'rejected', 'cancelled', 'payment_pending',
    'payment_completed', 'transfer_pending', 'transfer_completed', 'completed'));
alter table public.rent_applications add constraint application_rent_schedule_check
  check ((rent_month is null and rent_due_date is null) or (
    rent_month is not null and rent_due_date is not null
    and extract(day from rent_month) = 1
    and (extract(year from rent_month) * 12 + extract(month from rent_month))
      between (extract(year from contract_start_date) * 12 + extract(month from contract_start_date))
        and (extract(year from contract_end_date) * 12 + extract(month from contract_end_date))
  ));
create unique index one_application_per_rent_month
  on public.rent_applications (user_id, lower(btrim(property_address)), rent_month)
  where rent_month is not null and status not in ('cancelled','rejected');

grant select (rent_month, rent_due_date, revision, correction_reason, review_entered_at)
  on public.rent_applications to authenticated;

-- Date fields are separate from the editable draft payload and guarded by its revision.
alter table public.application_drafts add column rent_month date, add column rent_due_date date;
update public.application_drafts d set payload = '{}'::jsonb
where d.state = 'submitted' and d.payload <> '{}'::jsonb
  and exists (select 1 from public.rent_applications a where a.id = d.id and a.user_id = d.user_id);

create or replace function public.save_draft_with_schedule(
  p_id uuid, p_revision integer, p_payload jsonb, p_step integer,
  p_file_path text, p_file_name text, p_prepare boolean, p_month date, p_due date
)
returns public.application_drafts language plpgsql security definer set search_path = ''
as $$
declare d public.application_drafts%rowtype;
begin
  if p_prepare and (p_month is null or p_due is null) then
    raise exception 'Enter the rent month and due date before submitting.' using errcode = '22023';
  end if;
  d := public.save_application_draft(p_id, p_revision, p_payload, p_step, p_file_path, p_file_name, p_prepare);
  update public.application_drafts set rent_month = p_month, rent_due_date = p_due
  where user_id = auth.uid() and id = d.id returning * into d;
  return d;
end;
$$;
revoke all on function public.save_draft_with_schedule(uuid,integer,jsonb,integer,text,text,boolean,date,date) from public, anon;
grant execute on function public.save_draft_with_schedule(uuid,integer,jsonb,integer,text,text,boolean,date,date) to authenticated;
revoke execute on function public.save_application_draft(uuid,integer,jsonb,integer,text,text,boolean) from public, anon, authenticated;

-- Apply the schedule inside the existing atomic submission, even after a retry.
create or replace function divercity_private.apply_draft_schedule()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select rent_month, rent_due_date into new.rent_month, new.rent_due_date
  from public.application_drafts where id = new.id and user_id = new.user_id;
  new.review_entered_at := now();
  return new;
end;
$$;
create trigger apply_draft_schedule before insert on public.rent_applications
for each row execute function divercity_private.apply_draft_schedule();

-- Only the resumable submission RPC remains a public entry point.
revoke execute on function public.submit_rent_application(uuid,text,date,date,integer,text,text,text,text,text)
  from authenticated, anon, public;
create or replace function public.submit_application_draft(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare d public.application_drafts%rowtype; number text;
begin
  select * into d from public.application_drafts where user_id = auth.uid() and id = p_id for update;
  if not found then raise exception 'Draft unavailable.' using errcode = '42501'; end if;
  select application_number into number from public.rent_applications where id = d.id and user_id = auth.uid();
  if not found then
    if d.state <> 'submitting' then
      raise exception 'Review and save the application before submitting.' using errcode = '22023';
    end if;
    if d.rent_month is null or d.rent_due_date is null then
      raise exception 'Return to your saved details and enter the rent month and due date.' using errcode = '22023';
    end if;
    number := public.submit_rent_application(d.id, d.payload->>'address', nullif(d.payload->>'contractStart','')::date,
      nullif(d.payload->>'contractEnd','')::date, nullif(d.payload->>'rent','')::integer, d.payload->>'landlordName',
      d.payload->>'bank', d.payload->>'account', d.contract_file_path, d.contract_file_name);
  end if;
  update public.application_drafts
    set state = 'submitted', application_number = number, payload = '{}'::jsonb, updated_at = now()
    where id = d.id;
  return number;
exception when unique_violation then
  if exists (select 1 from public.rent_applications
    where user_id = auth.uid() and lower(btrim(property_address)) = lower(btrim(d.payload->>'address'))
      and rent_month = d.rent_month and status not in ('cancelled','rejected')) then
    raise exception 'An application for this property and rent month already exists. Check your applications.' using errcode = '22023';
  end if;
  raise;
end;
$$;

create or replace function public.open_application_draft(p_new boolean default false)
returns public.application_drafts language plpgsql security definer set search_path = ''
as $$
declare d public.application_drafts%rowtype; number text;
begin
  if auth.uid() is null then raise exception 'Sign in to restore your application.' using errcode = '42501'; end if;
  insert into public.application_drafts(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into d from public.application_drafts where user_id = auth.uid() for update;
  select application_number into number from public.rent_applications where id = d.id and user_id = auth.uid();
  if found then
    update public.application_drafts set state = 'submitted', application_number = number, payload = '{}'::jsonb
      where user_id = auth.uid() returning * into d;
  end if;
  if coalesce(p_new,false) then
    if d.state <> 'submitted' then raise exception 'Resume or finish the current draft first.' using errcode = '22023'; end if;
    update public.application_drafts set id = gen_random_uuid(), state = 'editing', revision = 0, step = 0, payload = '{}'::jsonb,
      contract_file_path = null, contract_file_name = null, contract_file_size = null, contract_file_type = null,
      application_number = null, rent_month = null, rent_due_date = null, updated_at = now()
      where user_id = auth.uid() returning * into d;
  end if;
  return d;
end;
$$;

-- Preserve old submitted evidence so a replacement does not turn it into an orphan.
create table divercity_private.application_revisions (
  application_id uuid not null references public.rent_applications(id) on delete cascade,
  revision integer not null,
  saved_at timestamptz not null default now(),
  details jsonb not null,
  contract_file_path text,
  primary key (application_id, revision)
);
create index application_revision_contract_idx on divercity_private.application_revisions(contract_file_path);
alter table divercity_private.application_revisions enable row level security;

create or replace function public.can_delete_unlinked_contract(p_path text, p_created_at timestamptz)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and (split_part(p_path, '/', 1) = auth.uid()::text
      or (public.is_admin() and p_created_at < now() - interval '7 days'))
    and not exists (select 1 from public.rent_applications where contract_file_path = p_path)
    and not exists (select 1 from public.application_drafts where contract_file_path = p_path)
    and not exists (select 1 from divercity_private.application_revisions where contract_file_path = p_path);
$$;

create or replace function public.find_old_orphan_contracts(p_limit integer default 50)
returns table(path text, uploaded_at timestamptz) language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501'; end if;
  return query select o.name::text, o.created_at from storage.objects o
  where o.bucket_id = 'contract-documents' and o.created_at < now() - interval '7 days'
    and public.can_delete_unlinked_contract(o.name, o.created_at)
  order by o.created_at, o.name limit least(greatest(coalesce(p_limit,50),1),50);
end;
$$;

create or replace function public.can_upload_lease_contract(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and p_path ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/[0-9a-f]{64}\.(pdf|jpg|png)$')
    and (
      exists (select 1 from public.application_drafts where user_id = auth.uid() and state = 'editing'
        and id::text = split_part(p_path, '/', 2))
      or exists (select 1 from public.rent_applications where user_id = auth.uid() and status = 'needs_changes'
        and id::text = split_part(p_path, '/', 2))
    )
    and (select count(*) from storage.objects
      where bucket_id = 'contract-documents' and split_part(name, '/', 1) = auth.uid()::text
        and created_at >= now() - interval '1 hour') < 20;
$$;
revoke all on function public.can_upload_lease_contract(text) from public, anon;
grant execute on function public.can_upload_lease_contract(text) to authenticated;
drop policy if exists "Users can upload own contracts" on storage.objects;
create policy "Users can upload own contracts" on storage.objects for insert to authenticated
with check (bucket_id = 'contract-documents' and public.can_upload_lease_contract(name));

create or replace function public.review_application(p_id uuid, p_status text, p_reason text, p_revision integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare a public.rent_applications%rowtype; reason text := nullif(btrim(left(p_reason, 1000)), '');
begin
  if not public.is_admin() then raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('approved','rejected','needs_changes')
    or (p_status = 'needs_changes' and reason is null) then
    raise exception '보완 요청에는 신청자가 수정할 내용을 입력해 주세요.' using errcode = '22023';
  end if;
  update public.rent_applications set status = p_status,
    rejection_reason = case when p_status = 'rejected' then reason end,
    correction_reason = case when p_status = 'needs_changes' then reason end
  where id = p_id and status = 'pending_review' and revision = p_revision returning * into a;
  if not found then return false; end if;

  insert into public.application_status_history(application_id, from_status, to_status, changed_by, reason)
  values (a.id, 'pending_review', p_status, auth.uid(), reason);
  insert into public.notifications(user_id, application_id, title, message, type)
  values (a.user_id, a.id,
    case p_status when 'needs_changes' then 'Changes requested' when 'approved' then 'Application approved' else 'Review complete' end,
    case p_status when 'needs_changes' then 'Open your application to see what to update and resubmit.'
      when 'approved' then 'Open your application to view the next test step.' else 'Open your application to read the review outcome.' end,
    'status');
  return true;
end;
$$;
revoke all on function public.review_application(uuid,text,text,integer) from public, anon;
grant execute on function public.review_application(uuid,text,text,integer) to authenticated;
revoke execute on function public.review_rent_application(uuid,text,text) from public, anon, authenticated;

create or replace function public.resubmit_application(
  p_id uuid, p_revision integer, p_address text, p_start date, p_end date, p_amount integer, p_month date, p_due date,
  p_landlord text, p_bank text, p_account text, p_file_path text, p_file_name text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare a public.rent_applications%rowtype; file_size integer; account_digits text;
begin
  select * into a from public.rent_applications where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Application unavailable.' using errcode = '42501'; end if;
  if a.status <> 'needs_changes' or a.revision is distinct from p_revision then return false; end if;
  if not public.application_intake_open() then raise exception 'Submissions are paused.' using errcode = '22023'; end if;
  if nullif(btrim(p_address), '') is null or length(p_address) > 500
    or p_start is null or p_end is null or p_end < p_start or p_amount is null or p_amount not between 1 and 1000000000
    or p_month is null or p_due is null or nullif(btrim(p_landlord), '') is null or length(p_landlord) > 120
    or nullif(btrim(p_bank), '') is null or length(p_bank) > 120 then
    raise exception 'Check the required rent, lease and account details.' using errcode = '22023';
  end if;
  if nullif(btrim(p_account), '') is null
    and (btrim(p_bank) is distinct from a.landlord_bank or btrim(p_landlord) is distinct from a.landlord_name) then
    raise exception 'Enter the account number when changing the bank or account holder.' using errcode = '22023';
  end if;
  account_digits := coalesce(nullif(regexp_replace(p_account, '[ -]', '', 'g'), ''), a.landlord_account);
  if account_digits is null or account_digits !~ '^[0-9]{6,30}$' then
    raise exception 'Enter a valid deposit account number.' using errcode = '22023';
  end if;
  if p_file_path is not null then
    if p_file_path !~ ('^' || a.user_id::text || '/' || a.id::text || '/[0-9a-f]{64}\.(pdf|jpg|png)$')
      or nullif(btrim(p_file_name), '') is null or length(p_file_name) > 255 then
      raise exception 'Choose a supported lease file.' using errcode = '22023';
    end if;
    select (metadata->>'size')::integer into file_size from storage.objects
    where bucket_id = 'contract-documents' and name = p_file_path
      and metadata->>'mimetype' in ('application/pdf','image/jpeg','image/png')
    for share;
    if not found or file_size is null or file_size not between 1 and 10485760 then
      raise exception 'Upload a PDF, JPG or PNG up to 10 MB.' using errcode = '22023';
    end if;
  elsif a.contract_file_path is null then
    raise exception 'Upload your lease contract.' using errcode = '22023';
  end if;

  insert into divercity_private.application_revisions(application_id, revision, details, contract_file_path)
  values (a.id, a.revision, to_jsonb(a) - 'landlord_account', a.contract_file_path);
  update public.rent_applications set property_address = btrim(p_address), contract_start_date = p_start,
    contract_end_date = p_end, rent_amount = p_amount, total_amount = p_amount + service_fee,
    rent_month = p_month, rent_due_date = p_due, landlord_name = btrim(p_landlord),
    landlord_bank = btrim(p_bank), landlord_account = account_digits, status = 'pending_review',
    revision = revision + 1, correction_reason = null, review_entered_at = now(),
    contract_file_path = coalesce(p_file_path, a.contract_file_path),
    contract_file_name = case when p_file_path is null then a.contract_file_name else p_file_name end,
    contract_file_size = coalesce(file_size, a.contract_file_size)
  where id = a.id;
  insert into public.application_status_history(application_id, from_status, to_status, changed_by, reason)
  values (a.id, 'needs_changes', 'pending_review', auth.uid(), 'Updated details submitted');
  insert into public.notifications(user_id, application_id, title, message, type)
  values (a.user_id, a.id, 'Updated details received', 'Your application is awaiting review again.', 'application');
  return true;
exception when unique_violation then
  raise exception 'An application for this property and rent month already exists.' using errcode = '22023';
end;
$$;
revoke all on function public.resubmit_application(uuid,integer,text,date,date,integer,date,date,text,text,text,text,text) from public, anon;
grant execute on function public.resubmit_application(uuid,integer,text,date,date,integer,date,date,text,text,text,text,text) to authenticated;

create or replace function public.cancel_rent_application(p_application_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare a public.rent_applications%rowtype;
begin
  select * into a from public.rent_applications
  where id = p_application_id and user_id = auth.uid() and status in ('pending_review','needs_changes') for update;
  if not found then return false; end if;
  update public.rent_applications set status = 'cancelled', cancelled_at = now() where id = a.id;
  insert into public.application_status_history(application_id,from_status,to_status,changed_by,reason)
  values (a.id,a.status,'cancelled',auth.uid(),'Cancelled by applicant');
  insert into public.notifications(user_id,application_id,title,message,type)
  values (a.user_id,a.id,'Application cancelled','Your application was cancelled. The review has ended.','status');
  return true;
end;
$$;

commit;
