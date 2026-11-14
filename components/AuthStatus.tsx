'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId,setUserId]=useState<string|null>(null);
  const [logoutError,setLogoutError]=useState('');
  const [loggingOut,setLoggingOut]=useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setUserId(data.session?.user.id??null); setEmail(data.session?.user.email ?? null); setName(data.session?.user.user_metadata?.full_name ?? null); setLoading(false); }
    }).catch(()=>{if(mounted)setLoading(false);});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id??null);
      setEmail(session?.user.email ?? null);
      setName(session?.user.user_metadata?.full_name ?? null);
      setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(()=>{let active=true;if(userId){supabase.from('profiles').select('full_name').eq('id',userId).maybeSingle().then(({data,error})=>{if(active&&!error&&data?.full_name)setName(data.full_name);});}return()=>{active=false;};},[userId]);

  if (loading) return <span className="login ghost">Checking...</span>;
  if (!email) return <Link href="/login" className="login">Log in</Link>;

  const logout = async () => {if(loggingOut)return;setLoggingOut(true);setLogoutError('');try{const {error}=await supabase.auth.signOut();if(error)throw error;window.location.assign('/');}catch{setLogoutError('Could not log out. Please try again.');}finally{setLoggingOut(false);}};
  return <div className="auth-status"><Link href="/dashboard" className="dashboard-link">My dashboard</Link><span className="auth-email" title={email ?? ''}>{name || email}</span><button className="login logout-button" onClick={logout} disabled={loggingOut}>{loggingOut?'Logging out…':'Log out'}</button>{logoutError&&<span role="alert">{logoutError}</span>}</div>;
}

