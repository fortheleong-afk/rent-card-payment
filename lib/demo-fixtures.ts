export type DemoApplication = {
 id:string;reference:string;name:string;email:string;address:string;rent:number;
 status:'pending_review'|'approved'|'rejected'|'cancelled';
 payment:'pending'|'paid'|'failed'|'cancelled';
 payout:'not_ready'|'pending'|'completed'|'failed';
 landlord?:string;bank?:string;accountLast4?:string;contractName?:string;
 history:string[];
};
export function initialDemoApplications():DemoApplication[] {
 return [
  {id:'sample-01',reference:'DEMO-001',name:'Demo Tenant',email:'tenant-one@divercity.example',address:'Sample home A · fictional address',rent:750000,status:'pending_review',payment:'pending',payout:'not_ready',history:['Sample application received · review pending']},
  {id:'sample-02',reference:'DEMO-002',name:'Demo Tenant',email:'tenant-one@divercity.example',address:'Sample home B · fictional address',rent:680000,status:'approved',payment:'paid',payout:'completed',history:['Sample application received','Sample reviewer approved','Simulated payment completed','Simulated payout completed · no money moved']},
  {id:'sample-03',reference:'DEMO-003',name:'Sample Applicant',email:'tenant-two@divercity.example',address:'Sample home C · fictional address',rent:900000,status:'pending_review',payment:'pending',payout:'not_ready',history:['Sample application received · review pending']},
 ];
}
export const DEMO_STORAGE_KEY='divercity-showcase-v1';

/** Only display values; no File, account number, token or production ID. */
export type DemoSubmission = {
 rent:number;address:string;landlord:string;bank:string;accountLast4:string;contractName:string;
};
const text=(value:unknown,fallback:string,max=200)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
export function createDemoApplication(input:DemoSubmission,existing:DemoApplication[]):DemoApplication {
 const sequence=Math.max(3,...existing.map(row=>Number(row.reference.replace('DEMO-',''))||0))+1;
 return {id:'demo-'+crypto.randomUUID(),reference:'DEMO-'+String(sequence).padStart(3,'0'),
 name:'Demo Tenant',email:'tenant-one@divercity.example',address:text(input.address,'Example address',500),
 rent:input.rent,status:'pending_review',payment:'pending',payout:'not_ready',
 landlord:text(input.landlord,'Sample Landlord',120),bank:text(input.bank,'Example Bank',120),
 accountLast4:/^\d{4}$/.test(input.accountLast4)?input.accountLast4:'0000',
 contractName:text(input.contractName,'Sample contract',255),
 history:['Demo Tenant · Sample application received · review pending']};
}
/** Restore only validated sample IDs/display fields and supported workflow values. */
export function restoreDemoApplications(value:unknown):DemoApplication[] {
 const base=initialDemoApplications();
 if(!Array.isArray(value))return base;
 const output:DemoApplication[]=[],seen=new Set<string>();
 for(const item of value.slice(0,100)){
  if(!item||typeof item!=='object')continue;
  const seed=base.find(row=>row.id===item.id);
  if(!seed&&(!/^demo-[a-f0-9-]{36}$/.test(item.id)||!/^DEMO-\d{3,6}$/.test(item.reference)))continue;
  if(seen.has(item.id))continue;
  if(!seed&&(!Number.isSafeInteger(item.rent)||item.rent<1||item.rent>1000000000))continue;
  const row=seed??{id:item.id,reference:item.reference,name:'Demo Tenant',email:'tenant-one@divercity.example',
   address:text(item.address,'Example address',500),rent:item.rent,
   landlord:text(item.landlord,'Sample Landlord',120),bank:text(item.bank,'Example Bank',120),
   accountLast4:/^\d{4}$/.test(item.accountLast4)?item.accountLast4:'0000',
   contractName:text(item.contractName,'Sample contract',255),
   status:'pending_review',payment:'pending',payout:'not_ready',history:[]};
  output.push({...row,
   status:['pending_review','approved','rejected','cancelled'].includes(item.status)?item.status:'pending_review',
   payment:['pending','paid','failed','cancelled'].includes(item.payment)?item.payment:'pending',
   payout:['not_ready','pending','completed','failed'].includes(item.payout)?item.payout:'not_ready',
   history:Array.isArray(item.history)?item.history.filter((h:unknown)=>typeof h==='string').slice(0,40).map((h:string)=>h.slice(0,400)):row.history,
  } as DemoApplication);
  seen.add(item.id);
 }
 return [...output,...base.filter(row=>!seen.has(row.id))];
}
