-- Admins may review application history; users retain access only to their own.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'application_status_history'
      and policyname = 'Admins can view status history'
  ) then
    create policy "Admins can view status history"
      on public.application_status_history for select to authenticated
      using (public.is_admin());
  end if;
end $$;
