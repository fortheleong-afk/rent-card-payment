import LegalDocument from '../../components/LegalDocument';
import { privacySections, privacyKorean } from '../../lib/legal-content';
export const metadata = { title: 'Privacy policy | Divercity Pay' };
export default function Page() {
 return <LegalDocument title="Privacy policy" intro="How Divercity House handles account information, saved applications and documents in the test service. Use sample documents; remaining launch requirements are explained below." sections={privacySections} koreanTitle="개인정보 처리방침" koreanSections={privacyKorean}/>;
}
