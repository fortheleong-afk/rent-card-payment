'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getJourney, statusText } from '../lib/workflow';
import { JourneyPanel, JourneyProgress, TestNotice } from './WorkflowStatus';
import Link from 'next/link';

type Order = { id:string; version:number; order_number:string; total_amount:number; payment_status:string; payout_status:string };
type OrderEvent = { id:string; action:string; from_payment:string; to_payment:string; from_payout:string; to_payout:string; changed_by:string; created_at:string; version:number };
type Attempt = {action:string; requestId:string; version:number; orderId:string};
const paymentLabels: Record<string,string> = {pending:'결제 대기',paid:'결제 완료',failed:'결제 실패',cancelled:'결제 취소',refunded:'환불 완료'};
const payoutLabels: Record<string,string> = {not_ready:'결제 완료 전',pending:'지급 대기',processing:'지급 처리 중',completed:'지급 완료',failed:'지급 실패',cancelled:'지급 취소'};
const actions: Record<string,string> = {payment_success:'결제 성공',payment_failure:'결제 실패',payment_cancel:'결제 취소',payout_start:'지급 시작',payout_success:'지급 성공',payout_failure:'지급 실패',payout_cancel:'지급 취소',payout_retry:'지급 재시도',reset:'테스트 초기화'};
const fields = 'id,version,order_number,total_amount,payment_status,payout_status';
const messageOf = (e:unknown) => e && typeof e === 'object' && 'message' in e ? String(e.message) : '요청 결과를 확인할 수 없습니다.';
function availableActions(o:Order):string[] {
  const p=o.payment_status, t=o.payout_status;
  const list:string[]=[];
  if(p==='pending'||p==='failed')list.push('payment_success');
  if(p==='pending')list.push('payment_failure');
  if(['pending','failed'].includes(p)||(p==='paid'&&['pending','failed','cancelled'].includes(t)))list.push('payment_cancel');
  if(p==='paid'){
    if(t==='pending')list.push('payout_start');
    if(t==='processing')list.push('payout_success','payout_failure');
    if(['pending','failed'].includes(t))list.push('payout_cancel');
    if(['failed','cancelled'].includes(t))list.push('payout_retry');
  }
  return list;
}

export default function PaymentOrder({applicationId, approved, applicationStatus, simulator=false, onOrderChange}: {applicationId:string; approved:boolean; applicationStatus?:string; simulator?:boolean; onOrderChange?:()=>void}) {
  const locale=simulator?'ko':'en';
  const [order,setOrder]=useState<Order|null>(null);
  const [events,setEvents]=useState<OrderEvent[]>([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [historyError,setHistoryError]=useState('');
  const [notice,setNotice]=useState('');
  const [resetConfirm,setResetConfirm]=useState(false);
  const [retry,setRetry]=useState<Attempt|null>(null);
  const running=useRef(false);
  const alive=useRef(true);
  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('payment_orders').select(fields).eq('application_id',applicationId).maybeSingle();
    if(error)throw error;
    if(!alive.current)return;
    setOrder(data);
    if(data){
      const result=await supabase.from('payment_order_events').select('id,action,from_payment,to_payment,from_payout,to_payout,changed_by,created_at,version').eq('order_id',data.id).order('version',{ascending:false}).limit(50);
      if(!alive.current)return;
      setEvents(result.data??[]);setHistoryError(result.error?'상태 변경 이력을 불러오지 못했습니다.':'');
    }else{setEvents([]);setHistoryError('');}
  },[applicationId]);
  useEffect(()=>{
    alive.current=true;
    setOrder(null);setEvents([]);setError('');setBusy(true);
    load().catch(e=>{if(alive.current)setError(messageOf(e));}).finally(()=>{if(alive.current)setBusy(false);});
    return ()=>{alive.current=false;};
  },[load]);
  const create=async()=>{
    if(running.current)return;running.current=true;setBusy(true);setError('');
    try{
      const {data,error}=await supabase.rpc('create_test_payment_order',{p_application_id:applicationId});
      if(error)throw error;if(!data)throw new Error('주문을 확인할 수 없습니다.');
      await load(); onOrderChange?.();
    }catch(e){setError(messageOf(e));}finally{running.current=false;setBusy(false);}
  };
  const simulate=async(action:string, previous?:Attempt)=>{
    if(!order||running.current)return;
    const attempt=previous??{action,requestId:crypto.randomUUID(),version:order.version,orderId:order.id};
    running.current=true;setBusy(true);setError('');setNotice('');
    try{
      const {data,error}=await supabase.rpc('simulate_test_payment_order',{p_order_id:attempt.orderId,p_action:attempt.action,p_request_id:attempt.requestId,p_expected_version:attempt.version});
      if(error){
        if(['22023','42501','40001'].includes(error.code)){setRetry(null);await load();}
        else setRetry(attempt);
        throw error;
      }
      if(!data){setRetry(attempt);throw new Error('결과를 확인할 수 없습니다. 동일 요청으로 다시 확인해주세요.');}
      setOrder(data as Order);setRetry(null);setResetConfirm(false);setNotice(`${actions[action]} 테스트를 처리했습니다. 실제 결제·송금은 없습니다.`);
      await load(); onOrderChange?.();
    }catch(e){
      const code=e&&typeof e==='object'&&'code' in e?String(e.code):'';
      if(!['22023','42501','40001'].includes(code))setRetry(attempt);
      setError(messageOf(e));
    }finally{running.current=false;setBusy(false);}
  };
  const journey=getJourney(applicationStatus??(approved?'approved':'pending_review'),order,locale);
  const buttons=order?availableActions(order):[];
  return <section className="work-order" aria-label={simulator?'테스트 결제 주문':'Payment and payout'}>
    <TestNotice locale={locale}/>
    {busy&&!order ? <div className="work-loading" role="status">{simulator?'처리 상태를 확인하고 있습니다…':'Checking your current status…'}</div> : <>
      {!error||order ? <JourneyPanel journey={journey} locale={locale}>
        {!order&&approved&&!error&&<button type="button" className="work-button work-button-primary" onClick={create} disabled={busy}>{simulator?'테스트 주문 생성':'Create test order'}</button>}
        {!simulator&&['payment_failed','payout_attention'].includes(journey.key)&&<Link className="work-button" href="/contact">Contact support</Link>}
      </JourneyPanel> : null}
      {!['closed','rejected','cancelled','legacy'].includes(journey.key)&&(order||!simulator&&['review','ready'].includes(journey.key))&&<JourneyProgress journey={journey} locale={locale}/>}
    </>}
    {error&&<div className="work-error" role="alert"><strong>{simulator?'요청을 완료하지 못했습니다':'We could not finish that request'}</strong><p>{error}</p>{!retry&&<button type="button" className="work-button" disabled={busy} onClick={()=>{setBusy(true);setError('');load().catch(e=>setError(messageOf(e))).finally(()=>setBusy(false));}}>{simulator?'최신 상태 다시 확인':'Refresh status'}</button>}</div>}
    {busy&&order&&<p className="work-feedback" role="status">{simulator?'처리 결과를 확인 중입니다…':'Checking the result…'}</p>}
    {notice&&<p className="work-feedback" role="status">{notice}</p>}
    {order&&<>
      <div className="work-order-facts"><div><span>{simulator?'주문번호':'Order reference'}</span><strong>{order.order_number}</strong></div><div><span>{simulator?'테스트 금액':'Test amount'}</span><strong>₩{Number(order.total_amount).toLocaleString('ko-KR')}</strong><small>{simulator?'테스트 이용료 0원 · 실제 이용료 미정':'Test fee ₩0 · Live pricing to be confirmed'}</small></div></div>
      <dl className="work-state-pair"><div><dt>{simulator?'결제 상태':'Payment status'}</dt><dd>{statusText(order.payment_status,'payment',locale)}</dd></div><div><dt>{simulator?'임대인 지급 상태':'Landlord payout status'}</dt><dd>{statusText(order.payout_status,'payout',locale)}</dd></div></dl>
      {simulator&&approved&&<details className="work-disclosure work-simulator">
        <summary><span>테스트 시뮬레이터</span><small>관리자 전용 · 가상 상태 변경</small></summary>
        <div className="work-disclosure-body"><p>현재 상태에서 가능한 테스트만 표시합니다. 지급 취소는 결제를 환불하지 않습니다. 지급 처리 중·완료 후에는 결제 취소가 차단됩니다.</p>
        {retry ? <button type="button" className="work-button work-button-primary" disabled={busy} onClick={()=>simulate(retry.action,retry)}>동일 요청 재확인</button> : <div className="work-sim-buttons">{buttons.map((action,i)=><button type="button" className={`work-button ${i===0?'work-button-primary':''}`} key={action} disabled={busy} onClick={()=>simulate(action)}>{actions[action]} 테스트</button>)}</div>}
        {!retry&&(order.payment_status!=='pending'||order.payout_status!=='not_ready')&&(!resetConfirm ? <button type="button" className="work-text-button" disabled={busy} onClick={()=>setResetConfirm(true)}>테스트를 처음부터 다시 시작</button> : <div className="work-reset"><p>결제 대기로 되돌립니다. 이전 이력과 알림은 보존됩니다.</p><button type="button" className="work-button" disabled={busy} onClick={()=>simulate('reset')}>초기화 확인</button> <button type="button" className="work-text-button" disabled={busy} onClick={()=>setResetConfirm(false)}>닫기</button></div>)}
        </div>
      </details>}
      <details className="work-disclosure"><summary><span>{simulator?'결제·지급 이력':'Payment & payout history'}</span><small>{simulator?'최근 50건까지': 'Up to 50 recent events'} · {events.length}</small></summary><div className="work-disclosure-body">
        {historyError&&<p role="alert">{simulator?historyError:'Could not load the history. Refresh the page to try again.'}</p>}
        {!historyError&&events.length===0&&<p>{simulator?'아직 상태 변경 이력이 없습니다.':'No payment or payout events yet.'}</p>}
        <ol className="work-timeline">{events.map(e=><li key={e.id}><time>{new Date(e.created_at).toLocaleString(simulator?'ko-KR':'en-GB')} · #{e.version}</time><strong>{simulator?actions[e.action]||e.action:({payment_success:'Test payment succeeded',payment_failure:'Test payment failed',payment_cancel:'Test payment cancelled',payout_start:'Test payout started',payout_success:'Test payout completed',payout_failure:'Test payout failed',payout_cancel:'Test payout cancelled',payout_retry:'Test payout retry prepared',reset:'Test reset'} as Record<string,string>)[e.action]||e.action}</strong><p>{statusText(e.from_payment,'payment',locale)} → {statusText(e.to_payment,'payment',locale)}<br/>{statusText(e.from_payout,'payout',locale)} → {statusText(e.to_payout,'payout',locale)}</p>{simulator&&<small>처리자 ID: {e.changed_by}</small>}</li>)}</ol>
      </div></details>
    </>}
  </section>;
}
