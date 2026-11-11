'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { ArrowRight,Plus,RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getJourney,type OrderSummary } from '../../lib/workflow';
import { priorityApplication,tenantTask } from '../../lib/tenant-dashboard';
import { JourneyPanel,JourneyProgress,StatusBadge,TestNotice } from '../../components/WorkflowStatus';
import AccountHeader from '../../components/AccountHeader';
type Application={id:string;application_number:string|null;property_address:string|null;rent_amount:number;status:string;created_at:string};
type DraftSummary={state:string;updated_at:string};
const reference=(a:Application)=>a.application_number||a.id.slice(0,8).toUpperCase();
const money=(n:number)=>`₩${Number(n).toLocaleString('ko-KR')}`;
const filters=[['all','All'],['active','In progress'],['complete','Completed'],['closed','Closed']] as const;
export default function Dashboard(){
 const [name,setName]=useState(''),[profileState,setProfileState]=useState<'complete'|'incomplete'|'unknown'>('unknown');
 const [applications,setApplications]=useState<Application[]>([]),[orders,setOrders]=useState<Record<string,OrderSummary>>({});
 const [draftSummary,setDraftSummary]=useState<DraftSummary|null>(null),[draftUnavailable,setDraftUnavailable]=useState(false),[unread,setUnread]=useState<number|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[updatedAt,setUpdatedAt]=useState<Date|null>(null),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const inFlight=useRef(false);
 const load=async()=>{
  if(inFlight.current)return;inFlight.current=true;setRefreshing(true);setError('');
  try{
   const {data:s,error:authError}=await supabase.auth.getSession();if(authError)throw authError;const user=s.session?.user;if(!user){window.location.href='/login?next=%2Fdashboard';return;}
   const [profile,result,orderResult,draftResult,updateResult]=await Promise.all([
    supabase.from('profiles').select('full_name,phone').eq('id',user.id).maybeSingle(),
    supabase.from('rent_applications').select('id,application_number,property_address,rent_amount,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
    supabase.from('payment_orders').select('application_id,payment_status,payout_status').eq('user_id',user.id),
    supabase.from('application_drafts').select('state,updated_at').eq('user_id',user.id).maybeSingle(),
    supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('is_read',false),
   ]);
   if(result.error)throw result.error;if(orderResult.error)throw orderResult.error;
   setDraftUnavailable(Boolean(draftResult.error));setDraftSummary(draftResult.error?null:draftResult.data);
   setUnread(updateResult.error?null:updateResult.count);
   setName(profile.data?.full_name??'');setProfileState(profile.error?'unknown':profile.data?.full_name?.trim()&&profile.data?.phone?.trim()?'complete':'incomplete');
   setOrders(Object.fromEntries((orderResult.data??[]).map(o=>[o.application_id,o])));setApplications(result.data??[]);setUpdatedAt(new Date());
  }catch{setError('We could not refresh your application status. Check your connection and try again.');}
  finally{inFlight.current=false;setRefreshing(false);setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const focus=priorityApplication(applications,orders),journey=focus?getJourney(focus.status,orders[focus.id]):null;
 const savedDraft=draftSummary&&draftSummary.state!=='submitted'?draftSummary:null;
 const counts={all:applications.length,active:0,complete:0,closed:0};
 for(const a of applications)counts[tenantTask(getJourney(a.status,orders[a.id])).group]++;
 const visible=applications.filter(a=>filter==='all'||tenantTask(getJourney(a.status,orders[a.id])).group===filter);
 const signOut=async()=>{const {error:signOutError}=await supabase.auth.signOut();if(signOutError){setError('We could not sign you out. Please try again.');return;}window.location.href='/';};
 return <main className="dashboard-page work-page tenant-dashboard"><AccountHeader/><div className="wrap work-main">
  <div className="work-page-heading"><div><h1>Your rent dashboard</h1><p>{name?`Welcome back, ${name}. `:''}Your status and next step, in one place.</p></div><div className="tenant-refresh"><span aria-live="polite">{refreshing?'Updating…':updatedAt?`Updated ${updatedAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:''}</span><button className="work-button" onClick={load} disabled={refreshing}><RefreshCw size={15} aria-hidden="true"/>{refreshing?'Refreshing…':'Refresh'}</button></div></div>
  <TestNotice/>
  {error&&<div className="work-error" role="alert"><p>{error}</p>{updatedAt&&<p>Showing your last loaded information. Status may have changed.</p>}<button className="work-button" disabled={refreshing} onClick={load}>Try again</button></div>}
  {loading?<div className="work-loading" role="status">Loading your rent activity…</div>:updatedAt&&<>
   <div className="tenant-account-strip"><Link href="/notifications"><span>Updates</span><strong>{unread===null?'View updates':unread>0?`${unread} unread`:'All caught up'}</strong><ArrowRight size={15} aria-hidden="true"/></Link><Link href="/profile"><span>Profile</span><strong>{profileState==='complete'?'Complete':profileState==='incomplete'?'Contact details needed':'Check profile details'}</strong><ArrowRight size={15} aria-hidden="true"/></Link></div>
   {profileState==='incomplete'&&<div className="work-profile-note"><p>Add your name and contact number before submitting. Your saved draft will stay available.</p><Link href="/profile">Complete profile <ArrowRight size={15}/></Link></div>}
   {draftUnavailable&&<div className="work-feedback" role="status"><strong>Saved application status is unavailable.</strong><p>Open the application page to check your saved result before starting again.</p><Link className="work-button" href="/applications/new">Check saved application <ArrowRight size={15}/></Link></div>}
   {savedDraft&&<section className={`tenant-draft ${savedDraft.state==='submitting'?'tenant-draft-recovery':''}`} aria-labelledby="draft-title"><div><h2 id="draft-title">{savedDraft.state==='submitting'?'Check your submission result':'Continue your saved application'}</h2><p>{savedDraft.state==='submitting'?'Your last submission still needs confirmation. Check the same application before trying again.':'Your draft has not been submitted for review. Continue from your saved details and add any missing information.'}</p><small>Last saved {new Date(savedDraft.updated_at).toLocaleString('en-GB')}</small></div><Link className={`work-button ${!focus||savedDraft.state==='submitting'?'work-button-primary':''}`} href="/applications/new">{savedDraft.state==='submitting'?'Check submission result':'Continue draft'} <ArrowRight size={16}/></Link></section>}
   {focus&&journey?<section className="work-focus tenant-focus" aria-label="Application to follow"><div className="tenant-focus-meta"><div><strong>{reference(focus)}</strong><span>{money(focus.rent_amount)} / month · Submitted {new Date(focus.created_at).toLocaleDateString('en-GB')}</span>{focus.property_address&&<span className="tenant-property">{focus.property_address}</span>}</div>{counts.active===0&&<span className="tenant-no-active">No applications in progress</span>}</div><JourneyPanel journey={journey}>{(tenantTask(journey).group==='active'&&journey.key!=='legacy'||journey.key==='complete')&&<JourneyProgress journey={journey}/>}<Link className={`work-button ${savedDraft?.state==='submitting'?'':'work-button-primary'}`} href={`/applications/${focus.id}`}>{tenantTask(journey).action} <ArrowRight size={16}/></Link>{['payment_failed','payout_attention','legacy'].includes(journey.key)&&<Link className="tenant-support-link" href="/contact">Contact support</Link>}</JourneyPanel></section>:!savedDraft&&!draftUnavailable&&<section className="work-empty tenant-first-application"><h2>Start your first rent application</h2><p>Prepare your lease, monthly rent amount and your landlord’s Korean bank account. You can save your progress and return later.</p><Link className="work-button work-button-primary" href="/applications/new">Start an application <ArrowRight size={16}/></Link></section>}
   <section className="work-sheet work-applications" aria-labelledby="applications-title"><div className="work-section-heading"><h2 id="applications-title">Your applications <span className="work-count">{applications.length}</span></h2>{applications.length>0&&<Link href="/applications/new"><Plus size={15}/> {savedDraft||draftUnavailable?'Open application form':'New application'}</Link>}</div>
    {applications.length===0?<div className="tenant-no-submissions"><strong>No submitted applications yet</strong><p>{savedDraft?'Your saved draft will appear here after you submit it for review.':'Once submitted, your application and its review, payment and payout status will appear here.'}</p></div>:<><nav className="tenant-list-filters" aria-label="Filter your applications">{filters.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label} <span>{counts[id]}</span></button>)}</nav>
    {!visible.length?<div className="tenant-list-empty" role="status"><p>No applications in this category.</p><button className="work-text-button" onClick={()=>setFilter('all')}>Show all applications</button></div>:<div className="work-application-list">{visible.slice(0,5).map(a=>{const j=getJourney(a.status,orders[a.id]);return <Link key={a.id} href={`/applications/${a.id}`} className="work-application-row"><div><strong>{money(a.rent_amount)} <small>/ month</small></strong><span>{reference(a)} · {new Date(a.created_at).toLocaleDateString('en-GB')}</span>{a.property_address&&<span className="tenant-property">{a.property_address}</span>}</div><div className="tenant-row-status"><StatusBadge journey={j}/><span>{tenantTask(j).action} <ArrowRight size={14} aria-hidden="true"/></span></div></Link>;})}</div>}
    <div className="tenant-list-footer"><span>{visible.length?`Showing ${Math.min(visible.length,5)} of ${visible.length} ${filter==='all'?'submitted':'matching'} applications`:'No matching applications'}</span><Link href="/applications">View full application history <ArrowRight size={15}/></Link></div></>}
   </section>
  </>}
  <footer className="work-footer"><div><Link href="/contact">Need help?</Link><Link href="/fees">Fees</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/profile">Manage profile</Link></div><button type="button" className="work-text-button" onClick={signOut}>Sign out</button></footer>
 </div></main>;
}
