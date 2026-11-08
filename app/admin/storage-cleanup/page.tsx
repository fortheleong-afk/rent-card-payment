'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import styles from './storage-cleanup.module.css';

type Orphan = { path: string; uploaded_at: string };

export default function StorageCleanup() {
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'admin' | 'denied'>('checking');
  const [files, setFiles] = useState<Orphan[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !user) {
        router.replace('/login?next=/admin/storage-cleanup');
        return;
      }
      const { data: profile, error: roleError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (active) setAccess(!roleError && profile?.role === 'admin' ? 'admin' : 'denied');
    })();
    return () => { active = false; };
  }, [router]);

  async function scan() {
    if (access !== 'admin' || busy) return;
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('find_old_orphan_contracts', { p_limit: 50 });
    if (error) {
      setFiles(null);
      setMessage(`조회 실패: ${error.message}`);
    } else {
      setFiles((data ?? []) as Orphan[]);
      setMessage(data?.length ? '최근 7일 이내 파일과 신청에 연결된 파일은 제외했습니다.' : '정리할 파일이 없습니다.');
    }
    setBusy(false);
  }

  async function remove() {
    if (access !== 'admin' || busy || !files?.length) return;
    if (!window.confirm(`신청에 연결되지 않은 파일 ${files.length}개를 영구 삭제하시겠습니까? 삭제 직전에도 연결 여부를 다시 확인합니다.`)) return;
    setBusy(true);
    setMessage('');
    // Recheck on the server immediately before deletion. Storage RLS checks again per object.
    const { data: fresh, error: scanError } = await supabase.rpc('find_old_orphan_contracts', { p_limit: 50 });
    if (scanError) {
      setMessage(`삭제 전 확인 실패: ${scanError.message}`);
      setBusy(false);
      return;
    }
    const approvedPaths = new Set(files.map(file => file.path));
    const paths = ((fresh ?? []) as Orphan[]).map(file => file.path).filter(path => approvedPaths.has(path));
    if (!paths.length) {
      setFiles([]);
      setMessage('삭제할 파일이 없어졌습니다. 다시 조회해 주세요.');
      setBusy(false);
      return;
    }
    const { error } = await supabase.storage.from('contract-documents').remove(paths);
    if (error) {
      setMessage(`삭제 실패: ${error.message}. 새로 조회해 상태를 확인해 주세요.`);
      setFiles(null);
    } else {
      const { data: remaining, error: verifyError } = await supabase.rpc('find_old_orphan_contracts', { p_limit: 50 });
      setFiles(verifyError ? null : (remaining ?? []) as Orphan[]);
      const stillPresent = ((remaining ?? []) as Orphan[]).filter(file => paths.includes(file.path)).length;
      setMessage(verifyError
        ? `삭제 요청을 보냈지만 결과 확인에 실패했습니다: ${verifyError.message}`
        : stillPresent
          ? `${stillPresent}개 파일이 남아 있습니다. 권한 정책을 확인해 주세요.`
          : `${paths.length}개 파일 삭제를 확인했습니다.${remaining?.length ? ' 남은 파일은 아래 목록에서 확인하세요.' : ''}`);
    }
    setBusy(false);
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.nav}><Link href="/admin">← 거래 심사로 돌아가기</Link><span>Divercity Pay · 관리자</span></nav>
      <h1>계약서 보관 점검</h1>
      <p className={styles.lead}>신청에 연결되지 않은 계약서 파일 중 업로드 후 7일이 지난 것만 확인합니다.</p>
      <p className={styles.note}>자동 실행이나 주기적 조회는 없습니다. 조회할 때마다 최대 50개만 표시하며, 파일 삭제는 별도 확인 후 실행됩니다. 제출된 신청의 계약서는 취소 후에도 삭제 대상이 아닙니다.</p>
      {access === 'checking' && <p role="status">관리자 권한을 확인하고 있습니다.</p>}
      {access === 'denied' && <p role="alert">관리자만 사용할 수 있습니다. <Link href="/dashboard">대시보드로 이동</Link></p>}
      {access === 'admin' && <>
        <div className={styles.actions}>
          <button type="button" onClick={scan} disabled={busy}>{busy ? '처리 중…' : '오래된 미연결 파일 조회'}</button>
          {files !== null && files.length > 0 && <button type="button" className={styles.danger} onClick={remove} disabled={busy}>선택된 {files.length}개 삭제</button>}
        </div>
        {message && <p role="status" className={styles.message}>{message}</p>}
        {files !== null && <section aria-label="정리 대상 파일" className={styles.results}>
          <h2>조회 결과 <span>{files.length}개{files.length === 50 ? ' · 추가 파일이 있을 수 있음' : ''}</span></h2>
          {files.length === 0 ? <p>조회된 미연결 파일이 없습니다.</p> : <ul>{files.map(file => <li key={file.path}><span className={styles.file}>{file.path.split('/').at(-1)}</span><time dateTime={file.uploaded_at}>{new Date(file.uploaded_at).toLocaleString('ko-KR')}</time></li>)}</ul>}
        </section>}
      </>}
    </div>
  </main>;
}
