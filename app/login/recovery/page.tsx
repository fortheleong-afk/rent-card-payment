'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import FormField from '../../../components/FormField';
import { supabase } from '../../../lib/supabase';

export default function RecoveryPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/login/recovery/update', window.location.origin).href,
      });
      setMessage(error
        ? 'We could not process your request. Wait a moment and try again.'
        : 'If an account exists for that email, a reset link will arrive shortly. Check your spam folder too.');
    } catch {
      setMessage('We could not connect. Check your connection and try again.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <main className="auth-page"><div className="auth-box">
    <Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link>
    <h1>Reset your password</h1>
    <p>Enter the email you used to create your account.</p>
    <form method="post" onSubmit={sendLink} aria-busy={busy}>
      <FormField id="recovery-email" name="email" label="Account email" type="email" autoComplete="username" required />
      <p role="status" className="account-feedback">{message}</p>
      <button className="primary full" disabled={busy}>{busy ? 'Requesting link…' : 'Send reset link'}</button>
    </form>
    <p className="auth-help"><Link href="/login">Back to login</Link></p>
  </div></main>;
}
