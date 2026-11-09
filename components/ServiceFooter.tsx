import Link from 'next/link';
import { serviceInfo as info } from '../lib/service-info';

export default function ServiceFooter() {
  return <footer className="service-footer" aria-label="Service and company information">
    <div className="wrap">
      <div className="service-footer-top"><Link href="/" className="brand"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link>
        <nav aria-label="Legal and support"><Link href="/terms">Terms of use · 이용약관</Link><Link href="/privacy"><strong>Privacy policy · 개인정보 처리방침</strong></Link><Link href="/fees">Fees</Link><Link href="/contact">Contact</Link></nav>
      </div>
      <dl className="service-company">
        <div><dt>Operator · 상호</dt><dd>{info.company}</dd></div>
        <div><dt>Representative · 대표자</dt><dd>{info.representative}</dd></div>
        <div><dt>Business registration · 사업자등록번호</dt><dd>{info.registration}</dd></div>
        <div className="service-address"><dt>Address · 사업장 주소</dt><dd><span lang="ko">{info.address}</span><br/>{info.addressEn}</dd></div>
        <div><dt>Company contact · 회사 연락처</dt><dd><a href={`mailto:${info.companyEmail}`}>{info.companyEmail}</a></dd></div>
        <div><dt>Pay support · 서비스 문의</dt><dd>{info.serviceContact} · <a href={`mailto:${info.serviceEmail}`}>{info.serviceEmail}</a></dd></div>
      </dl>
      <p className="service-footer-note">Test service. No real card payment or bank transfer is available. © 2026 Divercity House.</p>
    </div>
  </footer>;
}
