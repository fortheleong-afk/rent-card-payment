'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { safeNextPath } from '../../lib/navigation';
import FormField from '../../components/FormField';
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);
 const running=useRef(false);
 const login=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(running.current)return;running.current=true;setLoading(true);setMessage('');
  try{const values=new FormData(event.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:String(values.get('email')||'').trim(),password:String(values.get('password')||'')});if(error){setMessage('Login failed. Check your email and password, then try again.');return;}
   window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get('next')));
  }catch{setMessage('Could not connect. Check your connection and try again.');}
  finally{running.current=false;setLoading(false);}
 };
 return <main className="auth-page"><div className="auth-box"><Link href="/" className="brand" aria-label="Divercity Pay home"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><h1 id="login-title">Welcome back</h1><p>Log in to view your rent payment status.</p>
 <form method="post" onSubmit={login} aria-labelledby="login-title" aria-busy={loading}>
  <FormField id="login-email" name="email" label="Email" type="email" autoComplete="username" spellCheck={false} autoCapitalize="none" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" enterKeyHint="next"/>
  <FormField id="login-password" name="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} enterKeyHint="go"/>
  <div className="account-feedback" role="status" aria-live="polite">{message}</div><button type="submit" className="primary full" disabled={loading}>{loading?'Logging in…':'Log in'}</button>
 </form><div className="auth-help"><span>Don’t have an account?</span><Link href="/signup">Sign up</Link></div><small><LockKeyhole size={13} aria-hidden="true"/> Financial transactions are in test mode</small><noscript>JavaScript is required to sign in securely.</noscript></div></main>;
}
