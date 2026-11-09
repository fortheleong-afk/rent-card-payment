'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { ArrowRight,Download,ExternalLink,FileText,LogOut,ShieldCheck,X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createContractLink } from '../../lib/contracts';
import { getJourney,OrderSummary } from '../../lib/workflow';
import { JourneyPanel,StatusBadge,TestNotice } from '../../components/WorkflowStatus';
import PaymentOrder from '../../components/PaymentOrder';
type Application={id:string;application_number:string|null;user_id:string;applicant_name:string|null;applicant_phone:string|null;applicant_email:string|null;property_address:string|null;contract_start_date:string|null;contract_end_date:string|null;landlord_name:string|null;landlord_bank:string|null;landlord_account:string|null;contract_file_path:string|null;contract_file_name:string|null;contract_file_size:number|null;rent_amount:number;service_fee:number;total_amount:number;rejection_reason:string|null;status:string;created_at:string;submitted_at:string|null};
type History={id:string;from_status:string|null;to_status:string;reason:string|null;created_at:string};
const reviewLabels:Record<string,string>={pending_review:'심사 대기',approved:'심사 승인',rejected:'심사 반려',cancelled:'신청 취소'};
const queues=[['review','심사 대기'],['attention','실패·확인 필요'],['payment','결제 준비'],['payout','지급 대기·처리 중'],['complete','지급 완료'],['all','전체']] as const;
const money=(n:number)=>`₩${Number(n||0).toLocaleString('ko-KR')}`;
export default function Admin(){
 const [rows,setRows]=useState<Application[]>([]),[orders,setOrders]=useState<Record<string,OrderSummary>>({}),[filter,setFilter]=useState('review'),[search,setSearch]=useState('');
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(''),[loadError,setLoadError]=useState(''),[authorized,setAuthorized]=useState(false);
 const [selected,setSelected]=useState<Application|null>(null),[history,setHistory]=useState<History[]>([]),[historyError,setHistoryError]=useState('');
 const [contract,setContract]=useState<{url:string;fileName:string}|null>(null),[contractError,setContractError]=useState(''),[opening,setOpening]=useState(false);
 const [rejecting,setRejecting]=useState<Application|null>(null),[reason,setReason]=useState(''),[reviewError,setReviewError]=useState(''),[reviewing,setReviewing]=useState(false);
 const dialogRef=useRef<HTMLDivElement>(null),selectionId=useRef('');
 const loadOrders=async()=>{
  const result=await supabase.from('payment_orders').select('application_id,payment_status,payout_status');
  if(result.error){setLoadError('결제·지급 상태를 불러오지 못했습니다. 다시 확인해주세요.');return;}
  setOrders(Object.fromEntries((result.data??[]).map(o=>[o.application_id,o])));
 };
 const load=async()=>{
  setLoadError('');
  const [apps,os]=await Promise.all([supabase.from('rent_applications').select('*').order('created_at',{ascending:false}),supabase.from('payment_orders').select('application_id,payment_status,payout_status')]);
  if(apps.error||os.error){setLoadError('신청·거래 상태를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.');return;}
  const applications=apps.data as Application[];const ids=Array.from(new Set(applications.map(a=>a.user_id)));
  const [ps,us]=ids.length?await Promise.all([supabase.from('profiles').select('id,full_name,phone').in('id',ids),supabase.rpc('admin_user_contacts',{p_user_ids:ids})]):[{data:[]},{data:[]}];
  const pm=new Map((ps.data??[]).map((p:{id:string;full_name:string|null;phone:string|null})=>[p.id,p]));
  const um=new Map<string,string>((us.data??[]).map((u:{id:string;email:string})=>[u.id,u.email]));
  setRows(applications.map(a=>({...a,applicant_name:a.applicant_name??pm.get(a.user_id)?.full_name??null,applicant_phone:a.applicant_phone??pm.get(a.user_id)?.phone??null,applicant_email:a.applicant_email??um.get(a.user_id)??null})));
  setOrders(Object.fromEntries((os.data??[]).map(o=>[o.application_id,o])));
 };
 useEffect(()=>{(async()=>{
  try{const {data:s}=await supabase.auth.getSession();if(!s.session){window.location.href='/login?next=%2Fadmin';return;}
   const {data:p}=await supabase.from('profiles').select('role').eq('id',s.session.user.id).single();if(p?.role!=='admin'){setMessage('관리자 권한이 없는 계정입니다.');return;}setAuthorized(true);await load();
  }catch{setLoadError('관리자 화면을 불러오지 못했습니다. 새로고침해주세요.');}finally{setLoading(false);}
 })();},[]);
 useEffect(()=>{
  if(!selected&&!rejecting)return;
  const previous=document.activeElement as HTMLElement;const root=dialogRef.current;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  root?.focus();const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!reviewing){setSelected(null);setRejecting(null);}
   if(e.key==='Tab'&&root){const items=Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],textarea:not([disabled]),summary,input:not([disabled])')).filter(el=>el.getClientRects().length>0);const first=items[0],last=items[items.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){last.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root)){first.focus();e.preventDefault();}}
  };document.addEventListener('keydown',key);return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[Boolean(selected),Boolean(rejecting),reviewing]);
 const selectRow=async(row:Application)=>{
  selectionId.current=row.id;setSelected(row);setHistory([]);setHistoryError('');setContract(null);setContractError('');
  const result=await supabase.from('application_status_history').select('id,from_status,to_status,reason,created_at').eq('application_id',row.id).order('created_at',{ascending:false});
  if(selectionId.current!==row.id)return;setHistory(result.data??[]);if(result.error)setHistoryError('심사 이력을 불러오지 못했습니다.');
 };
 const changeStatus=async(row:Application,status:'approved'|'rejected')=>{
  if(reviewing||row.status!=='pending_review')return;setReviewing(true);setReviewError('');setMessage('');
  try{const {data,error}=await supabase.rpc('review_rent_application',{p_application_id:row.id,p_status:status,p_reason:status==='rejected'?reason.trim():''});if(error)throw error;
   if(!data){await load();setSelected(null);setRejecting(null);throw new Error('이미 처리된 신청입니다. 최신 목록을 확인해주세요.');}
   await load();setSelected(null);setRejecting(null);setMessage(status==='approved'?'신청을 승인했습니다. 결제 준비 목록에서 테스트 주문을 생성할 수 있습니다.':'신청을 반려하고 신청자에게 알렸습니다.');
  }catch(e){const text=e&&typeof e==='object'&&'message'in e?String(e.message):'심사 처리에 실패했습니다.';setReviewError(text);setMessage(text);}finally{setReviewing(false);}
 };
 const openContract=async(row:Application)=>{
  if(opening)return;setOpening(true);setContractError('');const preview=window.open('about:blank','_blank');
  try{const link=await createContractLink(row.contract_file_path,row.contract_file_name);setContract(link);if(preview)preview.location.href=link.url;else setContractError('새 탭이 차단됐습니다. 아래의 파일 열기 또는 다운로드를 이용해주세요.');}
  catch(e){preview?.close();setContractError(e instanceof Error?e.message:'계약서를 열지 못했습니다.');}finally{setOpening(false);}
 };
 const matchesQueue=(a:Application,q:string)=>{
  const key=getJourney(a.status,orders[a.id],'ko').key;
  return q==='all'||q==='review'&&key==='review'||q==='attention'&&['payout_attention','payment_failed','legacy'].includes(key)||q==='payment'&&['ready','payment'].includes(key)||q==='payout'&&['payout','payout_processing'].includes(key)||q==='complete'&&key==='complete';
 };
 const visible=rows.filter(a=>matchesQueue(a,filter)&&(!search.trim()||[a.application_number,a.applicant_name,a.applicant_email,a.user_id].some(v=>v?.toLowerCase().includes(search.trim().toLowerCase()))));
 if(loading)return <main className="work-page"><div className="work-loading" role="status">관리자 권한과 최신 거래를 확인하고 있습니다…</div></main>;
 if(!authorized)return <main className="work-page"><div className="work-empty"><h1>관리자 접근을 확인해주세요</h1><p>{message||loadError}</p><Link href="/login?next=%2Fadmin" className="work-button">로그인 화면으로</Link></div></main>;
 return <main className="admin-page work-admin" lang="ko"><aside><Link className="brand" href="/dashboard"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><nav aria-label="관리자 메뉴"><Link className="side active" href="/admin" aria-current="page"><FileText size={17}/>신청·거래 관리</Link><Link href="/admin/storage-cleanup" className="side"><ShieldCheck size={17}/>계약서 보관 점검</Link><Link href="/dashboard" className="side">사용자 대시보드</Link></nav><button className="admin-logout" onClick={async()=>{await supabase.auth.signOut();window.location.href='/';}}><LogOut size={16}/> 로그아웃</button></aside>
 <section className="admin-main"><div className="work-admin-mobile-nav"><strong>Divercity Pay · 관리자</strong><Link href="/dashboard">대시보드</Link><Link href="/admin/storage-cleanup">파일 점검</Link></div>
  <div className="work-page-heading"><div><h1>신청·거래 관리</h1><p>처리할 신청을 고르고, 다음 조치부터 확인하세요.</p></div><button className="work-button" onClick={load}>목록 새로고침</button></div><TestNotice locale="ko"/>
  {message&&<div className="work-feedback" role="status">{message}</div>}
  {loadError?<div className="work-error" role="alert"><p>{loadError}</p><button className="work-button" onClick={load}>다시 불러오기</button></div>:<>
  <nav className="work-queue" aria-label="처리 단계 필터">{queues.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<span>{rows.filter(a=>matchesQueue(a,id)).length}</span></button>)}</nav>
  <section className="work-sheet work-queue-sheet"><div className="work-section-heading"><h2>{queues.find(q=>q[0]===filter)?.[1]} <span className="work-count">{visible.length}</span></h2><div className="work-search"><label htmlFor="admin-search">신청 검색</label><input id="admin-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 이메일, 신청번호"/></div></div>
  <div className="work-table-scroll"><table className="work-table"><thead><tr><th scope="col">신청자 · 신청번호</th><th scope="col" className="work-money">월세</th><th scope="col">현재 상태</th><th scope="col">다음 할 일</th><th scope="col"><span className="work-sr-only">상세 보기</span></th></tr></thead><tbody>{visible.map(row=>{const j=getJourney(row.status,orders[row.id],'ko');return <tr key={row.id}><td><strong>{row.applicant_name||'이름 미입력'}</strong><small>{row.applicant_email||'이메일 미입력'}</small><button className="work-row-reference" onClick={()=>selectRow(row)}>{row.application_number||row.id.slice(0,8).toUpperCase()}</button></td><td className="work-money">{money(row.rent_amount)}<small>{new Date(row.created_at).toLocaleDateString('ko-KR')}</small></td><td><StatusBadge journey={j}/></td><td className="work-task-copy">{j.next}</td><td><button className="work-button" onClick={()=>selectRow(row)} aria-label={`${row.application_number||row.id.slice(0,8)} ${row.status==='pending_review'?'심사하기':'거래 보기'}`}>{row.status==='pending_review'?'심사하기':'거래 보기'}<ArrowRight size={14}/></button></td></tr>;})}</tbody></table></div>
  {!visible.length&&<div className="work-empty"><h3>{search?'검색 결과가 없습니다':'이 단계에 처리할 신청이 없습니다'}</h3><p>{search?'검색어를 바꾸거나 전체 목록을 확인하세요.':'다른 처리 단계의 신청을 확인할 수 있습니다.'}</p><button className="work-button" onClick={()=>{setFilter('all');setSearch('');}}>전체 신청 보기</button></div>}
  </section></>}
  {selected&&<div className="admin-overlay work-overlay" onClick={()=>{if(!reviewing)setSelected(null);}}><div className="admin-drawer work-drawer" role="dialog" aria-modal="true" aria-labelledby="review-title" ref={dialogRef} tabIndex={-1} onClick={e=>e.stopPropagation()}>
   <div className="work-drawer-header"><div><h2 id="review-title">{selected.status==='pending_review'?'신청 심사':'거래 상세'}</h2><p>{selected.application_number||selected.id.slice(0,8).toUpperCase()}</p></div><button type="button" className="work-icon-button" aria-label="상세 닫기" disabled={reviewing} onClick={()=>setSelected(null)}><X size={22}/></button></div>
   <div className="work-drawer-content">
    {selected.status==='pending_review'?<><TestNotice locale="ko"/><JourneyPanel journey={getJourney(selected.status,null,'ko')} locale="ko"/></>:<PaymentOrder key={selected.id} applicationId={selected.id} approved={selected.status==='approved'} applicationStatus={selected.status} simulator onOrderChange={loadOrders}/>}
    <section className="work-review-evidence"><h3>심사에 필요한 정보</h3><dl className="work-facts"><div><dt>신청자</dt><dd>{selected.applicant_name||'미입력'}<small>{selected.applicant_email||'—'} · {selected.applicant_phone||'연락처 미입력'}</small></dd></div><div><dt>주소</dt><dd>{selected.property_address||'미입력'}</dd></div><div><dt>계약 기간</dt><dd>{selected.contract_start_date||'—'} ~ {selected.contract_end_date||'—'}</dd></div><div><dt>월세</dt><dd>{money(selected.rent_amount)}</dd></div><div><dt>임대인 · 입금 계좌</dt><dd>{selected.landlord_name||'미입력'}<small>{selected.landlord_bank||'—'} · {selected.landlord_account?`••••${selected.landlord_account.slice(-4)}`:'—'}</small></dd></div></dl>
     <div className="work-file"><FileText size={24}/><div><strong>{selected.contract_file_name||'제출된 계약서 없음'}</strong><p>{selected.contract_file_size?`${(selected.contract_file_size/1024).toFixed(1)} KB`:'크기 정보 없음'} · 비공개 파일</p></div></div><button className="work-button" onClick={()=>openContract(selected)} disabled={opening||!selected.contract_file_path}>{opening?'계약서 확인 중…':'계약서 열기'}<ExternalLink size={15}/></button>
     {contractError&&<p className="work-error" role="alert">{contractError}</p>}{contract&&<div className="work-file-links"><a href={contract.url} target="_blank" rel="noreferrer">파일 다시 열기 <ExternalLink size={14}/></a><a href={contract.url} download={contract.fileName}>다운로드 <Download size={14}/></a><small>링크는 5분간 유효합니다.</small></div>}
    </section>
    {selected.rejection_reason&&<div className="work-error"><strong>반려 사유</strong><p>{selected.rejection_reason}</p></div>}
    <details className="work-disclosure"><summary><span>접수 금액·제출 정보</span></summary><div className="work-disclosure-body"><dl className="work-facts"><div><dt>접수 당시 총 테스트 금액</dt><dd>{money(selected.total_amount)}</dd></div><div><dt>이용료</dt><dd>{selected.service_fee===0?'미정 (테스트)':money(selected.service_fee)}</dd></div><div><dt>제출일</dt><dd>{new Date(selected.submitted_at||selected.created_at).toLocaleString('ko-KR')}</dd></div></dl></div></details>
    <details className="work-disclosure"><summary><span>심사 이력</span><small>{history.length}건</small></summary><div className="work-disclosure-body">{historyError&&<p role="alert">{historyError}</p>}<ol className="work-timeline">{history.map(h=><li key={h.id}><time>{new Date(h.created_at).toLocaleString('ko-KR')}</time><strong>{reviewLabels[h.from_status??'']||h.from_status||'신청'} → {reviewLabels[h.to_status]||h.to_status}</strong><p>{h.reason||'추가 사유 없음'}</p></li>)}</ol></div></details>
    {reviewError&&<p className="work-error" role="alert">{reviewError}</p>}
   </div>
   <div className="work-drawer-footer">{selected.status==='pending_review'?<><button className="work-button" disabled={reviewing} onClick={()=>{setReason('');setReviewError('');setRejecting(selected);setSelected(null);}}>반려 사유 입력</button><button className="work-button work-button-primary" disabled={reviewing} onClick={()=>changeStatus(selected,'approved')}>{reviewing?'처리 중…':'검토 완료 · 승인'}</button></>:<button className="work-button" onClick={()=>setSelected(null)}>목록으로</button>}</div>
  </div></div>}
  {rejecting&&<div className="admin-overlay work-overlay"><div className="work-reject-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title" ref={dialogRef} tabIndex={-1}><h2 id="reject-title">신청 반려</h2><p>{rejecting.application_number||rejecting.id.slice(0,8)} 신청을 반려합니다. 입력한 사유는 신청자에게 표시됩니다.</p><label htmlFor="reject-reason">반려 사유 <small>(선택)</small></label><textarea id="reject-reason" value={reason} maxLength={1000} disabled={reviewing} onChange={e=>setReason(e.target.value)} placeholder="예: 계약서의 월세 금액을 확인할 수 없습니다."/>{reviewError&&<p className="work-error" role="alert">{reviewError}</p>}<div className="work-dialog-actions"><button className="work-button" disabled={reviewing} onClick={()=>{setSelected(rejecting);setRejecting(null);}}>돌아가기</button><button className="work-button work-button-danger" disabled={reviewing} onClick={()=>changeStatus(rejecting,'rejected')}>{reviewing?'처리 중…':'신청 반려'}</button></div></div></div>}
 </section></main>;
}
