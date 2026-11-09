-- Private resumable drafts. Final submission reuses submit_rent_application.
begin;
create table public.application_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  state text not null default 'editing' check(state in ('editing','submitting','submitted')),
  revision integer not null default 0,
  step integer not null default 0 check(step between 0 and 3),
  payload jsonb not null default '{}'::jsonb,
  contract_file_path text, contract_file_name text,
  contract_file_size integer, contract_file_type text,
  application_number text,
  updated_at timestamptz not null default now()
);
create index application_drafts_contract_idx on public.application_drafts(contract_file_path) where contract_file_path is not null;
alter table public.application_drafts enable row level security;
revoke all on public.application_drafts from anon,authenticated;
grant select on public.application_drafts to authenticated;
create policy "Read own draft" on public.application_drafts for select to authenticated using(user_id=auth.uid());

create or replace function public.open_application_draft(p_new boolean default false)
returns public.application_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.application_drafts%rowtype; number text;
begin
 if auth.uid() is null then raise exception 'Sign in to restore your application.' using errcode='42501'; end if;
 insert into public.application_drafts(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into d from public.application_drafts where user_id=auth.uid() for update;
 select application_number into number from public.rent_applications where id=d.id and user_id=auth.uid();
 if found then
  update public.application_drafts set state='submitted',application_number=number where user_id=auth.uid() returning * into d;
 end if;
 if coalesce(p_new,false) then
  if d.state<>'submitted' then raise exception 'Resume or finish the current draft first.' using errcode='22023'; end if;
  update public.application_drafts set id=gen_random_uuid(),state='editing',revision=0,step=0,payload='{}'::jsonb,
   contract_file_path=null,contract_file_name=null,contract_file_size=null,contract_file_type=null,
   application_number=null,updated_at=now() where user_id=auth.uid() returning * into d;
 end if;
 return d;
end $$;

create or replace function public.save_application_draft(
 p_id uuid,p_revision integer,p_payload jsonb,p_step integer,
 p_file_path text default null,p_file_name text default null,p_prepare boolean default false
) returns public.application_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.application_drafts%rowtype; obj storage.objects%rowtype;
begin
 select * into d from public.application_drafts where user_id=auth.uid() and id=p_id for update;
 if not found then raise exception 'Draft unavailable. Sign in again.' using errcode='42501'; end if;
 if d.state<>'editing' then raise exception 'This draft is being submitted. Check its result first.' using errcode='22023'; end if;
 if p_revision is distinct from d.revision then raise exception 'Your draft changed in another tab. Refresh before continuing.' using errcode='40001'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 or p_step is null or p_step not between 0 and 3 then
  raise exception 'Invalid draft contents.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(p_payload) e where e.key not in ('address','contractStart','contractEnd','rent','landlordName','bank','account') or jsonb_typeof(e.value)<>'string') then
  raise exception 'Unsupported draft fields.' using errcode='22023'; end if;
 if length(coalesce(p_payload->>'address',''))>500 or length(coalesce(p_payload->>'landlordName',''))>120 or length(coalesce(p_payload->>'bank',''))>120 or length(coalesce(p_payload->>'account',''))>60 or length(coalesce(p_payload->>'rent',''))>32 or length(coalesce(p_payload->>'contractStart',''))>10 or length(coalesce(p_payload->>'contractEnd',''))>10 then
  raise exception 'One or more draft fields are too long.' using errcode='22023'; end if;
 if p_file_path is not null then
  if p_file_path !~ ('^'||auth.uid()::text||'/'||d.id::text||'/[0-9a-f]{64}\.(pdf|jpg|png)$') or nullif(btrim(p_file_name),'') is null or length(p_file_name)>255 then
   raise exception 'Invalid draft contract.' using errcode='22023'; end if;
  select * into obj from storage.objects where bucket_id='contract-documents' and name=p_file_path;
  if not found or coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 10485760 or coalesce(obj.metadata->>'mimetype','') not in ('application/pdf','image/jpeg','image/png') then
   raise exception 'The saved contract was not found or is invalid. Choose the file again.' using errcode='22023'; end if;
 elsif coalesce(p_prepare,false) then raise exception 'Save your lease contract before submitting.' using errcode='22023';
 end if;
 update public.application_drafts set payload=p_payload,step=p_step,contract_file_path=p_file_path,contract_file_name=p_file_name,
  contract_file_size=case when p_file_path is null then null else (obj.metadata->>'size')::integer end,
  contract_file_type=case when p_file_path is null then null else obj.metadata->>'mimetype' end,
  revision=revision+1,state=case when coalesce(p_prepare,false) then 'submitting' else 'editing' end,updated_at=now()
 where user_id=auth.uid() returning * into d;
 return d;
end $$;

create or replace function public.submit_application_draft(p_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.application_drafts%rowtype; number text;
begin
 select * into d from public.application_drafts where user_id=auth.uid() and id=p_id for update;
 if not found then raise exception 'Draft unavailable.' using errcode='42501'; end if;
 select application_number into number from public.rent_applications where id=d.id and user_id=auth.uid();
 if not found then
  if d.state<>'submitting' then raise exception 'Review and save the application before submitting.' using errcode='22023'; end if;
  number:=public.submit_rent_application(d.id,d.payload->>'address',nullif(d.payload->>'contractStart','')::date,
   nullif(d.payload->>'contractEnd','')::date,nullif(d.payload->>'rent','')::integer,d.payload->>'landlordName',
   d.payload->>'bank',d.payload->>'account',d.contract_file_path,d.contract_file_name);
 end if;
 update public.application_drafts set state='submitted',application_number=number,updated_at=now() where user_id=auth.uid();
 return number;
end $$;

create or replace function public.edit_application_draft(p_id uuid)
returns public.application_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.application_drafts%rowtype; number text;
begin
 select * into d from public.application_drafts where user_id=auth.uid() and id=p_id for update;
 if not found then raise exception 'Draft unavailable.' using errcode='42501'; end if;
 select application_number into number from public.rent_applications where id=d.id and user_id=auth.uid();
 if found then
  update public.application_drafts set state='submitted',application_number=number where user_id=auth.uid() returning * into d;
 else
  update public.application_drafts set state='editing',revision=revision+1,updated_at=now() where user_id=auth.uid() returning * into d;
 end if;
 return d;
end $$;

revoke all on function public.open_application_draft(boolean) from public,anon;
revoke all on function public.save_application_draft(uuid,integer,jsonb,integer,text,text,boolean) from public,anon;
revoke all on function public.submit_application_draft(uuid) from public,anon;
revoke all on function public.edit_application_draft(uuid) from public,anon;
grant execute on function public.open_application_draft(boolean) to authenticated;
grant execute on function public.save_application_draft(uuid,integer,jsonb,integer,text,text,boolean) to authenticated;
grant execute on function public.submit_application_draft(uuid) to authenticated;
grant execute on function public.edit_application_draft(uuid) to authenticated;

-- Saved contracts are not orphans while the draft still references them.
create or replace function public.can_delete_unlinked_contract(p_path text,p_created_at timestamptz)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and(split_part(p_path,'/',1)=auth.uid()::text or(public.is_admin() and p_created_at<now()-interval '7 days'))
 and not exists(select 1 from public.rent_applications a where a.contract_file_path=p_path)
 and not exists(select 1 from public.application_drafts d where d.contract_file_path=p_path);
$$;
create or replace function public.find_old_orphan_contracts(p_limit integer default 50)
returns table(path text,uploaded_at timestamptz) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 return query select o.name::text,o.created_at from storage.objects o
 where o.bucket_id='contract-documents' and o.created_at<now()-interval '7 days'
 and not exists(select 1 from public.rent_applications a where a.contract_file_path=o.name)
 and not exists(select 1 from public.application_drafts d where d.contract_file_path=o.name)
 order by o.created_at,o.name limit least(greatest(coalesce(p_limit,50),1),50);
end $$;
commit;
