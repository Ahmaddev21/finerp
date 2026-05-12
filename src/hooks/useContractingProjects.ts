import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ContractingProject {
  id: string;
  contractId: string | null;
  name: string;
  client: string;
  value: number;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  startDate: string;
  endDate: string;
  description: string;
  /** FK to main projects(id) — set to link this ERP project to a business project */
  mainProjectId: string | null;
}

const seed: ContractingProject[] = [
  { id: 'CPRJ-001', contractId: 'CTR-001', name: 'Snoonu Fleet Management', client: 'Snoonu', value: 450000, status: 'Active', startDate: '2026-01-01', endDate: '2026-12-31', description: 'Full fleet management and rider supply', mainProjectId: null },
  { id: 'CPRJ-002', contractId: 'CTR-002', name: 'TechCorp Infrastructure SLA', client: 'TechCorp Inc.', value: 120000, status: 'Active', startDate: '2026-02-15', endDate: '2026-08-14', description: 'Infrastructure service level agreement', mainProjectId: null },
  { id: 'CPRJ-003', contractId: 'CTR-003', name: 'Urban Eats Delivery Expansion', client: 'Urban Eats', value: 85000, status: 'Planning', startDate: '2026-04-01', endDate: '2026-09-30', description: 'Expansion of delivery operations', mainProjectId: null },
  { id: 'CPRJ-004', contractId: 'CTR-005', name: 'Q3 Rider Contracting Block', client: 'Snoonu', value: 280000, status: 'Active', startDate: '2026-03-01', endDate: '2026-09-30', description: 'Bulk rider contracting for Q3', mainProjectId: null },
  { id: 'CPRJ-005', contractId: null, name: 'Warehouse Fit-Out Phase 2', client: 'LogisTech', value: 95000, status: 'On Hold', startDate: '2026-04-10', endDate: '2026-10-09', description: 'Warehouse optimization and fit-out', mainProjectId: null },
];

function mapRow(row: any): ContractingProject {
  return {
    id: row.id,
    contractId: row.contract_id ?? null,
    name: row.name ?? '',
    client: row.client ?? '',
    value: Number(row.value ?? 0),
    status: row.status ?? 'Active',
    startDate: (row.start_date ?? '').toString(),
    endDate: (row.end_date ?? '').toString(),
    description: row.description ?? '',
    mainProjectId: row.main_project_id ?? null,
  };
}

export function useContractingProjects() {
  const { company, isInitialized } = useAuthStore();
  const [projects, setProjects] = useState<ContractingProject[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[contracting_projects:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_projects')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[contracting_projects:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setProjects(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addProject = useCallback(async (p: Omit<ContractingProject, 'id'>) => {
    const newId = `CPRJ-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ContractingProject = { ...p, id: newId };
    setProjects(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, contract_id: p.contractId, name: p.name, client: p.client,
      value: p.value, status: p.status, start_date: p.startDate || null, end_date: p.endDate || null, description: p.description,
      main_project_id: p.mainProjectId ?? null };
    console.log('[contracting_projects:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracting_projects').insert(payload).select();
    console.log('[contracting_projects:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setProjects(prev => prev.filter(x => x.id !== newId)); return; }
  }, [projects.length]);

  const updateProject = useCallback(async (id: string, updates: Partial<ContractingProject>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.client !== undefined) payload.client = updates.client;
    if (updates.value !== undefined) payload.value = updates.value;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.endDate !== undefined) payload.end_date = updates.endDate;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.contractId !== undefined) payload.contract_id = updates.contractId;
    if (updates.mainProjectId !== undefined) payload.main_project_id = updates.mainProjectId;
    const { error } = await supabase.from('contracting_projects').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  return { projects, loading, error, addProject, updateProject, refetch: fetch };
}
