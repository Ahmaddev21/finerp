import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ConsultancyClient {
  id: string;
  name: string;
  country: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  status: 'active' | 'inactive';
  notes: string;
}

const seed: ConsultancyClient[] = [
  { id: 'CCL-001', name: 'TechCorp Inc.', country: 'Qatar', contactPerson: 'Ahmad Khalil', contactEmail: 'ahmad@techcorp.qa', contactPhone: '+974 5512 0001', industry: 'Technology', status: 'active', notes: 'IT Infrastructure consulting client' },
  { id: 'CCL-002', name: 'Snoonu', country: 'Qatar', contactPerson: 'Hamad Al Hajri', contactEmail: 'hamad@snoonu.com', contactPhone: '+974 5512 0002', industry: 'Delivery & Logistics', status: 'active', notes: 'Operations optimization' },
  { id: 'CCL-003', name: 'MegaMart', country: 'Qatar', contactPerson: 'Sara Al Dosari', contactEmail: 'sara@megamart.qa', contactPhone: '+974 5512 0003', industry: 'Retail', status: 'active', notes: 'Supply chain audit client' },
  { id: 'CCL-004', name: 'Urban Eats', country: 'Qatar', contactPerson: 'Noor Abbas', contactEmail: 'noor@urbaneats.qa', contactPhone: '+974 5512 0004', industry: 'Food & Beverage', status: 'active', notes: 'Fleet advisory engagement' },
  { id: 'CCL-005', name: 'LogisTech', country: 'Qatar', contactPerson: 'Khalid Mansour', contactEmail: 'khalid@logistech.qa', contactPhone: '+974 5512 0005', industry: 'Warehousing', status: 'inactive', notes: 'Warehouse design completed' },
];

function mapRow(row: any): ConsultancyClient {
  return {
    id: row.id,
    name: row.name ?? '',
    country: row.country ?? '',
    contactPerson: row.contact_person ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    industry: row.industry ?? '',
    status: row.status ?? 'active',
    notes: row.notes ?? '',
  };
}

export function useConsultancyClients() {
  const { company, isInitialized } = useAuthStore();
  const [clients, setClients] = useState<ConsultancyClient[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[consultancy_clients:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultancy_clients')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[consultancy_clients:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setClients(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addClient = useCallback(async (c: Omit<ConsultancyClient, 'id'>) => {
    const newId = `CCL-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ConsultancyClient = { ...c, id: newId };
    setClients(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, name: c.name, country: c.country, contact_person: c.contactPerson,
      contact_email: c.contactEmail, contact_phone: c.contactPhone, industry: c.industry, status: c.status, notes: c.notes };
    console.log('[consultancy_clients:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('consultancy_clients').insert(payload).select();
    console.log('[consultancy_clients:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setClients(prev => prev.filter(x => x.id !== newId)); return; }
  }, [clients.length]);

  const updateClient = useCallback(async (id: string, updates: Partial<ConsultancyClient>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.country !== undefined) payload.country = updates.country;
    if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.industry !== undefined) payload.industry = updates.industry;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    const { error } = await supabase.from('consultancy_clients').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  return { clients, loading, error, addClient, updateClient, refetch: fetch };
}
