'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, Check, ChevronRight, CreditCard, FileText, LockKeyhole, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AuthStatus from '../components/AuthStatus';

const steps = ['Contract', 'Payment details', 'Deposit account', 'Test payment', 'Complete'];
const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
const makeNumber = () => `DP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export default function Home() {
  const [menu, setMenu] = useState(false); const [step, setStep] = useState(0); const [rent, setRent] = useState(750000); const [done, setDone] = useState(false); const [testPaid, setTestPaid] = useState(false); const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [address, setAddress] = useState(''); const [landlordName, setLandlordName] = useState(''); const [bank, setBank] = useState(''); const [account, setAccount] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const [applicationNumber, setApplicationNumber] = useState('');
  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>('main > section, main > footer, .hero-card, .numbers > div, .how-card, .faq-list details'));
    if (!revealItems.length) return;
    revealItems.forEach((item, index) => item.style.setProperty('--reveal-delay', `${Math.min(index * 45, 240)}ms`));
    const readyTimer = window.setTimeout(() => document.documentElement.classList.add('motion-ready'), 60);
    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(item => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    revealItems.forEach(item => observer.observe(item));
    return () => {
      window.clearTimeout(readyTimer);
      document.documentElement.classList.remove('motion-ready');
      observer.disconnect();
    };
  }, []);
  const fee = Math.round(rent * 0.029); const total = rent + fee;
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0] ?? null; if (selected && (!['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) { setMessage('PDF, JPG, and PNG files only, up to 10MB.'); return; } setMessage(''); setFile(selected); };
  const next = async () => {
    setMessage('');
    if (step === 0 && !file) { setMessage('Please upload your lease contract first.'); return; }
    if (step === 1 && (!rent || rent <= 0 || !address.trim())) { setMessage('Enter both the monthly rent and property address.'); return; }
    if (step === 2 && (!bank || !account || !landlordName)) { setMessage('Enter the bank, account number, and account holder.'); return; }
    if (step === 3 && !testPaid) { setMessage('Complete the test payment. No real payment will occur.'); return; }
    if (step === 4 && !consent) { setMessage('Please agree to personal data use.'); return; }
    if (step < 4) { setStep(step + 1); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Please log in before submitting an application.'); return; }
    if (!file || !address || !bank || !account || !landlordName) { setMessage('Please complete the contract, address, and account information.'); return; }
    const { data: profile } = await supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle();
    if (!profile?.phone) { setMessage('Please complete your phone number in Profile before applying.'); return; }
    setLoading(true); const number = makeNumber();
    const { data: application, error } = await supabase.from('rent_applications').insert({ user_id: user.id, application_number: number, applicant_name: profile.full_name, applicant_email: user.email, applicant_phone: profile.phone, rent_amount: rent, service_fee: fee, total_amount: total, landlord_name: landlordName, landlord_bank: bank, landlord_account: account, property_address: address, status: 'pending_review', test_payment_status: 'approved', submitted_at: new Date().toISOString() }).select('id').single();
    if (error || !application) { setLoading(false); setMessage('We could not save your application.'); return; }
    const path = `${user.id}/${application.id}/${file.name}`; const { error: uploadError } = await supabase.storage.from('contract-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { await supabase.from('rent_applications').delete().eq('id', application.id); setLoading(false); setMessage(`Contract upload failed: ${uploadError.message}`); return; }
    const { error: updateError } = await supabase.from('rent_applications').update({ contract_file_path: path, contract_file_name: file.name, contract_file_size: file.size }).eq('id', application.id).eq('user_id', user.id);
    if (updateError) { await supabase.storage.from('contract-documents').remove([path]); await supabase.from('rent_applications').delete().eq('id', application.id); setLoading(false); setMessage(`Application file metadata could not be saved: ${updateError.message}`); return; }
    const { error: historyError } = await supabase.from('application_status_history').insert({ application_id: application.id, to_status: 'pending_review', changed_by: user.id, reason: 'Homepage application submitted' });
    if (historyError) { setLoading(false); setMessage(`Application saved, but status history could not be saved: ${historyError.message}`); return; }
    const { error: notificationError } = await supabase.from('notifications').insert({ user_id: user.id, application_id: application.id, title: 'Rent application submitted', message: `${number} application received.`, type: 'application' });
    if (notificationError) { setLoading(false); setMessage(`Application saved, but notification could not be saved: ${notificationError.message}`); return; }
    setApplicationNumber(number); setLoading(false); setDone(true);
  };
  return <main className="home-page">
    <div className="test-banner"><span className="pulse" />Test mode · No real payment or transfer is processed</div>
    <header><div className="wrap nav"><div className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></div><nav><a href="#how">How it works</a><a href="#safe">Security</a><a href="#faq">FAQ</a></nav><AuthStatus /><button className="menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>{menu && <div className="mobile-nav"><a href="#how">How it works</a><a href="#safe">Security</a><a href="#faq">FAQ</a></div>}</header>
    <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><Sparkles size={16}/> Monthly rent payments for tenants</div><h1>Pay rent<br/><em>with your card</em></h1><p>Pay your rent by card without requiring landlord sign-up,<br/>then send it to the designated landlord account.</p><button className="primary" onClick={async () => { const { data } = await supabase.auth.getSession(); if (!data.session) { window.location.href = '/login?next=/#apply'; return; } document.getElementById('apply')?.scrollIntoView({behavior:'smooth'}); }}>Start a rent payment <ArrowRight size={18}/></button><div className="trust"><ShieldCheck size={16}/> All payments remain in test mode until financial partner integration</div></div><div className="hero-card"><div className="card-top"><span>This month's rent</span><span className="status"><span className="dot"/> Scheduled</span></div><div className="amount">₩750,000</div><div className="card-line"/><div className="card-info"><span>Deposit date<strong>2026. 11. 05</strong></span><span>Recipient<strong>Test landlord</strong></span></div><div className="card-bottom"><span className="mini-logo">D</span><span>DIVERCITY PAY</span><span className="visa">VISA</span></div></div></section>
    <section className="numbers"><div><strong>Guided<span> application</span></strong><small>Submit your rent details step by step</small></div><div><strong>No landlord<span> sign-up</span></strong><small>Use the designated deposit account</small></div><div><strong>Clear<span> status updates</span></strong><small>Track every review step in one place</small></div></section>
    <section id="how" className="section wrap"><div className="section-head"><div><div className="eyebrow">HOW IT WORKS</div><h2>Rent payments, made simple</h2></div><p>Apply quickly with a simple guided flow.</p></div><div className="how-grid">{([['01','Upload your contract','Upload a photo or file of your lease contract',FileText],['02','Enter rent details','Enter the rent amount and deposit account',Building2],['03','Request card payment','Review the amount and submit your request',CreditCard],['04','Deposit to landlord','After review, funds are routed to the designated account',Check]] as const).map(([n,t,d,Icon])=><div className="how-card" key={n}><span className="num">{n}</span><Icon size={25}/><h3>{t}</h3><p>{d}</p><ChevronRight className="chev" size={18}/></div>)}</div></section>
    <section id="apply" className="apply-section"><div className="wrap"><div className="section-head"><div><div className="eyebrow">QUICK APPLICATION</div><h2>Rent payment application</h2></div><div className="test-note"><LockKeyhole size={16}/> Test application · No real transaction</div></div><div className="apply-box"><div className="progress">{steps.map((s,i)=><div className={i <= step ? 'active' : ''} key={s}><span>{i < step ? <Check size={14}/> : i+1}</span><small>{s}</small></div>)}</div>{done ? <div className="success"><div className="success-icon"><Check size={30}/></div><h3>Your application has been submitted</h3><p>Application number <strong>{applicationNumber}</strong><br/>Your status will be updated after admin review.<br/>No real card authorization or bank transfer will occur.</p><button className="secondary" onClick={() => {setDone(false);setStep(0);setFile(null);setAddress('');setLandlordName('');setBank('');setAccount('');setTestPaid(false);setConsent(false);}}>Start a new application</button></div> : <div className="form-content">{step === 0 && <><h3>Review your lease contract</h3><p>Your rent payment is based on the information in your contract.</p><label className="upload"><FileText size={27}/><strong>{file ? file.name : 'Upload your contract'}</strong><span>{file ? `${Math.round(file.size / 1024)}KB · selected` : 'PDF, JPG, PNG · up to 10MB'}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile} /></label></>}{step === 1 && <><h3>Enter your monthly rent</h3><p>Enter your monthly rent to calculate the service fee.</p><label>Monthly rent<input className="money" value={rent.toLocaleString()} onChange={e=>setRent(Number(e.target.value.replace(/[^0-9]/g,''))||0)} /><span className="won">KRW</span></label><label>Property address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Address from the lease contract" /></label><div className="summary"><span>Rent</span><b>₩{fmt(rent)}</b><span>Service fee <small>(2.9%)</small></span><b>₩{fmt(fee)}</b><strong>Card payment total</strong><strong>₩{fmt(total)}</strong></div></>}{step === 2 && <><h3>Enter the landlord's deposit account</h3><p>This is the account designated for the landlord. No landlord sign-up is required.</p><label>Bank<select value={bank} onChange={e=>setBank(e.target.value)}><option value="">Select a bank</option><option>Shinhan Bank</option><option>KB Kookmin Bank</option><option>Woori Bank</option><option>KakaoBank</option></select></label><label>Account number<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="Numbers only" /></label><label>Account holder<input value={landlordName} onChange={e=>setLandlordName(e.target.value)} placeholder="Enter the account holder's name" /></label></>}{step === 3 && <><h3>Complete the test payment</h3><p>No real card authorization occurs; this is only a test screen.</p><div className="confirm"><span>Scheduled amount<b>₩{fmt(total)}</b></span><span>Card<b>DIVERCITY PAY TEST CARD</b></span><span>Payment status<b>{testPaid ? 'Test approved' : 'Not approved'}</b></span></div><button className="secondary full" onClick={() => {setTestPaid(true);setMessage('Test payment approved. No real payment will occur.');}}>{testPaid ? 'Test payment approved' : 'Approve test payment'}</button></>}{step === 4 && <><h3>Review your application</h3><p>Submit a test application with the details below.</p><div className="confirm"><span>Monthly rent<b>₩{fmt(rent)}</b></span><span>Service fee<b>₩{fmt(fee)}</b></span><span>Deposit account<b>{bank} · {account}</b></span><span>Landlord<b>{landlordName}</b></span><span>Property address<b>{address}</b></span><span>Test payment<b>Approved</b></span></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to personal data use and test processing.</label></>}{message&&<p className="auth-message">{message}</p>}<button className="primary full" onClick={next} disabled={loading}>{loading ? 'Saving application...' : step === 4 ? 'Submit test application' : 'Next step'} <ArrowRight size={18}/></button></div>}</div></div></section>
    <section id="faq" className="section wrap"><div className="section-head"><div><div className="eyebrow">FAQ</div><h2>FAQ</h2></div><p>Learn more before using the test service.</p></div><div className="faq-list"><details><summary>Does the landlord need to sign up?</summary><p>No. The test service only demonstrates the flow to the designated account entered by the tenant.</p></details><details><summary>Are real card payments or transfers made?</summary><p>No. All payments and transfers remain simulated until financial partner integration.</p></details><details><summary>Where is my contract stored?</summary><p>It is stored in private Supabase Storage and accessible only to you and authorized admins via secure links.</p></details><details><summary>Can I cancel an application?</summary><p>Applications can be cancelled from the detail page while awaiting review.</p></details></div></section>
    <section id="safe" className="safe wrap"><ShieldCheck size={30}/><div><h2>Start with confidence</h2><p>Your personal data and contract files are protected. No real transaction occurs before financial partner integration.</p></div></section>
    <footer><div className="wrap footer-inner"><div className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></div><div className="footer-links"><Link href="/fees">Fees</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><span>© 2026 DIVERCITY PAY · Test service</span></div></div></footer>
  </main>;
}
