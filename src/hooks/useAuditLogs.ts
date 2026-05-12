import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface AuditLog {
  id: number;
  time: string;
  user: string;
  action: string;
  table: string;
  record: string;
  details: string;
}

const seed: AuditLog[] = [
  { id: 1, time: '2026-04-06 14:32:11', user: 'admin@example.com', action: 'UPDATE', table: 'invoices', record: 'inv_8f72a...', details: 'Status: pending → paid' },
  { id: 2, time: '2026-04-06 11:15:42', user: 'bd@example.com', action: 'CREATE', table: 'erp_contracting', record: 'ctr_92b1x...', details: 'New contract created' },
  { id: 3, time: '2026-04-05 09:45:00', user: 'super@example.com', action: 'DELETE', table: 'expenses', record: 'exp_33a9c...', details: 'Deleted duplicate expense' },
  { id: 4, time: '2026-04-04 16:20:33', user: 'admin@example.com', action: 'CREATE', table: 'receipts', record: 'rec_55d8e...', details: 'Recorded payment QR 25,000' },
  { id: 5, time: '2026-04-04 10:05:12', user: 'admin@example.com', action: 'UPDATE', table: 'projects', record: 'prj_11a2b...', details: 'Updated project description' },
];

function mapRow(row: any): AuditLog {
  return {
    id: row.id,
    time: new Date(row.created_at).toLocaleString('sv-SE').replace('T', ' '),
    user: row.user_name || row.user_email || 'System',
    action: row.action?.toUpperCase() ?? '',
    table: row.table_name ?? '',
    record: (row.record_id ?? '').slice(0, 12) + '...',
    details: row.details ?? '',
  };
}

export function useAuditLogs() {
  const { company, isInitialized } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs_with_profiles')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data) setLogs(data.map(mapRow));
  }, [company?.id]);

  useEffect(() => {
    fetch();

    if (!isSupabaseConfigured || !company?.id) return;
    const channel = supabase
      .channel(`audit-realtime-${company.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `company_id=eq.${company.id}` },
        payload => {
          setLogs(prev => [mapRow(payload.new), ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetch, company?.id]);

  return { logs, loading, error, refetch: fetch };
}
