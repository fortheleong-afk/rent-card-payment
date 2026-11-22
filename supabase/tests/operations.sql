-- Disposable local database. Uses synthetic, isolated principals. No provider calls.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001','tenant@fixture.invalid',now(),'{"full_name":"Tenant Test","phone":"+12025550101"}'),
  ('10000000-0000-0000-0000-000000000002','other@fixture.invalid',now(),'{"full_name":"Other Test","phone":"+12025550102"}'),
  ('10000000-0000-0000-0000-000000000003','ops@fixture.invalid',now(),'{"full_name":"Operator Test","phone":"+12025550103"}');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"aal":"aal2","session_id":"qa-admin"}',true);
-- The existing profile trigger requires an authorized principal to assign a role.
alter table public.profiles disable trigger protect_profile_privileges;
update public.profiles set role='admin' where id=auth.uid();
alter table public.profiles enable trigger protect_profile_privileges;
update divercity_private.operating_settings set email_updates=true;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"qa-tenant"}',true);
set local role authenticated;
select public.accept_site_terms('2026-11-09');
select set_config('qa.draft',(public.open_application_draft(false)).id::text,true);
select set_config('qa.path',auth.uid()::text||'/'||current_setting('qa.draft')||'/'||repeat('a',64)||'.png',true);
insert into storage.objects(bucket_id,name,metadata)
  values('contract-documents',current_setting('qa.path'),'{"size":128,"mimetype":"image/png"}');
select public.save_draft_with_schedule(current_setting('qa.draft')::uuid,0,
  '{"address":"QA building 1","contractStart":"2026-11-01","contractEnd":"2027-10-31","rent":"750000","landlordName":"QA Landlord","bank":"신한은행","account":"0000001234"}',
  3,current_setting('qa.path'),'qa.png',true,'2026-12-01','2026-12-05');
select public.submit_application_draft(current_setting('qa.draft')::uuid);
do $$
declare row_id uuid:=current_setting('qa.draft')::uuid;
begin
  if (select landlord_account_last4 from public.rent_applications where id=row_id) is distinct from '1234' then
    raise exception 'Masked account missing';
  end if;
  begin
    perform landlord_account from public.rent_applications where id=row_id;
    raise exception 'Full account accessible';
  exception when insufficient_privilege then null;
  end;
  if (public.open_application_draft(false)).payload <> '{}'::jsonb then
    raise exception 'Submitted draft retained entered data';
  end if;
  if (public.submit_application_draft(row_id)) is distinct from
    (select application_number from public.rent_applications where id=row_id) then raise exception 'Receipt retry differs'; end if;
  if exists (select 1 from public.payment_orders where application_id=row_id) then raise exception 'Unexpected payment order'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
begin
  if exists (select 1 from storage.objects where name=current_setting('qa.path')) then raise exception 'Cross-tenant file access'; end if;
  if exists (select 1 from public.rent_applications where id=current_setting('qa.draft')::uuid) then raise exception 'Cross-tenant row access'; end if;
  begin
    perform public.admin_application_detail(current_setting('qa.draft')::uuid);
    raise exception 'Non-admin detail RPC access';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"qa-admin"}',true);
do $$
begin
  if public.is_admin() then raise exception 'MFA was bypassed'; end if;
  begin
    perform public.review_application(current_setting('qa.draft')::uuid,'approved','',0);
    raise exception 'AAL1 approval accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claims','{"aal":"aal2","session_id":"qa-admin"}',true);
do $$
declare row_id uuid:=current_setting('qa.draft')::uuid; details jsonb;
begin
  if not public.is_admin() then raise exception 'MFA admin not recognized'; end if;
  if exists (select 1 from storage.objects where name=current_setting('qa.path')) then
    raise exception 'Admin read file without recorded access';
  end if;
  details:=public.admin_application_detail(row_id);
  if details ? 'landlord_account' or (details->>'landlord_account_last4') <> '1234' then
    raise exception 'Admin projection wrong';
  end if;
  perform public.authorize_application_access(row_id,'preview');
  if not exists (select 1 from storage.objects where name=current_setting('qa.path')) then
    raise exception 'Recorded access did not unlock file';
  end if;
  if (public.admin_application_queue('fixture.invalid','review','priority',0)->'counts'->>'review')::int <> 1 then
    raise exception 'Queue lookup failed';
  end if;
  if not public.review_application(row_id,'needs_changes','Replace the document.',0) then raise exception 'Correction request missing'; end if;
  if public.review_application(row_id,'approved','',0) then raise exception 'Approval accepted outside review'; end if;
  perform public.set_application_intake(false);
  if public.application_intake_open() then raise exception 'Pause failed'; end if;
  perform public.set_application_intake(true);
end;
$$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"qa-tenant"}',true);
do $$
declare row_id uuid:=current_setting('qa.draft')::uuid; d public.application_drafts;
begin
  if not public.resubmit_application(row_id,0,'QA building 1','2026-11-01','2027-10-31',750000,'2026-12-01','2026-12-05',
    'QA Landlord','신한은행','',null,null) then raise exception 'Resubmission failed'; end if;
  if (select status from public.rent_applications where id=row_id) <> 'pending_review'
    or (select revision from public.rent_applications where id=row_id) <> 1 then raise exception 'Revision or status missing'; end if;
  d:=public.open_application_draft(true);
  perform public.discard_application_draft(d.id,d.revision);
  if exists(select 1 from public.application_drafts where id=d.id) then raise exception 'Discard failed'; end if;
  if (select count(*) from public.application_status_history where application_id=row_id) <> 3 then raise exception 'History incomplete'; end if;
  if (select count(*) from public.notifications where application_id=row_id) <> 3 then raise exception 'Notifications incomplete'; end if;
end;
$$;
do $$
declare d public.application_drafts; path text;
begin
  d:=public.open_application_draft(false);
  path:=auth.uid()::text||'/'||d.id::text||'/'||repeat('b',64)||'.png';
  insert into storage.objects(bucket_id,name,metadata)
  values ('contract-documents',path,'{"size":128,"mimetype":"image/png"}');
  d:=public.save_draft_with_schedule(d.id,d.revision,
    '{"address":" qa BUILDING 1 ","contractStart":"2026-11-01","contractEnd":"2027-10-31","rent":"750000","landlordName":"QA Landlord","bank":"신한은행","account":"0000001234"}',
    3,path,'qa-duplicate.png',true,'2026-12-01','2026-12-05');
  begin
    perform public.submit_application_draft(d.id);
    raise exception 'Duplicate rent period was accepted';
  exception when invalid_parameter_value then
    if sqlerrm not like 'An application for this property and rent month%' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"aal":"aal2","session_id":"qa-admin"}',true);
do $$
begin
  if public.review_application(current_setting('qa.draft')::uuid,'approved','',0) then raise exception 'Old review revision accepted'; end if;
  if not public.review_application(current_setting('qa.draft')::uuid,'approved','',1) then raise exception 'Approval failed'; end if;
end;
$$;
set local role service_role;
do $$
declare job record;
begin
  select * into job from public.claim_review_emails() where review_status='approved';
  if job.email is distinct from 'tenant@fixture.invalid' then raise exception 'Review mail was not queued'; end if;
  perform public.finish_review_email(job.id,job.lease_id,'accepted');
  if exists(select 1 from public.claim_review_emails() where id=job.id) then raise exception 'Mail already accepted was retried'; end if;
end;
$$;
rollback;
