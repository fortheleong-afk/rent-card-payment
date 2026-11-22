'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import FormField from '../../../../components/FormField';
import { supabase } from '../../../../lib/supabase';

export default function UpdatePasswordPage() {
  const [state, setState] = useState<'checking'|'valid'|'expired'|'done'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recoveryUser = useRef('');
  const verification = useRef<ReturnType<typeof supabase.auth.verifyOtp> | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get('token_hash');
    if (token && !verification.current) {
      window.history.replaceState(null, '', '/login/recovery/update');
      verification.current = supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' });
    }
    if (verification.current) {
      void verification.current.then(
        ({ data, error: verifyError }) => {
          if (!active) return;
          recoveryUser.current = data.user?.id ?? '';
          setState(!verifyError && recoveryUser.current ? 'valid' : 'expired');
        },
        () => { if (active) setState('expired'); },
      );
    }
    // Also accept the default Supabase recovery email template.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user && active) {
        recoveryUser.current = session.user.id;
        setState('valid');
      }
      if (event === 'SIGNED_OUT' && active) setState(value => value === 'done' ? value : 'expired');
    });
    const timeout = window.setTimeout(() => setState(value => value === 'checking' ? 'expired' : value), 5000);
    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || state !== 'valid') return;
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') ?? '');
    if (password.length < 12 || password !== values.get('confirmation')) {
      setError('Use at least 12 characters and enter the same password twice.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!recoveryUser.current || data.user?.id !== recoveryUser.current) {
        setState('expired');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setState('done');
      await supabase.auth.signOut();
    } catch {
      setError('We could not update your password. Try again or request a fresh link.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <main className="auth-page"><div className="auth-box">
    <Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link>
    <h1>Choose a new password</h1>
    {state === 'checking' && <p role="status">Checking your reset link…</p>}
    {state === 'expired' && <><p>This link has expired or has already been used.</p><Link href="/login/recovery">Request another reset link</Link></>}
    {state === 'done' && <><p role="status">Your password has been updated.</p><Link href="/login">Log in with your new password</Link></>}
    {state === 'valid' && <form method="post" onSubmit={update} aria-busy={busy}>
      <FormField id="new-password" name="password" label="New password" type="password" autoComplete="new-password" minLength={12} required hint="Use at least 12 characters." />
      <FormField id="confirm-password" name="confirmation" label="Repeat new password" type="password" autoComplete="new-password" minLength={12} required />
      {error && <p role="alert" className="account-feedback">{error}</p>}
      <button className="primary full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>}
  </div></main>;
}
