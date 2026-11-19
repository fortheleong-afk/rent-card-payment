'use client';
import type {ReactNode} from 'react';
import AccountHeader from '../AccountHeader';
import AccountTheme from './AccountTheme';
import styles from './account-screen.module.css';
export default function AccountScreen({children,className='',contentId}:{children:ReactNode;className?:string;contentId:string}){
 return <AccountTheme><main className={`dashboard-page work-page ${styles.surface} ${className}`}><a className={styles.skipLink} href={`#${contentId}`}>Skip to page content</a><AccountHeader/>{children}</main></AccountTheme>;
}
