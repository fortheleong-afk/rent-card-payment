import { getJourney, type Journey, type OrderSummary } from './workflow';

export type ApplicationGroup = 'active' | 'complete' | 'closed';

// Presentation only: payment and payout state still come from the shared journey.
export function tenantTask(journey: Journey): { group: ApplicationGroup; priority: number; action: string } {
 switch (journey.key) {
  case 'payout_attention': return { group: 'active', priority: 0, action: 'View payout issue' };
  case 'payment_failed': return { group: 'active', priority: 1, action: 'View payment issue' };
  case 'legacy': return { group: 'active', priority: 2, action: 'Check application status' };
  case 'ready': return { group: 'active', priority: 3, action: 'Review test order' };
  case 'payment': return { group: 'active', priority: 4, action: 'View test payment status' };
  case 'payout':
  case 'payout_processing': return { group: 'active', priority: 5, action: 'View test payout status' };
  case 'review': return { group: 'active', priority: 6, action: 'View submitted details' };
  case 'complete': return { group: 'complete', priority: 10, action: 'View completed test' };
  case 'rejected': return { group: 'closed', priority: 10, action: 'View review reason' };
  case 'cancelled': return { group: 'closed', priority: 10, action: 'View cancelled application' };
  case 'closed': return { group: 'closed', priority: 10, action: 'View order history' };
  default: return { group: 'active', priority: 2, action: 'Check application status' };
 }
}

export function priorityApplication<T extends { id: string; status: string; created_at: string }>(applications: T[], orders: Record<string, OrderSummary>): T | undefined {
 const recent = [...applications].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 const active = recent.filter(a=>tenantTask(getJourney(a.status,orders[a.id])).group==='active');
 return active.sort((a,b)=>tenantTask(getJourney(a.status,orders[a.id])).priority-tenantTask(getJourney(b.status,orders[b.id])).priority)[0] ?? recent[0];
}
