export type DraftPayload={address:string;contractStart:string;contractEnd:string;rent:string;landlordName:string;bank:string;account:string};
export type StoredContract={name:string;size:number;type:string;path:string};
export type ApplicationDraft={user_id:string;id:string;state:'editing'|'submitting'|'submitted';revision:number;step:number;payload:Partial<DraftPayload>;contract_file_path:string|null;contract_file_name:string|null;contract_file_size:number|null;contract_file_type:string|null;application_number:string|null;updated_at:string};
export const emptyDraftPayload:DraftPayload={address:'',contractStart:'',contractEnd:'',rent:'750000',landlordName:'',bank:'',account:''};
export function draftSignature(payload:DraftPayload,step:number,file:{name:string;size:number;type:string}|null):string{
 return JSON.stringify({payload,step,file:file?{name:file.name,size:file.size,type:file.type}:null});
}
export function draftError(error:unknown):string{
 return error&&typeof error==='object'&&'message'in error?String(error.message):'We could not confirm the saved result. Please try again.';
}
