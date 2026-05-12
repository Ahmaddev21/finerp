import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface Subcontractor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  companyDetails: string;
  status: 'active' | 'inactive';
}

const seed: Subcontractor[] = [
  { id: 'SUB-001', name: 'Al Rashid Construction', contactPerson: 'Mohammed Al Rashid', phone: '+974 5512 3456', email: 'info@alrashid.qa', companyDetails: 'Civil works & infrastructure', status: 'active' },
  { id: 'SUB-002', name: 'Gulf Fleet Services', contactPerson: 'Ahmed Hassan', phone: '+974 5523 4567', email: 'fleet@gulfservices.qa', companyDetails: 'Vehicle fleet management & maintenance', status: 'active' },
  { id: 'SUB-003', name: 'Doha Electrical Co.', contactPerson: 'Khalid Nasser', phone: '+974 5534 5678', email: 'khalid@dohaelec.qa', companyDetails: 'Electrical installation & maintenance', status: 'active' },
  { id: 'SUB-004', name: 'Star Logistics', contactPerson: 'Fatima Al Thani', phone: '+974 5545 6789', email: 'ops@starlogistics.qa', companyDetails: 'Warehousing & supply chain', status: 'inactive' },
];

function mapRow(row: any): Subcontractor {
  return {
    id: row.id,
    name: row.name ?? '',
    contactPerson: row.contact_person ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    companyDetails: row.company_details ?? '',
    status: row.status ?? 'active',
  };
}

export function useSubcontractors() {
  const { company, isInitialized } = useAuthStore();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[subcontractors:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_subcontractors')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[subcontractors:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setSubcontractors(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addSubcontractor = useCallback(async (s: Omit<Subcontractor, 'id'>) => {
    const newId = `SUB-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: Subcontractor = { ...s, id: newId };
    setSubcontractors(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, name: s.name, contact_person: s.contactPerson,
      phone: s.phone, email: s.email, company_details: s.companyDetails, status: s.status };
    console.log('[subcontractors:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracting_subcontractors').insert(payload).select();
    console.log('[subcontractors:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setSubcontractors(prev => prev.filter(x => x.id !== newId)); return; }
  }, [subcontractors.length]);

  const updateSubcontractor = useCallback(async (id: string, updates: Partial<Subcontractor>) => {
    setSubcontractors(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.companyDetails !== undefined) payload.company_details = updates.companyDetails;
    if (updates.status !== undefined) payload.status = updates.status;
    const { error } = await supabase.from('contracting_subcontractors').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  return { subcontractors, loading, error, addSubcontractor, updateSubcontractor, refetch: fetch };
}
