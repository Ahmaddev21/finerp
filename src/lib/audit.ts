import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../store/auth';

export async function writeAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: string,
  details: string
) {
  if (!isSupabaseConfigured) return;

  // Email must come from the server-validated JWT, not the localStorage cache,
  // so the audit trail cannot be forged by editing localStorage.
  const { data: { user: verifiedUser } } = await supabase.auth.getUser();
  const company = useAuthStore.getState().company;
  const { error } = await supabase.from('audit_logs').insert({
    user_id: verifiedUser?.id ?? null,
    user_email: verifiedUser?.email ?? 'unknown',
    action,
    table_name: tableName,
    record_id: recordId,
    details,
    company_id: company?.id ?? null,
  });

  if (error) {
    console.warn('[Audit] Failed to write audit log:', error.message);
  }
}

export async function countPriorEdits(
  userId: string,
  recordId: string,
  tableName: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('record_id', recordId)
    .eq('table_name', tableName)
    .eq('action', 'UPDATE');
  if (error) return 0;
  return count ?? 0;
}
