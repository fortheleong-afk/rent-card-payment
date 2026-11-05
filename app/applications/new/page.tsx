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
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState('');
  const fee = 0; // Storage placeholder for the test flow; the future fee is undecided.

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (!data.session) window.location.href = '/login'; else setUserId(data.session.user.id); }); }, []);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected && (!['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) { setMessage('Please upload a PDF, JPG or PNG file up to 10MB.'); return; }
    setMessage(''); setFile(selected);
  };

  const fail = (text: string) => { setLoading(false); setMessage(text); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !landlordName || !bank || !account || !address) { setMessage('Please enter the lease, address and landlord account details.'); return; }
    if (!contractStart || !contractEnd || contractEnd < contractStart) { setMessage('Enter a valid lease start and end date.'); return; }
    if (!Number.isSafeInteger(rent) || rent <= 0) { setMessage('Enter a rent amount greater than zero.'); return; }
    setLoading(true); setMessage('');
    const { data: profile } = await supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle();
    if (!profile?.phone) { setLoading(false); setMessage('Please add a contact phone number in your profile before applying.'); return; }
    const applicationNumber = makeNumber();
    const { data: sessionData } = await supabase.auth.getSession();
    const applicantEmail = sessionData.session?.user.email ?? null;
    const { data: profileData } = await supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle();
    const { data: application, error: insertError } = await supabase.from('rent_applications').insert({ user_id: userId, application_number: applicationNumber, applicant_name: profileData?.full_name ?? null, applicant_email: applicantEmail, applicant_phone: profileData?.phone ?? null, rent_amount: rent, service_fee: fee, total_amount: rent + fee, landlord_name: landlordName, landlord_bank: bank, landlord_account: account, property_address: address, contract_start_date: contractStart, contract_end_date: contractEnd, status: 'pending_review', submitted_at: new Date().toISOString() }).select('id').single();
    if (insertError || !application) { setLoading(false); setMessage('Could not save your application. Please contact support.'); return; }
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

  if (complete) return <main className="dashboard-page"><section className="dashboard-main wrap"><div className="dashboard-empty"><div className="success-icon"><Check size={30}/></div><strong>Your rent application has been submitted.</strong><span>Application number {complete}</span><span>Your status will be updated after review.</span><Link href="/dashboard" className="primary">Go to dashboard</Link></div></section></main>;
  return <main className="dashboard-page"><header><div className="wrap nav"><Link href="/dashboard" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link></div></header><section className="dashboard-main wrap"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> 대시보드</Link><div className="dashboard-heading"><div><div className="eyebrow">NEW APPLICATION</div><h1>Rent application</h1><p>This is a test. No real payment or transfer will occur.</p></div></div><div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>Test environment</strong><span>Lease files are stored privately and accessible to you and authorized administrators.</span></div></div><form className="application-form detail-card" onSubmit={submit}><label>Lease contract<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile}/><small>{file ? `${file.name} (${Math.round(file.size / 1024)}KB)` : 'PDF, JPG, PNG · up to 10MB'}</small></label><label>Property address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Address from your lease"/></label><label>Lease start date<input type="date" value={contractStart} onChange={e=>setContractStart(e.target.value)} required /></label><label>Lease end date<input type="date" value={contractEnd} onChange={e=>setContractEnd(e.target.value)} required /></label><label>Monthly rent<input type="number" value={rent} onChange={e=>setRent(Number(e.target.value))}/></label><div className="form-summary"><span>Service fee</span><b>To be confirmed</b><span>Test rent amount</span><b>{money(rent + fee)}</b></div><label>Landlord name<input value={landlordName} onChange={e=>setLandlordName(e.target.value)} placeholder="Account holder name"/></label><label>Bank<select value={bank} onChange={e=>setBank(e.target.value)}><option value="">Select a bank</option><option>국민은행</option><option>신한은행</option><option>우리은행</option><option>카카오뱅크</option></select></label><label>Account number<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="Enter the account number"/></label>{message&&<p className="auth-message">{message}</p>}<button className="primary full" disabled={loading}>{loading ? '신청 저장 중...' : 'Submit test application'}</button></form></section></main>;
}
