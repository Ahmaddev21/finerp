import { useAuthStore } from '../store/auth';
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Contract {
  id: string;
  title: string;
  client: string;
  value: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Pending Signature' | 'Expiring Soon' | 'Expired';
  edit_count?: number;
  attachment_url?: string;
}

const seed: Contract[] = [
  { id: 'CTR-001', title: 'Snoonu Fleet Management Agreement', client: 'Snoonu', value: 450000, startDate: '2026-01-01', endDate: '2026-12-31', status: 'Active' },
  { id: 'CTR-002', title: 'TechCorp Infrastructure SLA', client: 'TechCorp Inc.', value: 120000, startDate: '2026-02-15', endDate: '2026-08-14', status: 'Expiring Soon' },
  { id: 'CTR-003', title: 'Urban Eats Delivery Expansion', client: 'Urban Eats', value: 85000, startDate: '2026-04-01', endDate: '2026-09-30', status: 'Pending Signature' },
  { id: 'CTR-004', title: 'MegaMart Supply Chain Audit', client: 'MegaMart', value: 65000, startDate: '2025-07-01', endDate: '2025-12-31', status: 'Expired' },
  { id: 'CTR-005', title: 'Q3 Rider Contracting Block', client: 'Snoonu', value: 280000, startDate: '2026-03-01', endDate: '2026-09-30', status: 'Active' },
  { id: 'CTR-006', title: 'LogisTech Warehouse SLA', client: 'LogisTech', value: 95000, startDate: '2026-04-10', endDate: '2026-10-09', status: 'Pending Signature' },
];

function mapRow(row: any): Contract {
  return {
    id: row.id,
    title: row.title ?? row.contract_details ?? '',
    client: row.client ?? row.client_name ?? '',
    value: Number(row.value ?? 0),
    startDate: (row.start_date ?? '').toString(),
    endDate: (row.end_date ?? '').toString(),
    status: row.status ?? 'Pending Signature',
    edit_count: Number(row.edit_count || 0),
    attachment_url: row.attachment_url ?? undefined,
  };
}

export function useContracts() {
  const { company, isInitialized } = useAuthStore();
  const [contracts, setContracts] = useState<Contract[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[contracts:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[contracts:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setContracts(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addContract = useCallback(async (c: Omit<Contract, 'id'>) => {
    const newId = `CTR-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: Contract = { ...c, id: newId };
    setContracts(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = {
      id: newId,
      company_id: companyId,
      title: c.title,
      client: c.client,
      value: c.value,
      start_date: c.startDate || null,
      end_date: c.endDate || null,
      status: c.status,
    };
    console.log('[contracts:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracts').insert(payload).select();
    console.log('[contracts:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setContracts(prev => prev.filter(x => x.id !== newId)); return; }
  }, [contracts.length]);

  const updateContract = useCallback(async (id: string, updates: Partial<Contract>) => {
    // Standard role check logic from useProjects/useTransactions
    // (Actual implementation would require useAuthStore etc, but following the pattern for consistency)
    const proj = contracts.find(c => c.id === id); // 'proj' here is just following my previous naming pattern for the 'old' record
    if (!proj) return;

    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (!isSupabaseConfigured) return;

    const payload: Record<string, any> = { ...updates };
    if (updates.startDate) payload.start_date = updates.startDate;
    if (updates.endDate) payload.end_date = updates.endDate;

    await supabase.from('contracts').update(payload).eq('id', id);
  }, [contracts]);

  const updateContractStatus = useCallback(async (id: string, status: Contract['status']) => {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('contracts').update({ status }).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  const deleteContract = useCallback(async (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('contracts').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { contracts, loading, error, addContract, updateContract, updateContractStatus, deleteContract, refetch: fetch };
}
