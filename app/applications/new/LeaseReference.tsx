'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import type { StoredContract } from '../../../lib/application-drafts';
import { checkLeaseFile, createContractLink } from '../../../lib/contracts';
import styles from './application.module.css';

type Lease = File | StoredContract;

function LeaseDocument({file}: {file: Lease}) {
  const [source, setSource] = useState<{url: string; pdf: boolean} | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setSource(null);
    setError('');

    async function load() {
      let documentFile: File;
      if (file instanceof File) {
        documentFile = file;
      } else {
        const {url} = await createContractLink(file.path, file.name, {locale: 'en'});
        const response = await fetch(url, {signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer'});
        if (!response.ok) throw new Error('Could not load your saved lease. Check your connection and try again.');
        const blob = await response.blob();
        const type = file.type || blob.type;
        documentFile = new File([blob], file.name, {type});
      }
      const issue = await checkLeaseFile(documentFile);
      if (issue) throw new Error(issue);
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(documentFile);
      setSource({url: objectUrl, pdf: documentFile.type === 'application/pdf'});
    }
    load().catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not open your lease.');
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, attempt]);

  if (error) return <div className={styles.readerStatus}><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry preview</button></div>;
  if (!source) return <p className={styles.readerStatus} role="status">Opening your lease…</p>;
  return <>
    <div className={styles.documentBar}><span>{file.name}</span><a href={source.url} target="_blank" rel="noopener noreferrer">Open full size <ExternalLink size={14} aria-hidden="true"/></a></div>
    <div className={styles.documentBody}>
      {source.pdf ? <iframe title="Lease PDF" src={source.url}/> :
        // A private, browser-local image cannot use the Next.js image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.url} alt="Your uploaded lease" onError={() => setError('This image could not be displayed. Check the uploaded file and try again.')}/>}
    </div>
  </>;
}

export default function LeaseReference({file, lastField}: {file: Lease; lastField: RefObject<HTMLElement | null>}) {
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 60rem)');
    function sync() {
      setWide(media.matches);
      if (media.matches) setOpen(false);
    }
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  function returnToForm() {
    setOpen(false);
    const field = lastField.current;
    (field?.isConnected ? field : trigger.current)?.focus();
  }

  if (wide) return <aside className={styles.reader} aria-label="Lease reference">
    <h2><BookOpen size={19} aria-hidden="true"/> Your lease</h2>
    <LeaseDocument file={file}/>
  </aside>;

  return <div className={styles.mobileReference}>
    <button type="button" ref={trigger} className={styles.readerTrigger} aria-haspopup="dialog" onClick={() => setOpen(true)}><BookOpen size={18} aria-hidden="true"/> View my lease</button>
    <dialog ref={dialog} className={styles.sheet} aria-labelledby="lease-dialog-title" onClose={returnToForm}>
      <div className={styles.sheetHeading}><h2 id="lease-dialog-title">Your lease</h2><button type="button" onClick={() => dialog.current?.close()}><X size={16} aria-hidden="true"/> Back to form</button></div>
      {open && <LeaseDocument file={file}/>}
    </dialog>
  </div>;
}
