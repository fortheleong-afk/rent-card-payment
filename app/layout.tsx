import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '집업페이 | 월세 카드결제', description: '임차인을 위한 안전한 월세 카드결제 테스트 서비스' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
