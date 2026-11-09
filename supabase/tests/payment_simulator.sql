-- Uses only the existing admin-owned QA fixture; all writes roll back.
begin;
update public.payment_orders set payment_status='pending',payout_status='not_ready'
where application_id='0a60be5d-3a48-46c5-9dce-695c77992800';
set local role authenticated;
set local request.jwt.claim.sub='715b286c-24f5-44cc-8569-593f3ee94bfa';
do $$
declare o public.payment_orders; replay public.payment_orders; request uuid:=gen_random_uuid();
  initial_version integer; history_count bigint; notification_count bigint; action text;
begin
 select * into strict o from public.payment_orders where application_id='0a60be5d-3a48-46c5-9dce-695c77992800';
 initial_version:=o.version;
 select count(*) into history_count from public.payment_order_events where order_id=o.id;
 select count(*) into notification_count from public.notifications where application_id=o.application_id;
 o:=public.simulate_test_payment_order(o.id,'payment_failure',request,o.version);
 replay:=public.simulate_test_payment_order(o.id,'payment_failure',request,initial_version);
 if replay.version<>o.version or o.payment_status<>'failed' then raise exception 'Replay duplicated or failure missing'; end if;
 begin perform public.simulate_test_payment_order(o.id,'payment_success',gen_random_uuid(),initial_version);
  raise exception 'Stale request accepted'; exception when serialization_failure then null; end;
 begin perform public.simulate_test_payment_order(o.id,'payout_success',gen_random_uuid(),o.version);
  raise exception 'Payout before payment accepted'; exception when invalid_parameter_value then null; end;
 foreach action in array array['payment_success','payout_start','payout_failure','payout_retry','payout_cancel','payout_retry','payout_start','payout_success','reset','payment_cancel','reset','payment_success','payment_cancel','reset'] loop
  o:=public.simulate_test_payment_order(o.id,action,gen_random_uuid(),o.version);
  if action='payout_success' and o.payout_status<>'completed' then raise exception 'Payout success missing'; end if;
  if action='payout_failure' and (o.payout_status<>'failed' or o.payment_status<>'paid') then raise exception 'Payout failure changed payment'; end if;
  if action='payout_cancel' and (o.payout_status<>'cancelled' or o.payment_status<>'paid') then raise exception 'Payout cancel refunded'; end if;
  if action='payment_cancel' and o.payout_status<>'cancelled' then raise exception 'Cancel payout missing'; end if;
  if o.payout_status in ('processing','completed') then
   begin perform public.simulate_test_payment_order(o.id,'payment_cancel',gen_random_uuid(),o.version);
    raise exception 'Unsafe cancel accepted'; exception when invalid_parameter_value then null; end;
  end if;
 end loop;
 if o.version<>initial_version+15 or o.payment_status<>'pending' or o.payout_status<>'not_ready' then raise exception 'Version/reset assertion failed'; end if;
 if (select count(*) from public.payment_order_events where order_id=o.id)<>history_count+15 then raise exception 'History not atomic'; end if;
 if (select count(*) from public.notifications where application_id=o.application_id)<>notification_count+15 then raise exception 'Notifications not atomic'; end if;
 if has_function_privilege('anon','public.simulate_test_payment_order(uuid,text,uuid,integer)','EXECUTE') then raise exception 'Anonymous execute permitted'; end if;
 if has_table_privilege('authenticated','public.payment_order_events','INSERT') or has_table_privilege('authenticated','public.payment_orders','UPDATE') then raise exception 'Direct writes permitted'; end if;
 perform set_config('request.jwt.claim.sub','179a648b-e817-40cd-88c9-29a8ce2a3b15',true);
 begin perform public.simulate_test_payment_order(o.id,'payment_success',gen_random_uuid(),o.version);
  raise exception 'Non-admin simulator allowed'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.payment_order_events where order_id=o.id) then raise exception 'Other user history leaked'; end if;
end $$;
rollback;
select 'PASS: 15 transitions, duplicate/stale/invalid requests, audit+notifications, admin-only, RLS; writes rolled back' as result;
