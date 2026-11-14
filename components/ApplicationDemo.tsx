'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react';

const steps = ['Contract', 'Rent details', 'Deposit account', 'Test payment', 'Review'];

/** Home-page walkthrough only. No upload, storage or application submission. */
export default function ApplicationDemo() {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error,setError]=useState('');
  const [fileName, setFileName] = useState('');
  const [rent, setRent] = useState('');
  const [address, setAddress] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [landlord, setLandlord] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    contentRef.current?.focus({ preventScroll: true });
  }, [step, complete]);
  const shownRent = rent ? `₩${Number(rent).toLocaleString('ko-KR')}` : '₩750,000 (example)';

  const reset = () => { setStep(0); setComplete(false); setError(''); setFileName(''); setRent(''); setAddress(''); setBank(''); setAccount(''); setLandlord(''); };
  const advance=()=>{
    setError('');
    if(step===1&&rent&&(!Number.isSafeInteger(Number(rent))||Number(rent)<1||Number(rent)>1000000000)){setError('Enter a whole rent amount between ₩1 and ₩1,000,000,000, or leave it empty for the example.');return;}
    if(step<steps.length-1){setStep(step+1);return;}
    setComplete(true);
  };
  return <div className="apply-box demo-wizard">
    {!complete && <div className="progress demo-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
      {steps.map((label, index) => <div className={index <= step ? 'active' : ''} key={label} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={14}/> : index + 1}</span><small>{label}</small></div>)}
    </div>}
    {complete ? <div ref={contentRef} tabIndex={-1} className="form-content demo-content demo-finish" role="status"><div className="success-icon"><Check size={30}/></div><h3>You’ve completed the demo</h3><p>This was a preview. Nothing was uploaded, submitted, or saved.</p><div className="demo-finish-actions"><button type="button" className="secondary" onClick={reset}>Try it again</button><Link className="primary" href="/dashboard">Go to my dashboard <ArrowRight size={16}/></Link></div></div> : <div ref={contentRef} tabIndex={-1} className="form-content demo-content">
      <div className="demo-notice">Interactive demo only · Do not enter real personal information. Nothing is sent or saved.</div>
      {step === 0 && <><h3>Review your lease contract</h3><p>See how you would add your contract. You can skip this step.</p><label className="demo-upload"><FileText size={26}/><strong>{fileName || 'Choose a contract file (optional)'}</strong><span>PDF, JPG or PNG · selected only on this device</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}/></label></>}
      {step === 1 && <><h3>Enter your rent details</h3><p>Try the fields or continue with the example.</p><label>Monthly rent (KRW)<input type="number" min="1" max="1000000000" value={rent} onChange={e => setRent(e.target.value)} placeholder="750000"/></label><label>Property address<input maxLength={500} value={address} onChange={e => setAddress(e.target.value)} placeholder="Example address"/></label><div className="summary"><span>Rent</span><b>{shownRent}</b><span>Service fee</span><b>To be confirmed</b></div></>}
      {step === 2 && <><h3>Enter the landlord’s deposit account</h3><p>Use imaginary information for this preview.</p><label>Bank<select value={bank} onChange={e => setBank(e.target.value)}><option value="">Example bank</option><option>Shinhan Bank</option><option>KB Kookmin Bank</option><option>Woori Bank</option><option>KakaoBank</option></select></label><label>Account number<input inputMode="numeric" value={account} onChange={e => setAccount(e.target.value)} placeholder="Example account number"/></label><label>Account holder<input maxLength={120} value={landlord} onChange={e => setLandlord(e.target.value)} placeholder="Example name"/></label></>}
      {step === 3 && <><h3>See the test payment</h3><p>This is an illustration. No card details or payment are needed.</p><div className="confirm"><span>Example rent amount<b>{shownRent}</b></span><span>Card<b>TEST CARD</b></span><span>Status<b>Simulation only</b></span></div></>}
      {step === 4 && <><h3>Review the example</h3><p>Submitting this demo will not create an application.</p><div className="confirm"><span>Contract<b>{fileName || 'Example contract'}</b></span><span>Monthly rent<b>{shownRent}</b></span><span>Address<b>{address || 'Example address'}</b></span><span>Deposit account<b>{bank || 'Example bank'} · {account ? `••••${account.slice(-4)}` : '••••0000'}</b></span><span>Account holder<b>{landlord || 'Example landlord'}</b></span></div></>}
      {error&&<p role="alert" className="auth-message">{error}</p>}
      <div className="demo-actions">{step > 0 && <button type="button" className="secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={16}/> Back</button>}<button type="button" className="primary" onClick={advance}>{step === steps.length - 1 ? 'Submit demo' : 'Next step'} <ArrowRight size={17}/></button></div>
      <p className="demo-skip">All fields are optional in this demo.</p>
    </div>}
  </div>;
}
