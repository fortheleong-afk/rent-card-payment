'use client';

import { useRef, useState, type FormEvent } from 'react';
import FormField from '../../../components/FormField';
import { BANK_OPTIONS, validateApplicationStep } from '../../../lib/application-validation';
import { checkLeaseFile, leaseObjectPath } from '../../../lib/contracts';
import { reportOperationError } from '../../../lib/operation-errors';
import { supabase } from '../../../lib/supabase';

type EditableApplication = {
  id: string;
  revision: number;
  property_address: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  rent_amount: number;
  rent_month: string | null;
  rent_due_date: string | null;
  landlord_name: string | null;
  landlord_bank: string | null;
  landlord_account_last4: string | null;
  contract_file_path: string | null;
};

export default function CorrectionForm({ row, onSaved }: { row: EditableApplication; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);

  async function resubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const values = new FormData(event.currentTarget);
    const read = (name: string) => String(values.get(name) ?? '').trim();
    const payload = {
      address: read('address'), contractStart: read('lease_start'), contractEnd: read('lease_end'),
      rent: read('rent'), rentMonth: read('rent_month'), dueDate: read('due_date'),
      landlordName: read('landlord'), bank: read('bank'), account: read('account'),
    };
    const file = values.get('contract');
    const replacement = file instanceof File && file.name ? file : null;
    if (!payload.account && (payload.bank !== row.landlord_bank || payload.landlordName !== row.landlord_name)) {
      setMessage('Enter the account number when changing the bank or account holder.');
      return;
    }
    const checkingValues = { ...payload, account: payload.account || (row.landlord_account_last4 ? '000000' : '') };
    const errors = [0, 1, 2].flatMap(step => Object.values(validateApplicationStep(step, checkingValues, Boolean(replacement || row.contract_file_path))));
    if (errors.length) {
      setMessage(errors[0] ?? 'Check the application details.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      let path: string | null = null;
      if (replacement) {
        const issue = await checkLeaseFile(replacement);
        if (issue) {
          setMessage(issue);
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error('Sign in to update your application.');
        path = await leaseObjectPath(data.user.id, row.id, replacement);
        const { error } = await supabase.storage.from('contract-documents').upload(path, replacement, { contentType: replacement.type, upsert: false });
        if (error && !/already exists|duplicate/i.test(error.message)) throw error;
      }
      const { data, error } = await supabase.rpc('resubmit_application', {
        p_id: row.id, p_revision: row.revision, p_address: payload.address, p_start: payload.contractStart,
        p_end: payload.contractEnd, p_amount: Number(payload.rent), p_month: payload.rentMonth + '-01', p_due: payload.dueDate,
        p_landlord: payload.landlordName, p_bank: payload.bank, p_account: payload.account,
        p_file_path: path, p_file_name: replacement?.name ?? null,
      });
      if (error) throw error;
      if (!data) setMessage('This application has changed. Check its latest status before submitting again.');
      await onSaved();
    } catch (error) {
      reportOperationError('submit_application');
      setMessage(error && typeof error === 'object' && 'code' in error && error.code === '22023'
        ? String('message' in error ? error.message : '') : 'The submission could not be confirmed. Refresh the application before retrying.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <form method="post" onSubmit={resubmit} aria-busy={busy}>
    <fieldset disabled={busy} className="work-edit-fields">
      <FormField id="correction-address" name="address" label="Property address" defaultValue={row.property_address ?? ''} maxLength={500} required />
      <div className="field-pair">
        <FormField id="correction-start" name="lease_start" type="date" label="Lease start date" defaultValue={row.contract_start_date ?? ''} required />
        <FormField id="correction-end" name="lease_end" type="date" label="Lease end date" defaultValue={row.contract_end_date ?? ''} required />
      </div>
      <div className="field-pair">
        <FormField id="correction-month" name="rent_month" type="month" placeholder="YYYY-MM" label="Rent month" defaultValue={row.rent_month?.slice(0,7) ?? ''} required />
        <FormField id="correction-due" name="due_date" type="date" label="Rent due date" defaultValue={row.rent_due_date ?? ''} required />
      </div>
      <FormField id="correction-rent" name="rent" type="number" label="Monthly rent (KRW)" min={1} max={1000000000} step={1} defaultValue={row.rent_amount} required />
      <FormField id="correction-landlord" name="landlord" label="Landlord / account holder" maxLength={120} defaultValue={row.landlord_name ?? ''} required />
      <div className="account-field">
        <label htmlFor="correction-bank">Bank</label>
        <select id="correction-bank" name="bank" defaultValue={row.landlord_bank ?? ''} required>
          <option value="">Select a bank</option>
          {row.landlord_bank && !BANK_OPTIONS.some(([name]) => name === row.landlord_bank) && <option>{row.landlord_bank}</option>}
          {BANK_OPTIONS.map(([name,label]) => <option key={name} value={name}>{label}</option>)}
        </select>
      </div>
      <FormField id="correction-account" name="account" label="Replacement account number" inputMode="numeric" autoComplete="off" maxLength={60} required={!row.landlord_account_last4}
        hint={row.landlord_account_last4 ? 'Leave blank to keep the account ending in ' + row.landlord_account_last4 + '.' : 'Enter the landlord’s account number.'} />
      <FormField id="correction-contract" name="contract" label="Replacement contract" type="file" accept=".pdf,.png,.jpg,.jpeg" required={!row.contract_file_path}
        hint={row.contract_file_path ? 'Leave empty to keep the current file. PDF, JPG or PNG up to 10 MB.' : 'PDF, JPG or PNG up to 10 MB.'} />
      <label className="review-confirm"><input type="checkbox" required /><span>I confirm these details are ready for another test review.</span></label>
    </fieldset>
    {message && <p className="work-error" role="alert">{message}</p>}
    <button className="work-button work-button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Send updated details'}</button>
  </form>;
}
