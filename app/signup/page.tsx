'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    if (!email || !password || !name || !phone) {
      setMessage('이름, 전화번호, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setMessage('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (!/^[+0-9][0-9 ()-]{7,20}$/.test(phone)) {
      setMessage('전화번호 형식을 확인해주세요.');
      return;
    }
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim() } },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message.includes('already registered') ? '이미 가입된 이메일입니다.' : '회원가입에 실패했습니다.');
      return;
    }
    if (data.session) window.location.href = '/';
    else setMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.');
  };

  return <main className="auth-page"><div className="auth-box">
    <Link href="/" className="brand"><span className="logo">D</span><span>Divercity <span>Pay</span></span></Link>
    <h1>Create account</h1><p>Start your rent payment journey.</p>
    <label>이름<input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" /></label>
    <label>전화번호<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+82 10-1234-5678" /></label>
    <label>이메일<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
    <label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
    {message && <p className="auth-message">{message}</p>}
    <button className="primary full" onClick={signup} disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
    <div className="auth-help"><span>Already have an account?</span><Link href="/login">Log in</Link></div>
    <small><LockKeyhole size={13}/> Supabase Auth connected · Financial transactions are in test mode</small>
  </div></main>;
}
