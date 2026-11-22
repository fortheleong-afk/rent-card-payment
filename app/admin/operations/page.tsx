'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

type OperationsSummary = {
  intake_open: boolean;
  email_enabled: boolean;
  overdue_review: number;
  recent_submission_errors: number;
  recent_contract_errors: number;
  email_waiting: number;
  email_failed: number;
  contract_files: number;
  contract_bytes: number;
  last_contract_access: Array<{
    id: string;
    actor_id: string;
    full_name: string | null;
    application_number: string | null;
    action: 'details' | 'preview' | 'download';
    occurred_at: string;
  }>;
};

const actionLabel = { details: '신청 상세 조회', preview: '계약서 미리보기 권한 발급', download: '계약서 다운로드 권한 발급' };
const formatTime = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

export default function OperationsPage() {
  const [summary, setSummary] = useState<OperationsSummary>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await supabase.rpc('operations_summary');
      if (result.error || !result.data) throw result.error;
      setSummary(result.data);
    } catch {
      setError('운영 상태를 확인하지 못했습니다. 추가 인증을 확인하고 다시 시도해 주세요.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function changeIntake() {
    if (!summary || !confirm || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase.rpc('set_application_intake', { p_open: !summary.intake_open });
      if (updateError) throw updateError;
      setConfirm(false);
      await load();
    } catch {
      setError('접수 상태 변경을 확인하지 못했습니다. 최신 상태를 확인해 주세요.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return <main className="work-page" lang="ko">
    <section className="wrap work-main">
      <Link className="work-back" href="/admin">신청·거래 관리</Link>
      <div className="work-page-heading"><div><h1>운영 상태</h1><p>접수 현황과 최근 오류, 자료 접근 이력을 확인합니다.</p></div>
        <button className="work-button" disabled={busy} onClick={load}>새로고침</button>
      </div>
      {error && <p className="work-error" role="alert">{error}</p>}
      {!summary && !error && <p role="status">운영 상태를 불러오고 있습니다.</p>}
      {summary && <>
        <section className="work-sheet" aria-labelledby="intake-heading">
          <h2 id="intake-heading">신청 접수 · {summary.intake_open ? '접수 가능' : '일시 중지'}</h2>
          <p>접수를 중지하면 신규 신청과 보완 제출을 일시 중지합니다. 신청 조회와 초안 저장은 계속할 수 있습니다.</p>
          {confirm ? <div className="work-dialog-actions">
            <button className="work-button" disabled={busy} onClick={()=>setConfirm(false)}>돌아가기</button>
            <button className="work-button work-button-primary" disabled={busy} onClick={changeIntake}>
              {busy ? '반영 중…' : summary.intake_open ? '접수 중지 확인' : '접수 재개 확인'}
            </button>
          </div> : <button className="work-button" onClick={()=>setConfirm(true)}>{summary.intake_open ? '접수 중지' : '접수 재개'}</button>}
        </section>
        <section className="work-sheet" aria-labelledby="signals-heading">
          <h2 id="signals-heading">확인이 필요한 업무</h2>
          {summary.contract_bytes >= 250*1024*1024 && <p className="work-feedback" role="status">계약서 보관량이 내부 점검 기준인 250 MB에 도달했습니다. 보관 대상과 백업 용량을 확인해 주세요.</p>}
          <dl className="work-facts">
            <div><dt>48시간 넘게 대기한 심사</dt><dd><Link href="/admin?queue=review&sort=oldest">{summary.overdue_review}건</Link></dd></div>
            <div><dt>최근 24시간 제출 오류 보고</dt><dd>{summary.recent_submission_errors}건</dd></div>
            <div><dt>최근 24시간 계약서 링크 오류 보고</dt><dd>{summary.recent_contract_errors}건</dd></div>
            <div><dt>심사 이메일</dt><dd>{summary.email_enabled ? '발송 설정 사용 중' : '발송 비활성'}</dd></div>
            <div><dt>대기 및 재시도 예정 메일</dt><dd>{summary.email_waiting}건</dd></div>
            <div><dt>수신 주소 확인 또는 수동 처리가 필요한 메일</dt><dd>{summary.email_failed}건</dd></div>
            <div><dt>비공개 계약서 저장량</dt><dd>{(summary.contract_bytes/(1024*1024)).toFixed(1)} MB · {summary.contract_files}개</dd></div>
          </dl>
        </section>
        <section className="work-sheet" aria-labelledby="access-heading">
          <h2 id="access-heading">최근 자료 접근 이력</h2>
          {summary.last_contract_access.length ? <ol className="work-timeline">
            {summary.last_contract_access.map(event => <li key={event.id}>
              <time dateTime={event.occurred_at}>{formatTime(event.occurred_at)}</time>
              <strong>{actionLabel[event.action]}</strong>
              <p>{event.application_number ?? '신청번호 없음'} · {event.full_name || event.actor_id.slice(0,8)}</p>
            </li>)}
          </ol> : <p>아직 기록된 접근 이력이 없습니다.</p>}
        </section>
      </>}
    </section>
  </main>;
}
