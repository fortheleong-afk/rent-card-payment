'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Order = { order_number: string; total_amount: number; rent_amount: number; service_fee: number; payment_status: string; payout_status: string };
const paymentLabels: Record<string,string> = {pending:'결제 대기',paid:'결제 완료',failed:'결제 실패',cancelled:'결제 취소',refunded:'환불 완료'};
const payoutLabels: Record<string,string> = {not_ready:'결제 완료 전',pending:'지급 대기',processing:'지급 처리 중',completed:'지급 완료',failed:'지급 실패',cancelled:'지급 취소'};

export default function PaymentOrder({applicationId, approved}: {applicationId:string; approved:boolean}) {
  const [order,setOrder] = useState<Order|null>(null);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  useEffect(()=>{
    let active=true;
    setOrder(null); setError(''); setBusy(true);
    supabase.from('payment_orders').select('order_number,total_amount,rent_amount,service_fee,payment_status,payout_status').eq('application_id',applicationId).maybeSingle().then(({data,error})=>{
      if(!active)return;
      setOrder(data); setError(error ? '결제 주문을 불러올 수 없습니다. 데이터베이스 설정을 확인해주세요.' : ''); setBusy(false);
    });
    return ()=>{active=false;};
  },[applicationId]);
  const create=async()=>{
    setBusy(true); setError('');
    try {
      const {data,error}=await supabase.rpc('create_test_payment_order',{p_application_id:applicationId});
      if(error)throw error;
      if(!data)throw new Error('주문 생성 결과를 확인할 수 없습니다.');
      setOrder(data as Order);
    } catch(e) {setError(e instanceof Error ? e.message : '주문을 만들 수 없습니다. 다시 시도해주세요.');}
    finally {setBusy(false);}
  };
  return <section className="detail-history" aria-label="테스트 결제 주문">
    <h2>결제·지급 진행 상태</h2>
    <p>테스트 모드 · 실제 결제와 송금은 실행되지 않습니다.</p>
    {busy&&<p role="status">주문 확인 중…</p>}
    {error&&<p role="alert">{error}</p>}
    {order ? <dl>
      <dt>주문번호</dt><dd style={{overflowWrap:'anywhere'}}>{order.order_number}</dd>
      <dt>결제 예정 금액</dt><dd>₩{Number(order.total_amount).toLocaleString('ko-KR')} (테스트 이용료 ₩0 · 실제 요금 미정)</dd>
      <dt>결제 상태</dt><dd>{paymentLabels[order.payment_status] || order.payment_status}</dd>
      <dt>임대인 지급 상태</dt><dd>{payoutLabels[order.payout_status] || order.payout_status}</dd>
    </dl> : !busy&&!error&&(approved ? <button type="button" className="secondary" onClick={create}>테스트 결제 주문 생성</button> : <p>심사 승인 후 결제 주문을 생성할 수 있습니다.</p>)}
  </section>;
}
