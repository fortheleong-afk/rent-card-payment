import Link from 'next/link';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';

export default function ContactPage() {
  return <main className="info-page">
    <header className="info-header"><div className="nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><Link href="/login" className="login">Log in</Link></div></header>
    <section className="info-main">
      <Link href="/" className="info-back"><ArrowLeft size={14}/> Back to home</Link>
      <div className="info-kicker">CONTACT</div><h1>We are here<br/>to help.</h1>
      <p className="info-lead">Have a question about an application, a contract file or the test flow? Use the channels below and include your application number when available.</p>
      <div className="contact-grid">
        <div className="contact-card"><Mail size={20} color="var(--blue)"/><h2>Email support</h2><p>For account and application questions, email <a href="mailto:fortheleong@gmail.com">fortheleong@gmail.com</a>.</p></div>
        <div className="contact-card"><MessageCircle size={20} color="var(--blue)"/><h2>Application support</h2><p>Open your dashboard and share the application number shown in the detail page so the operator can find the correct record.</p></div>
      </div>
      <div className="info-note"><div><strong>Test service response</strong>This is a prototype operated for workflow testing. Support responses do not represent a financial institution or a completed payment service.</div></div>
    </section>
  </main>;
}
