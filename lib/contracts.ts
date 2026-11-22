import { supabase } from './supabase';
import { reportOperationError } from './operation-errors';

export async function checkLeaseFile(file: File): Promise<string> {
  if (file.size < 1 || file.size > 10 * 1024 * 1024) return 'Choose a file up to 10 MB.';
  const signatures: Record<string, number[]> = {
    'application/pdf': [37, 80, 68, 70, 45],
    'image/jpeg': [255, 216, 255],
    'image/png': [137, 80, 78, 71, 13, 10, 26, 10],
  };
  const signature = signatures[file.type];
  if (!signature) return 'Choose a PDF, JPG or PNG file.';
  try {
    const header = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
    return signature.every((byte, index) => header[index] === byte)
      ? '' : 'The file contents do not match its format. Choose a valid PDF, JPG or PNG.';
  } catch {
    return 'We could not read this file. Choose it again.';
  }
}

export async function leaseObjectPath(userId: string, applicationId: string, file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
  return `${userId}/${applicationId}/${hash}.${extension}`;
}
export type ContractLink={url:string;fileName:string;expiresIn:number};
export async function createContractLink(path:string|null,fileName?:string|null,options:{locale?:'en'|'ko';download?:boolean}={}):Promise<ContractLink>{
 const en=options.locale==='en';
 if(!path)throw new Error(en?'No lease contract is attached to this application.':'계약서 파일 경로가 없습니다.');
 const name=fileName||path.split('/').pop()||'contract';
 const {data,error}=await supabase.storage.from('contract-documents').createSignedUrl(path,300,options.download?{download:name}:undefined);
 if(error||!data?.signedUrl){
  reportOperationError('contract_link');
  const message=error?.message?.toLowerCase()??'';
  if(/not found|does not exist|404/.test(message))throw new Error(en?'This file could not be found or is unavailable to this account. Contact support if you need help.':'계약서 파일을 찾을 수 없거나 현재 계정에서 접근할 수 없습니다. 파일과 접근 권한을 확인해주세요.');
  if(/permission|row-level|not authorized|access denied|403/.test(message))throw new Error(en?'You do not have access to this contract. Check your signed-in account or contact support.':'계약서 접근 권한이 없습니다. 관리자 계정과 Storage 정책을 확인해주세요.');
  throw new Error(en?'We could not create a secure file link. Please try again.':'계약서 보안 링크를 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
 }
 return {url:data.signedUrl,fileName:name,expiresIn:300};
}
