'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, Check, ChevronRight, CreditCard, FileText, LockKeyhole, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import './home-preview.css';
import AuthStatus from '../components/AuthStatus';


export default function Home() {
  const [menu, setMenu] = useState(false);
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
  return <main className="home-page">
    <div className="test-banner"><span className="pulse" />Test mode · No real payment or transfer is processed</div>
    <header><div className="wrap nav"><div className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></div><nav><a href="#how">How it works</a><a href="#safe">Security</a><a href="#faq">FAQ</a></nav><AuthStatus /><button className="menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>{menu && <div className="mobile-nav"><a href="#how">How it works</a><a href="#safe">Security</a><a href="#faq">FAQ</a></div>}</header>
    <section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><Sparkles size={16}/> Monthly rent payments for tenants</div><h1>Pay rent<br/><em>with your card</em></h1><p>Pay your rent by card without requiring landlord sign-up,<br/>then send it to the designated landlord account.</p><Link className="primary" href="/dashboard">Start a rent application <ArrowRight size={18}/></Link><div className="trust"><ShieldCheck size={16}/> All payments remain in test mode until financial partner integration</div></div><div className="hero-card"><div className="card-top"><span>This month's rent</span><span className="status"><span className="dot"/> Scheduled</span></div><div className="amount">₩750,000</div><div className="card-line"/><div className="card-info"><span>Deposit date<strong>2026. 11. 05</strong></span><span>Recipient<strong>Test landlord</strong></span></div><div className="card-bottom"><span className="mini-logo">D</span><span>DIVERCITY PAY</span><span className="visa">VISA</span></div></div></section>
    <section className="numbers"><div><strong>Guided<span> application</span></strong><small>Submit your rent details step by step</small></div><div><strong>No landlord<span> sign-up</span></strong><small>Use the designated deposit account</small></div><div><strong>Clear<span> status updates</span></strong><small>Track every review step in one place</small></div></section>
    <section id="how" className="section wrap"><div className="section-head"><div><div className="eyebrow">HOW IT WORKS</div><h2>Rent payments, made simple</h2></div><p>Apply quickly with a simple guided flow.</p></div><div className="how-grid">{([['01','Upload your contract','Upload a photo or file of your lease contract',FileText],['02','Enter rent details','Enter the rent amount and deposit account',Building2],['03','Request card payment','Review the amount and submit your request',CreditCard],['04','Deposit to landlord','After review, funds are routed to the designated account',Check]] as const).map(([n,t,d,Icon])=><div className="how-card" key={n}><span className="num">{n}</span><Icon size={25}/><h3>{t}</h3><p>{d}</p><ChevronRight className="chev" size={18}/></div>)}</div></section>
    <section id="apply" className="apply-section"><div className="wrap"><div className="section-head"><div><div className="eyebrow">APPLICATION PREVIEW</div><h2>See how to apply</h2></div><div className="test-note"><LockKeyhole size={16}/> Preview only · No information is submitted here</div></div><div className="apply-box application-preview"><div className="preview-heading"><div><span className="preview-label">YOUR RENT APPLICATION</span><h3>Everything in one place</h3><p>Start from your dashboard when you're ready. You can review your details before submitting a test application.</p></div><span className="preview-badge">Example</span></div><div className="preview-steps"><div><span className="preview-icon"><FileText size={20}/></span><div><strong>Lease contract</strong><small>Upload a PDF or photo</small></div><span className="preview-example">lease-example.pdf</span></div><div><span className="preview-icon"><Building2 size={20}/></span><div><strong>Rent and property</strong><small>Enter your rent, address and lease dates</small></div></div><div><span className="preview-icon"><CreditCard size={20}/></span><div><strong>Landlord account</strong><small>Add the designated bank account details</small></div></div></div><div className="preview-footer"><p>Test mode: no real card payment or bank transfer.</p><Link href="/dashboard" className="primary">Go to my dashboard <ArrowRight size={17}/></Link></div></div></div></section>
    <section id="faq" className="section wrap"><div className="section-head"><div><div className="eyebrow">FAQ</div><h2>FAQ</h2></div><p>Learn more before using the test service.</p></div><div className="faq-list"><details><summary>Does the landlord need to sign up?</summary><p>No. The test service only demonstrates the flow to the designated account entered by the tenant.</p></details><details><summary>Are real card payments or transfers made?</summary><p>No. All payments and transfers remain simulated until financial partner integration.</p></details><details><summary>Where is my contract stored?</summary><p>It is stored in private Supabase Storage and accessible only to you and authorized admins via secure links.</p></details><details><summary>Can I cancel an application?</summary><p>Applications can be cancelled from the detail page while awaiting review.</p></details></div></section>
    <section id="safe" className="safe wrap"><ShieldCheck size={30}/><div><h2>Start with confidence</h2><p>Your personal data and contract files are protected. No real transaction occurs before financial partner integration.</p></div></section>
    <footer><div className="wrap footer-inner"><div className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></div><div className="footer-links"><Link href="/fees">Fees</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><span>© 2026 DIVERCITY PAY · Test service</span></div></div></footer>
  </main>;
}
