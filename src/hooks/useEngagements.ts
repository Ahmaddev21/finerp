import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type EngagementStatus = 'Active' | 'Completed' | 'On Hold';

export interface Engagement {
  id: string;
  client: string;
  consultant: string;
  service: string;
  hourlyRate: number;
  hoursBilled: number;
  startDate: string;
  status: EngagementStatus;
  attachment_url?: string;
}

const seed: Engagement[] = [
  { id: 'CON-001', client: 'TechCorp Inc.', consultant: 'Super Admin', service: 'IT Infrastructure Strategy', hourlyRate: 450, hoursBilled: 42, startDate: '2026-02-01', status: 'Active' },
  { id: 'CON-002', client: 'Snoonu', consultant: 'Admin User', service: 'Operations Optimization', hourlyRate: 380, hoursBilled: 38, startDate: '2026-03-10', status: 'Active' },
  { id: 'CON-003', client: 'MegaMart', consultant: 'Super Admin', service: 'Supply Chain Audit Consulting', hourlyRate: 420, hoursBilled: 44, startDate: '2025-11-01', status: 'Completed' },
  { id: 'CON-004', client: 'Urban Eats', consultant: 'Admin User', service: 'Delivery Fleet Advisory', hourlyRate: 350, hoursBilled: 0, startDate: '2026-04-01', status: 'On Hold' },
  { id: 'CON-005', client: 'LogisTech', consultant: 'Super Admin', service: 'Warehouse Process Design', hourlyRate: 400, hoursBilled: 0, startDate: '2026-04-08', status: 'On Hold' },
];

function mapRow(row: any): Engagement {
  return {
    id: row.id,
    client: row.client ?? '',
    consultant: row.consultant ?? '',
    service: row.service ?? row.consultation_notes ?? '',
    hourlyRate: Number(row.hourly_rate ?? 0),
    hoursBilled: Number(row.hours_billed ?? 0),
    startDate: (row.start_date ?? row.consultation_date ?? '').toString(),
    status: row.status ?? 'Active',
    attachment_url: row.attachment_url ?? undefined,
  };
}

export function useEngagements() {
  const { company, isInitialized } = useAuthStore();
  const [engagements, setEngagements] = useState<Engagement[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[engagements:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('engagements')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[engagements:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setEngagements(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addEngagement = useCallback(async (e: Omit<Engagement, 'id'>) => {
    const newId = `CON-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: Engagement = { ...e, id: newId };
    setEngagements(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, client: e.client, consultant: e.consultant,
      service: e.service, hourly_rate: e.hourlyRate, hours_billed: 0, start_date: e.startDate || null, status: e.status };
    console.log('[engagements:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('engagements').insert(payload).select();
    console.log('[engagements:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setEngagements(prev => prev.filter(x => x.id !== newId)); return; }
  }, [engagements.length]);

  // NEW: log additional hours against an engagement
  const logHours = useCallback(async (id: string, additionalHours: number) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, hoursBilled: e.hoursBilled + additionalHours } : e
    ));
    if (!isSupabaseConfigured) return;
    const current = engagements.find(e => e.id === id);
    const newTotal = (current?.hoursBilled ?? 0) + additionalHours;
    const { error } = await supabase.from('engagements').update({ hours_billed: newTotal }).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [engagements, fetch]);

  const updateStatus = useCallback(async (id: string, status: EngagementStatus) => {
    setEngagements(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('engagements').update({ status }).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  const updateEngagement = useCallback(async (id: string, updates: Partial<Engagement>) => {
    setEngagements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.client !== undefined) payload.client = updates.client;
    if (updates.consultant !== undefined) payload.consultant = updates.consultant;
    if (updates.service !== undefined) payload.service = updates.service;
    if (updates.hourlyRate !== undefined) payload.hourly_rate = updates.hourlyRate;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.status !== undefined) payload.status = updates.status;
    const { error } = await supabase.from('engagements').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  const deleteEngagement = useCallback(async (id: string) => {
    setEngagements(prev => prev.filter(e => e.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('engagements').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { engagements, loading, error, addEngagement, logHours, updateEngagement, updateStatus, deleteEngagement, refetch: fetch };
}
