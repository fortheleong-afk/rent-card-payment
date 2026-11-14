import type { DraftPayload } from './application-drafts';
export const APPLICATION_STEPS=['Lease contract','Rent details','Deposit account','Review & submit'];
export type ApplicationField='file'|'address'|'contractStart'|'contractEnd'|'rent'|'landlordName'|'bank'|'account';
export const FIELD_IDS:Record<ApplicationField,string>={file:'lease-file',address:'property-address',contractStart:'lease-start',contractEnd:'lease-end',rent:'monthly-rent',landlordName:'landlord-name',bank:'landlord-bank',account:'account-number'};
export const BANK_OPTIONS=[['국민은행','KB Kookmin Bank'],['신한은행','Shinhan Bank'],['우리은행','Woori Bank'],['하나은행','Hana Bank'],['농협은행','NH Nonghyup Bank'],['기업은행','IBK Bank'],['카카오뱅크','KakaoBank'],['토스뱅크','Toss Bank']] as const;
export function bankLabel(value:string|null|undefined){return BANK_OPTIONS.find(([id])=>id===value)?.[1]||value||'Not provided';}
const validDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
export function validateApplicationStep(step:number,p:DraftPayload,hasFile:boolean):Partial<Record<ApplicationField,string>>{
 const errors:Partial<Record<ApplicationField,string>>={};
 if(step===0&&!hasFile)errors.file='Upload your lease contract to continue.';
 if(step===1){
  if(!p.address.trim())errors.address='Enter the property address shown on your lease.';
  else if(p.address.trim().length>500)errors.address='Use 500 characters or fewer.';
  if(!validDate(p.contractStart))errors.contractStart='Enter the lease start date.';
  if(!validDate(p.contractEnd)||(validDate(p.contractStart)&&p.contractEnd<p.contractStart))errors.contractEnd='Enter an end date on or after the start date.';
  const amount=Number(p.rent);
  if(!p.rent||!Number.isSafeInteger(amount)||amount<1||amount>1000000000)errors.rent='Enter a whole amount from ₩1 to ₩1,000,000,000.';
 }
 if(step===2){
  if(!p.landlordName.trim())errors.landlordName="Enter the landlord's name as shown on the account.";
  else if(p.landlordName.trim().length>120)errors.landlordName='Use 120 characters or fewer.';
  if(!p.bank.trim())errors.bank='Select the deposit bank.';
  if(!/^[0-9]{6,30}$/.test(p.account.replace(/[ -]/g,'')))errors.account='Enter 6–30 digits. Spaces and hyphens are allowed.';
 }
 return errors;
}
