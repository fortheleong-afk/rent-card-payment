'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { demoDestination, isDemoAccount } from '../lib/demo-account';

/** Prevent production screens mounting for the showcase account.
 * RLS and the tenant database role remain the actual security boundary. */
export default function WorkspaceGate({children}:{children:React.ReactNode}) {
 const path=usePathname(),router=useRouter();
 const guarded=/^\/(dashboard|admin|applications|notifications|profile)(\/|$)/.test(path);
 const [checked,setChecked]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{
  if(!guarded)return;
  let active=true;
  const decide=(user:{id:string}|null|undefined)=>{
   if(!active)return;
   if(isDemoAccount(user)){router.replace(demoDestination(path));return;}
   setChecked(path);
  };
  setError(false);
  supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error){setError(true);return;}decide(data.session?.user);});
  const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>decide(session?.user));
  return()=>{active=false;listener.subscription.unsubscribe();};
 },[path,guarded,router]);
 if(!guarded)return <>{children}</>;
 if(checked!==path)return <main className="dashboard-page"><div className="wrap work-main" role={error?'alert':'status'}>{error?<>Could not check your session. <button className="work-button" onClick={()=>window.location.reload()}>Try again</button></>:'Checking your workspace…'}</div></main>;
 return <>{children}</>;
}
