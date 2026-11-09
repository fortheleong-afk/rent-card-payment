import Link from 'next/link';
import ServiceFooter from './ServiceFooter';
import { serviceInfo } from '../lib/service-info';

export type LegalSection = { title: string; text: string };
export default function LegalDocument({ title, intro, sections, koreanTitle, koreanSections }: {
  title: string; intro: string; sections: LegalSection[]; koreanTitle: string; koreanSections: LegalSection[];
}) {
  return <main className="legal-page">
    <header className="info-header"><div className="nav"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><Link href="/dashboard">My dashboard</Link></div></header>
    <article className="legal-document">
      <Link href="/" className="info-back">Back to home</Link>
      <h1>{title}</h1><p className="legal-version">Test-service edition · Effective {serviceInfo.policyVersion}</p>
      <p className="legal-intro">{intro}</p>
      <nav className="legal-contents" aria-label="On this page">{sections.map((section,index)=><a key={section.title} href={`#section-${index}`}>{section.title}</a>)}<a href="#korean">한국어로 보기</a></nav>
      {sections.map((section,index)=><section id={`section-${index}`} key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}
      <details id="korean" lang="ko"><summary>{koreanTitle} · 한국어 전문</summary>{koreanSections.map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}</details>
      <p className="legal-help">Questions or privacy requests? <a href={`mailto:${serviceInfo.serviceEmail}`}>{serviceInfo.serviceEmail}</a></p>
    </article>
    <ServiceFooter/>
  </main>;
}
