'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){
 return <main className="work-page"><section className="wrap work-main"><div className="work-empty" role="alert"><h1>This page could not be loaded</h1><p>Please try again. If you were submitting an application, check your dashboard before starting another one.</p><button type="button" className="work-button work-button-primary" onClick={reset}>Try again</button> <Link className="work-button" href="/dashboard">Open dashboard</Link></div></section></main>;
}
