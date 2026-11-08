'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const labels: Record<string, string> = { pending_review: '심사 대기', approved: '심사 승인', rejected: '심사 반려', cancelled: '신청 취소', completed: '처리 완료', payment_pending: '테스트 결제 대기', transfer_pending: '테스트 송금 대기' };

export default function Applications() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => { const { data: session } = await supabase.auth.getSession(); if (!session.session) { window.location.href = '/login'; return; } const { data } = await supabase.from('rent_applications').select('*').eq('user_id', session.session.user.id).order('created_at', { ascending: false }); setRows(data ?? []); })(); }, []);
  return <main className="dashboard-page"><header><div className="wrap nav"><Link href="/dashboard" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link></div></header><section className="dashboard-main wrap"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> 대시보드</Link><div className="dashboard-heading"><div><div className="eyebrow">APPLICATIONS</div><h1>신청 내역</h1><p>내 월세 신청과 처리 상태를 확인하세요.</p></div></div><div className="dashboard-section"><div className="application-list">{rows.length === 0 ? <div className="dashboard-empty">신청 내역이 없습니다.</div> : rows.map(row => <Link href={`/applications/${row.id}`} className="application-row" key={row.id}><div><strong>{money(row.rent_amount)}</strong><span>{new Date(row.created_at).toLocaleDateString('ko-KR')} · 신청번호 {row.application_number || row.id.slice(0, 8).toUpperCase()} · {row.landlord_name || '임대인 정보 미입력'}</span></div><div className="application-status"><span>{labels[row.status] ?? row.status}</span><b><ChevronRight size={16}/></b></div></Link>)}</div></div></section></main>;
}
