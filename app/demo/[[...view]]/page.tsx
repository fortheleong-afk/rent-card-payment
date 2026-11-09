'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,RotateCcw,ShieldCheck} from 'lucide-react';
import {supabase} from '../../../lib/supabase';
import {isDemoAccount} from '../../../lib/demo-account';
import {DemoApplication,DEMO_STORAGE_KEY,initialDemoApplications} from '../../../lib/demo-fixtures';
import {getJourney} from '../../../lib/workflow';
import {JourneyPanel,StatusBadge} from '../../../components/WorkflowStatus';
import ApplicationDemo from '../../../components/ApplicationDemo';
import '../../home-preview.css';
import './demo.css';

const money=(value:number)=>'₩'+value.toLocaleString('ko-KR');
export default function DemoWorkspace({params}:{params:{view?:string[]}}) {
 const view=params.view?.[0]??'dashboard',admin=view==='admin',router=useRouter();
 const [ready,setReady]=useState(false),[authError,setAuthError]=useState('');
 const [rows,setRows]=useState<DemoApplication[]>(initialDemoApplications),[selected,setSelected]=useState('sample-01');
 const [search,setSearch]=useState(''),[reason,setReason]=useState(''),[feedback,setFeedback]=useState('');
 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(({data,error})=>{
   if(!active)return;
   if(error){setAuthError('Could not verify the demo session. Please log in with the demo account.');return;}
   if(!isDemoAccount(data.user)){router.replace('/login?next=%2Fdemo%2Fdashboard');return;}
   // Only known fixture IDs and workflow values are restored; no production records.
   try{
    const raw=sessionStorage.getItem(DEMO_STORAGE_KEY);
    if(raw){const saved=JSON.parse(raw);if(Array.isArray(saved)){
     const base=initialDemoApplications();
     setRows(base.map(row=>{const previous=saved.find((r:{id?:string})=>r.id===row.id);
      if(!previous)return row;
      return {...row,
       status:['pending_review','approved','rejected','cancelled'].includes(previous.status)?previous.status:row.status,
       payment:['pending','paid','failed','cancelled'].includes(previous.payment)?previous.payment:row.payment,
       payout:['not_ready','pending','completed','failed'].includes(previous.payout)?previous.payout:row.payout,
       history:Array.isArray(previous.history)?previous.history.filter((h:unknown)=>typeof h==='string').slice(0,40):row.history};
     }));
    }}
   }catch{/* session storage is optional; the fixed samples still work. */}
   setReady(true);
  });
  const {data:listener}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')router.replace('/login');});
  return()=>{active=false;listener.subscription.unsubscribe();};
 },[router]);
 const change=(patch:Partial<DemoApplication>,message:string)=>{
  setRows(previous=>{const next=previous.map(row=>row.id===selected?{...row,...patch,history:[message,...row.history].slice(0,40)}:row);
   try{sessionStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(next));}catch{}return next;});
  setFeedback(message);setReason('');
 };
 const reset=()=>{setRows(initialDemoApplications());setSelected('sample-01');setReason('');setFeedback('Sample data reset · 가상 데이터 초기화 완료');try{sessionStorage.removeItem(DEMO_STORAGE_KEY);}catch{}};
 const signOut=async()=>{await supabase.auth.signOut();router.replace('/login');};
 if(!ready)return <main className="dashboard-page"><div className="wrap work-main"><h1>Demo workspace</h1>{authError?<><p role="alert">{authError}</p><Link className="work-button" href="/login?next=%2Fdemo%2Fdashboard">Log in</Link></>:<p role="status">Checking your demo account…</p>}</div></main>;
 const visible=admin?rows:rows.filter(row=>row.name==='Demo Tenant');
 const current=visible.find(row=>row.id===selected)??visible[0];
 const journey=(row:DemoApplication,ko=false)=>getJourney(row.status,row.status==='approved'?{payment_status:row.payment,payout_status:row.payout}:null,ko?'ko':'en');
 const filtered=visible.filter(row=>(row.name+' '+row.reference+' '+row.email).toLowerCase().includes(search.toLowerCase()));
 return <main className="work-page showcase-page">
  <header className="work-header"><div className="wrap showcase-nav"><Link href="/demo/dashboard" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link>
   <nav aria-label="Demo navigation"><Link aria-current={!admin&&view!=='apply'?'page':undefined} href="/demo/dashboard">User dashboard</Link><Link aria-current={admin?'page':undefined} href="/demo/admin">관리자 체험</Link><button className="work-text-button" onClick={signOut}>Log out</button></nav></div></header>
  <div className="wrap work-main">
   <div className="showcase-notice"><ShieldCheck size={21}/><div><strong>Demo account · 가상 데이터 전용</strong><p>No real applicants, contracts or transactions. Actions affect this browser tab only. 실제 개인정보·운영 데이터에는 접근하지 않습니다.</p></div></div>
   <div className="work-page-heading"><div><h1>{view==='apply'?'Try the application':admin?'관리자 시연 화면':'Hello, Demo Tenant'}</h1><p>{admin?'가상 신청을 선택하고 심사·결제·지급 흐름을 체험하세요.':'Explore the rent application journey with sample information.'}</p></div>
    <div className="showcase-actions">{view==='apply'?<Link className="work-button" href="/demo/dashboard"><ArrowLeft size={16}/> Dashboard</Link>:<><Link className="work-button" href={admin?'/demo/dashboard':'/demo/admin'}>{admin?'사용자 화면 보기':'View admin demo'} <ArrowRight size={16}/></Link><button className="work-button" onClick={reset}><RotateCcw size={16}/>{admin?'초기화':'Reset samples'}</button></>}</div>
   </div>
   <p className="showcase-feedback" role="status" aria-live="polite">{feedback}</p>
   {view==='apply'?<><p className="work-hint">All steps are optional. Use imaginary information only; submitting this walkthrough does not create an application.</p><ApplicationDemo/></>:<>
    {!admin&&<div className="work-focus"><JourneyPanel journey={journey(current)}><Link className="work-button work-button-primary" href="/demo/apply">Try a new application</Link></JourneyPanel></div>}
    {admin&&<label className="showcase-search">신청 검색<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름·이메일·신청번호"/></label>}
    <div className="showcase-grid">
     <section className="work-sheet showcase-list"><h2>{admin?'가상 신청 목록':'Sample applications'}</h2>
      {filtered.length===0?<p>No matching samples · 검색 결과 없음</p>:filtered.map(row=><button key={row.id} onClick={()=>{setSelected(row.id);setReason('');setFeedback('');}} className="showcase-row" aria-pressed={current.id===row.id}><span><strong>{row.reference}</strong><small>{admin?row.name:row.address}</small><b>{money(row.rent)}</b></span><StatusBadge journey={journey(row,admin)}/></button>)}
     </section>
     <section className="work-sheet showcase-detail" aria-label={admin?'가상 신청 상세':'Sample application details'}>
      <div className="work-section-heading"><h2>{current.reference}</h2><StatusBadge journey={journey(current,admin)}/></div>
      {admin&&<JourneyPanel journey={journey(current,true)} locale="ko"/>}
      <dl><div><dt>{admin?'신청자':'Applicant'}</dt><dd>{current.name}<br/>{current.email}</dd></div><div><dt>{admin?'목적물':'Property'}</dt><dd>{current.address}</dd></div><div><dt>{admin?'계약기간':'Lease dates'}</dt><dd>2026-11-01 — 2027-10-31</dd></div><div><dt>{admin?'월세':'Monthly rent'}</dt><dd>{money(current.rent)}</dd></div><div><dt>{admin?'이용료':'Service fee'}</dt><dd>{admin?'미확정 · 시연 비용 없음':'To be confirmed · no charge'}</dd></div><div><dt>{admin?'임대인 / 계좌':'Landlord / account'}</dt><dd>Sample Landlord · Example Bank · ••••0000</dd></div><div><dt>{admin?'계약서':'Contract'}</dt><dd><a href="/demo/sample-contract.svg" target="_blank" rel="noopener noreferrer">{admin?'견본 계약서 열기':'Open sample contract'}</a><br/><a href="/demo/sample-contract.svg" download="sample-contract.svg">{admin?'견본 다운로드':'Download sample'}</a></dd></div></dl>
      {admin?<div className="showcase-controls">
       {current.status==='pending_review'&&<><label>반려 사유 (선택)<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={200} placeholder="가상 사유만 입력"/></label><div className="showcase-actions"><button className="work-button work-button-primary" onClick={()=>change({status:'approved'},'Sample Reviewer · 심사 승인 (시연)')}>승인 체험</button><button className="work-button" onClick={()=>change({status:'rejected'},'Sample Reviewer · 심사 반려 (시연)'+(reason.trim()?': '+reason.trim():''))}>반려 체험</button></div></>}
       {current.status==='approved'&&<><h3>결제·지급 시뮬레이션</h3><p>운영 API를 호출하지 않으며, 가상 상태만 변경됩니다.</p><div className="showcase-actions">
        {['pending','failed'].includes(current.payment)&&<><button className="work-button" onClick={()=>change({payment:'paid',payout:'pending'},'가상 결제 성공 · 실제 청구 없음')}>결제 성공</button><button className="work-button" onClick={()=>change({payment:'failed',payout:'not_ready'},'가상 결제 실패')}>결제 실패</button><button className="work-button" onClick={()=>change({payment:'cancelled',payout:'not_ready'},'가상 결제 취소')}>결제 취소</button></>}
        {current.payment==='paid'&&['pending','failed'].includes(current.payout)&&<><button className="work-button" onClick={()=>change({payout:'completed'},'가상 지급 완료 · 실제 송금 없음')}>지급 성공</button><button className="work-button" onClick={()=>change({payout:'failed'},'가상 지급 실패')}>지급 실패</button></>}
       </div></>}
      </div>:current.status==='pending_review'&&<button className="work-button" onClick={()=>change({status:'cancelled'},'Demo Tenant · Application cancelled (demo)')}>Try cancelling this sample</button>}
      <h3>{admin?'상태 이력 · 가상 알림':'History & sample updates'}</h3><ul className="showcase-history">{current.history.map((item,index)=><li key={index}>{item}</li>)}</ul>
     </section>
    </div>
   </>}
   <footer className="work-footer"><div><Link href="/demo/dashboard">User dashboard</Link><Link href="/demo/admin">관리자 체험</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div><span>Demo · no real money</span></footer>
  </div>
 </main>;
}
