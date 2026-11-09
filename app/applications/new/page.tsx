'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ApplicationDraft,StoredContract,emptyDraftPayload,draftSignature,draftError } from '../../../lib/application-drafts';
import './application.css';

const STEPS = ['Lease contract', 'Rent details', 'Deposit account', 'Review & submit'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const VALID_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const maskAccount = (value: string) => value ? `••••${value.replace(/\D/g, '').slice(-4)}` : '—';

type Field = 'file' | 'address' | 'contractStart' | 'contractEnd' | 'rent' | 'landlordName' | 'bank' | 'account';
type Attempt = { id: string; path: string; uploaded: boolean; file:File };

export default function NewApplication() {
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState('');
  const [rent, setRent] = useState('750000');
  const [landlordName, setLandlordName] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [address, setAddress] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [file, setFile] = useState<File | StoredContract | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [complete, setComplete] = useState('');
  const attempt = useRef<Attempt | null>(null);
  const submitting = useRef(false);

  const [draft,setDraft]=useState<ApplicationDraft|null>(null);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [conflict,setConflict]=useState(false);
  const serverDraft=useRef<ApplicationDraft|null>(null);
  const lastSaved=useRef('');
  const saveQueue=useRef<Promise<unknown>>(Promise.resolve());
  const active=useRef(true);
  const snapshot=useRef({payload:emptyDraftPayload,step:0,file:null as File|StoredContract|null});
  snapshot.current={payload:{address,contractStart,contractEnd,rent,landlordName,bank,account},step,file};

  const applyDraft=(d:ApplicationDraft)=>{
    const p={...emptyDraftPayload,...d.payload};
    const savedFile:StoredContract|null=d.contract_file_path&&d.contract_file_name?{name:d.contract_file_name,size:d.contract_file_size??0,type:d.contract_file_type??'',path:d.contract_file_path}:null;
    serverDraft.current=d;setDraft(d);setUserId(d.user_id);
    setAddress(p.address);setContractStart(p.contractStart);setContractEnd(p.contractEnd);setRent(p.rent);
    setLandlordName(p.landlordName);setBank(p.bank);setAccount(p.account);setFile(savedFile);setStep(d.step);
    snapshot.current={payload:p,step:d.step,file:savedFile};
    lastSaved.current=draftSignature(p,d.step,savedFile);
    attempt.current=null;setErrors({});setReviewConfirmed(false);setConflict(false);setSaveError('');
    setUncertain(d.state==='submitting');setComplete(d.state==='submitted'?d.application_number??'':'');setReady(true);
  };
  const restore=async(startNew=false)=>{
    setLoading(true);setMessage('');
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth.user){window.location.href='/login?next=/applications/new';return;}
      const {data,error}=await supabase.rpc('open_application_draft',{p_new:startNew});
      if(error)throw error;if(!data)throw new Error('Your saved application is unavailable.');
      if(active.current)applyDraft(data as ApplicationDraft);
    }catch(e){if(active.current)setMessage(draftError(e));}
    finally{if(active.current)setLoading(false);}
  };
  useEffect(()=>{
    active.current=true;restore();
    const {data:listener}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')window.location.href='/login?next=/applications/new';});
    const warn=(event:BeforeUnloadEvent)=>{
      if(serverDraft.current?.state==='editing'&&draftSignature(snapshot.current.payload,snapshot.current.step,snapshot.current.file)!==lastSaved.current){event.preventDefault();event.returnValue='';}
    };
    window.addEventListener('beforeunload',warn);
    return()=>{active.current=false;listener.subscription.unsubscribe();window.removeEventListener('beforeunload',warn);};
  },[]);

  const saveDraft=(prepare=false):Promise<ApplicationDraft>=>{
    const task=saveQueue.current.then(async()=>{
      const d=serverDraft.current;if(!d)throw new Error('Restore your saved application first.');
      if(d.state!=='editing')throw new Error('Check your submission result before editing.');
      const current=snapshot.current;const signature=draftSignature(current.payload,current.step,current.file);
      if(!prepare&&signature===lastSaved.current)return d;
      setSaving(true);setSaveError('');
      try{
        let path:string|null=null;
        if(current.file){
          if(current.file instanceof File){
            if(!attempt.current||attempt.current.file!==current.file){
              const digest=await crypto.subtle.digest('SHA-256',await current.file.arrayBuffer());
              const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
              const extension=current.file.type==='application/pdf'?'pdf':current.file.type==='image/png'?'png':'jpg';
              attempt.current={id:d.id,path:`${d.user_id}/${d.id}/${hash}.${extension}`,uploaded:false,file:current.file};
            }
            const pending=attempt.current;
            if(!pending.uploaded){
              const uploaded=await supabase.storage.from('contract-documents').upload(pending.path,current.file,{contentType:current.file.type,upsert:false});
              if(uploaded.error&&!/already exists|duplicate/i.test(uploaded.error.message))throw uploaded.error;
              pending.uploaded=true;
            }
            path=pending.path;
          }else path=current.file.path;
        }
        const {data,error}=await supabase.rpc('save_application_draft',{p_id:d.id,p_revision:d.revision,p_payload:current.payload,p_step:current.step,p_file_path:path,p_file_name:current.file?.name??null,p_prepare:prepare});
        if(error){if(error.code==='40001')setConflict(true);throw error;}
        if(!data)throw new Error('The saved result was not confirmed.');
        serverDraft.current=data as ApplicationDraft;lastSaved.current=signature;
        if(active.current)setDraft(data as ApplicationDraft);
        return data as ApplicationDraft;
      }catch(e){if(active.current)setSaveError(draftError(e));throw e;}
      finally{if(active.current)setSaving(false);}
    });
    saveQueue.current=task.catch(()=>undefined);return task;
  };
  useEffect(()=>{
    if(!ready||complete||uncertain||conflict||loading)return;
    const timer=window.setTimeout(()=>{saveDraft().catch(()=>undefined);},900);
    return()=>window.clearTimeout(timer);
  },[ready,complete,uncertain,conflict,loading,address,contractStart,contractEnd,rent,landlordName,bank,account,step,file]);

  const saveAndExit=async()=>{
    if(submitting.current)return;submitting.current=true;setLoading(true);
    try{await saveDraft();window.location.href='/dashboard';}catch(e){setMessage(draftError(e));}
    finally{submitting.current=false;setLoading(false);}
  };
  const resumeEditing=async()=>{
    if(!serverDraft.current||submitting.current)return;submitting.current=true;setLoading(true);
    try{const {data,error}=await supabase.rpc('edit_application_draft',{p_id:serverDraft.current.id});if(error)throw error;applyDraft(data as ApplicationDraft);setMessage('Saved details restored. Review them and confirm again before submitting.');}
    catch(e){setMessage(draftError(e));}finally{submitting.current=false;setLoading(false);}
  };

  const clearError = (field: Field) => {
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setMessage('');
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    if (!VALID_TYPES.includes(selected.type) || selected.size < 1 || selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setErrors(previous => ({ ...previous, file: 'Choose a PDF, JPG or PNG file between 1 byte and 10 MB.' }));
      event.target.value = '';
      return;
    }
    setFile(selected);
    clearError('file');
  };

  const validate = (current: number): boolean => {
    const next: Partial<Record<Field, string>> = {};
    if (current === 0 && !file) next.file = 'Upload your lease contract to continue.';
    if (current === 1) {
      if (!address.trim()) next.address = 'Enter the property address shown on your lease.';
      else if (address.trim().length > 500) next.address = 'Use 500 characters or fewer.';
      if (!contractStart) next.contractStart = 'Enter the lease start date.';
      if (!contractEnd || (contractStart && contractEnd < contractStart)) next.contractEnd = 'Enter an end date on or after the start date.';
      const amount = Number(rent);
      if (!rent || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) next.rent = 'Enter a whole amount from ₩1 to ₩1,000,000,000.';
    }
    if (current === 2) {
      if (!landlordName.trim()) next.landlordName = "Enter the landlord's name as shown on the account.";
      else if (landlordName.trim().length > 120) next.landlordName = 'Use 120 characters or fewer.';
      if (!bank.trim()) next.bank = 'Select the deposit bank.';
      const digits = account.replace(/[ -]/g, '');
      if (!/^[0-9]{6,30}$/.test(digits)) next.account = 'Enter 6–30 digits. Spaces and hyphens are allowed.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage('Please correct the highlighted fields before continuing.');
      const firstField = Object.keys(next)[0] as Field;
      const inputId: Record<Field, string> = {
        file: 'lease-file', address: 'property-address', contractStart: 'lease-start',
        contractEnd: 'lease-end', rent: 'monthly-rent', landlordName: 'landlord-name',
        bank: 'landlord-bank', account: 'account-number',
      };
      requestAnimationFrame(() => document.getElementById(inputId[firstField])?.focus());
      return false;
    }
    setMessage('');
    return true;
  };

  const nextStep = () => {
    if (!validate(step)) return;
    setStep(current => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event:FormEvent) => {
    event.preventDefault();
    if(submitting.current||!userId||!serverDraft.current)return;
    if(!uncertain){
      if(step!==STEPS.length-1||!file)return;
      if(!reviewConfirmed){setMessage('Confirm the details before submitting.');return;}
      if(![0,1,2].every(validate)){setMessage('Some details need attention. Go back and review your application.');return;}
    }
    submitting.current=true;setLoading(true);setMessage('');
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||auth.user?.id!==userId)throw new Error('Your session expired. Sign in again to recover your saved application.');
      if(!uncertain){
        const {data:profile,error}=await supabase.from('profiles').select('full_name,phone').eq('id',userId).maybeSingle();
        if(error)throw error;
        if(!profile?.full_name?.trim()||!profile?.phone?.trim())throw new Error('Add your name and contact number in Profile before submitting.');
        setUncertain(true);
        await saveDraft(true);
      }
      const {data,error}=await supabase.rpc('submit_application_draft',{p_id:serverDraft.current!.id});
      if(error)throw error;
      if(!data)throw new Error('The submission result is not confirmed. Check the saved result or retry this same submission.');
      // The wrapper calls the existing atomic submit function with the saved ID.
      setComplete(String(data));setUncertain(false);setSaveError('');
      serverDraft.current={...serverDraft.current!,state:'submitted',application_number:String(data)};
    }catch(e){setMessage(draftError(e));}
    finally{submitting.current=false;setLoading(false);}
  };

  const fieldError = (field: Field) => errors[field] && <small className="field-error" id={`${field}-error`}>{errors[field]}</small>;
  const invalid = (field: Field) => Boolean(errors[field]);

  if(!ready) return <main className="dashboard-page"><section className="dashboard-main wrap application-shell"><Link href="/dashboard" className="back-link">My dashboard</Link><div className="dashboard-empty"><h1>Restore your application</h1>{loading?<p role="status">Checking saved details and submission results…</p>:<><p role="alert">{message||'Could not load your saved application.'}</p><button className="secondary" onClick={()=>restore()}>Try again</button></>}</div></section></main>;
  if (complete) return <main className="dashboard-page">
    <section className="dashboard-main wrap"><div className="dashboard-empty application-complete">
      <div className="success-icon"><Check size={30}/></div>
      <h1>Application received</h1><p>Your reference number is <strong>{complete}</strong>.</p>
      <p>Your request is awaiting review. No card payment or bank transfer has taken place.</p>
      <Link href={`/applications/${serverDraft.current?.id}`} className="primary">View application</Link>
      <Link href="/dashboard" className="secondary">Go to dashboard</Link>
      <button type="button" className="secondary" disabled={loading} onClick={()=>restore(true)}>{loading?'Starting…':'Start another application'}</button>
    </div></section>
  </main>;

  return <main className="dashboard-page">
    <header><div className="wrap nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link></div></header>
    <section className="dashboard-main wrap application-shell">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> My dashboard</Link>
      <div className="dashboard-heading"><div><h1>Apply for rent payment</h1><p>Complete the four steps below to send a test application for review.</p></div></div>
      <div className="dashboard-notice"><ShieldCheck size={20}/><div><strong>Test mode</strong><span>Use a sample contract for testing. Selected files and entered details can be saved before submission. No real payment or transfer will occur. <Link href="/privacy">Read the privacy policy</Link>.</span></div></div>
      <div className="draft-save-bar" aria-label="Draft save status">
        <div><strong>{conflict?'Another tab changed this draft':saving?'Saving your private draft…':saveError?'Draft not saved':draftSignature(snapshot.current.payload,step,file)!==lastSaved.current?'Unsaved changes':`Saved ${draft?new Date(draft.updated_at).toLocaleTimeString('en-GB'):''}`}</strong><p>Your details and selected contract are saved privately to your account. You can return here to continue.</p></div>
        {!uncertain&&!conflict&&<button type="button" className="secondary" disabled={loading||saving} onClick={saveAndExit}>Save & exit</button>}
      </div>
      {saveError&&<div className="draft-warning" role="alert"><p>{saveError}</p>{!conflict&&!uncertain&&<button type="button" className="secondary" disabled={saving||loading} onClick={()=>saveDraft().catch(()=>undefined)}>Retry save</button>}</div>}
      {conflict&&<div className="draft-warning" role="alert"><p>Newer saved changes are protected. Reload the saved draft before editing further.</p><button type="button" className="secondary" disabled={loading} onClick={()=>restore()}>Reload saved draft</button></div>}
      {uncertain&&<div className="draft-warning" role="status"><strong>Check your submission result</strong><p>This application keeps the same submission ID after refresh. Check the result first. If it is still pending, retry the saved submission without creating a new application.</p><div className="draft-recovery-actions"><button type="button" className="secondary" disabled={loading} onClick={()=>restore()}>Check saved result</button><button type="button" className="secondary" disabled={loading} onClick={resumeEditing}>Return to saved details</button></div></div>}
      <p className="application-mobile-progress">Step {step + 1} of {STEPS.length} <strong>{STEPS[step]}</strong></p>
      <ol className="application-steps" aria-label="Application progress">{STEPS.map((label, index) =>
        <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
          <span className="step-number">{index < step ? <Check size={14}/> : index + 1}</span><span className="step-label">{label}</span>
        </li>)}</ol>
      <form className="application-form detail-card" onSubmit={submit} noValidate>
        <fieldset disabled={loading || uncertain || conflict}>
          {step === 0 && <div className="step-content">
            <div className="step-heading"><FileText size={22}/><div><h2>Upload your lease contract</h2><p>We use the contract to check the rent amount and tenancy details.</p></div></div>
            <label htmlFor="lease-file">Lease contract <span className="required">Required</span>
              <input id="lease-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile} aria-invalid={invalid('file')} aria-describedby={errors.file ? 'file-error' : 'file-help'}/>
              {fieldError('file')}<small id="file-help">{file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB${file instanceof File?'':' · restored from your private draft'}` : 'PDF, JPG or PNG · maximum 10 MB'}</small>
            </label>
          </div>}
          {step === 1 && <div className="step-content">
            <div className="step-heading"><div><h2>Enter your rent details</h2><p>Use the address and dates shown on your lease.</p></div></div>
            <label htmlFor="property-address">Property address <span className="required">Required</span>
              <input id="property-address" value={address} maxLength={500} onChange={event => { setAddress(event.target.value); clearError('address'); }} placeholder="Street address and unit number" aria-invalid={invalid('address')} aria-describedby={errors.address ? 'address-error' : undefined}/>
              {fieldError('address')}
            </label>
            <div className="field-pair">
              <label htmlFor="lease-start">Lease start date <span className="required">Required</span>
                <input id="lease-start" type="date" value={contractStart} onChange={event => { setContractStart(event.target.value); clearError('contractStart'); }} aria-invalid={invalid('contractStart')} aria-describedby={errors.contractStart ? 'contractStart-error' : undefined}/>{fieldError('contractStart')}</label>
              <label htmlFor="lease-end">Lease end date <span className="required">Required</span>
                <input id="lease-end" type="date" value={contractEnd} min={contractStart || undefined} onChange={event => { setContractEnd(event.target.value); clearError('contractEnd'); }} aria-invalid={invalid('contractEnd')} aria-describedby={errors.contractEnd ? 'contractEnd-error' : undefined}/>{fieldError('contractEnd')}</label>
            </div>
            <label htmlFor="monthly-rent">Monthly rent (KRW) <span className="required">Required</span>
              <input id="monthly-rent" type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={rent} onChange={event => { setRent(event.target.value); clearError('rent'); }} aria-invalid={invalid('rent')} aria-describedby={errors.rent ? 'rent-error' : undefined}/>{fieldError('rent')}</label>
            <div className="form-summary"><span>Service fee</span><b>To be confirmed</b><span>Rent amount for this test</span><b>{money(Number(rent) || 0)}</b></div>
          </div>}
          {step === 2 && <div className="step-content">
            <div className="step-heading"><div><h2>Add the landlord’s deposit account</h2><p>These details are for review only. No transfer will be sent.</p></div></div>
            <label htmlFor="landlord-name">Landlord / account holder name <span className="required">Required</span>
              <input id="landlord-name" value={landlordName} maxLength={120} onChange={event => { setLandlordName(event.target.value); clearError('landlordName'); }} placeholder="Name on the bank account" aria-invalid={invalid('landlordName')} aria-describedby={errors.landlordName ? 'landlordName-error' : undefined}/>{fieldError('landlordName')}</label>
            <label htmlFor="landlord-bank">Bank <span className="required">Required</span>
              <select id="landlord-bank" value={bank} onChange={event => { setBank(event.target.value); clearError('bank'); }} aria-invalid={invalid('bank')} aria-describedby={errors.bank ? 'bank-error' : undefined}>
                <option value="">Select a bank</option><option value="국민은행">KB Kookmin Bank</option><option value="신한은행">Shinhan Bank</option><option value="우리은행">Woori Bank</option><option value="하나은행">Hana Bank</option><option value="농협은행">NH Nonghyup Bank</option><option value="기업은행">IBK Bank</option><option value="카카오뱅크">KakaoBank</option><option value="토스뱅크">Toss Bank</option>
              </select>{fieldError('bank')}</label>
            <label htmlFor="account-number">Account number <span className="required">Required</span>
              <input id="account-number" value={account} inputMode="numeric" autoComplete="off" onChange={event => { setAccount(event.target.value); clearError('account'); }} placeholder="6–30 digits" aria-invalid={invalid('account')} aria-describedby={errors.account ? 'account-error' : undefined}/>{fieldError('account')}</label>
          </div>}
          {step === 3 && <div className="step-content">
            <div className="step-heading"><div><h2>Review your application</h2><p>Check your details before sending this test request for review.</p></div></div>
            <dl className="review-list">
              <div><dt>Contract</dt><dd>{file?.name}</dd></div>
              <div><dt>Property</dt><dd>{address}</dd></div>
              <div><dt>Lease dates</dt><dd>{contractStart} – {contractEnd}</dd></div>
              <div><dt>Monthly rent</dt><dd>{money(Number(rent))}</dd></div>
              <div><dt>Service fee</dt><dd>To be confirmed</dd></div>
              <div><dt>Landlord</dt><dd>{landlordName}</dd></div>
              <div><dt>Deposit account</dt><dd>{bank} · {maskAccount(account)}</dd></div>
            </dl>
            <p className="application-disclosure">By submitting, you send these details and the contract to Divercity Pay for a test review. No payment or transfer is made.</p>
            <label className="review-confirm"><input type="checkbox" checked={reviewConfirmed} onChange={event => { setReviewConfirmed(event.target.checked); setMessage(''); }}/><span>I have checked these details and want to submit this test application.</span></label>
          </div>}
        </fieldset>
        {message && <p className="auth-message application-error" role="alert">{message}{message.includes('Profile') && <> <Link href="/profile">Open Profile</Link></>}</p>}
        <div className="application-actions">
          {step > 0 && !uncertain && <button type="button" className="secondary" disabled={loading||conflict} onClick={() => { setMessage(''); setErrors({}); setReviewConfirmed(false); setStep(current => current - 1); }}>Back</button>}
          {step < STEPS.length - 1 && !uncertain
            ? <button type="button" className="primary" disabled={loading||conflict} onClick={nextStep}>Continue <ArrowRight size={16}/></button>
            : <button type="submit" className="primary" disabled={loading || !userId || conflict}>{loading ? 'Checking submission…' : uncertain ? 'Retry submission' : 'Submit test application'}</button>}
        </div>
        {uncertain && <Link href="/dashboard" className="application-status-link">Check my dashboard</Link>}
      </form>
    </section>
  </main>;
}
