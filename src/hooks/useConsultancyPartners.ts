import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ConsultancyPartner {
  id: string;
  name: string;
  country: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: 'active' | 'inactive';
  notes: string;
}

const seed: ConsultancyPartner[] = [
  { id: 'PTR-001', name: 'Eurotech Solutions GmbH', country: 'Germany', contactPerson: 'Hans Müller', contactEmail: 'h.muller@eurotech.de', contactPhone: '+49 30 1234567', status: 'active', notes: 'IT infrastructure consulting partner' },
  { id: 'PTR-002', name: 'Nordic Advisory AS', country: 'Norway', contactPerson: 'Erik Olsen', contactEmail: 'erik@nordicadvisory.no', contactPhone: '+47 22 334455', status: 'active', notes: 'Supply chain optimization' },
  { id: 'PTR-003', name: 'Mediterranean Logistics SRL', country: 'Italy', contactPerson: 'Marco Rossi', contactEmail: 'marco@medlog.it', contactPhone: '+39 06 7890123', status: 'active', notes: 'Logistics & warehousing expert' },
  { id: 'PTR-004', name: 'Iberian Consulting SL', country: 'Spain', contactPerson: 'Ana García', contactEmail: 'ana@iberianconsulting.es', contactPhone: '+34 91 2345678', status: 'inactive', notes: 'Previous engagement completed' },
];

function mapRow(row: any): ConsultancyPartner {
  return {
    id: row.id,
    name: row.name ?? '',
    country: row.country ?? '',
    contactPerson: row.contact_person ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    status: row.status ?? 'active',
    notes: row.notes ?? '',
  };
}

export function useConsultancyPartners() {
  const { company, isInitialized } = useAuthStore();
  const [partners, setPartners] = useState<ConsultancyPartner[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[consultancy_partners:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultancy_partners')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[consultancy_partners:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setPartners(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addPartner = useCallback(async (p: Omit<ConsultancyPartner, 'id'>) => {
    const newId = `PTR-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ConsultancyPartner = { ...p, id: newId };
    setPartners(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, name: p.name, country: p.country, contact_person: p.contactPerson,
      contact_email: p.contactEmail, contact_phone: p.contactPhone, status: p.status, notes: p.notes };
    console.log('[consultancy_partners:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('consultancy_partners').insert(payload).select();
    console.log('[consultancy_partners:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setPartners(prev => prev.filter(x => x.id !== newId)); return; }
  }, [partners.length]);

  const updatePartner = useCallback(async (id: string, updates: Partial<ConsultancyPartner>) => {
    setPartners(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.country !== undefined) payload.country = updates.country;
    if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    const { error } = await supabase.from('consultancy_partners').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  return { partners, loading, error, addPartner, updatePartner, refetch: fetch };
}
