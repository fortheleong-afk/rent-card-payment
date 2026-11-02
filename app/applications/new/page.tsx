'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const makeNumber = () => `DP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export default function NewApplication() {
  const [userId, setUserId] = useState('');
  const [rent, setRent] = useState(750000);
  const [landlordName, setLandlordName] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [address, setAddress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState('');
  const fee = Math.round(rent * 0.029);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (!data.session) window.location.href = '/login'; else setUserId(data.session.user.id); }); }, []);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected && (!['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) { setMessage('PDF, JPG, PNG 파일만 가능하며 최대 10MB까지 업로드할 수 있습니다.'); return; }
    setMessage(''); setFile(selected);
  };

  const fail = (text: string) => { setLoading(false); setMessage(text); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !landlordName || !bank || !account || !address) { setMessage('계약서, 주소, 임대인 계좌정보를 모두 입력해주세요.'); return; }
    setLoading(true); setMessage('');
    const { data: profile } = await supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle();
    if (!profile?.phone) { setLoading(false); setMessage('신청 전에 프로필에서 전화번호를 입력해주세요.'); return; }
    const applicationNumber = makeNumber();
    const { data: sessionData } = await supabase.auth.getSession();
    const applicantEmail = sessionData.session?.user.email ?? null;
    const { data: profileData } = await supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle();
    const { data: application, error: insertError } = await supabase.from('rent_applications').insert({ user_id: userId, application_number: applicationNumber, applicant_name: profileData?.full_name ?? null, applicant_email: applicantEmail, applicant_phone: profileData?.phone ?? null, rent_amount: rent, service_fee: fee, total_amount: rent + fee, landlord_name: landlordName, landlord_bank: bank, landlord_account: account, property_address: address, status: 'pending_review', submitted_at: new Date().toISOString() }).select('id').single();
    if (insertError || !application) { setLoading(false); setMessage('신청 저장에 실패했습니다. 관리자에게 문의해주세요.'); return; }
    const path = `${userId}/${application.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('contract-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { await supabase.from('rent_applications').delete().eq('id', application.id); fail(`계약서 업로드에 실패했습니다: ${uploadError.message}`); return; }
    const { error: updateError } = await supabase.from('rent_applications').update({ contract_file_path: path, contract_file_name: file.name, contract_file_size: file.size }).eq('id', application.id).eq('user_id', userId);
    if (updateError) { await supabase.storage.from('contract-documents').remove([path]); await supabase.from('rent_applications').delete().eq('id', application.id); fail(`신청 파일 정보 저장에 실패했습니다: ${updateError.message}`); return; }
    const { error: historyError } = await supabase.from('application_status_history').insert({ application_id: application.id, to_status: 'pending_review', changed_by: userId, reason: '신청 접수' });
    if (historyError) { fail(`신청 이력 저장에 실패했습니다: ${historyError.message}`); return; }
    const { error: notificationError } = await supabase.from('notifications').insert({ user_id: userId, application_id: application.id, title: '월세 신청이 접수되었습니다', message: `${applicationNumber} 신청을 접수했습니다.`, type: 'application' });
    if (notificationError) { fail(`신청은 저장됐지만 알림 저장에 실패했습니다: ${notificationError.message}`); return; }
    setLoading(false); setComplete(applicationNumber);
  };

  if (complete) return <main className="dashboard-page"><section className="dashboard-main wrap"><div className="dashboard-empty"><div className="success-icon"><Check size={30}/></div><strong>월세 신청이 접수되었습니다.</strong><span>신청번호 {complete}</span><span>심사 후 상태가 업데이트됩니다.</span><Link href="/dashboard" className="primary">대시보드로 이동</Link></div></section></main>;
  return <main className="dashboard-page"><header><div className="wrap nav"><Link href="/dashboard" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link></div></header><section className="dashboard-main wrap"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> 대시보드</Link><div className="dashboard-heading"><div><div className="eyebrow">NEW APPLICATION</div><h1>월세 신청</h1><p>모든 거래는 금융사 계약 전까지 테스트로 처리됩니다.</p></div></div><div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>안전한 테스트 서비스</strong><span>계약서는 비공개 Storage에 저장되며 본인과 관리자만 확인할 수 있습니다.</span></div></div><form className="application-form detail-card" onSubmit={submit}><label>임대차계약서<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile}/><small>{file ? `${file.name} (${Math.round(file.size / 1024)}KB)` : 'PDF, JPG, PNG · 최대 10MB'}</small></label><label>주소<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="임대차계약서의 주소"/></label><label>월세 금액<input type="number" value={rent} onChange={e=>setRent(Number(e.target.value))}/></label><div className="form-summary"><span>서비스 이용료 (2.9%)</span><b>{money(fee)}</b><span>테스트 결제 금액</span><b>{money(rent + fee)}</b></div><label>임대인 이름<input value={landlordName} onChange={e=>setLandlordName(e.target.value)} placeholder="예: 홍길동"/></label><label>은행명<select value={bank} onChange={e=>setBank(e.target.value)}><option value="">은행을 선택해주세요</option><option>국민은행</option><option>신한은행</option><option>우리은행</option><option>카카오뱅크</option></select></label><label>계좌번호<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="숫자만 입력해주세요"/></label>{message&&<p className="auth-message">{message}</p>}<button className="primary full" disabled={loading}>{loading ? '신청 저장 중...' : '테스트 신청 접수'}</button></form></section></main>;
}
