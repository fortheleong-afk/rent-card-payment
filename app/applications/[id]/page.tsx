'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { ArrowLeft,Download,ExternalLink,FileText,RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { createContractLink } from '../../../lib/contracts';
import { bankLabel } from '../../../lib/application-validation';
import PaymentOrder from '../../../components/PaymentOrder';
import AccountHeader from '../../../components/AccountHeader';
type Application={id:string;application_number:string|null;applicant_name?:string|null;applicant_email?:string|null;property_address:string|null;contract_start_date:string|null;contract_end_date:string|null;rent_amount:number;service_fee:number;total_amount:number;landlord_name:string|null;landlord_bank:string|null;landlord_account:string|null;contract_file_path:string|null;contract_file_name:string|null;contract_file_size:number|null;status:string;rejection_reason:string|null;created_at:string;submitted_at?:string|null};
type History={id:string;from_status:string|null;to_status:string;reason:string|null;created_at:string};
const money=(n:number)=>`₩${Number(n||0).toLocaleString('ko-KR')}`;
const reviewLabels:Record<string,string>={pending_review:'Under review',approved:'Approved',rejected:'Declined',cancelled:'Cancelled'};
export default function ApplicationDetail({params}:{params:{id:string}}){
 const [row,setRow]=useState<Application|null>(null),[history,setHistory]=useState<History[]>([]),[email,setEmail]=useState('');
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[loadError,setLoadError]=useState(''),[historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(false);
 const [message,setMessage]=useState(''),[actionError,setActionError]=useState(''),[cancelling,setCancelling]=useState(false),[confirmCancel,setConfirmCancel]=useState(false);
 const [contract,setContract]=useState<{preview?:string;download?:string}>({}),[contractError,setContractError]=useState(''),[opening,setOpening]=useState<'preview'|'download'|null>(null);
 const [updatedAt,setUpdatedAt]=useState<Date|null>(null),[statusVersion,setStatusVersion]=useState(0);
 const request=useRef(0),inFlight=useRef(false),cancelInFlight=useRef(false),contractInFlight=useRef(false);
 const load=async()=>{
  if(inFlight.current)return;inFlight.current=true;setRefreshing(true);setLoadError('');const serial=++request.current;
  try{
   const {data:session,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
   if(!session.session){window.location.href=`/login?next=${encodeURIComponent(`/applications/${params.id}`)}`;return;}
   const {data,error}=await supabase.from('rent_applications').select('*').eq('id',params.id).eq('user_id',session.session.user.id).maybeSingle();
   if(request.current!==serial)return;if(error)throw error;
   if(!data){setRow(null);setLoadError('This application is unavailable to this account. Check that you are signed in with the account used to apply.');return;}
   setRow(data as Application);setEmail(session.session.user.email??'');setUpdatedAt(new Date());setStatusVersion(v=>v+1);setConfirmCancel(false);
   setHistoryLoading(true);setHistoryError('');
   const result=await supabase.from('application_status_history').select('id,from_status,to_status,reason,created_at').eq('application_id',data.id).order('created_at',{ascending:false}).limit(50);
   if(request.current!==serial)return;
   if(result.error)setHistoryError('We could not load your review history. Refresh to try again.');else setHistory(result.data??[]);
  }catch{if(request.current===serial)setLoadError('We could not refresh this application. Check your connection and try again.');}
  finally{if(request.current===serial){setLoading(false);setRefreshing(false);setHistoryLoading(false);inFlight.current=false;}}
 };
 useEffect(()=>{inFlight.current=false;setRow(null);setHistory([]);setLoading(true);setContract({});setContractError('');setActionError('');setMessage('');void load();return()=>{request.current++;};},[params.id]);
 const openContract=async(mode:'preview'|'download')=>{
  if(!row?.contract_file_path||contractInFlight.current)return;contractInFlight.current=true;setOpening(mode);setContractError('');
  const preview=mode==='preview'?window.open('about:blank','_blank'):null;if(preview)preview.opener=null;
  try{const link=await createContractLink(row.contract_file_path,row.contract_file_name,{locale:'en',download:mode==='download'});setContract(current=>({...current,[mode]:link.url}));
   if(mode==='download')window.location.assign(link.url);else if(preview)preview.location.href=link.url;else setContractError('Your browser blocked the preview. Use Open file below, or allow pop-ups and try again.');
  }catch(e){preview?.close();setContractError(e instanceof Error?e.message:'We could not open this contract. Please try again.');}
  finally{contractInFlight.current=false;setOpening(null);}
 };
 const cancel=async()=>{
  if(!row||row.status!=='pending_review'||cancelInFlight.current)return;cancelInFlight.current=true;setCancelling(true);setActionError('');setMessage('');
  try{const {data,error}=await supabase.rpc('cancel_rent_application',{p_application_id:row.id});if(error)throw error;
   if(!data){await load();throw new Error('This application may already have been processed. Check the refreshed status.');}
   await load();setConfirmCancel(false);setMessage('Your application has been cancelled. You can still view the submitted details and history.');
  }catch(e){setActionError(e&&typeof e==='object'&&'message'in e?String(e.message):'We could not cancel this application. Refresh its status before trying again.');}
  finally{cancelInFlight.current=false;setCancelling(false);}
 };
 return <main className="dashboard-page work-page tenant-detail"><AccountHeader/><section className="wrap work-main work-detail-main">
  <Link href="/applications" className="work-back"><ArrowLeft size={16}/> All applications</Link>
  {loading?<div className="work-loading" role="status">Loading your application…</div>:!row?<div className="work-empty"><h1>Application unavailable</h1><p role="alert">{loadError}</p><div className="tenant-detail-actions"><button className="work-button" disabled={refreshing} onClick={load}>Try again</button><Link href="/dashboard" className="work-button">Return to dashboard</Link></div></div>:<>
   <div className="work-page-heading"><div><h1>Application details</h1><p>{row.application_number||row.id.slice(0,8).toUpperCase()}</p><small>Submitted {new Date(row.submitted_at||row.created_at).toLocaleString('en-GB')}</small></div><div className="tenant-refresh"><span aria-live="polite">{refreshing?'Updating…':updatedAt?`Updated ${updatedAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:''}</span><button className="work-button" disabled={refreshing||cancelling} onClick={load}><RefreshCw size={15}/>{refreshing?'Refreshing…':'Refresh status'}</button></div></div>
   {loadError&&<div className="work-error" role="alert"><p>{loadError}</p><p>Showing the last loaded information. Status may have changed.</p></div>}
   {message&&<p className="work-feedback" role="status">{message}</p>}
   <nav className="tenant-detail-nav" aria-label="Application sections"><a href="#application-status">Status & next step</a><a href="#application-details">Submitted details</a><a href="#lease-contract">Lease contract</a><a href="#review-history">Review history</a></nav>
   <div id="application-status"><PaymentOrder key={`${row.id}:${statusVersion}`} applicationId={row.id} approved={row.status==='approved'} applicationStatus={row.status}/></div>
   {row.status==='rejected'&&<div className="work-error"><strong>Review outcome</strong><p>{row.rejection_reason||'No additional reason was provided. Contact support if you need clarification.'}</p><Link href="/contact">Contact support</Link></div>}
   <div className="work-detail-columns"><section className="work-sheet" id="application-details"><h2>Submitted details</h2><dl className="work-facts">
    <div><dt>Applicant</dt><dd>{row.applicant_name||'Your account'}<small>{row.applicant_email||email}</small></dd></div>
    <div><dt>Property address</dt><dd>{row.property_address||'Not provided'}</dd></div><div><dt>Lease period</dt><dd className="tenant-lease-period"><span>{row.contract_start_date||'—'}</span><span>— {row.contract_end_date||'—'}</span></dd></div>
    <div><dt>Monthly rent</dt><dd>{money(row.rent_amount)}</dd></div><div><dt>Service fee at submission</dt><dd>{row.service_fee===0?'₩0 in this test · live pricing to be confirmed':money(row.service_fee)}</dd></div>
    <div className="tenant-detail-total"><dt>Application test amount</dt><dd>{money(row.total_amount)}</dd></div><div><dt>Landlord / account holder</dt><dd>{row.landlord_name||'Not provided'}</dd></div><div><dt>Landlord’s Korean bank account</dt><dd>{bankLabel(row.landlord_bank)}<small>{row.landlord_account?`Account ending ${row.landlord_account.replace(/\D/g,'').slice(-4)}`:'Account number not provided'}</small></dd></div>
   </dl></section><section className="work-sheet" id="lease-contract"><h2>Lease contract</h2><div className="work-file"><FileText size={24}/><div><strong>{row.contract_file_name||'No contract attached'}</strong><p>{row.contract_file_size?`${(row.contract_file_size/1024).toFixed(1)} KB · `:''}Private file</p></div></div>
    {row.contract_file_path?<div className="tenant-detail-actions"><button type="button" className="work-button" onClick={()=>openContract('preview')} disabled={opening!==null}>{opening==='preview'?'Opening…':'Preview contract'} <ExternalLink size={15}/></button><button type="button" className="work-button" onClick={()=>openContract('download')} disabled={opening!==null}>{opening==='download'?'Preparing…':'Download'} <Download size={15}/></button></div>:<p className="work-hint">No file is available for this application. Contact support if you expected to see a contract.</p>}
    {contractError&&<p className="work-error" role="alert">{contractError}</p>}
    {(contract.preview||contract.download)&&<div className="work-file-links">{contract.preview&&<a href={contract.preview} target="_blank" rel="noopener noreferrer">Open file <ExternalLink size={14}/></a>}{contract.download&&<a href={contract.download} download={row.contract_file_name||'contract'}>Download file <Download size={14}/></a>}<small>Links expire after 5 minutes. Use Preview or Download above to create a fresh link.</small></div>}
    <p className="work-hint">Only you and authorized administrators can request access. Do not share a secure file link.</p>
   </section></div>
   <details className="work-disclosure tenant-review-history" id="review-history" open><summary><span>Application review history</span><small>{historyLoading?'Loading…':historyError?'Unavailable':`${history.length} recent events`}</small></summary><div className="work-disclosure-body">{historyLoading?<p role="status">Loading review updates…</p>:historyError?<div role="alert"><p>{historyError}</p><button className="work-button" disabled={refreshing} onClick={load}>Reload history</button></div>:history.length?<ol className="work-timeline">{history.map(e=><li key={e.id}><time>{new Date(e.created_at).toLocaleString('en-GB')}</time><strong>{reviewLabels[e.from_status??'']||e.from_status||'Submitted'} → {reviewLabels[e.to_status]||e.to_status}</strong><p>{e.reason||'No additional note'}</p></li>)}</ol>:<p>No review updates have been recorded yet.</p>}</div></details>
   {row.status==='pending_review'&&<section className="work-cancel" aria-labelledby="cancel-heading"><div><strong id="cancel-heading">Need to withdraw this application?</strong><p>You can cancel while the review is pending. The submitted details remain in your history.</p></div>{!confirmCancel&&<button type="button" className="work-button" onClick={()=>{setConfirmCancel(true);setActionError('');}}>Cancel application</button>}</section>}
   {confirmCancel&&row.status==='pending_review'&&<section className="tenant-cancel-confirm" aria-labelledby="cancel-confirm-title"><h2 id="cancel-confirm-title">Cancel this application?</h2><p>This ends the review for {row.application_number||row.id.slice(0,8).toUpperCase()}. You will need a new application if you want to apply again.</p><div className="tenant-detail-actions"><button className="work-button" disabled={cancelling} onClick={()=>setConfirmCancel(false)}>Keep application</button><button className="work-button work-button-danger" disabled={cancelling} onClick={cancel}>{cancelling?'Cancelling…':'Confirm cancellation'}</button></div></section>}
   {actionError&&<p className="work-error" role="alert">{actionError}</p>}
   <footer className="work-footer"><div><Link href="/dashboard">My dashboard</Link><Link href="/contact">Need help?</Link></div><Link href="/applications">All applications</Link></footer>
  </>}
 </section></main>;
}
