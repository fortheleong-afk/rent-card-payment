'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import FormField from '../../../components/FormField';
import { supabase } from '../../../lib/supabase';

export default function AdminVerificationPage() {
  const [state, setState] = useState<'loading'|'denied'|'ready'>('loading');
  const [factor, setFactor] = useState('');
  const [setup, setSetup] = useState<{ qr: string; secret: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          window.location.replace('/login?next=%2Fadmin');
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!active) return;
        if (profile?.role !== 'admin') {
          setMessage('관리자 계정으로 로그인해 주세요.');
          setState('denied');
          return;
        }
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (error) throw error;
        setFactor(data.totp[0]?.id ?? '');
        setState('ready');
      } catch {
        if (active) {
          setMessage('인증 정보를 불러오지 못했습니다. 새로고침해 주세요.');
          setState('denied');
        }
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function enroll() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Divercity Pay' });
      if (error) throw error;
      setFactor(data.id);
      setSetup({ qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setMessage('인증 앱을 등록하지 못했습니다. 관리자에게 기존 등록 상태를 확인해 주세요.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !factor) return;
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) throw error;
      setSetup(undefined);
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next === '/admin/storage-cleanup' || next === '/admin/operations' ? next : '/admin');
    } catch {
      setMessage('코드를 확인하지 못했습니다. 인증 앱의 최신 6자리 코드로 다시 시도해 주세요.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <main className="auth-page" lang="ko"><div className="auth-box">
    <Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link>
    <h1>관리자 추가 인증</h1>
    {state === 'loading' && <p role="status">인증 정보를 확인하고 있습니다.</p>}
    {state === 'ready' && !factor && <>
      <p>인증 앱을 등록하면 관리자 작업을 시작할 수 있습니다.</p>
      <button className="primary full" type="button" disabled={busy} onClick={enroll}>{busy ? '준비 중…' : '인증 앱 등록'}</button>
    </>}
    {setup && <>
      <p>인증 앱에서 QR 코드를 스캔하거나 아래 키를 직접 입력하세요.</p>
      <Image src={setup.qr} alt="인증 앱 등록용 QR 코드" width={160} height={160} unoptimized />
      <p><code style={{ overflowWrap: 'anywhere' }}>{setup.secret}</code></p>
    </>}
    {state === 'ready' && factor && <form method="post" onSubmit={verify} aria-busy={busy}>
      <FormField id="admin-verification-code" name="code" label="인증 앱의 6자리 코드" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      <button className="primary full" disabled={busy}>{busy ? '확인 중…' : '인증하고 계속'}</button>
    </form>}
    {message && <p role="alert" className="account-feedback">{message}</p>}
    <p className="auth-help"><Link href="/dashboard">사용자 대시보드</Link></p>
  </div></main>;
}
