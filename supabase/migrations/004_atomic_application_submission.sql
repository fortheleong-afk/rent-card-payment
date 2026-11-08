-- A contract is uploaded first. The application, initial history and notification
-- are then committed in one transaction. No payment or transfer is performed.
create or replace function public.submit_rent_application(
  p_request_id uuid,
  p_property_address text,
  p_contract_start_date date,
  p_contract_end_date date,
  p_rent_amount integer,
  p_landlord_name text,
  p_landlord_bank text,
  p_landlord_account text,
  p_contract_file_path text,
  p_contract_file_name text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  applicant_id uuid := auth.uid();
  existing public.rent_applications%rowtype;
  applicant public.profiles%rowtype;
  applicant_email text;
  contract_object storage.objects%rowtype;
  new_number text;
  account_digits text;
begin
  if applicant_id is null then
    raise exception 'Log in before submitting an application.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Missing submission ID.' using errcode = '22023';
  end if;

  -- A retry with the same ID returns the first result; it cannot create two rows.
  select * into existing from public.rent_applications
    where id = p_request_id and user_id = applicant_id;
  if found then
    if existing.contract_file_path is distinct from p_contract_file_path then
      raise exception 'This submission ID belongs to a different contract.' using errcode = '22023';
    end if;
    return existing.application_number;
  end if;

  select * into applicant from public.profiles where id = applicant_id;
  if not found or nullif(btrim(coalesce(applicant.full_name, '')), '') is null
      or nullif(btrim(coalesce(applicant.phone, '')), '') is null then
    raise exception 'Complete your name and contact phone in your profile before applying.' using errcode = '22023';
  end if;
  select email into applicant_email from auth.users where id = applicant_id;
  if nullif(btrim(coalesce(p_property_address, '')), '') is null
      or length(btrim(p_property_address)) > 500
      or p_contract_start_date is null or p_contract_end_date is null
      or p_contract_end_date < p_contract_start_date
      or p_rent_amount is null or p_rent_amount < 1 or p_rent_amount > 1000000000
      or nullif(btrim(coalesce(p_landlord_name, '')), '') is null
      or length(btrim(p_landlord_name)) > 120
      or nullif(btrim(coalesce(p_landlord_bank, '')), '') is null
      or length(btrim(p_landlord_bank)) > 120
      or nullif(btrim(coalesce(p_contract_file_name, '')), '') is null
      or length(p_contract_file_name) > 255 then
    raise exception 'Check the required lease and rent details.' using errcode = '22023';
  end if;
  account_digits := regexp_replace(coalesce(p_landlord_account, ''), '[ -]', '', 'g');
  if account_digits !~ '^[0-9]{6,30}$' then
    raise exception 'Enter a valid deposit account number.' using errcode = '22023';
  end if;
  if p_contract_file_path is null
      or p_contract_file_path !~ ('^' || applicant_id::text || '/' || p_request_id::text || '/[0-9a-f]{64}\.(pdf|jpg|png)$') then
    raise exception 'Invalid contract storage path.' using errcode = '22023';
  end if;
  select * into contract_object from storage.objects
    where bucket_id = 'contract-documents' and name = p_contract_file_path;
  if not found then
    raise exception 'The uploaded contract was not found. Upload it again.' using errcode = '22023';
  end if;
  if nullif(contract_object.metadata ->> 'size', '') is null
      or nullif(contract_object.metadata ->> 'size', '')::bigint not between 1 and 10485760
      or contract_object.metadata ->> 'mimetype' is null
      or contract_object.metadata ->> 'mimetype' not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'The contract must be a PDF, JPG or PNG up to 10 MB.' using errcode = '22023';
  end if;

  new_number := 'DP-' || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
    || '-' || upper(substr(replace(p_request_id::text, '-', ''), 1, 8));
  insert into public.rent_applications (
    id, user_id, application_number, applicant_name, applicant_email, applicant_phone,
    property_address, contract_start_date, contract_end_date, rent_amount, service_fee,
    total_amount, landlord_name, landlord_bank, landlord_account, contract_file_path,
    contract_file_name, contract_file_size, status, test_payment_status, submitted_at
  ) values (
    p_request_id, applicant_id, new_number, btrim(applicant.full_name), applicant_email,
    btrim(applicant.phone), btrim(p_property_address), p_contract_start_date,
    p_contract_end_date, p_rent_amount, 0, p_rent_amount, btrim(p_landlord_name),
    btrim(p_landlord_bank), account_digits, p_contract_file_path,
    p_contract_file_name, (contract_object.metadata ->> 'size')::integer,
    'pending_review', 'not_started', now()
  ) on conflict (id) do nothing;

  if not found then
    select * into existing from public.rent_applications
      where id = p_request_id and user_id = applicant_id;
    if not found or existing.contract_file_path is distinct from p_contract_file_path then
      raise exception 'Submission ID conflict.' using errcode = '23505';
    end if;
    return existing.application_number;
  end if;

  insert into public.application_status_history
    (application_id, from_status, to_status, changed_by, reason)
    values (p_request_id, null, 'pending_review', applicant_id, 'Application submitted');
  insert into public.notifications
    (user_id, application_id, title, message, type)
    values (applicant_id, p_request_id, 'Rent application received',
      new_number || ' is awaiting review. No payment or transfer was made.', 'application');
  return new_number;
end;
$$;

revoke all on function public.submit_rent_application(uuid,text,date,date,integer,text,text,text,text,text) from public, anon;
grant execute on function public.submit_rent_application(uuid,text,date,date,integer,text,text,text,text,text) to authenticated;

-- Submission, audit and status mutations must go through their checked RPCs.
drop policy if exists "Users can create own applications" on public.rent_applications;
drop policy if exists "Users can delete own applications" on public.rent_applications;
drop policy if exists "Admins can update applications" on public.rent_applications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Admins can insert notifications" on public.notifications;
drop policy if exists "Admins can insert status history" on public.application_status_history;
