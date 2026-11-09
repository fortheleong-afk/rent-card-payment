export type DemoApplication = {
 id:string;reference:string;name:string;email:string;address:string;rent:number;
 status:'pending_review'|'approved'|'rejected'|'cancelled';
 payment:'pending'|'paid'|'failed'|'cancelled';
 payout:'not_ready'|'pending'|'completed'|'failed';
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
