import { supabase } from './supabase';
import type { ApplicationDraft } from './application-drafts';
import { checkLeaseFile, leaseObjectPath } from './contracts';
import { sameProperty, renewalSchedule } from './rent-period';

export async function existingRentApplication(userId: string, address: string, month: string, activeOnly = false) {
  let closed: string | null = null;
  for (let start = 0; ; start += 100) {
    const {data, error} = await supabase.from('rent_applications')
      .select('id,property_address,status').eq('user_id', userId).eq('rent_month', month + '-01')
      .order('created_at', {ascending: false}).order('id').range(start, start + 99);
    if (error) throw error;
    for (const row of data) {
      if (!sameProperty(row.property_address, address)) continue;
      if (row.status !== 'cancelled' && row.status !== 'rejected') return String(row.id);
      if (!activeOnly && !closed) closed = String(row.id);
    }
    if (data.length < 100) return closed;
  }
}

async function openDraft(startNew = false): Promise<ApplicationDraft> {
  const {data, error} = await supabase.rpc('open_application_draft', {p_new: startNew});
  if (error || !data) throw error || new Error('Could not open your draft.');
  return data;
}

// Each saved contract belongs to its draft. Copy into a new private path so
// discarding or replacing the new file can never remove the previous evidence.
async function copyLease(userId: string, draftId: string, path: string, name: string) {
  if (!path.startsWith(userId + '/')) return null;
  const bucket = supabase.storage.from('contract-documents');
  const download = await bucket.download(path);
  if (download.error) return null;
  const file = new File([download.data], name, {type: download.data.type.split(';')[0].trim().toLowerCase()});
  if (await checkLeaseFile(file)) return null;
  const destination = await leaseObjectPath(userId, draftId, file);
  const upload = await bucket.upload(destination, file, {contentType: file.type, upsert: false});
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) return null;
  return destination;
}

type Result = {url: string} | {otherDraft: true};

export async function startNextRent(sourceId: string): Promise<Result> {
  const {data: auth, error: authError} = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to start your next application.');
  const userId = auth.user.id;
  const {data: source, error} = await supabase.from('rent_applications')
    .select('property_address,contract_start_date,contract_end_date,rent_month,rent_due_date,rent_amount,landlord_name,landlord_bank,contract_file_path,contract_file_name')
    .eq('user_id', userId).eq('id', sourceId).single();
  if (error || !source) throw new Error('Could not read the original application. Refresh and try again.');
  const {month, due} = renewalSchedule(source.rent_month, source.rent_due_date);
  const address = source.property_address ?? '';
  const existing = await existingRentApplication(userId, address, month);
  if (existing) return {url: '/applications/' + existing};

  let draft = await openDraft();
  if (draft.state === 'submitted') {
    try { draft = await openDraft(true); }
    catch { draft = await openDraft(); }
  }
  if (draft.state === 'submitted') throw new Error('Could not start a draft. Try again.');
  if (draft.revision || draft.contract_file_path || draft.state !== 'editing' || Object.keys(draft.payload).length) {
    if (draft.rent_month?.slice(0, 7) === month && sameProperty(draft.payload.address, address))
      return {url: '/applications/new'};
    return {otherDraft: true};
  }

  const leaseCoversMonth = source.contract_start_date?.slice(0, 7) <= month && source.contract_end_date?.slice(0, 7) >= month;
  const file = leaseCoversMonth && source.contract_file_path && source.contract_file_name
    ? await copyLease(userId, draft.id, source.contract_file_path, source.contract_file_name) : null;
  const {error: saveError} = await supabase.rpc('save_draft_with_schedule', {
    p_id: draft.id, p_revision: draft.revision, p_prepare: false, p_step: file ? 1 : 0,
    p_month: month + '-01', p_due: due || null, p_file_path: file, p_file_name: file ? source.contract_file_name : null,
    p_payload: {address, contractStart: source.contract_start_date ?? '', contractEnd: source.contract_end_date ?? '',
      rent: String(source.rent_amount ?? ''), landlordName: source.landlord_name ?? '', bank: source.landlord_bank ?? '', account: ''},
  });
  if (saveError) {
    if (saveError.code === '40001') {
      const latest = await openDraft();
      if (latest.state === 'editing' && latest.rent_month?.slice(0, 7) === month && sameProperty(latest.payload.address, address))
        return {url: '/applications/new'};
      return {otherDraft: true};
    }
    throw saveError;
  }
  return {url: '/applications/new?renewal=' + (file ? 'review' : 'attach')};
}
