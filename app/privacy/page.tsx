import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
  return <main className="info-page">
    <header className="info-header"><div className="nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><Link href="/login" className="login">Log in</Link></div></header>
    <section className="info-main">
      <Link href="/" className="info-back"><ArrowLeft size={14}/> Back to home</Link>
      <div className="info-kicker">PRIVACY &amp; SECURITY</div><h1>Your information,<br/>handled carefully.</h1>
      <p className="info-lead">This prototype is designed to keep application information visible only to the applicant and authorized administrators.</p>
      <div className="info-panel">
        <div className="info-row"><h2>Information collected</h2><p>Account information, name, phone number, lease contract file, property address, rent amount and landlord deposit account details may be collected when you use the test flow.</p></div>
        <div className="info-row"><h2>How it is used</h2><p>Information is used to create a test application, calculate an estimated fee, review the submission and show status updates.</p></div>
        <div className="info-row"><h2>Access controls</h2><p>Applicants can view their own applications. Authorized administrators can review submissions for operational testing. Account numbers are masked in the interface.</p></div>
        <div className="info-row"><h2>Financial activity</h2><p>No real card authorization, settlement or bank transfer is performed by this prototype.</p></div>
      </div>
      <div className="info-note"><ShieldCheck size={18}/><div><strong>Security note</strong>Do not upload documents or enter account information that you do not have permission to use in this test environment.</div></div>
    </section>
  </main>;
}
