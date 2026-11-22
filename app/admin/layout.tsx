import type {ReactNode} from 'react';
import AccountTheme from '../../components/ui/AccountTheme';
import AdminAccess from './AdminAccess';

// The admin routes reuse the tenant design tokens without a global reset.
export default function AdminLayout({children}:{children:ReactNode}){
 return <AccountTheme><AdminAccess>{children}</AdminAccess></AccountTheme>;
}
