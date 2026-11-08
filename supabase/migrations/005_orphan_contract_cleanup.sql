-- On-demand, bounded cleanup. No cron or background Storage listing.
-- A submitted contract remains protected, including after cancellation.
create index if not exists rent_applications_contract_file_path_idx
  on public.rent_applications (contract_file_path)
  where contract_file_path is not null;

create or replace function public.can_delete_unlinked_contract(p_path text, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and (split_part(p_path, '/', 1) = auth.uid()::text
      or (public.is_admin() and p_created_at < now() - interval '7 days'))
    and not exists (
      select 1 from public.rent_applications a
      where a.contract_file_path = p_path
    );
$$;

revoke all on function public.can_delete_unlinked_contract(text,timestamptz) from public, anon;
grant execute on function public.can_delete_unlinked_contract(text,timestamptz) to authenticated;

drop policy if exists "Users can delete own contracts" on storage.objects;
drop policy if exists "Delete unlinked contracts" on storage.objects;
create policy "Delete unlinked contracts" on storage.objects
for delete to authenticated
using (
  bucket_id = 'contract-documents'
  and public.can_delete_unlinked_contract(name, created_at)
);

create or replace function public.find_old_orphan_contracts(p_limit integer default 50)
returns table(path text, uploaded_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return query
    select o.name::text, o.created_at
    from storage.objects o
    where o.bucket_id = 'contract-documents'
      and o.created_at < now() - interval '7 days'
      and not exists (
        select 1 from public.rent_applications a
        where a.contract_file_path = o.name
      )
    order by o.created_at, o.name
    limit least(greatest(coalesce(p_limit, 50), 1), 50);
end;
$$;

revoke all on function public.find_old_orphan_contracts(integer) from public, anon;
grant execute on function public.find_old_orphan_contracts(integer) to authenticated;
