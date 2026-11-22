'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminAccess({ children }: { children: ReactNode }) {
  const path = usePathname();
  const verify = path === '/admin/verify';
  const [allowedPath, setAllowedPath] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (verify) return;
    let active = true;
    setError('');
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          window.location.replace('/login?next=' + encodeURIComponent(path));
          return;
        }
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!active) return;
        if (profileError) throw profileError;
        if (profile.role !== 'admin') {
          setError('관리자 권한이 없는 계정입니다.');
          return;
        }
        const { data, error: accessError } = await supabase.rpc('is_admin');
        if (!active) return;
        if (accessError) throw accessError;
        if (!data) window.location.replace('/admin/verify?next=' + encodeURIComponent(path));
        else setAllowedPath(path);
      } catch {
        if (active) setError('관리자 권한을 확인하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.');
      }
    }
    void check();
    return () => { active = false; };
  }, [path, verify]);

  if (verify || allowedPath === path) return children;
  return <main className="auth-page" lang="ko"><div className="auth-box">
    <h1>관리자 접근 확인</h1>
    <p role={error ? 'alert' : 'status'}>{error || '로그인과 추가 인증 상태를 확인하고 있습니다.'}</p>
    {error && <Link href="/dashboard">사용자 대시보드</Link>}
  </div></main>;
}
