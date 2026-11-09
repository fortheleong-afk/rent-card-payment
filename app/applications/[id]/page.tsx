'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { createContractLink } from '../../../lib/contracts';
import PaymentOrder from '../../../components/PaymentOrder';
import AccountHeader from '../../../components/AccountHeader';
const money=(n:number)=>`₩${Number(n||0).toLocaleString('ko-KR')}`;
const reviewLabels:Record<string,string>={pending_review:'Under review',approved:'Approved',rejected:'Declined',cancelled:'Cancelled'};
export default function ApplicationDetail({params}:{params:{id:string}}){
 const [row,setRow]=useState<any>(null),[history,setHistory]=useState<any[]>([]),[message,setMessage]=useState(''),[cancelling,setCancelling]=useState(false);
 const [contract,setContract]=useState<{url:string;fileName:string}|null>(null),[contractError,setContractError]=useState('');
 const load=async()=>{
  const {data:session}=await supabase.auth.getSession();if(!session.session){window.location.href='/login';return;}
  const {data,error}=await supabase.from('rent_applications').select('*').eq('id',params.id).eq('user_id',session.session.user.id).single();
  if(error||!data){setMessage('We could not find this application. It may be unavailable to this account.');return;}
  setRow(data);const h=await supabase.from('application_status_history').select('id,from_status,to_status,reason,created_at').eq('application_id',data.id).order('created_at',{ascending:false});setHistory(h.data??[]);
 };
 useEffect(()=>{load();},[params.id]);
 const openContract=async()=>{
  setContractError('');const preview=window.open('about:blank','_blank');
  try{const link=await createContractLink(row?.contract_file_path,row?.contract_file_name);setContract(link);if(preview)preview.location.href=link.url;else setContractError('Your browser blocked the new tab. Use Open file or Download below.');}
  catch(e){preview?.close();setContractError(e instanceof Error?e.message:'Could not open the contract. Please try again.');}
 };
 const cancel=async()=>{
  if(!row||row.status!=='pending_review'||cancelling)return;setCancelling(true);setMessage('');
  try{const {data,error}=await supabase.rpc('cancel_rent_application',{p_application_id:row.id});if(error)throw error;if(!data)throw new Error('This application has already been processed. Refresh to check its status.');await load();}
  catch(e){setMessage(e&&typeof e==='object'&&'message'in e?String(e.message):'Could not cancel. Try again.');}finally{setCancelling(false);}
 };
 return <main className="dashboard-page work-page"><AccountHeader/><section className="wrap work-main work-detail-main">
  <Link href="/applications" className="work-back"><ArrowLeft size={16}/> All applications</Link>
  {!row?<div className="work-empty" role="status"><h1>{message?'Application unavailable':'Loading your application…'}</h1><p>{message}</p><Link href="/dashboard">Return to dashboard</Link></div>:<>
   <div className="work-page-heading"><div><h1>Rent application</h1><p>{row.application_number||row.id.slice(0,8).toUpperCase()} · Submitted {new Date(row.created_at).toLocaleDateString('en-GB')}</p></div></div>
   <PaymentOrder applicationId={row.id} approved={row.status==='approved'} applicationStatus={row.status}/>
   {row.rejection_reason&&<div className="work-error"><strong>Review reason</strong><p>{row.rejection_reason}</p></div>}
   <div className="work-detail-columns"><section className="work-sheet"><h2>Application details</h2><dl className="work-facts">
    <div><dt>Property address</dt><dd>{row.property_address||'Not provided'}</dd></div><div><dt>Lease period</dt><dd>{row.contract_start_date||'—'} — {row.contract_end_date||'—'}</dd></div>
    <div><dt>Monthly rent</dt><dd>{money(row.rent_amount)}</dd></div><div><dt>Service fee</dt><dd>{row.service_fee===0?'To be confirmed (test)':money(row.service_fee)}</dd></div>
    <div><dt>Application test amount</dt><dd>{money(row.total_amount)}</dd></div><div><dt>Landlord</dt><dd>{row.landlord_name||'Not provided'}</dd></div><div><dt>Deposit account</dt><dd>{row.landlord_bank||'—'} · {row.landlord_account?`••••${row.landlord_account.slice(-4)}`:'—'}</dd></div>
   </dl></section><section className="work-sheet"><h2>Lease contract</h2><div className="work-file"><FileText size={24}/><div><strong>{row.contract_file_name||'No contract attached'}</strong><p>{row.contract_file_size?`${(row.contract_file_size/1024).toFixed(1)} KB · `:''}Private file</p></div></div>
    {row.contract_file_path&&<button type="button" className="work-button" onClick={openContract}>Preview contract <ExternalLink size={15}/></button>}
    {contractError&&<p className="work-error" role="alert">{contractError}</p>}{contract&&<div className="work-file-links"><a href={contract.url} target="_blank" rel="noreferrer">Open file <ExternalLink size={14}/></a><a href={contract.url} download={contract.fileName}>Download <Download size={14}/></a><small>Secure link expires in 5 minutes.</small></div>}
    <p className="work-hint">Only you and authorized administrators can request access. Do not share the secure file link.</p>
   </section></div>
   <details className="work-disclosure work-sheet"><summary><span>Application review history</span><small>{history.length} events</small></summary><div className="work-disclosure-body"><ol className="work-timeline">{history.map(e=><li key={e.id}><time>{new Date(e.created_at).toLocaleString('en-GB')}</time><strong>{reviewLabels[e.from_status]||e.from_status||'Submitted'} → {reviewLabels[e.to_status]||e.to_status}</strong><p>{e.reason||'No additional note'}</p></li>)}</ol>{!history.length&&<p>No review updates yet.</p>}</div></details>
   {message&&<p className="work-error" role="alert">{message}</p>}
   {row.status==='pending_review'&&<div className="work-cancel"><div><strong>Need to withdraw this application?</strong><p>You can cancel while the review is pending.</p></div><button className="work-button" onClick={cancel} disabled={cancelling}>{cancelling?'Cancelling…':'Cancel application'}</button></div>}
  </>}
 </section></main>;
}
