'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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

export default function PaymentOrder({applicationId, approved, simulator=false}: {applicationId:string; approved:boolean; simulator?:boolean}) {
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
      await load();
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
      await load();
    }catch(e){
      const code=e&&typeof e==='object'&&'code' in e?String(e.code):'';
      if(!['22023','42501','40001'].includes(code))setRetry(attempt);
      setError(messageOf(e));
    }finally{running.current=false;setBusy(false);}
  };
  return <section className="detail-history" aria-label="테스트 결제 주문">
    <h2>결제·지급 진행 상태</h2>
    <p>테스트 모드 · 실제 결제와 송금은 실행되지 않습니다.</p>
    {busy&&<p role="status">확인 중…</p>}
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {order ? <>
      <dl><dt>주문번호</dt><dd style={{overflowWrap:'anywhere'}}>{order.order_number}</dd>
      <dt>결제 예정 금액</dt><dd>₩{Number(order.total_amount).toLocaleString('ko-KR')} (테스트 이용료 ₩0 · 실제 요금 미정)</dd>
      <dt>결제 상태</dt><dd>{paymentLabels[order.payment_status]||order.payment_status}</dd>
      <dt>임대인 지급 상태</dt><dd>{payoutLabels[order.payout_status]||order.payout_status}</dd></dl>
      {simulator&&approved&&<div aria-label="관리자 테스트 시뮬레이터">
        <h3>관리자 테스트 시뮬레이터</h3>
        <p>결제 성공 후 지급을 시작할 수 있습니다. 지급 취소는 결제를 환불하지 않습니다. 지급 처리 중·완료 후에는 결제 취소가 차단됩니다.</p>
        {retry ? <button type="button" className="secondary" disabled={busy} onClick={()=>simulate(retry.action,retry)}>동일 요청 재확인</button> : <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{availableActions(order).map(action=><button type="button" className="secondary" key={action} disabled={busy} onClick={()=>simulate(action)}>{actions[action]} 테스트</button>)}</div>}
        {!retry&&(order.payment_status!=='pending'||order.payout_status!=='not_ready')&&(!resetConfirm ? <button type="button" className="secondary" disabled={busy} onClick={()=>setResetConfirm(true)}>다시 테스트하기</button> : <div><p>결제 대기 상태로 되돌립니다. 이전 이력과 알림은 보존됩니다.</p><button type="button" className="secondary" disabled={busy} onClick={()=>simulate('reset')}>초기화 확인</button> <button type="button" className="secondary" disabled={busy} onClick={()=>setResetConfirm(false)}>닫기</button></div>)}
      </div>}
      <h3>결제·지급 테스트 이력 (최근 50건)</h3>
      {historyError&&<p role="alert">{historyError}</p>}
      {!historyError&&events.length===0&&<p>아직 테스트 상태 변경 이력이 없습니다.</p>}
      {events.map(e=><div className="history-item" key={e.id}><span>{new Date(e.created_at).toLocaleString('ko-KR')} · #{e.version}</span><b>{actions[e.action]||e.action}</b><small>결제: {paymentLabels[e.from_payment]} → {paymentLabels[e.to_payment]} / 지급: {payoutLabels[e.from_payout]} → {payoutLabels[e.to_payout]}</small>{simulator&&<small>처리자 ID: {e.changed_by}</small>}</div>)}
    </> : !busy&&!error&&(approved ? <button type="button" className="secondary" onClick={create}>테스트 결제 주문 생성</button> : <p>심사 승인 후 결제 주문을 생성할 수 있습니다.</p>)}
  </section>;
}
