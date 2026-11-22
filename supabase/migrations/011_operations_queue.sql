begin;

create index rent_applications_user_created_idx on public.rent_applications(user_id, created_at desc, id);
create index rent_applications_review_wait_idx on public.rent_applications(review_entered_at)
  where status = 'pending_review';
create index application_history_order_idx on public.application_status_history(application_id, created_at desc);

-- Administrative detail access goes through an audited boundary.
drop policy if exists "Admins can view all applications" on public.rent_applications;
drop policy if exists "Admins can view profiles" on public.profiles;
revoke execute on function public.admin_user_contacts(uuid[]) from public, anon, authenticated;

create or replace function public.admin_application_detail(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform public.authorize_application_access(p_id, 'details');
  return (
    select (to_jsonb(a) - 'landlord_account') || jsonb_build_object(
      'applicant_name', coalesce(a.applicant_name, p.full_name),
      'applicant_email', coalesce(a.applicant_email, u.email),
      'applicant_phone', coalesce(a.applicant_phone, p.phone)
    )
    from public.rent_applications a
    left join public.profiles p on p.id = a.user_id
    left join auth.users u on u.id = a.user_id
    where a.id = p_id
  );
end;
$$;
revoke all on function public.admin_application_detail(uuid) from public, anon;
grant execute on function public.admin_application_detail(uuid) to authenticated;

create or replace function public.admin_application_queue(
  p_search text, p_queue text, p_sort text, p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare query text := lower(left(btrim(coalesce(p_search, '')), 160));
begin
  if not public.is_admin() then raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501'; end if;
  return (
    with matches as (
      select a.id, a.application_number, a.status, a.rent_amount, a.rent_month, a.rent_due_date, a.created_at,
        a.submitted_at, coalesce(a.review_entered_at, a.submitted_at, a.created_at) as review_entered_at,
        coalesce(a.applicant_name, p.full_name) as applicant_name,
        coalesce(a.applicant_email, u.email) as applicant_email, o.payment_status, o.payout_status,
        case
          when a.status = 'pending_review' then 'review'
          when a.status = 'needs_changes' then 'changes'
          when a.status in ('rejected','cancelled') then 'closed'
          when a.status <> 'approved' then 'attention'
          when o.payment_status in ('cancelled','refunded') then 'closed'
          when o.payment_status = 'failed' or o.payout_status in ('failed','cancelled') then 'attention'
          when o.payout_status = 'completed' then 'complete'
          when o.payout_status in ('pending','processing') then 'payout'
          when o.payment_status is null or o.payment_status = 'pending' then 'payment'
          else 'attention'
        end as queue
      from public.rent_applications a
      left join public.payment_orders o on o.application_id = a.id
      left join public.profiles p on p.id = a.user_id and a.applicant_name is null
      left join auth.users u on u.id = a.user_id and a.applicant_email is null
      where query = '' or strpos(lower(concat_ws(' ', a.id, a.application_number,
        coalesce(a.applicant_name, p.full_name), coalesce(a.applicant_email, u.email))), query) > 0
    ), counts as (
      select queue, count(*) as n from matches group by queue
    ), selected as (
      select * from matches where p_queue = 'all' or queue = p_queue
      order by
        case when p_sort = 'priority' then
          case queue when 'attention' then 0 when 'review' then 1 when 'payment' then 2 when 'payout' then 2 else 3 end
        end,
        case when p_sort = 'oldest' then coalesce(submitted_at, created_at)
          when p_sort = 'priority' and queue = 'review' then review_entered_at end asc,
        coalesce(submitted_at, created_at) desc, id
      offset greatest(coalesce(p_page, 0), 0)::bigint * 25 limit 25
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(selected)) from selected), '[]'::jsonb),
      'counts', coalesce((select jsonb_object_agg(queue, n) from counts), '{}'::jsonb)
        || jsonb_build_object('all', coalesce((select sum(n) from counts),0))
    )
  );
end;
$$;
revoke all on function public.admin_application_queue(text,text,text,integer) from public, anon;
grant execute on function public.admin_application_queue(text,text,text,integer) to authenticated;

create table divercity_private.review_email_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rent_applications(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('needs_changes','approved','rejected')),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  attempts integer not null default 0,
  accepted_at timestamptz,
  last_error text check (last_error in ('mail_unavailable', 'recipient_unavailable'))
);
create index review_email_due_idx on divercity_private.review_email_outbox(next_attempt_at)
  where accepted_at is null and attempts < 5;
alter table divercity_private.review_email_outbox enable row level security;

create or replace function divercity_private.enqueue_review_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('needs_changes','approved','rejected')
    and (select email_updates from divercity_private.operating_settings) then
    insert into divercity_private.review_email_outbox(application_id, recipient_id, status)
    values (new.id, new.user_id, new.status);
  end if;
  return new;
end;
$$;
create trigger enqueue_review_email after update of status on public.rent_applications
for each row execute function divercity_private.enqueue_review_email();

create or replace function public.claim_review_emails()
returns table(id uuid, lease_id uuid, email text, application_id uuid, reference text, review_status text)
language sql security definer set search_path = ''
as $$
  with claim as (
    select q.id from divercity_private.review_email_outbox q
    where q.accepted_at is null and q.attempts < 5 and q.next_attempt_at <= now()
      and (select email_updates from divercity_private.operating_settings)
    order by q.next_attempt_at, q.id limit 5 for update skip locked
  ), jobs as (
    update divercity_private.review_email_outbox q
    set lease_id = gen_random_uuid(), attempts = q.attempts + 1, next_attempt_at = now() + interval '5 minutes'
    from claim where q.id = claim.id returning q.*
  )
  select j.id, j.lease_id, case when u.email_confirmed_at is not null then u.email::text end,
    j.application_id, a.application_number, j.status
  from jobs j join auth.users u on u.id = j.recipient_id
    join public.rent_applications a on a.id = j.application_id;
$$;
revoke all on function public.claim_review_emails() from public, anon, authenticated;
grant execute on function public.claim_review_emails() to service_role;

create or replace function public.finish_review_email(p_id uuid, p_lease uuid, p_result text)
returns void language sql security definer set search_path = ''
as $$
  update divercity_private.review_email_outbox
    set accepted_at = case when p_result = 'accepted' then now() end,
      last_error = case when p_result <> 'accepted' then p_result end,
      attempts = case when p_result = 'recipient_unavailable' then 5 else attempts end,
      next_attempt_at = now() + make_interval(mins => 5 * attempts),
      lease_id = null
  where id = p_id and lease_id = p_lease and accepted_at is null
    and p_result in ('accepted','mail_unavailable','recipient_unavailable');
$$;
revoke all on function public.finish_review_email(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finish_review_email(uuid,uuid,text) to service_role;

create table divercity_private.intake_changes (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  intake_open boolean not null,
  changed_at timestamptz not null default now()
);
create or replace function public.set_application_intake(p_open boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501'; end if;
  update divercity_private.operating_settings set intake_open = p_open where intake_open is distinct from p_open;
  if found then
    insert into divercity_private.intake_changes(actor_id, intake_open) values (auth.uid(), p_open);
  end if;
end;
$$;
alter table divercity_private.intake_changes enable row level security;
revoke all on function public.set_application_intake(boolean) from public, anon;
grant execute on function public.set_application_intake(boolean) to authenticated;

create or replace function public.operations_summary()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자 추가 인증이 필요합니다.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'intake_open', public.application_intake_open(),
    'email_enabled', (select email_updates from divercity_private.operating_settings),
    'overdue_review', (select count(*) from public.rent_applications
      where status = 'pending_review' and coalesce(review_entered_at, submitted_at, created_at) < now() - interval '48 hours'),
    'recent_submission_errors', (select count(*) from divercity_private.operation_errors
      where operation = 'submit_application' and hour >= now() - interval '24 hours'),
    'recent_contract_errors', (select count(*) from divercity_private.operation_errors
      where operation = 'contract_link' and hour >= now() - interval '24 hours'),
    'email_waiting', (select count(*) from divercity_private.review_email_outbox where accepted_at is null and attempts < 5),
    'email_failed', (select count(*) from divercity_private.review_email_outbox
      where accepted_at is null and attempts >= 5 and next_attempt_at <= now()),
    'contract_files', (select count(*) from storage.objects where bucket_id = 'contract-documents'),
    'contract_bytes', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects
      where bucket_id = 'contract-documents' and metadata->>'size' ~ '^[0-9]{1,15}$'),
    'last_contract_access', (select coalesce(jsonb_agg(to_jsonb(events)), '[]'::jsonb) from (
      select e.id, e.actor_id, p.full_name, a.application_number, e.action, e.occurred_at
      from divercity_private.admin_access_events e
      left join public.profiles p on p.id = e.actor_id
      left join public.rent_applications a on a.id = e.application_id
      order by e.id desc limit 20
    ) events)
  );
end;
$$;
revoke all on function public.operations_summary() from public, anon;
grant execute on function public.operations_summary() to authenticated;

commit;
