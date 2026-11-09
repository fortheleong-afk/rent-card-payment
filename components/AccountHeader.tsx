'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
export default function AccountHeader(){
 const path=usePathname();
 return <header className="work-header"><div className="wrap work-nav"><Link href="/" className="brand" aria-label="Divercity Pay home"><span className="logo">D</span><span>Divercity<span>Pay</span></span></Link><nav aria-label="Account navigation"><Link href="/dashboard" aria-current={path==='/dashboard'?'page':undefined}>Dashboard</Link><Link href="/applications" aria-current={path.startsWith('/applications')?'page':undefined}>Applications</Link><Link href="/notifications" aria-current={path==='/notifications'?'page':undefined}>Updates</Link><Link href="/profile" aria-current={path==='/profile'?'page':undefined}>Profile</Link></nav></div></header>;
}
