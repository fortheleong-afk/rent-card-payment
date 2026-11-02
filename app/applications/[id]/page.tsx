'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const labels: Record<string, string> = { pending_review: '심사 대기', approved: '심사 승인', rejected: '심사 반려', cancelled: '신청 취소', completed: '처리 완료', payment_pending: '테스트 결제 대기', payment_completed: '테스트 결제 완료', transfer_pending: '테스트 송금 대기', transfer_completed: '테스트 송금 완료' };

export default function ApplicationDetail({ params }: { params: { id: string } }) {
  const [row, setRow] = useState<any>(null); const [message, setMessage] = useState(''); const [cancelling, setCancelling] = useState(false);
  useEffect(() => { (async () => { const { data: session } = await supabase.auth.getSession(); if (!session.session) { window.location.href = '/login'; return; } const { data } = await supabase.from('rent_applications').select('*').eq('id', params.id).eq('user_id', session.session.user.id).single(); setRow(data); })(); }, [params.id]);
  const cancel = async () => { if (!row || row.status !== 'pending_review') return; setCancelling(true); const { data, error } = await supabase.rpc('cancel_rent_application', { p_application_id: row.id }); if (error || !data) setMessage('신청 취소에 실패했습니다.'); else setRow({ ...row, status: 'cancelled' }); setCancelling(false); };
  if (!row) return <main className="dashboard-page"><section className="dashboard-main wrap"><div className="dashboard-empty">신청 정보를 불러오는 중...</div></section></main>;
  return <main className="dashboard-page"><header><div className="wrap nav"><Link href="/dashboard" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link></div></header><section className="dashboard-main wrap"><Link href="/applications" className="back-link"><ArrowLeft size={15}/> 신청 내역</Link><div className="dashboard-heading"><div><div className="eyebrow">APPLICATION DETAIL</div><h1>월세 신청 상세</h1><p>신청번호 {row.application_number || row.id.slice(0, 8).toUpperCase()}</p></div><span className="detail-status">{labels[row.status] ?? row.status}</span></div><div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>테스트 모드</strong><span>실제 카드 결제와 계좌 송금은 실행되지 않습니다.</span></div></div><div className="detail-card"><div><span>월세</span><b>{money(row.rent_amount)}</b></div><div><span>서비스 이용료</span><b>{money(row.service_fee)}</b></div><div className="detail-total"><span>총 결제 금액</span><b>{money(row.total_amount)}</b></div><div><span>임대인</span><b>{row.landlord_name || '-'}</b></div><div><span>입금 계좌</span><b>{row.landlord_bank || '-'} · {row.landlord_account ? `••••${row.landlord_account.slice(-4)}` : '-'}</b></div>{row.rejection_reason&&<div><span>반려 사유</span><b>{row.rejection_reason}</b></div>}{message&&<p className="auth-message">{message}</p>}{row.status === 'pending_review'&&<button className="secondary" onClick={cancel} disabled={cancelling}><XCircle size={15}/> {cancelling ? '취소 중...' : '신청 취소'}</button>}</div></section></main>;
}
