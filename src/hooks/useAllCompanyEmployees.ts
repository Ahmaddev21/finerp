import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface EmployeeForNotif {
  id: string;
  entity: string;
  name: string;
  idExpiryDate: string | null;
}

export function useAllCompanyEmployees() {
  const { user, company } = useAuthStore();
  const [employees, setEmployees] = useState<EmployeeForNotif[]>([]);

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id || !isOwnerOrAdmin) return;
    const { data } = await supabase
      .from('company_entity_employees')
      .select('id, entity, name, id_expiry_date')
      .eq('company_id', company.id);
    if (data) {
      setEmployees(data.map(r => ({
        id: r.id,
        entity: r.entity,
        name: r.name,
        idExpiryDate: r.id_expiry_date ?? null,
      })));
    }
  }, [company?.id, isOwnerOrAdmin]);

  useEffect(() => { fetch(); }, [fetch]);

  return employees;
}
