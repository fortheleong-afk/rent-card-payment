'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { ArrowLeft,ArrowRight,Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getJourney,OrderSummary } from '../../lib/workflow';
import { StatusBadge,TestNotice } from '../../components/WorkflowStatus';
import AccountHeader from '../../components/AccountHeader';
type Application={id:string;application_number:string|null;rent_amount:number;status:string;created_at:string;landlord_name:string|null};
export default function Applications(){
 const [rows,setRows]=useState<Application[]>([]),[orders,setOrders]=useState<Record<string,OrderSummary>>({}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');try{
   const {data:s}=await supabase.auth.getSession();const user=s.session?.user;if(!user){window.location.href='/login';return;}
   const [apps,os]=await Promise.all([supabase.from('rent_applications').select('id,application_number,rent_amount,status,created_at,landlord_name').eq('user_id',user.id).order('created_at',{ascending:false}),supabase.from('payment_orders').select('application_id,payment_status,payout_status').eq('user_id',user.id)]);
   if(apps.error||os.error)throw new Error('load');setRows(apps.data??[]);setOrders(Object.fromEntries((os.data??[]).map(o=>[o.application_id,o])));
  }catch{setError('Could not load your applications. Try again.');}finally{setLoading(false);}
 };
 useEffect(()=>{load();},[]);
 return <main className="dashboard-page work-page"><AccountHeader/><section className="wrap work-main"><Link className="work-back" href="/dashboard"><ArrowLeft size={16}/> Dashboard</Link><div className="work-page-heading"><div><h1>Your applications</h1><p>Review, payment and payout status in one place.</p></div><Link href="/applications/new" className="work-button work-button-primary"><Plus size={17}/> New application</Link></div><TestNotice/>
  {loading?<div className="work-loading" role="status">Loading applications…</div>:error?<div className="work-error" role="alert"><p>{error}</p><button className="work-button" onClick={load}>Try again</button></div>:rows.length===0?<div className="work-empty"><h2>No applications yet</h2><p>Start with your lease and landlord’s deposit account.</p><Link href="/applications/new" className="work-button">Start an application</Link></div>:<div className="work-sheet work-application-list">{rows.map(row=><Link href={`/applications/${row.id}`} className="work-application-row" key={row.id}><div><strong>₩{Number(row.rent_amount).toLocaleString('ko-KR')} <small>/ month</small></strong><span>{row.application_number||row.id.slice(0,8).toUpperCase()} · {new Date(row.created_at).toLocaleDateString('en-GB')}</span><span>{row.landlord_name||'Landlord not provided'}</span></div><div><StatusBadge journey={getJourney(row.status,orders[row.id])}/><ArrowRight size={16}/></div></Link>)}</div>}
 </section></main>;
}
