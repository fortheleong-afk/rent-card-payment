'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, FileText, LockKeyhole, Menu, ShieldCheck, X } from 'lucide-react';
import AuthStatus from '../components/AuthStatus';
import ApplicationDemo from '../components/ApplicationDemo';
import ServiceFooter from '../components/ServiceFooter';
import './home-preview.css';
import styles from './home.module.css';

const journey = [
  ['Upload your contract', 'Add your lease and the address of your home.'],
  ['Enter rent details', 'Review the rent amount and your landlord’s deposit account.'],
  ['Submit for review', 'Send your application and follow its progress in your dashboard.'],
  ['Track the next step', 'See review updates and simulated payment and transfer statuses.'],
];

export default function Home() {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const motionRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Content stays visible even before hydration or when observation is unavailable.
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add(styles.entered);
      observer.unobserve(entry.target);
    }), { threshold: 0.12 });
    motionRoot.current?.querySelectorAll('[data-home-reveal]').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  const closeMenu = () => setMenu(false);
  return <main className={styles.home} ref={motionRoot}>
    <a className={styles.skipLink} href="#home-content">Skip to content</a>
    <div className={styles.testBanner}><ShieldCheck size={15} aria-hidden="true"/> Test mode. No real payments or transfers.</div>
    <header className={styles.siteHeader}>
      <div className={styles.navigation}>
        <Link href="/" className={styles.brand} aria-label="Divercity Pay home"><span className={styles.logo}>D</span><span>Divercity<span>Pay</span></span></Link>
        <nav className={styles.desktopLinks} aria-label="Main navigation"><a href="#how">How it works</a><a href="#apply">Try the demo</a><a href="#faq">FAQ</a></nav>
        <div className={styles.account}><AuthStatus /></div>
        <button ref={menuButton} type="button" className={styles.menuButton} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="home-mobile-navigation" onClick={() => setMenu(!menu)}>{menu ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button>
      </div>
      {menu && <nav id="home-mobile-navigation" className={styles.mobileLinks} aria-label="Mobile navigation"><a href="#how" onClick={closeMenu}>How it works</a><a href="#apply" onClick={closeMenu}>Try the demo</a><a href="#safe" onClick={closeMenu}>Security</a><a href="#faq" onClick={closeMenu}>FAQ</a><Link href="/profile">Manage profile</Link></nav>}
    </header>
    <section id="home-content" className={`${styles.container} ${styles.hero}`} aria-labelledby="home-title">
      <div className={styles.heroCopy}>
        <h1 id="home-title">Pay rent<br/><span>with your card.</span></h1>
        <p>A simpler way to manage your rent in Korea. Add your lease, enter your rent details, and follow every step in one place.</p>
        <div className={styles.heroActions}><Link className={styles.primary} href="/dashboard">Start a rent application <ArrowRight size={18} aria-hidden="true"/></Link><a className={styles.textLink} href="#apply">Explore the demo <ArrowRight size={17} aria-hidden="true"/></a></div>
        <p className={styles.testHint}>Currently in testing. Card payments and landlord transfers are simulated.</p>
      </div>
      <aside className={styles.receipt} aria-label="Example application preview" data-home-reveal>
        <div className={styles.receiptHeading}><span>Application preview</span><span className={styles.exampleTag}>Example</span></div>
        <p className={styles.rentLabel}>Monthly rent</p><strong className={styles.rentAmount}>₩750,000</strong>
        <dl className={styles.receiptDetails}><div><dt>Recipient</dt><dd>Example landlord</dd></div><div><dt>Deposit account</dt><dd>Shinhan · •••• 0000</dd></div><div><dt>Payment mode</dt><dd>Test only</dd></div></dl>
        <ol className={styles.receiptTimeline} aria-label="Example review progress"><li><Check size={15} aria-hidden="true"/><span>Contract added</span></li><li><Check size={15} aria-hidden="true"/><span>Rent details entered</span></li><li><span className={styles.currentDot}/><span>Ready for review</span></li></ol>
        <div className={styles.receiptNote}><LockKeyhole size={15} aria-hidden="true"/> No card details needed for this preview.</div>
      </aside>
    </section>
    <section id="how" className={`${styles.container} ${styles.journey}`} aria-labelledby="how-title">
      <div className={styles.sectionHeading}><h2 id="how-title">From lease to review.</h2><p>A guided application, with a clear place to check what happens next.</p></div>
      <ol className={styles.journeySteps}>{journey.map(([title, description], index) => <li key={title} data-home-reveal><span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
    </section>
    <section id="apply" className={styles.demoSection} aria-labelledby="demo-title">
      <div className={styles.container}>
        <div className={styles.sectionHeading}><div><h2 id="demo-title">Take a look before you apply.</h2><p>Walk through the steps with example details. No file or account required.</p></div></div>
        <div className={styles.demoLayout}><div className={styles.demoIntro}><FileText size={28} aria-hidden="true"/><h3>A practice run.<br/>Nothing gets sent.</h3><p>Skip any field and try every step. Files stay on your device, and this walkthrough never creates an application.</p><a className={styles.textLink} href="/dashboard">Ready to apply? Open your dashboard <ArrowRight size={17} aria-hidden="true"/></a><span className={styles.demoPrivacy}>Use example information, not personal details.</span></div><ApplicationDemo /></div>
      </div>
    </section>
    <section id="safe" className={`${styles.container} ${styles.security}`} aria-labelledby="security-title" data-home-reveal>
      <div><ShieldCheck size={28} aria-hidden="true"/><h2 id="security-title">Your application.<br/>Your private space.</h2><Link className={styles.textLink} href="/privacy">Read our privacy policy <ArrowRight size={17} aria-hidden="true"/></Link></div>
      <dl><div><dt>Private contract storage</dt><dd>Submitted contracts are available to you and authorized reviewers through temporary links.</dd></div><div><dt>A clear application record</dt><dd>Check submitted details, review updates, and status history from your dashboard.</dd></div><div><dt>No real money moves yet</dt><dd>Payments and transfers stay in test mode while financial partner integration is being prepared.</dd></div></dl>
    </section>
    <section id="faq" className={`${styles.container} ${styles.faq}`} aria-labelledby="faq-title">
      <div><h2 id="faq-title">A few things<br/>to know.</h2><p>Still have a question?</p><Link className={styles.textLink} href="/contact">Contact us <ArrowRight size={17} aria-hidden="true"/></Link></div>
      <div className={styles.questions}>
        <details><summary>Are real card payments or transfers made?</summary><p>No. All payments and transfers are simulated. Applying does not charge your card or send money to a landlord.</p></details>
        <details><summary>Does the landlord need to sign up?</summary><p>The test flow uses the account details entered by the tenant. Requirements for a live service will be confirmed with our financial partners.</p></details>
        <details><summary>Does the homepage demo save my details?</summary><p>No. This walkthrough does not upload files or save an application. To submit a test application for review, sign in and start from your dashboard.</p></details>
        <details><summary>Where is my submitted contract stored?</summary><p>Contracts submitted through your dashboard are stored privately and can be opened by you and authorized admins using temporary links.</p></details>
        <details><summary>Can I cancel an application?</summary><p>You can cancel an application from its detail page while it is awaiting review.</p></details>
      </div>
    </section>
    <ServiceFooter />
  </main>;
}
