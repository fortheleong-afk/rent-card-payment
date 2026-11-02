'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, FileText, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Application = {
  id: string;
  rent_amount: number;
  service_fee: number;
  total_amount: number;
  status: string;
  created_at: string;
};

const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const statusLabel: Record<string, string> = {
  pending_review: '심사 대기', approved: '심사 승인', rejected: '심사 반려',
  payment_pending: '테스트 결제 대기', payment_completed: '테스트 결제 완료',
  transfer_pending: '테스트 송금 대기', transfer_completed: '테스트 송금 완료', completed: '처리 완료',
};

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) { window.location.href = '/login'; return; }
      setEmail(user.email ?? '');
      const { data, error: queryError } = await supabase.from('rent_applications').select('id,rent_amount,service_fee,total_amount,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      if (queryError) setError('신청 내역을 불러오지 못했습니다.');
      setApplications(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  return <main className="dashboard-page">
    <div className="test-banner"><span className="pulse" />현재 테스트 모드예요 · 실제 결제와 송금은 실행되지 않습니다</div>
    <header><div className="wrap nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><div className="dashboard-actions"><span>{email}</span><button onClick={logout}><LogOut size={14}/> 로그아웃</button></div></div></header>
    <section className="dashboard-main wrap">
      <div className="dashboard-heading"><div><div className="eyebrow">MY DASHBOARD</div><h1>안녕하세요, 반가워요</h1><p>월세 신청 현황을 한눈에 확인하세요.</p></div><Link href="/applications/new" className="primary"><Plus size={17}/> 월세 신청하기</Link></div>
      <div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>안전한 테스트 서비스</strong><span>금융사 계약 전까지 실제 카드 승인과 계좌 송금은 발생하지 않습니다.</span></div></div>
      <div className="dashboard-grid"><div className="dashboard-card"><span>전체 신청</span><strong>{applications.length}건</strong><small>내 월세 신청</small></div><div className="dashboard-card"><span>최근 상태</span><strong>{applications[0] ? statusLabel[applications[0].status] ?? applications[0].status : '신청 전'}</strong><small>가장 최근 신청</small></div><div className="dashboard-card"><span>최근 총액</span><strong>{applications[0] ? money(applications[0].total_amount) : '₩0'}</strong><small>월세 + 서비스 이용료</small></div></div>
      <div className="dashboard-section"><div className="dashboard-section-title"><h2>최근 신청 내역</h2><Link href="/applications">전체 보기 <ArrowRight size={14}/></Link></div>
        {loading ? <div className="dashboard-empty">신청 내역을 불러오는 중...</div> : error ? <div className="dashboard-empty">{error}</div> : applications.length === 0 ? <div className="dashboard-empty"><FileText size={30}/><strong>아직 신청 내역이 없습니다.</strong><span>첫 월세 신청을 시작해보세요.</span><Link href="/applications/new" className="secondary">월세 신청하기</Link></div> : <div className="application-list">{applications.slice(0, 5).map(application => <Link href={`/applications/${application.id}`} className="application-row" key={application.id}><div><strong>{money(application.rent_amount)}</strong><span>{new Date(application.created_at).toLocaleDateString('ko-KR')} · 신청번호 {application.id.slice(0, 8).toUpperCase()}</span></div><div className="application-status"><span>{statusLabel[application.status] ?? application.status}</span><b>{money(application.total_amount)}</b></div></Link>)}</div>}
      </div>
      <p className="dashboard-foot"><Clock3 size={13}/> 심사 및 상태 변경은 테스트 운영자가 확인 후 반영합니다.</p>
    </section>
  </main>;
}
