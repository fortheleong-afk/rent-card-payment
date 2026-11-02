'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { window.location.href = '/login?next=%2Fprofile'; return; }
      const user = session.session.user;
      setUserId(user.id);
      setEmail(user.email ?? '');
      const { data } = await supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle();
      setName(data?.full_name ?? user.user_metadata?.full_name ?? '');
      setPhone(data?.phone ?? user.user_metadata?.phone ?? '');
    })();
  }, []);

  const save = async () => {
    if (!name.trim() || !phone.trim() || !/^[+0-9][0-9 ()-]{7,20}$/.test(phone)) {
      setMessage('이름과 올바른 전화번호를 입력해주세요.');
      return;
    }
    setSaving(true); setMessage('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', userId);
    setSaving(false);
    setMessage(error ? '저장에 실패했습니다: ' + error.message : '프로필이 저장되었습니다.');
  };

  return <main className="dashboard-page"><section className="dashboard-main wrap">
    <Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> 대시보드</Link>
    <div className="dashboard-heading"><div><div className="eyebrow">PROFILE</div><h1>프로필 관리</h1><p>관리자 심사와 신청자 구분에 사용되는 정보입니다.</p></div></div>
    <div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>개인정보 보호</strong><span>이름과 전화번호는 본인과 관리자만 확인할 수 있습니다.</span></div></div>
    <div className="detail-card profile-form">
      <label>이름<input value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력해주세요" /></label>
      <label>전화번호<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+82 10-1234-5678" /></label>
      <label>이메일<input value={email} readOnly /></label>
      {message && <p className="auth-message">{message}</p>}
      <button className="primary full" onClick={save} disabled={saving}>{saving ? '저장 중...' : '프로필 저장'}</button>
    </div>
  </section></main>;
}
