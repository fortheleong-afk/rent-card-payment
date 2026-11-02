import { supabase } from './supabase';

export type ContractLink = { url: string; fileName: string; expiresIn: number };

export async function createContractLink(path: string | null, fileName?: string | null): Promise<ContractLink> {
  if (!path) throw new Error('계약서 파일 경로가 없습니다.');
  const { data, error } = await supabase.storage.from('contract-documents').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('not found') || message.includes('object')) throw new Error('Storage에서 계약서 파일을 찾지 못했습니다. 파일을 다시 제출해주세요.');
    if (message.includes('permission') || message.includes('row-level')) throw new Error('계약서 접근 권한이 없습니다. 관리자 계정과 Storage 정책을 확인해주세요.');
    throw new Error('계약서 보안 링크를 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return { url: data.signedUrl, fileName: fileName || path.split('/').pop() || 'contract', expiresIn: 300 };
}

