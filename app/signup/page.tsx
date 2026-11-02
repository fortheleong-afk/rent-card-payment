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
  const signup = async () => { if (!email || !password || !name) { setMessage('Enter your name, email, and password.'); return; } if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return; } setLoading(true); setMessage(''); const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }); setLoading(false); if (error) { setMessage(error.message.includes('already registered') ? 'This email is already registered.' : 'Sign-up failed. Check your details.'); return; } if (data.session) window.location.href = '/'; else setMessage('Sign-up complete! Verify your email before logging in.'); };
  return <main className="auth-page"><div className="auth-box"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity <span>Pay</span></span></Link><h1>Create account</h1><p>Start your rent payment journey.</p><label>이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" /></label><label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" /></label>{message&&<p className="auth-message">{message}</p>}<button className="primary full" onClick={signup} disabled={loading}>{loading?'Creating account...':'Create account'}</button><div className="auth-help"><span>Already have an account?</span><Link href="/login">Log in</Link></div><small><LockKeyhole size={13}/> Supabase Auth connected · Financial transactions are in test mode</small></div></main>;
}
