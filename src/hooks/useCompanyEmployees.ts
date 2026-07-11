import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface CompanyEmployee {
  id: string;
  entity: string;
  companyId: string;
  name: string;
  position: string | null;
  nationality: string | null;
  idNumber: string | null;
  createdAt: string;
}

function mapRow(row: any): CompanyEmployee {
  return {
    id: row.id,
    entity: row.entity,
    companyId: row.company_id,
    name: row.name,
    position: row.position ?? null,
    nationality: row.nationality ?? null,
    idNumber: row.id_number ?? null,
    createdAt: row.created_at,
  };
}

export interface NewEmployee {
  name: string;
  position?: string;
  nationality?: string;
  idNumber?: string;
}

export function useCompanyEmployees(entity: string) {
  const { company } = useAuthStore();
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !entity || !company?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('company_entity_employees')
      .select('*')
      .eq('entity', entity)
      .eq('company_id', company.id)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setEmployees(data ? data.map(mapRow) : []);
  }, [entity, company?.id]);

  const addEmployee = useCallback(async (emp: NewEmployee): Promise<boolean> => {
    if (!isSupabaseConfigured || !entity || !company?.id || !emp.name.trim()) return false;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('company_entity_employees')
      .insert({
        entity,
        company_id: company.id,
        name: emp.name.trim(),
        position: emp.position?.trim() || null,
        nationality: emp.nationality?.trim() || null,
        id_number: emp.idNumber?.trim() || null,
      });
    setSaving(false);
    if (error) { setError(error.message); return false; }
    await fetch();
    return true;
  }, [entity, company?.id, fetch]);

  const deleteEmployee = useCallback(async (id: string): Promise<void> => {
    if (!isSupabaseConfigured || !company?.id) return;
    setError(null);
    const { error } = await supabase
      .from('company_entity_employees')
      .delete()
      .eq('id', id)
      .eq('company_id', company.id);
    if (error) { setError(error.message); return; }
    setEmployees(prev => prev.filter(e => e.id !== id));
  }, [company?.id]);

  return { employees, loading, saving, error, fetch, addEmployee, deleteEmployee };
}
