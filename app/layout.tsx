import type { Metadata } from 'next';
import './globals.css';
import './faq.css';
import './dashboard.css';
import './admin-extra.css';
import './review.css';
import './taste-overrides.css';
import './info.css';
import './workflow.css';
import './legal.css';
import './accessibility.css';

export const metadata: Metadata = { title: 'Divercity Pay | Rent by Card', description: 'A secure test-mode rent payment service for tenants.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
