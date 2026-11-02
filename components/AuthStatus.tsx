'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setEmail(data.session?.user.email ?? null); setLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  if (loading) return <span className="login ghost">Checking...</span>;
  if (!email) return <Link href="/login" className="login">Log in</Link>;

  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  return <div className="auth-status"><Link href="/dashboard" className="dashboard-link">My dashboard</Link><span className="auth-email" title={email}>{email}</span><button className="login logout-button" onClick={logout}>Log out</button></div>;
}
