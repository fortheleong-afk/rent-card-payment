begin;

create schema if not exists divercity_private;
revoke all on schema divercity_private from public, anon, authenticated;

create table divercity_private.operating_settings (
  singleton boolean primary key default true check (singleton),
  intake_open boolean not null default true,
  require_admin_mfa boolean not null default true,
  email_updates boolean not null default false
);
insert into divercity_private.operating_settings default values;
alter table divercity_private.operating_settings enable row level security;

-- Applies also to all existing review/order RPCs that call is_admin().
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) and (
    coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or not (select require_admin_mfa from divercity_private.operating_settings)
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view all applications" on public.rent_applications;
create policy "Admins can view all applications" on public.rent_applications
  for select to authenticated using ((select public.is_admin()));

create or replace function public.admin_user_contacts(p_user_ids uuid[])
returns table(id uuid, email text)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text from auth.users u
  where public.is_admin() and u.id = any(p_user_ids)
    and exists (select 1 from public.rent_applications a where a.user_id = u.id);
$$;
revoke all on function public.admin_user_contacts(uuid[]) from public, anon;
grant execute on function public.admin_user_contacts(uuid[]) to authenticated;

alter table public.rent_applications add column landlord_account_last4 text
  generated always as (nullif(right(regexp_replace(landlord_account, '[^0-9]', '', 'g'), 4), '')) stored;

-- Column privileges apply to direct Data API requests as well as our UI.
revoke select on public.rent_applications from public, anon, authenticated;
revoke select (landlord_account) on public.rent_applications from public, anon, authenticated;
do $$
declare safe_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into safe_columns
  from pg_catalog.pg_attribute
  where attrelid = 'public.rent_applications'::regclass and attnum > 0
    and not attisdropped and attname <> 'landlord_account';
  execute 'grant select (' || safe_columns || ') on public.rent_applications to authenticated';
end;
$$;

revoke update on public.profiles from public, anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke update on public.notifications from public, anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

create table divercity_private.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
create or replace function public.accept_site_terms(p_version text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in before accepting the terms.' using errcode = '42501'; end if;
  if p_version is distinct from '2026-11-09' then raise exception 'Refresh to read the latest terms.' using errcode = '22023'; end if;
  insert into divercity_private.terms_acceptances(user_id, version)
  values (auth.uid(), p_version) on conflict do nothing;
end;
$$;
alter table divercity_private.terms_acceptances enable row level security;
revoke all on function public.accept_site_terms(text) from public, anon;
grant execute on function public.accept_site_terms(text) to authenticated;

create or replace function divercity_private.record_signup_terms()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data->>'terms_version' = '2026-11-09' then
    insert into divercity_private.terms_acceptances(user_id, version)
    values (new.id, '2026-11-09') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger record_signup_terms after insert on auth.users
for each row execute function divercity_private.record_signup_terms();

create or replace function public.application_intake_open()
returns boolean language sql stable security definer set search_path = ''
as $$ select intake_open from divercity_private.operating_settings $$;
revoke all on function public.application_intake_open() from public;
grant execute on function public.application_intake_open() to anon, authenticated;

create or replace function divercity_private.check_application_intake()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.application_intake_open() then
    raise exception 'New submissions are paused. Your draft is still saved.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from divercity_private.terms_acceptances
    where user_id = new.user_id and version = '2026-11-09'
  ) then
    raise exception 'Review and accept the terms before submitting.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger check_application_intake before insert on public.rent_applications
for each row execute function divercity_private.check_application_intake();

create table divercity_private.admin_access_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  session_id text not null,
  application_id uuid not null,
  object_path text,
  action text not null check (action in ('details', 'preview', 'download')),
  occurred_at timestamptz not null default now()
);
create index admin_contract_session_idx on divercity_private.admin_access_events
  (actor_id, session_id, object_path, occurred_at desc) where object_path is not null;
alter table divercity_private.admin_access_events enable row level security;

create or replace function public.authorize_application_access(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare file_path text; session_key text := auth.jwt()->>'session_id';
begin
  if not public.is_admin() or nullif(session_key, '') is null then
    raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('details', 'preview', 'download') then
    raise exception '지원하지 않는 열람 작업입니다.' using errcode = '22023';
  end if;
  select case when p_action <> 'details' then contract_file_path end into file_path
  from public.rent_applications where id = p_id;
  if not found or (p_action <> 'details' and file_path is null) then
    raise exception '신청 또는 계약서를 확인할 수 없습니다.' using errcode = '22023';
  end if;
  insert into divercity_private.admin_access_events(actor_id, session_id, application_id, object_path, action)
  values (auth.uid(), session_key, p_id, file_path, p_action);
end;
$$;
revoke all on function public.authorize_application_access(uuid,text) from public, anon;
grant execute on function public.authorize_application_access(uuid,text) to authenticated;

create or replace function public.can_read_review_contract(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() and (
    exists (
      select 1 from divercity_private.admin_access_events
      where actor_id = auth.uid() and session_id = auth.jwt()->>'session_id'
        and object_path = p_path and occurred_at >= now() - interval '1 minute'
    )
    -- Storage requires visibility to remove an orphan through the Storage API.
    or exists (
      select 1 from storage.objects o
      where o.bucket_id = 'contract-documents' and o.name = p_path
        and public.can_delete_unlinked_contract(o.name, o.created_at)
    )
  );
$$;
revoke all on function public.can_read_review_contract(text) from public, anon;
grant execute on function public.can_read_review_contract(text) to authenticated;

drop policy if exists "Admins can view contracts" on storage.objects;
create policy "Admins can view contracts" on storage.objects for select to authenticated
using (bucket_id = 'contract-documents' and public.can_read_review_contract(name));

update storage.buckets
set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'contract-documents';

-- Keep tenant self-service limited to the current user's own content.
create or replace function public.discard_application_draft(p_id uuid, p_revision integer)
returns text language plpgsql security definer set search_path = ''
as $$
declare d public.application_drafts%rowtype;
begin
  select * into d from public.application_drafts
    where user_id = auth.uid() and id = p_id for update;
  if not found or d.state <> 'editing' or d.revision is distinct from p_revision then
    raise exception 'Refresh the draft before discarding it.' using errcode = '40001';
  end if;
  delete from public.application_drafts where id = d.id;
  return d.contract_file_path;
end;
$$;
revoke all on function public.discard_application_draft(uuid,integer) from public, anon;
grant execute on function public.discard_application_draft(uuid,integer) to authenticated;

-- Cap stored error reports to one per account, operation and hour.
create table divercity_private.operation_errors (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('submit_application', 'contract_link')),
  hour timestamptz not null,
  primary key (operation, hour, user_id)
);
create or replace function public.report_operation_error(p_operation text)
returns void language sql security definer set search_path = ''
as $$
  insert into divercity_private.operation_errors(user_id, operation, hour)
  select auth.uid(), p_operation, date_trunc('hour', now())
  where auth.uid() is not null and p_operation in ('submit_application','contract_link')
  on conflict do nothing;
$$;
alter table divercity_private.operation_errors enable row level security;
revoke all on function public.report_operation_error(text) from public, anon;
grant execute on function public.report_operation_error(text) to authenticated;

commit;
