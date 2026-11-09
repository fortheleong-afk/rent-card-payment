'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { ArrowRight,Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getJourney, OrderSummary } from '../../lib/workflow';
import { JourneyPanel,StatusBadge,TestNotice } from '../../components/WorkflowStatus';
import AccountHeader from '../../components/AccountHeader';
type Application={id:string;application_number:string|null;rent_amount:number;status:string;created_at:string};
export default function Dashboard(){
 const [name,setName]=useState(''),[completeProfile,setCompleteProfile]=useState(true),[applications,setApplications]=useState<Application[]>([]),[orders,setOrders]=useState<Record<string,OrderSummary>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const {data:s,error:authError}=await supabase.auth.getSession();if(authError)throw authError;const user=s.session?.user;if(!user){window.location.href='/login';return;}
   const [profile,result,orderResult]=await Promise.all([
    supabase.from('profiles').select('full_name,phone').eq('id',user.id).maybeSingle(),
    supabase.from('rent_applications').select('id,application_number,rent_amount,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
    supabase.from('payment_orders').select('application_id,payment_status,payout_status').eq('user_id',user.id),
   ]);
   if(result.error)throw result.error;if(orderResult.error)throw orderResult.error;
   setName(profile.data?.full_name??'');setCompleteProfile(Boolean(profile.data?.full_name&&profile.data?.phone));
   setOrders(Object.fromEntries((orderResult.data??[]).map(o=>[o.application_id,o])));setApplications(result.data??[]);
  }catch{setError('We could not load your latest status. Please try again.');}finally{setLoading(false);}
 };
 useEffect(()=>{load();},[]);
 const priority=(a:Application)=>({payout_attention:0,payment_failed:1,ready:2,payment:3,payout:4,payout_processing:4,review:5} as Record<string,number>)[getJourney(a.status,orders[a.id]).key]??10;
 const focus=[...applications].sort((a,b)=>priority(a)-priority(b))[0];
 return <main className="dashboard-page work-page"><AccountHeader/><div className="wrap work-main">
  <div className="work-page-heading"><div><h1>{name?`Hello, ${name}`:'Your rent dashboard'}</h1><p>Track your rent application and see what happens next.</p></div><Link href="/applications/new" className="work-button work-button-primary"><Plus size={17}/> New application</Link></div>
  <TestNotice/>
  {loading?<div className="work-loading" role="status">Loading your rent activity…</div>:error?<div className="work-error" role="alert"><p>{error}</p><button className="work-button" onClick={load}>Try again</button></div>:<>
   {!completeProfile&&<div className="work-profile-note"><p>Add your name and contact number before your next application.</p><Link href="/profile">Complete profile <ArrowRight size={15}/></Link></div>}
   {focus?<div className="work-focus"><div className="work-section-heading"><h2>{priority(focus)<5?'Your next step':'Latest activity'}</h2><span>{focus.application_number||focus.id.slice(0,8).toUpperCase()}</span></div><JourneyPanel journey={getJourney(focus.status,orders[focus.id])}><Link className="work-button work-button-primary" href={`/applications/${focus.id}`}>View application <ArrowRight size={16}/></Link></JourneyPanel></div>:<section className="work-empty"><h2>Your first rent application starts here</h2><p>Have your lease, monthly rent amount and landlord’s Korean bank account ready.</p><Link className="work-button work-button-primary" href="/applications/new">Start an application <ArrowRight size={16}/></Link></section>}
   <section className="work-sheet work-applications"><div className="work-section-heading"><h2>Your applications <span className="work-count">{applications.length}</span></h2><Link href="/applications">View all <ArrowRight size={15}/></Link></div>
    {applications.length===0?<p className="work-hint">Your submitted applications will appear here.</p>:<div className="work-application-list">{applications.slice(0,5).map(a=><Link key={a.id} href={`/applications/${a.id}`} className="work-application-row"><div><strong>₩{Number(a.rent_amount).toLocaleString('ko-KR')} <small>/ month</small></strong><span>{a.application_number||a.id.slice(0,8).toUpperCase()} · {new Date(a.created_at).toLocaleDateString('en-GB')}</span></div><div><StatusBadge journey={getJourney(a.status,orders[a.id])}/><ArrowRight size={16}/></div></Link>)}</div>}
   </section>
  </>}
  <footer className="work-footer"><div><Link href="/contact">Need help?</Link><Link href="/fees">Fees</Link><Link href="/profile">Manage profile</Link></div><button type="button" className="work-text-button" onClick={async()=>{await supabase.auth.signOut();window.location.href='/';}}>Sign out</button></footer>
 </div></main>;
}
