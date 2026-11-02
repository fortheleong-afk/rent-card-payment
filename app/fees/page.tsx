import Link from 'next/link';
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react';

export default function FeesPage() {
  return <main className="info-page">
    <header className="info-header"><div className="nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><Link href="/login" className="login">Log in</Link></div></header>
    <section className="info-main">
      <Link href="/" className="info-back"><ArrowLeft size={14}/> Back to home</Link>
      <div className="info-kicker">FEES &amp; PROCESS</div><h1>Know the amount<br/>before you apply.</h1>
      <p className="info-lead">Divercity Pay shows the estimated service fee before you submit an application. The current site is a test environment, so no card charge or bank transfer is made.</p>
      <div className="info-panel">
        <div className="info-row"><h2>Service fee</h2><p>The test flow currently calculates a service fee of 2.9% of the monthly rent. This is an estimate for the prototype and may change after financial partner agreements are completed.</p></div>
        <div className="info-row"><h2>What you will see</h2><ul><li>Monthly rent</li><li>Estimated service fee</li><li>Total scheduled card amount</li><li>Designated landlord deposit account</li></ul></div>
        <div className="info-row"><h2>Before submission</h2><p>You can review the rent, address, landlord details, account information and test payment status before submitting the application.</p></div>
      </div>
      <div className="info-note"><LockKeyhole size={18}/><div><strong>Test environment</strong>Real payment and transfer APIs are not connected. Submitting an application only creates a review record for this prototype.</div></div>
    </section>
  </main>;
}
