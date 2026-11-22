'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ApplicationDraft,StoredContract,emptyDraftPayload,draftSignature,draftError } from '../../../lib/application-drafts';
import './application.css';

import AccountScreen from '../../../components/ui/AccountScreen';
import {Button} from '@astryxdesign/core/Button';
import styles from './application.module.css';
import LeaseReference from './LeaseReference';
import { existingRentApplication } from '../../../lib/next-rent';
import { TestNotice } from '../../../components/WorkflowStatus';
import { checkLeaseFile,createContractLink,leaseObjectPath } from '../../../lib/contracts';
import { TERMS_VERSION } from '../../../lib/terms-version';
import { reportOperationError } from '../../../lib/operation-errors';
import { APPLICATION_STEPS as STEPS,BANK_OPTIONS,FIELD_IDS,bankLabel,validateApplicationStep,type ApplicationField } from '../../../lib/application-validation';
const money = (value: number) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
const maskAccount = (value: string) => value ? `••••${value.replace(/\D/g, '').slice(-4)}` : '—';

type Field = ApplicationField;
type Attempt = { id: string; path: string; uploaded: boolean; file:File };

export default function NewApplication() {
  const [step, setStep] = useState(0);
  const [renewal, setRenewal] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [rent, setRent] = useState('750000');
  const [landlordName, setLandlordName] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [address, setAddress] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [rentMonth,setRentMonth]=useState('');
  const [dueDate,setDueDate]=useState('');
  const [intakeOpen,setIntakeOpen]=useState(true);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [file, setFile] = useState<File | StoredContract | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [complete, setComplete] = useState('');
  const [previewing,setPreviewing]=useState(false),[previewError,setPreviewError]=useState('');
  const lastField = useRef<HTMLElement | null>(null);
  const showLease = Boolean(file && (step === 1 || step === 2));
  const focusTarget=useRef<Field|null>(null);
  const localPreview=useRef<string|null>(null);
  const fileSelection=useRef(0);
  const stepChanged=useRef(false);
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
  snapshot.current={payload:{address,contractStart,contractEnd,rent,landlordName,bank,account,rentMonth,dueDate},step,file};

  const applyDraft=useCallback((d:ApplicationDraft)=>{
    const p={...emptyDraftPayload,...d.payload,rentMonth:d.rent_month?.slice(0,7)??'',dueDate:d.rent_due_date??''};
    const savedFile:StoredContract|null=d.contract_file_path&&d.contract_file_name?{name:d.contract_file_name,size:d.contract_file_size??0,type:d.contract_file_type??'',path:d.contract_file_path}:null;
    serverDraft.current=d;setDraft(d);setUserId(d.user_id);
    setAddress(p.address);setContractStart(p.contractStart);setContractEnd(p.contractEnd);setRent(p.rent);
    setRentMonth(p.rentMonth);setDueDate(p.dueDate);setConfirmDiscard(false);
    setLandlordName(p.landlordName);setBank(p.bank);setAccount(p.account);setFile(savedFile);setStep(d.step);
    snapshot.current={payload:p,step:d.step,file:savedFile};
    lastSaved.current=draftSignature(p,d.step,savedFile);
    attempt.current=null;setErrors({});setReviewConfirmed(false);setConflict(false);setSaveError('');
    setUncertain(d.state==='submitting');setComplete(d.state==='submitted'?d.application_number??'':'');setReady(true);
  },[]);
  const restore=useCallback(async(startNew=false)=>{
    setLoading(true);setMessage('');
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth.user){window.location.href='/login?next=/applications/new';return;}
      const [{data,error},{data:intake}]=await Promise.all([
        supabase.rpc('open_application_draft',{p_new:startNew}),
        supabase.rpc('application_intake_open'),
      ]);
      if(error)throw error;if(!data)throw new Error('Your saved application is unavailable.');
      if(active.current){setIntakeOpen(intake!==false);applyDraft(data as ApplicationDraft);}
    }catch(e){if(active.current)setMessage(draftError(e));}
    finally{if(active.current)setLoading(false);}
  },[applyDraft]);
  useEffect(()=>{
    active.current=true;setRenewal(new URLSearchParams(window.location.search).get('renewal'));restore();
    const {data:listener}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')window.location.href='/login?next=/applications/new';});
    const warn=(event:BeforeUnloadEvent)=>{
      if(serverDraft.current?.state==='editing'&&draftSignature(snapshot.current.payload,snapshot.current.step,snapshot.current.file)!==lastSaved.current){event.preventDefault();event.returnValue='';}
    };
    window.addEventListener('beforeunload',warn);
    return()=>{active.current=false;listener.subscription.unsubscribe();window.removeEventListener('beforeunload',warn);};
  },[restore]);

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
              const path=await leaseObjectPath(d.user_id,d.id,current.file);
              attempt.current={id:d.id,path,uploaded:false,file:current.file};
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
        const {rentMonth,dueDate,...payload}=current.payload;
        const {data,error}=await supabase.rpc('save_draft_with_schedule',{p_id:d.id,p_revision:d.revision,p_payload:payload,p_step:current.step,p_file_path:path,p_file_name:current.file?.name??null,p_prepare:prepare,p_month:/^\d{4}-(0[1-9]|1[0-2])$/.test(rentMonth)&&!rentMonth.startsWith('0000')?rentMonth+'-01':null,p_due:dueDate||null});
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
    if(!ready||complete||uncertain||conflict||loading||confirmDiscard)return;
    const timer=window.setTimeout(()=>{saveDraft().catch(()=>undefined);},900);
    return()=>window.clearTimeout(timer);
  },[ready,complete,uncertain,conflict,loading,confirmDiscard,address,contractStart,contractEnd,rent,landlordName,bank,account,rentMonth,dueDate,step,file]);

  async function discardDraft() {
    if (submitting.current) return;
    submitting.current=true;
    setLoading(true);
    setMessage('');
    try {
      await saveQueue.current;
      const d=serverDraft.current;
      if (!d || d.state!=='editing') throw new Error('Check your submission result before discarding this draft.');
      const {data,error}=await supabase.rpc('discard_application_draft',{p_id:d.id,p_revision:d.revision});
      if(error)throw error;
      serverDraft.current=null;
      if(data)await supabase.storage.from('contract-documents').remove([String(data)]).then(() => {}, () => {});
      window.location.assign('/dashboard');
    } catch {
      setMessage('The draft could not be discarded. Reload the saved draft and try again.');
    } finally {
      submitting.current=false;
      setLoading(false);
    }
  }

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

  useEffect(()=>()=>{if(localPreview.current)URL.revokeObjectURL(localPreview.current);},[]);
  useEffect(()=>{const field=focusTarget.current;if(field){document.getElementById(FIELD_IDS[field])?.focus();focusTarget.current=null;}else if(stepChanged.current){document.querySelector<HTMLElement>('.application-form .step-heading h2')?.focus();}stepChanged.current=false;},[step,errors]);
  const previewFile=async()=>{
    if(!file||previewing)return;setPreviewing(true);setPreviewError('');const preview=window.open('about:blank','_blank');if(preview)preview.opener=null;
    try{let url:string;if(file instanceof File){if(localPreview.current)URL.revokeObjectURL(localPreview.current);url=URL.createObjectURL(file);localPreview.current=url;}else url=(await createContractLink(file.path,file.name,{locale:'en'})).url;
      if(preview)preview.location.href=url;else setPreviewError('Your browser blocked the preview. Allow pop-ups for this site and try again.');
    }catch(e){preview?.close();setPreviewError(e instanceof Error?e.message:'Could not open the contract. Try again.');}finally{setPreviewing(false);}
  };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input=event.currentTarget;
    const selected = input.files?.[0] ?? null;
    const selection=++fileSelection.current;
    if (!selected) return;
    const issue=await checkLeaseFile(selected);
    if(selection!==fileSelection.current)return;
    if (issue) {
      setErrors(previous => ({ ...previous, file: issue+(file?' Your previously selected file has been kept.':'') }));
      input.value = '';
      return;
    }
    setFile(selected);setPreviewError('');
    clearError('file');
  };

  const validate = (current: number): boolean => {
    const next=validateApplicationStep(current,snapshot.current.payload,Boolean(file));
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage('Please correct the highlighted fields before continuing.');
      focusTarget.current=Object.keys(next)[0] as Field;
      return false;
    }
    setMessage('');
    return true;
  };

  const goToStep=(target:number)=>{
    if(loading||uncertain||conflict||target<0||target>step)return;
    setMessage('');setErrors({});setReviewConfirmed(false);stepChanged.current=true;setStep(target);
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };
  const nextStep = () => {
    if (!validate(step)) return;
    stepChanged.current=true;
    setStep(current => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };

  const submit = async (event:FormEvent) => {
    event.preventDefault();
    if(!uncertain&&step<STEPS.length-1){nextStep();return;}
    if(submitting.current||!userId||!serverDraft.current||!intakeOpen)return;
    if(!uncertain){
      if(step!==STEPS.length-1||!file)return;
      if(!reviewConfirmed){setMessage('Confirm the details before submitting.');document.getElementById('review-confirmation')?.focus();return;}
      for(const section of [0,1,2]){const issues=validateApplicationStep(section,snapshot.current.payload,Boolean(file));if(Object.keys(issues).length){focusTarget.current=Object.keys(issues)[0] as Field;setStep(section);setReviewConfirmed(false);setErrors(issues);setMessage('Check the highlighted details before submitting.');return;}}
    }
    submitting.current=true;setLoading(true);setMessage('');
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||auth.user?.id!==userId)throw new Error('Your session expired. Sign in again to recover your saved application.');
      if(!uncertain){
        const {data:profile,error}=await supabase.from('profiles').select('full_name,phone').eq('id',userId).maybeSingle();
        if(error)throw error;
        if(!profile?.full_name?.trim()||!profile?.phone?.trim())throw new Error('Add your name and contact number in Profile before submitting.');
        const {error:termsError}=await supabase.rpc('accept_site_terms',{p_version:TERMS_VERSION});
        if(termsError)throw termsError;
        setUncertain(true);
        await saveDraft(true);
      }
      const {data,error}=await supabase.rpc('submit_application_draft',{p_id:serverDraft.current!.id});
      if(error?.code === '22023' && error.message.includes('already exists')) {
        const existing = await existingRentApplication(userId, address, rentMonth, true);
        if (existing) {
          // Unlock this unsubmitted draft so it stays editable after the conflict.
          await supabase.rpc('edit_application_draft', {p_id: serverDraft.current!.id});
          window.location.replace('/applications/' + existing);
          return;
        }
      }
      if(error)throw error;
      if(!data)throw new Error('The submission result is not confirmed. Check the saved result or retry this same submission.');
      // The wrapper calls the existing atomic submit function with the saved ID.
      setComplete(String(data));setUncertain(false);setSaveError('');
      serverDraft.current={...serverDraft.current!,state:'submitted',application_number:String(data)};
    }catch(e){reportOperationError('submit_application');setMessage(draftError(e));}
    finally{submitting.current=false;setLoading(false);}
  };

  const fieldError = (field: Field) => errors[field] && <small className="field-error" id={`${field}-error`}>{errors[field]}</small>;
  const invalid = (field: Field) => Boolean(errors[field]);

  if(!ready) return <AccountScreen className={`rent-application ${styles.application}`} contentId="application-content"><section className="dashboard-main wrap application-shell" id="application-content" tabIndex={-1}><Link href="/dashboard" className="back-link">My dashboard</Link><div className="dashboard-empty"><h1>Restore your application</h1>{loading?<p role="status">Checking saved details and submission results…</p>:<><p role="alert">{message||'Could not load your saved application.'}</p><Button label="Try again" onClick={()=>restore()}/></>}</div></section></AccountScreen>;
  if (complete) return <AccountScreen className={`rent-application ${styles.application}`} contentId="application-content">
    <section className="dashboard-main wrap" id="application-content" tabIndex={-1}><div className="dashboard-empty application-complete">
      <div className="success-icon"><Check size={30}/></div>
      <h1>Application received</h1><p>Your reference number is <strong>{complete}</strong>.</p>
      <p>Your request is awaiting review. No card payment or bank transfer has taken place.</p>
      <Button href={`/applications/${serverDraft.current?.id}`} label="View application" variant="primary"/>
      <Button href="/dashboard" label="Go to dashboard"/>
      <Button label={loading?'Starting…':'Start another application'} isLoading={loading} onClick={()=>restore(true)}/>
    </div></section>
  </AccountScreen>;

  return <AccountScreen className={`rent-application ${styles.application}`} contentId="application-content">
    <section className={`dashboard-main wrap application-shell ${showLease ? styles.withLease : ''}`} id="application-content" tabIndex={-1}>
      <div className="work-page-heading"><div><h1>Apply for rent payment</h1><p>Save your progress, check the details, then submit for test review.</p></div></div>
      <TestNotice/>
      {!intakeOpen&&<p className="draft-warning" role="status">New submissions are paused. You can still review and save your draft.</p>}
      <div className="draft-save-bar" aria-label="Draft save status">
        <div><strong aria-live="polite">{conflict?'Another tab changed this draft':saving?'Saving your private draft…':saveError?'Draft not saved':draftSignature(snapshot.current.payload,step,file)!==lastSaved.current?'Unsaved changes':`Saved ${draft?new Date(draft.updated_at).toLocaleTimeString('en-GB'):''}`}</strong><p>Private draft · not submitted until you confirm the final step.</p></div>
        {!uncertain&&!conflict&&!confirmDiscard&&<details className={styles.draftOptions}><summary>Draft options</summary><div className="draft-recovery-actions"><Button label="Save & exit" size="lg" isDisabled={loading||saving} onClick={saveAndExit}/><Button label="Discard draft" isDisabled={loading||saving} onClick={()=>setConfirmDiscard(true)}/></div></details>}
      </div>
      {confirmDiscard&&<section className="draft-warning" aria-labelledby="discard-title"><strong id="discard-title">Discard this draft?</strong><p>This removes the saved application details. You can start again from your dashboard.</p><div className="draft-recovery-actions"><Button label="Keep draft" isDisabled={loading} onClick={()=>setConfirmDiscard(false)}/><button type="button" className="work-button work-button-danger" disabled={loading} onClick={discardDraft}>Confirm discard</button></div></section>}
      {saveError&&<div className="draft-warning" role="alert"><p>{saveError}</p>{!conflict&&!uncertain&&<Button label="Retry save" isDisabled={saving||loading} onClick={()=>saveDraft().catch(()=>undefined)}/>}</div>}
      {conflict&&<div className="draft-warning" role="alert"><p>Newer saved changes are protected. Reload the saved draft before editing further.</p><Button label="Reload saved draft" isDisabled={loading} onClick={()=>restore()}/></div>}
      {uncertain&&<div className="draft-warning" role="status"><strong>Check your submission result</strong><p>This application keeps the same submission ID after refresh. Check the result first. If it is still pending, retry the saved submission without creating a new application.</p><div className="draft-recovery-actions"><Button label="Check saved result" isDisabled={loading} onClick={()=>restore()}/><Button label="Return to saved details" isDisabled={loading} onClick={resumeEditing}/></div></div>}
      <p className="application-mobile-progress">Step {step + 1} of {STEPS.length} {step === 0 ? <strong>{STEPS[step]}</strong> : <select aria-label="Current step or return to a previous step" value={step} disabled={loading||uncertain||conflict} onChange={event => goToStep(Number(event.target.value))}>
        {STEPS.slice(0, step+1).map((label, index) => <option key={label} value={index}>{label}</option>)}
      </select>}</p>
      <ol className="application-steps" aria-label="Application progress">{STEPS.map((label, index) =>
        <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
          {index<step?<button type="button" disabled={loading||uncertain||conflict} onClick={()=>goToStep(index)} aria-label={`Edit ${label}`}><span className="step-number"><Check size={14}/></span><span className="step-label">{label}</span></button>:<><span className="step-number">{index+1}</span><span className="step-label">{label}</span></>}
        </li>)}</ol>
      <div className={showLease ? styles.workspace : undefined}>
      {showLease && file && <LeaseReference file={file} lastField={lastField}/>}
      <form onFocus={event => { if (event.target.matches("input, select")) lastField.current = event.target; }} className="application-form detail-card" method="post" aria-labelledby="application-step-title" onSubmit={submit} noValidate>
        <fieldset disabled={loading || uncertain || conflict}><legend className="work-sr-only">{STEPS[step]}</legend>
          {step === 0 && <div className="step-content">
            <div className="step-heading"><FileText size={22}/><div><h2 id="application-step-title" tabIndex={-1}>Upload your lease contract</h2><p>{renewal === 'attach' ? 'Attach a current lease for this month, then check the copied dates and amount.' : 'We use the contract to check the rent amount and tenancy details.'}</p></div></div>
            <label htmlFor="lease-file">Lease contract <span className="required">Required</span>
              <input name="contract" required id="lease-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile} aria-invalid={invalid('file')} aria-describedby={errors.file ? 'file-error' : 'file-help'}/>
              {fieldError('file')}<small id="file-help">PDF, JPG or PNG · maximum 10 MB. Use a sample file for testing.</small>
            </label>
            {file&&<div className="application-file"><FileText size={22} aria-hidden="true"/><div><strong>{file.name}</strong><small>{Math.ceil(file.size/1024)} KB · {file instanceof File?'Selected for this draft':'Restored from your saved draft'}</small></div><Button label={previewing?'Opening…':'Preview'} onClick={previewFile} isLoading={previewing} endContent={<ExternalLink size={16} aria-hidden="true"/>}/></div>}
            {previewError&&<p className="application-error" role="alert">{previewError}</p>}
          </div>}
          {step === 1 && <div className="step-content">
            <div className="step-heading"><div><h2 id="application-step-title" tabIndex={-1}>Enter your rent details</h2><p>{renewal ? 'Check the copied address, lease dates and rent amount for this month.' : 'Use the address and dates shown on your lease.'}</p></div></div>
            <label htmlFor="property-address">Property address <span lang="ko" className={styles.leaseTerm}>소재지</span> <span className="required">Required</span>
              <input name="address" required id="property-address" value={address} maxLength={500} onChange={event => { setAddress(event.target.value); clearError('address'); }} autoComplete="street-address" placeholder="Street address and unit number" aria-invalid={invalid('address')} aria-describedby={errors.address ? 'address-error' : undefined}/>
              {fieldError('address')}
            </label>
            <div className="field-pair">
              <label htmlFor="lease-start">Lease start date <span lang="ko" className={styles.leaseTerm}>임대차 시작일</span> <span className="required">Required</span>
                <input name="lease_start" required id="lease-start" type="date" value={contractStart} onChange={event => { setContractStart(event.target.value); clearError('contractStart'); }} aria-invalid={invalid('contractStart')} aria-describedby={errors.contractStart ? 'contractStart-error' : undefined}/>{fieldError('contractStart')}</label>
              <label htmlFor="lease-end">Lease end date <span lang="ko" className={styles.leaseTerm}>임대차 종료일</span> <span className="required">Required</span>
                <input name="lease_end" required id="lease-end" type="date" value={contractEnd} min={contractStart || undefined} onChange={event => { setContractEnd(event.target.value); clearError('contractEnd'); }} aria-invalid={invalid('contractEnd')} aria-describedby={errors.contractEnd ? 'contractEnd-error' : undefined}/>{fieldError('contractEnd')}</label>
            </div>
            <div className="field-pair">
              <label htmlFor="rent-month">Rent month <span className="required">Required</span>
                <input id="rent-month" name="rent_month" type="month" placeholder="YYYY-MM" value={rentMonth} onChange={event=>{setRentMonth(event.target.value);clearError('rentMonth');}} aria-invalid={invalid('rentMonth')} aria-describedby={errors.rentMonth?'rentMonth-error':undefined} required/>{fieldError('rentMonth')}</label>
              <label htmlFor="rent-due-date">Rent due date <span className="required">Required</span>
                <input id="rent-due-date" name="due_date" type="date" value={dueDate} onChange={event=>{setDueDate(event.target.value);clearError('dueDate');}} aria-invalid={invalid('dueDate')} aria-describedby={errors.dueDate?'dueDate-error':undefined} required/>{fieldError('dueDate')}</label>
            </div>
            <label htmlFor="monthly-rent">Monthly rent (KRW) <span lang="ko" className={styles.leaseTerm}>차임 · 월세</span> <span className="required">Required</span>
              <input name="rent" required id="monthly-rent" type="text" inputMode="numeric" pattern="[0-9]+" value={rent} onChange={event => { const value=event.target.value; if (/^\d*$/.test(value)) { setRent(value); clearError('rent'); } }} aria-invalid={invalid('rent')} aria-describedby={errors.rent ? 'rent-error' : undefined}/>{fieldError('rent')}</label>
            <div className="form-summary"><span>Service fee</span><b>To be confirmed</b><span>Rent amount for this test</span><b>{money(Number(rent) || 0)}</b></div>
          </div>}
          {step === 2 && <div className="step-content">
            <div className="step-heading"><div><h2 id="application-step-title" tabIndex={-1}>Add the landlord’s deposit account</h2><p>{renewal ? 'Confirm the bank and enter the landlord’s account number from your lease.' : 'These details are for review only. No transfer will be sent.'}</p></div></div>
            <label htmlFor="landlord-name">Landlord / account holder name <span lang="ko" className={styles.leaseTerm}>임대인 · 예금주</span> <span className="required">Required</span>
              <input name="landlord_name" autoComplete="off" required id="landlord-name" value={landlordName} maxLength={120} onChange={event => { setLandlordName(event.target.value); clearError('landlordName'); }} placeholder="Name on the bank account" aria-invalid={invalid('landlordName')} aria-describedby={errors.landlordName ? 'landlordName-error' : undefined}/>{fieldError('landlordName')}</label>
            <label htmlFor="landlord-bank">Bank <span lang="ko" className={styles.leaseTerm}>은행</span> <span className="required">Required</span>
              <select name="bank" required id="landlord-bank" value={bank} onChange={event => { setBank(event.target.value); clearError('bank'); }} aria-invalid={invalid('bank')} aria-describedby={errors.bank ? 'bank-error' : undefined}>
                <option value="">Select a bank</option>{BANK_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>{fieldError('bank')}</label>
            <label htmlFor="account-number">Account number <span lang="ko" className={styles.leaseTerm}>계좌번호</span> <span className="required">Required</span>
              <input name="account" required id="account-number" value={account} inputMode="numeric" autoComplete="off" onChange={event => { setAccount(event.target.value); clearError('account'); }} maxLength={60} placeholder="6–30 digits" aria-invalid={invalid('account')} aria-describedby={errors.account ? 'account-error account-help' : 'account-help'}/>{fieldError('account')}<small id="account-help">Use a Korean bank account belonging to the landlord. Spaces and hyphens are allowed.</small></label>
          </div>}
          {step === 3 && <div className="step-content">
            <div className="step-heading"><div><h2 id="application-step-title" tabIndex={-1}>Review your application</h2><p>Check your details before sending this test request for review.</p></div></div>
            <dl className="review-list">
              <div><dt>Contract</dt><dd>{file?.name}<button type="button" className="review-edit" onClick={()=>goToStep(0)}>Change contract</button></dd></div>
              <div><dt>Property</dt><dd>{address}<button type="button" className="review-edit" onClick={()=>goToStep(1)}>Edit rent details</button></dd></div>
              <div><dt>Lease dates</dt><dd>{contractStart} – {contractEnd}</dd></div>
              <div><dt>Rent month and due date</dt><dd>{rentMonth} · Due {dueDate}</dd></div>
              <div><dt>Monthly rent</dt><dd>{money(Number(rent))}</dd></div>
              <div><dt>Service fee</dt><dd>To be confirmed</dd></div>
              <div><dt>Landlord</dt><dd>{landlordName}</dd></div>
              <div><dt>Deposit account</dt><dd>{bankLabel(bank)} · {maskAccount(account)}<button type="button" className="review-edit" onClick={()=>goToStep(2)}>Edit deposit account</button></dd></div>
            </dl>
            <p className="application-disclosure">By submitting, you send these details and the contract to Divercity Pay for a test review. No payment or transfer is made.</p>
            <p className="application-disclosure"><Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of use</Link> · <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</Link></p>
            <label className="review-confirm"><input id="review-confirmation" type="checkbox" checked={reviewConfirmed} onChange={event => { setReviewConfirmed(event.target.checked); setMessage(''); }}/><span>I agree to the Terms of use and confirm these details for test review.</span></label>
          </div>}
        </fieldset>
        {message && <p className="auth-message application-error" role="alert">{message}{message.includes('Profile') && <> <Link href="/profile">Open Profile</Link></>}</p>}
        <div className="application-actions">
          {step > 0 && !uncertain && <button type="button" className="secondary" disabled={loading||conflict} onClick={()=>goToStep(step-1)}>Back</button>}
          {step < STEPS.length - 1 && !uncertain
            ? <button key="continue-step" type="submit" className="primary" disabled={loading||conflict}>{step===0?'Continue to rent details':step===1?'Continue to deposit account':'Review application'} <ArrowRight size={16}/></button>
            : <button key="submit-application" type="submit" className="primary" disabled={loading || !userId || conflict || !intakeOpen || confirmDiscard}>{loading ? 'Checking submission…' : uncertain ? 'Retry submission' : 'Submit test application'}</button>}
        </div>
        {uncertain && <Link href="/dashboard" className="application-status-link">Check my dashboard</Link>}
      </form>
      </div>
    </section>
  </AccountScreen>;
}
