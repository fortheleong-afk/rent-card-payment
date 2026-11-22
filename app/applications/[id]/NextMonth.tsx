'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { startNextRent } from '../../../lib/next-rent';
import { renewalSchedule } from '../../../lib/rent-period';
import styles from '../detail.module.css';

export default function NextMonth({id, month}: {id: string; month: string | null}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otherDraft, setOtherDraft] = useState(false);
  const running = useRef(false);
  const target = renewalSchedule(month, null).month;
  const label = new Intl.DateTimeFormat('en', {month: 'long', year: 'numeric', timeZone: 'UTC'})
    .format(new Date(target + '-01T00:00:00Z'));

  async function start() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setOtherDraft(false);
    setError('');
    try {
      const result = await startNextRent(id);
      if ('url' in result) { window.location.assign(result.url); return; }
      setOtherDraft(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your next application. Please try again.');
    }
    running.current = false;
    setBusy(false);
  }

  return <section className={styles.renewal} aria-labelledby="next-rent-heading">
    <div><h2 id="next-rent-heading">Rent for {label}</h2>
      <p>Reuse your lease details, then review the rent and confirm the landlord’s account.</p></div>
    <button type="button" className="work-button" onClick={start} disabled={busy}>{busy ? 'Checking applications…' : 'Apply for next month'}</button>
    {otherDraft && <p className={styles.renewalMessage} role="status">You have another draft in progress. Finish or discard it before starting this one. <Link href="/applications/new">Open saved draft</Link></p>}
    {error && <p className={styles.renewalMessage} role="alert">{error}</p>}
  </section>;
}
