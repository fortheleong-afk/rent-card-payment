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
      setMessage('Please enter your name, contact phone, email and password.');
      return;
    }
    if (password.length < 6) {
      setMessage('Your password must be at least 6 characters.');
      return;
    }
    if (!/^\+?[0-9][0-9 ()-]{5,23}$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) {
      setMessage('Enter a valid contact number, including the country code if applicable.');
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
      setMessage(error.message.includes('already registered') ? 'This email is already registered.' : 'Could not create your account. Please try again.');
      return;
    }
    if (data.session) window.location.href = '/';
    else setMessage('Account created. If email verification is enabled, check your inbox before logging in.');
  };

  return <main className="auth-page"><div className="auth-box">
    <Link href="/" className="brand"><span className="logo">D</span><span>Divercity <span>Pay</span></span></Link>
    <h1>Create account</h1><p>Start your rent payment journey.</p>
    <p className="auth-legal">Before entering personal information, read our <Link href="/terms">Terms of use</Link> and <Link href="/privacy">Privacy policy</Link>. Account details are stored when you create an account. This is a test service.</p>
    <label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" /></label>
    <label>Contact phone<input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+82 10-1234-5678" /><small>International numbers are accepted. This is a contact number, not identity verification.</small></label>
    <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
    <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
    {message && <p className="auth-message">{message}</p>}
    <button className="primary full" onClick={signup} disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
    <div className="auth-help"><span>Already have an account?</span><Link href="/login">Log in</Link></div>
    <small><LockKeyhole size={13}/> Supabase Auth connected · Financial transactions are in test mode</small>
  </div></main>;
}
