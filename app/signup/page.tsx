'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FormField from '../../components/FormField';
import { validateName, validatePhone } from '../../lib/profile-validation';
export default function Signup(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);
 const running=useRef(false);
 const signup=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(running.current)return;
  // Also guard values supplied by autofill, which need not dispatch change events.
  const form=event.currentTarget;const values=new FormData(form);const submittedName=String(values.get('full_name')||''),submittedPhone=String(values.get('phone')||'');
  for(const [id,value,validate] of [['signup-name',submittedName,validateName],['signup-phone',submittedPhone,validatePhone]] as const){const input=form.querySelector<HTMLInputElement>(`#${id}`)!;input.setCustomValidity(validate(value));if(!input.reportValidity())return;}
  running.current=true;setLoading(true);setMessage('');
  try{const {data,error}=await supabase.auth.signUp({email:String(values.get('email')||'').trim(),password:String(values.get('password')||''),options:{data:{full_name:submittedName.trim(),phone:submittedPhone.trim()}}});
   if(error){setMessage('Could not create your account. Check your details or try logging in if you already have an account.');return;}
   if(data.session)window.location.assign('/dashboard');else setMessage('Check your inbox to confirm your account, then log in. If you already have an account, use Log in.');
  }catch{setMessage('Could not connect. Check your connection and try again.');}finally{running.current=false;setLoading(false);}
 };
 return <main className="auth-page"><div className="auth-box"><Link href="/" className="brand" aria-label="Divercity Pay home"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><h1 id="signup-title">Create account</h1><p>Start your rent payment journey.</p>
 <p className="auth-legal">Read our <Link href="/terms">Terms of use</Link> and <Link href="/privacy">Privacy policy</Link> before entering personal information. This is a test service.</p>
 <form method="post" onSubmit={signup} aria-labelledby="signup-title" aria-busy={loading}>
  <FormField id="signup-name" name="full_name" label="Full name" autoComplete="name" required maxLength={120} validate={validateName} value={name} onChange={e=>setName(e.target.value)} enterKeyHint="next"/>
  <FormField id="signup-phone" name="phone" label="Contact phone" type="tel" autoComplete="tel" required maxLength={24} validate={validatePhone} value={phone} onChange={e=>setPhone(e.target.value)} hint="International numbers are accepted. Include your country code when applicable. This is not identity verification." enterKeyHint="next"/>
  <FormField id="signup-email" name="email" label="Email" type="email" autoComplete="username" spellCheck={false} autoCapitalize="none" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" enterKeyHint="next"/>
  <FormField id="signup-password" name="password" label="Password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} hint="At least 6 characters. A unique, longer password is recommended." enterKeyHint="go"/>
  <div className="account-feedback" role="status" aria-live="polite">{message}</div><button type="submit" className="primary full" disabled={loading}>{loading?'Creating account…':'Create account'}</button>
 </form><div className="auth-help"><span>Already have an account?</span><Link href="/login">Log in</Link></div><small><LockKeyhole size={13} aria-hidden="true"/> Financial transactions are in test mode</small><noscript>JavaScript is required to create an account securely.</noscript></div></main>;
}
