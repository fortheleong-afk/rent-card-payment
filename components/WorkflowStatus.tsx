import { Check, FlaskConical } from 'lucide-react';
import type { Journey, Locale } from '../lib/workflow';

export function TestNotice({locale='en'}:{locale?:Locale}){
 return <div className="work-test-note"><FlaskConical size={16} aria-hidden="true"/><span>{locale==='ko'?'테스트 환경 · 실제 결제·송금 없음':'Test environment · No real payments or transfers'}</span></div>;
}
export function StatusBadge({journey}:{journey:Journey}){
 return <span className={`work-badge work-tone-${journey.tone}`}><span aria-hidden="true"/>{journey.title}</span>;
}
export function JourneyPanel({journey,locale='en',children}:{journey:Journey;locale?:Locale;children?:React.ReactNode}){
 return <div className={`work-next work-tone-${journey.tone}`}><h2>{journey.title}</h2><p>{journey.description}</p><div className="work-next-action"><strong>{locale==='ko'?'다음 할 일':'What happens next'}</strong><p>{journey.next}</p>{children}</div></div>;
}
export function JourneyProgress({journey,locale='en'}:{journey:Journey;locale?:Locale}){
 const stages=locale==='ko'?['신청 심사','테스트 결제','테스트 지급']:['Review','Test payment','Test payout'];
 return <ol className="work-progress" aria-label={locale==='ko'?'처리 단계':'Application progress'}>{stages.map((text,i)=><li key={text} className={i<journey.stage?'is-done':i===journey.stage?'is-current':''} aria-current={i===journey.stage?'step':undefined}><span>{i<journey.stage?<Check size={14} aria-hidden="true"/>:i+1}</span>{text}</li>)}</ol>;
}
