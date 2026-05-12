import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface Quotation {
  id: string;
  projectId: string | null;
  client: string;
  description: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  validUntil: string;
  notes: string;
}

const seed: Quotation[] = [
  { id: 'QOT-001', projectId: 'CPRJ-001', client: 'Snoonu', description: 'Q2 Fleet Management Extension', amount: 180000, status: 'approved', validUntil: '2026-05-15', notes: '' },
  { id: 'QOT-002', projectId: 'CPRJ-003', client: 'Urban Eats', description: 'Delivery Zone Expansion Proposal', amount: 85000, status: 'pending', validUntil: '2026-04-30', notes: 'Awaiting client review' },
  { id: 'QOT-003', projectId: null, client: 'MegaMart', description: 'Annual Supply Chain Audit', amount: 72000, status: 'draft', validUntil: '2026-06-01', notes: 'Initial draft' },
  { id: 'QOT-004', projectId: 'CPRJ-002', client: 'TechCorp Inc.', description: 'Infrastructure SLA Renewal', amount: 135000, status: 'approved', validUntil: '2026-07-31', notes: '' },
  { id: 'QOT-005', projectId: null, client: 'Qatar Airways', description: 'Ground Logistics Support', amount: 320000, status: 'rejected', validUntil: '2026-03-15', notes: 'Budget constraints' },
];

function mapRow(row: any): Quotation {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    client: row.client ?? '',
    description: row.description ?? '',
    amount: Number(row.amount ?? 0),
    status: row.status ?? 'draft',
    validUntil: (row.valid_until ?? '').toString(),
    notes: row.notes ?? '',
  };
}

export function useQuotations() {
  const { company, isInitialized } = useAuthStore();
  const [quotations, setQuotations] = useState<Quotation[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[quotations:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_quotations')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[quotations:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setQuotations(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addQuotation = useCallback(async (q: Omit<Quotation, 'id'>) => {
    const newId = `QOT-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: Quotation = { ...q, id: newId };
    setQuotations(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, project_id: q.projectId, client: q.client,
      description: q.description, amount: q.amount, status: q.status, valid_until: q.validUntil || null, notes: q.notes };
    console.log('[quotations:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracting_quotations').insert(payload).select();
    console.log('[quotations:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setQuotations(prev => prev.filter(x => x.id !== newId)); return; }
  }, [quotations.length]);

  const updateStatus = useCallback(async (id: string, status: Quotation['status']) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('contracting_quotations').update({ status }).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  return { quotations, loading, error, addQuotation, updateStatus, refetch: fetch };
}
