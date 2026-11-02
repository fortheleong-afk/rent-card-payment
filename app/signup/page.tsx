'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const signup = async () => { if (!email || !password || !name) { setMessage('이름, 이메일, 비밀번호를 모두 입력해주세요.'); return; } if (password.length < 6) { setMessage('비밀번호는 6자 이상 입력해주세요.'); return; } setLoading(true); setMessage(''); const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }); setLoading(false); if (error) { setMessage(error.message.includes('already registered') ? '이미 가입된 이메일입니다.' : '회원가입에 실패했습니다. 입력 내용을 확인해주세요.'); return; } if (data.session) window.location.href = '/'; else setMessage('가입 완료! 이메일 인증 후 로그인해주세요.'); };
  return <main className="auth-page"><div className="auth-box"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity <span>Pay</span></span></Link><h1>회원가입</h1><p>월세 결제 서비스를 시작해보세요.</p><label>이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="이름을 입력해주세요" /></label><label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6자 이상 입력해주세요" /></label>{message&&<p className="auth-message">{message}</p>}<button className="primary full" onClick={signup} disabled={loading}>{loading?'가입 중...':'회원가입'}</button><div className="auth-help"><span>이미 계정이 있으신가요?</span><Link href="/login">로그인</Link></div><small><LockKeyhole size={13}/> Supabase Auth 연결 · 금융 거래는 테스트 모드</small></div></main>;
}
