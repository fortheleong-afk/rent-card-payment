'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { supabase } from '../../lib/supabase';
import AccountHeader from '../../components/AccountHeader';
import { TestNotice } from '../../components/WorkflowStatus';
type Notification={id:string;title:string;message:string;created_at:string;is_read:boolean};
export default function Notifications(){
 const [items,setItems]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[readError,setReadError]=useState('');
 const request=useRef(0);
 const load=async()=>{const version=++request.current;setLoading(true);setError('');setReadError('');try{
  const {data:s}=await supabase.auth.getSession();const user=s.session?.user;if(!user){window.location.assign('/login?next=%2Fnotifications');return;}
  const result=await supabase.from('notifications').select('id,title,message,created_at,is_read').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
  if(version!==request.current)return;if(result.error)throw result.error;setItems(result.data||[]);
  // Mark only successfully fetched rows, never a concurrent notification the user has not seen.
  const unread=(result.data||[]).filter(item=>!item.is_read).map(item=>item.id);
  if(unread.length){const marked=await supabase.from('notifications').update({is_read:true}).eq('user_id',user.id).in('id',unread);if(version===request.current&&marked.error)setReadError('Updates were loaded, but could not be marked as read. Refresh to retry.');}
 }catch{if(version===request.current)setError('We could not load your updates. Check your connection and try again.');}finally{if(version===request.current)setLoading(false);}};
 useEffect(()=>{void load();const requestRef=request;return()=>{requestRef.current++;};},[]);
 return <main className="work-page"><AccountHeader/><section className="wrap work-main"><Link href="/dashboard" className="work-back">← Dashboard</Link><div className="work-page-heading"><div><h1>Your updates</h1><p>Review decisions and test payment or transfer status changes. Up to 100 recent updates.</p></div><button className="work-button" type="button" onClick={load} disabled={loading}>{loading?'Loading…':'Refresh updates'}</button></div><TestNotice/>
 {error&&<p className="work-error" role="alert">{error}</p>}{readError&&<p className="work-error" role="alert">{readError}</p>}
 {loading?<p className="work-loading" role="status">Loading your updates…</p>:!error&&!items.length?<div className="work-empty"><h2>No updates yet</h2><p>Changes to your applications will appear here.</p><Link className="work-button" href="/applications">View applications</Link></div>:items.length>0&&<section className="work-sheet" aria-label="Recent updates"><ul className="account-updates">{items.map(item=><li key={item.id}><h2>{item.title}</h2><p>{item.message}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('en-GB')}</time></li>)}</ul></section>}
 </section></main>;
}
