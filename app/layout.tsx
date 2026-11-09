import type { Metadata } from 'next';
import WorkspaceGate from '../components/WorkspaceGate';
import './globals.css';
import './faq.css';
import './dashboard.css';
import './admin-extra.css';
import './review.css';
import './taste-overrides.css';
import './info.css';
import './workflow.css';
import './legal.css';

export const metadata: Metadata = { title: 'Divercity Pay | Rent by Card', description: 'A secure test-mode rent payment service for tenants.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><WorkspaceGate>{children}</WorkspaceGate></body></html>; }
