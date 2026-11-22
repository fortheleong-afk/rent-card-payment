'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { ArrowRight,Download,ExternalLink,FileText,LogOut,RefreshCw,ShieldCheck,X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createContractLink } from '../../lib/contracts';
import { getJourney,OrderSummary } from '../../lib/workflow';
import { StatusBadge,TestNotice } from '../../components/WorkflowStatus';
import PaymentOrder from '../../components/PaymentOrder';
import styles from './admin.module.css';
type Application={id:string;application_number:string|null;user_id:string;applicant_name:string|null;applicant_phone:string|null;applicant_email:string|null;property_address:string|null;contract_start_date:string|null;contract_end_date:string|null;landlord_name:string|null;landlord_bank:string|null;landlord_account_last4:string|null;contract_file_path:string|null;contract_file_name:string|null;contract_file_size:number|null;rent_amount:number;service_fee:number;total_amount:number;rejection_reason:string|null;status:string;created_at:string;submitted_at:string|null;rent_month:string|null;rent_due_date:string|null;review_entered_at:string|null;revision:number;correction_reason:string|null};
type QueueRow=Pick<Application,'id'|'application_number'|'applicant_name'|'applicant_email'|'status'|'rent_amount'|'created_at'|'submitted_at'|'review_entered_at'> & OrderSummary;
type History={id:string;from_status:string|null;to_status:string;reason:string|null;created_at:string};
const reviewLabels:Record<string,string>={pending_review:'심사 대기',needs_changes:'보완 대기',approved:'심사 승인',rejected:'심사 반려',cancelled:'신청 취소'};
const queues=[['review','심사 대기'],['changes','보완 대기'],['attention','실패·확인 필요'],['payment','결제 준비'],['payout','지급 대기·처리 중'],['complete','지급 완료'],['closed','반려·취소·환불'],['all','전체']] as const;
const nextActions:Record<string,string>={review:'계약서·신청 정보 검토',needs_changes:'신청자 보완 자료 대기',ready:'테스트 주문 생성',payment:'결제 시뮬레이션',payment_failed:'결제 실패 원인 확인',payout:'테스트 지급 시작',payout_processing:'지급 결과 처리',payout_attention:'지급 이력·재시도 확인',complete:'처리 이력 확인',rejected:'반려 사유 확인',cancelled:'취소 이력 확인',closed:'종료된 주문 확인',legacy:'기존 처리 상태 확인'};
const queueHints:Record<string,string>={review:'계약서와 신청 정보를 대조한 뒤 심사 결과를 선택하세요.',changes:'신청자가 요청받은 내용을 보완하면 심사 대기 목록에 다시 표시됩니다.',attention:'실패 원인과 주문 이력을 확인하세요. 중복 결제 없이 다음 테스트를 진행합니다.',payment:'승인된 신청의 주문 생성과 테스트 결제를 진행합니다.',payout:'테스트 결제 완료 건의 지급 진행 상태를 확인합니다.',complete:'테스트 지급까지 완료된 신청과 처리 이력을 확인합니다.',closed:'반려·신청 취소·결제 취소·환불로 종료된 건입니다.',all:'모든 신청을 심사·결제·지급 상태와 함께 확인합니다.'};
const money=(n:number)=>`₩${Number(n||0).toLocaleString('ko-KR')}`;
export default function Admin(){
 const [visible,setRows]=useState<QueueRow[]>([]),[counts,setCounts]=useState<Record<string,number>>({}),[page,setPage]=useState(0),[filter,setFilter]=useState('review'),[search,setSearch]=useState(''),[sort,setSort]=useState('priority');
 const [refreshing,setRefreshing]=useState(false),[updatedAt,setUpdatedAt]=useState<Date|null>(null);
 const queueRequest=useRef(0);
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(''),[loadError,setLoadError]=useState(''),[authorized,setAuthorized]=useState(false);
 const [selected,setSelected]=useState<Application|null>(null),[history,setHistory]=useState<History[]>([]),[historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(false);
 const [contract,setContract]=useState<{url:string;fileName:string}|null>(null),[contractError,setContractError]=useState(''),[opening,setOpening]=useState(false);
 const [rejecting,setRejecting]=useState<Application|null>(null),[reason,setReason]=useState(''),[reviewError,setReviewError]=useState(''),[reviewing,setReviewing]=useState(false);
 const dialogRef=useRef<HTMLDivElement>(null),selectionId=useRef('');
 const [decision,setDecision]=useState<'rejected'|'needs_changes'>('rejected');
 const load=useCallback(async()=>{
  const request=++queueRequest.current;
  setRefreshing(true);setLoadError('');
  try{
   const {data,error}=await supabase.rpc('admin_application_queue',{p_search:search,p_queue:filter,p_sort:sort,p_page:page});
   if(request!==queueRequest.current)return;
   if(error||!data)throw error;
   setRows(data.rows);setCounts(data.counts);setUpdatedAt(new Date());
   if(page>0&&!data.rows.length)setPage(current=>Math.max(0,current-1));
  }catch{
   if(request===queueRequest.current)setLoadError('신청·거래 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
  }finally{if(request===queueRequest.current)setRefreshing(false);}
 },[search,filter,sort,page]);
 useEffect(()=>{
  if(!authorized)return;
  const timer=window.setTimeout(()=>void load(),200);
  const currentRequest=queueRequest;
  return()=>{window.clearTimeout(timer);currentRequest.current++;};
 },[authorized,load]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search),q=params.get('queue'),order=params.get('sort');
  if(queues.some(([id])=>id===q))setFilter(q!);
  if(order&&['priority','newest','oldest'].includes(order))setSort(order);
 },[]);
 useEffect(()=>{
  if(loading)return;const url=new URL(window.location.href);url.searchParams.set('queue',filter);url.searchParams.set('sort',sort);window.history.replaceState(null,'',url);
 },[filter,sort,loading]);
 useEffect(()=>{(async()=>{
  try{const {data:s}=await supabase.auth.getSession();if(!s.session){window.location.href='/login?next=%2Fadmin';return;}
   const {data:p}=await supabase.from('profiles').select('role').eq('id',s.session.user.id).single();if(p?.role!=='admin'){setMessage('관리자 권한이 없는 계정입니다.');return;}setAuthorized(true);
  }catch{setLoadError('관리자 화면을 불러오지 못했습니다. 새로고침해주세요.');}finally{setLoading(false);}
 })();},[]);
 const selectedOpen=Boolean(selected),rejectOpen=Boolean(rejecting);
 useEffect(()=>{
  if(!selectedOpen&&!rejectOpen)return;
  const previous=document.activeElement as HTMLElement;const root=dialogRef.current;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  root?.focus();const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!reviewing){setSelected(null);setRejecting(null);}
   if(e.key==='Tab'&&root){const items=Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],textarea:not([disabled]),summary,input:not([disabled])')).filter(el=>el.getClientRects().length>0);const first=items[0],last=items[items.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){last.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root)){first.focus();e.preventDefault();}}
  };document.addEventListener('keydown',key);return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[selectedOpen,rejectOpen,reviewing]);
 const loadHistory=async(id:string)=>{
  setHistoryLoading(true);setHistoryError('');
  try{const result=await supabase.from('application_status_history').select('id,from_status,to_status,reason,created_at').eq('application_id',id).order('created_at',{ascending:false});
   if(selectionId.current!==id)return;if(result.error)throw result.error;setHistory(result.data??[]);
  }catch{if(selectionId.current===id)setHistoryError('심사 이력을 불러오지 못했습니다.');}
  finally{if(selectionId.current===id)setHistoryLoading(false);}
 };
 const selectRow=async (row:QueueRow)=>{
  selectionId.current=row.id;setHistory([]);setReviewError('');setContract(null);setContractError('');setMessage('');
  try{
   const {data,error}=await supabase.rpc('admin_application_detail',{p_id:row.id});
   if(selectionId.current!==row.id)return;
   if(error||!data)throw error;
   setSelected(data as Application);
   void loadHistory(row.id);
  }catch{
   if(selectionId.current===row.id)setMessage('신청 상세를 열지 못했습니다. 추가 인증 상태를 확인한 뒤 다시 시도해 주세요.');
  }
 };
 const changeStatus=async(row:Application,status:'approved'|'rejected'|'needs_changes')=>{
  if(reviewing||row.status!=='pending_review')return;setReviewing(true);setReviewError('');setMessage('');
  try{const {data,error}=await supabase.rpc('review_application',{p_id:row.id,p_status:status,p_reason:status==='approved'?'':reason.trim(),p_revision:row.revision});if(error)throw error;
   if(!data){await load();setSelected(null);setRejecting(null);throw new Error('이미 처리된 신청입니다. 최신 목록을 확인해주세요.');}
   await load();setSelected(null);setRejecting(null);setMessage(status==='approved'?'신청을 승인했습니다. 결제 준비 목록에서 테스트 주문을 생성할 수 있습니다.':status==='needs_changes'?'보완 요청을 기록하고 신청자에게 알렸습니다.':'신청을 반려하고 신청자에게 알렸습니다.');
  }catch(e){const text=e&&typeof e==='object'&&'message'in e?String(e.message):'심사 처리에 실패했습니다.';setReviewError(text);setMessage(text);}finally{setReviewing(false);}
 };
 const openContract=async(row:Application,download=false)=>{
  if(opening)return;setOpening(true);setContractError('');const preview=download?null:window.open('about:blank','_blank');if(preview)preview.opener=null;
  try{const {error}=await supabase.rpc('authorize_application_access',{p_id:row.id,p_action:download?'download':'preview'});if(error)throw new Error('계약서 접근을 확인하지 못했습니다. 다시 로그인해 주세요.');const link=await createContractLink(row.contract_file_path,row.contract_file_name,{download});if(selectionId.current!==row.id){preview?.close();return;}if(download){const anchor=document.createElement('a');anchor.href=link.url;anchor.download=link.fileName;anchor.rel='noopener noreferrer';document.body.appendChild(anchor);anchor.click();anchor.remove();return;}setContract(link);if(preview)preview.location.href=link.url;else setContractError('새 탭이 차단됐습니다. 아래의 파일 열기 또는 다운로드를 이용해주세요.');}
  catch(e){preview?.close();if(selectionId.current===row.id)setContractError(e instanceof Error?e.message:'계약서를 열지 못했습니다.');}finally{setOpening(false);}
 };
 const signOut=async()=>{const {error}=await supabase.auth.signOut();if(error){setMessage('로그아웃하지 못했습니다. 다시 시도해주세요.');return;}window.location.href='/';};
 if(loading)return <main className={`work-page ${styles.access}`} lang="ko"><div className="work-loading" role="status">관리자 권한과 최신 거래를 확인하고 있습니다…</div></main>;
 if(!authorized)return <main className={`work-page ${styles.access}`} lang="ko"><div className="work-empty"><h1>관리자 접근을 확인해주세요</h1><p>{message||loadError}</p><Link href="/login?next=%2Fadmin" className="work-button">로그인 화면으로</Link></div></main>;
 return <main className={`admin-page work-admin ${styles.admin}`} lang="ko"><a className={styles.skipLink} href="#admin-content">관리자 본문으로 건너뛰기</a><aside><Link className="brand" href="/"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><nav aria-label="관리자 메뉴"><Link className="side active" href="/admin" aria-current="page"><FileText size={17}/>신청·거래 관리</Link><Link href="/admin/storage-cleanup" className="side"><ShieldCheck size={17}/>계약서 보관 점검</Link><Link href="/admin/operations" className="side">운영 상태</Link><Link href="/dashboard" className="side">사용자 대시보드</Link></nav><button className="admin-logout" onClick={signOut}><LogOut size={16}/> 로그아웃</button></aside>
 <section className="admin-main" id="admin-content" tabIndex={-1}><div className="work-admin-mobile-nav"><Link className="brand" href="/"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><span className="admin-mobile-role">관리자</span><nav aria-label="모바일 관리자 메뉴"><Link href="/dashboard">사용자 대시보드</Link><Link href="/admin/storage-cleanup">파일 점검</Link><Link href="/admin/operations">운영 상태</Link><button onClick={signOut}>로그아웃</button></nav></div>
  <div className="work-page-heading"><div><h1>신청·거래 관리</h1><p>신청 검토부터 테스트 지급까지, 처리할 건을 확인하세요.</p></div><div className="admin-refresh"><span aria-live="polite">{refreshing?'목록 업데이트 중…':updatedAt?`최근 업데이트 ${updatedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`:'아직 불러오지 않음'}</span><button className="work-button" onClick={load} disabled={refreshing}><RefreshCw size={15} aria-hidden="true"/>{refreshing?'불러오는 중…':'새로고침'}</button></div></div><TestNotice locale="ko"/>
  {message&&<div className="work-feedback" role="status">{message}</div>}
  {loadError?<div className="work-error" role="alert"><p>{loadError}</p><button className="work-button" onClick={load} disabled={refreshing}>다시 불러오기</button>{updatedAt&&<small>최근 성공한 조회: {updatedAt.toLocaleTimeString('ko-KR')} · 아래 목록은 이전 조회 결과입니다.</small>}</div>:null}
  <>
  <nav className="work-queue" aria-label="처리 단계 필터">{queues.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);setPage(0);}}>{label}<span>{counts[id]??0}</span></button>)}</nav>
  <div className="admin-mobile-filter"><label htmlFor="admin-queue">처리 단계</label><select id="admin-queue" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>{queues.map(([id,label])=><option key={id} value={id}>{label} · {counts[id]??0}건</option>)}</select></div>
  <section className="work-sheet work-queue-sheet" aria-busy={refreshing} aria-labelledby="queue-title">
   <div className="work-section-heading"><div><h2 id="queue-title">{queues.find(q=>q[0]===filter)?.[1]} <span className="work-count">{counts[filter]??0}건</span></h2><p className="admin-queue-hint">{queueHints[filter]}</p></div></div>
   <div className="admin-list-toolbar"><div className="work-search"><label className="work-sr-only" htmlFor="admin-search">이름, 이메일, 신청번호 검색</label><input id="admin-search" type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="이름, 이메일, 신청번호 검색" aria-describedby="admin-search-scope"/></div><div className="admin-sort"><label htmlFor="admin-sort">정렬</label><select id="admin-sort" value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="priority">처리 우선순위</option><option value="newest">최신 접수순</option><option value="oldest">오래된 접수순</option></select></div></div>
   <div className={`admin-list-context ${search.trim()?'':'admin-sort-hint'}`} id="admin-search-scope" role="status">{search.trim()?<><span>현재 단계 {counts[filter]??0}건 · 전체 검색 결과 {counts.all??0}건</span>{filter!=='all'&&<button className="work-text-button" onClick={()=>{setFilter('all');setPage(0);}}>전체 단계에서 검색</button>}<button className="work-text-button" onClick={()=>{setSearch('');setPage(0);}}>검색 지우기</button></>:<span>{sort==='priority'?'실패·확인 필요 건을 먼저, 심사 대기는 오래된 접수부터 표시합니다.':sort==='newest'?'최근 접수된 신청부터 표시합니다.':'먼저 접수된 신청부터 표시합니다.'}</span>}</div>
  <div className="work-table-scroll"><table className="work-table"><thead><tr><th scope="col">신청자 · 신청번호</th><th scope="col" className="work-money">월세 · 접수일</th><th scope="col">현재 상태</th><th scope="col">다음 할 일</th><th scope="col"><span className="work-sr-only">상세 보기</span></th></tr></thead><tbody>{visible.map(row=>{const j=getJourney(row.status,row.payment_status?row:null,'ko');return <tr key={row.id}><td><strong>{row.applicant_name||'이름 미입력'}</strong><small>{row.applicant_email||'이메일 미입력'}</small><button className="work-row-reference" onClick={()=>selectRow(row)}>{row.application_number||row.id.slice(0,8).toUpperCase()}</button></td><td className="work-money">{money(row.rent_amount)}<small>{new Date(row.submitted_at||row.created_at).toLocaleDateString('ko-KR')}</small>{row.status==='pending_review'&&row.review_entered_at&&<small>심사 대기 {Math.max(0,Math.floor((Date.now()-Date.parse(row.review_entered_at))/3600000))}시간</small>}</td><td><StatusBadge journey={j}/></td><td className="work-task-copy">{nextActions[j.key]||j.next}</td><td><button className="work-button" onClick={()=>selectRow(row)} aria-label={`${row.application_number||row.id.slice(0,8)} ${row.status==='pending_review'?'심사하기':'거래 보기'}`}>{row.status==='pending_review'?'심사하기':'거래 보기'}<ArrowRight size={14}/></button></td></tr>;})}</tbody></table></div>
  {!visible.length&&<div className="work-empty"><h3>{search?'검색 결과가 없습니다':'이 단계에 처리할 신청이 없습니다'}</h3><p>{search?(counts.all?'다른 단계에 검색 결과가 있습니다. 전체 단계에서 확인하세요.':'이름, 이메일 또는 신청번호를 다시 확인하세요.'):'다른 처리 단계의 신청을 확인할 수 있습니다.'}</p>{!search.trim()&&<button className="work-button" onClick={()=>{setFilter('all');setPage(0);}}>전체 신청 보기</button>}</div>}
  {(counts[filter]??0)>25&&<nav className="work-footer" aria-label="신청 목록 페이지">
    <button className="work-button" disabled={page===0||refreshing} onClick={()=>setPage(p=>p-1)}>이전</button>
    <span>{page+1} / {Math.ceil((counts[filter]??0)/25)} 페이지</span>
    <button className="work-button" disabled={(page+1)*25>=(counts[filter]??0)||refreshing} onClick={()=>setPage(p=>p+1)}>다음</button>
  </nav>}
  </section></>
  {selected&&<div className="admin-overlay work-overlay" onClick={()=>{if(!reviewing)setSelected(null);}}><div className="admin-drawer work-drawer" role="dialog" aria-modal="true" aria-labelledby="review-title" ref={dialogRef} tabIndex={-1} onClick={e=>e.stopPropagation()}>
   <div className="work-drawer-header"><div><h2 id="review-title">{selected.status==='pending_review'?'신청 심사':'거래 상세'}</h2><p>{selected.application_number||selected.id.slice(0,8).toUpperCase()}</p><small>접수 {new Date(selected.submitted_at||selected.created_at).toLocaleString('ko-KR')}</small></div><button type="button" className="work-icon-button" aria-label="상세 닫기" disabled={reviewing} onClick={()=>setSelected(null)}><X size={22}/></button></div>
   <div className="work-drawer-content">
    {selected.status==='pending_review'?<><TestNotice locale="ko"/><div className="admin-review-summary"><StatusBadge journey={getJourney(selected.status,null,'ko')}/><p>계약서와 아래 정보를 대조한 뒤 심사 결과를 선택하세요.</p></div></>:<PaymentOrder key={selected.id} applicationId={selected.id} approved={selected.status==='approved'} applicationStatus={selected.status} simulator onOrderChange={load}/>}
    <section className="work-review-evidence"><h3>신청자·임대차 정보</h3><dl className="work-facts"><div><dt>신청자</dt><dd>{selected.applicant_name||'미입력'}<small>{selected.applicant_email||'—'} · {selected.applicant_phone||'연락처 미입력'}</small></dd></div><div><dt>주소</dt><dd>{selected.property_address||'미입력'}</dd></div><div><dt>계약 기간</dt><dd>{selected.contract_start_date||'—'} ~ {selected.contract_end_date||'—'}</dd></div><div><dt>납부 대상 월 · 기한</dt><dd>{selected.rent_month?.slice(0,7)??'—'} · {selected.rent_due_date??'—'}</dd></div><div><dt>월세</dt><dd>{money(selected.rent_amount)}</dd></div><div><dt>접수 당시 이용료</dt><dd>{selected.service_fee===0?'₩0 · 요율 미정 (테스트)':money(selected.service_fee)}</dd></div><div><dt>총 테스트 금액</dt><dd>{money(selected.total_amount)}</dd></div><div><dt>임대인 · 입금 계좌</dt><dd>{selected.landlord_name||'미입력'}<small>{selected.landlord_bank||'—'} · {selected.landlord_account_last4?`••••${selected.landlord_account_last4}`:'—'}</small></dd></div></dl>
     <h3 className="admin-evidence-heading">제출 계약서</h3><div className="work-file"><FileText size={24}/><div><strong>{selected.contract_file_name||'제출된 계약서 없음'}</strong><p>{selected.contract_file_size?`${(selected.contract_file_size/1024).toFixed(1)} KB`:'크기 정보 없음'} · 비공개 파일</p></div></div><button className="work-button" onClick={()=>openContract(selected)} disabled={opening||!selected.contract_file_path}>{opening?'계약서 확인 중…':'계약서 열기'}<ExternalLink size={15}/></button>
     {contractError&&<p className="work-error" role="alert">{contractError}</p>}{contract&&<div className="work-file-links"><a href={contract.url} target="_blank" rel="noreferrer">파일 다시 열기 <ExternalLink size={14}/></a><button type="button" className="work-text-button" disabled={opening} onClick={()=>selected&&openContract(selected,true)}>다운로드 <Download size={14}/></button><small>링크는 5분간 유효합니다.</small></div>}
    </section>
    {selected.correction_reason&&selected.status==='needs_changes'&&<div className="work-feedback"><strong>보완 요청</strong><p>{selected.correction_reason}</p></div>}
    {selected.rejection_reason&&<div className="work-error"><strong>반려 사유</strong><p>{selected.rejection_reason}</p></div>}
    <details className="work-disclosure"><summary><span>심사 이력</span><small>{historyLoading?'불러오는 중…':historyError?'조회 실패':`${history.length}건`}</small></summary><div className="work-disclosure-body">{historyLoading?<p role="status">심사 이력을 불러오고 있습니다.</p>:historyError?<div role="alert"><p>{historyError}</p><button className="work-button" onClick={()=>loadHistory(selected.id)}>이력 다시 불러오기</button></div>:!history.length?<p>아직 기록된 심사 이력이 없습니다.</p>:<ol className="work-timeline">{history.map(h=><li key={h.id}><time>{new Date(h.created_at).toLocaleString('ko-KR')}</time><strong>{reviewLabels[h.from_status??'']||h.from_status||'신청'} → {reviewLabels[h.to_status]||h.to_status}</strong><p>{h.reason||'추가 사유 없음'}</p></li>)}</ol>}</div></details>
    {reviewError&&<p className="work-error" role="alert">{reviewError}</p>}
   </div>
   <div className="work-drawer-footer">{selected.status==='pending_review'?<><button className="work-button" disabled={reviewing} onClick={()=>{setDecision('rejected');setReason('');setReviewError('');setRejecting(selected);setSelected(null);}}>반려 검토</button><button className="work-button" disabled={reviewing} onClick={()=>{setDecision('needs_changes');setReason('');setReviewError('');setRejecting(selected);setSelected(null);}}>보완 요청</button><button className="work-button work-button-primary" disabled={reviewing} onClick={()=>changeStatus(selected,'approved')}>{reviewing?'처리 중…':'검토 완료 · 승인'}</button></>:<button className="work-button" onClick={()=>setSelected(null)}>목록으로</button>}</div>
  </div></div>}
  {rejecting&&<div className="admin-overlay work-overlay"><div className="work-reject-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title" ref={dialogRef} tabIndex={-1}><h2 id="reject-title">{decision==='needs_changes'?'자료 보완 요청':'신청 반려'}</h2><p>{rejecting.application_number||rejecting.id.slice(0,8)} · 입력한 내용은 신청자에게 표시됩니다.</p><label htmlFor="reject-reason">{decision==='needs_changes'?'수정할 내용 (필수)':'반려 사유 (선택)'}</label><textarea id="reject-reason" value={reason} maxLength={1000} disabled={reviewing} onChange={e=>setReason(e.target.value)} placeholder="예: 계약서의 월세 금액을 확인할 수 없습니다."/>{reviewError&&<p className="work-error" role="alert">{reviewError}</p>}<div className="work-dialog-actions"><button className="work-button" disabled={reviewing} onClick={()=>{setSelected(rejecting);setRejecting(null);}}>돌아가기</button><button className="work-button work-button-danger" disabled={reviewing||(decision==='needs_changes'&&!reason.trim())} onClick={()=>changeStatus(rejecting,decision)}>{reviewing?'처리 중…':decision==='needs_changes'?'보완 요청 보내기':'신청 반려'}</button></div></div></div>}
 </section></main>;
}
