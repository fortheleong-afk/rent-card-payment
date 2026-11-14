'use client';
import Link from 'next/link';
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import AccountHeader from '../../components/AccountHeader';
import FormField from '../../components/FormField';
import { TestNotice } from '../../components/WorkflowStatus';
import { validateName,validatePhone } from '../../lib/profile-validation';
export default function ProfilePage(){
 const [userId,setUserId]=useState(''),[email,setEmail]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState('');
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const running=useRef(false),request=useRef(0);
 const load=async()=>{const version=++request.current;setLoading(true);setLoadError('');try{
  const {data,error}=await supabase.auth.getUser();if(error||!data.user){window.location.assign('/login?next=%2Fprofile');return;}
  const result=await supabase.from('profiles').select('full_name,phone').eq('id',data.user.id).maybeSingle();if(version!==request.current)return;
  if(result.error||!result.data)throw new Error('profile');
  setUserId(data.user.id);setEmail(data.user.email||'');setName(result.data.full_name||'');setPhone(result.data.phone||'');
 }catch{if(version===request.current)setLoadError('We could not load your profile. Try again before editing.');}finally{if(version===request.current)setLoading(false);}};
 useEffect(()=>{void load();const requestRef=request;return()=>{requestRef.current++;};},[]);
 const save=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(running.current||!userId)return;
  for(const [id,value,validate] of [['profile-name',name,validateName],['profile-phone',phone,validatePhone]] as const){const input=event.currentTarget.querySelector<HTMLInputElement>(`#${id}`)!;input.setCustomValidity(validate(value));if(!input.reportValidity())return;}
  running.current=true;setSaving(true);setMessage('');
  try{const {data,error}=await supabase.from('profiles').update({full_name:name.trim(),phone:phone.trim()}).eq('id',userId).select('id').maybeSingle();
   if(error||!data)throw new Error('save');setMessage('Your profile has been saved. You can continue your application.');
  }catch{setMessage('We could not confirm your changes were saved. Check your connection and try again.');}finally{running.current=false;setSaving(false);}
 };
 return <main className="work-page"><AccountHeader/><section className="wrap work-main"><Link href="/dashboard" className="work-back">← Dashboard</Link><div className="work-page-heading"><div><h1>Your profile</h1><p>Your name and contact number help reviewers identify your application.</p></div></div><TestNotice/>
 {loading?<p className="work-loading" role="status">Loading your profile…</p>:loadError?<div className="work-error" role="alert"><p>{loadError}</p><button type="button" className="work-button" onClick={load}>Try again</button></div>:<form method="post" className="work-sheet account-profile" onSubmit={save} aria-label="Edit your profile" aria-busy={saving}>
 <p>These details are visible to you and authorized admins. International contact numbers are accepted.</p>
 <FormField id="profile-name" name="full_name" label="Full name" autoComplete="name" required maxLength={120} validate={validateName} value={name} onChange={e=>{setName(e.target.value);setMessage('');}}/>
 <FormField id="profile-phone" name="phone" label="Contact phone" type="tel" autoComplete="tel" required maxLength={24} validate={validatePhone} value={phone} onChange={e=>{setPhone(e.target.value);setMessage('');}} hint="Include your country code when applicable. This is a contact number, not identity verification."/>
 <FormField id="profile-email" name="email" label="Email" type="email" value={email} readOnly hint="Your sign-in email is read-only here."/>
 <div className="account-feedback" role="status" aria-live="polite">{message}</div><button type="submit" className="work-button work-button-primary" disabled={saving}>{saving?'Saving…':'Save profile'}</button>
 </form>}</section></main>;
}
