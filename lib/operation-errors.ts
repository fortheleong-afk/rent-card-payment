import { supabase } from './supabase';

export function reportOperationError(operation: 'contract_link' | 'submit_application') {
  void supabase.rpc('report_operation_error', { p_operation: operation }).then(() => {}, () => {});
}
