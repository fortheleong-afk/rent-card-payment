import LegalDocument from '../../components/LegalDocument';
import { termsSections, termsKorean } from '../../lib/legal-content';
export const metadata = { title: 'Terms of use | Divercity Pay' };
export default function Page() {
 return <LegalDocument title="Terms of use" intro="The scope of the current prototype, how applications are handled, and how to contact the operator. Real payments and transfers remain unavailable." sections={termsSections} koreanTitle="이용약관" koreanSections={termsKorean}/>;
}
