import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type WPSStatus = 'pending' | 'processing' | 'paid';

export interface WPSRecord {
  id: string;
  entity: string;
  companyId: string;
  employeeName: string;
  bankName: string | null;
  accountNumber: string | null;
  wpsAmount: number | null;
  paymentMonth: string | null;
  status: WPSStatus;
  createdAt: string;
}

function mapRow(row: any): WPSRecord {
  return {
    id: row.id,
    entity: row.entity,
    companyId: row.company_id,
    employeeName: row.employee_name,
    bankName: row.bank_name ?? null,
    accountNumber: row.account_number ?? null,
    wpsAmount: row.wps_amount != null ? Number(row.wps_amount) : null,
    paymentMonth: row.payment_month ?? null,
    status: (row.status as WPSStatus) ?? 'pending',
    createdAt: row.created_at,
  };
}

export interface NewWPSRecord {
  employeeName: string;
  bankName?: string;
  accountNumber?: string;
  wpsAmount?: number | null;
  paymentMonth?: string;
  status?: WPSStatus;
}

export function useCompanyWPS(entity: string) {
  const { company } = useAuthStore();
  const [records, setRecords] = useState<WPSRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !entity || !company?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('company_entity_wps')
      .select('*')
      .eq('entity', entity)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setRecords(data ? data.map(mapRow) : []);
  }, [entity, company?.id]);

  const addRecord = useCallback(async (rec: NewWPSRecord): Promise<boolean> => {
    if (!isSupabaseConfigured || !entity || !company?.id || !rec.employeeName.trim()) return false;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('company_entity_wps')
      .insert({
        entity,
        company_id: company.id,
        employee_name: rec.employeeName.trim(),
        bank_name: rec.bankName?.trim() || null,
        account_number: rec.accountNumber?.trim() || null,
        wps_amount: rec.wpsAmount ?? null,
        payment_month: rec.paymentMonth || null,
        status: rec.status ?? 'pending',
      });
    setSaving(false);
    if (error) { setError(error.message); return false; }
    await fetch();
    return true;
  }, [entity, company?.id, fetch]);

  const updateStatus = useCallback(async (id: string, status: WPSStatus): Promise<void> => {
    if (!isSupabaseConfigured || !company?.id) return;
    const { error } = await supabase
      .from('company_entity_wps')
      .update({ status })
      .eq('id', id)
      .eq('company_id', company.id);
    if (error) { setError(error.message); return; }
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }, [company?.id]);

  const deleteRecord = useCallback(async (id: string): Promise<void> => {
    if (!isSupabaseConfigured || !company?.id) return;
    setError(null);
    const { error } = await supabase
      .from('company_entity_wps')
      .delete()
      .eq('id', id)
      .eq('company_id', company.id);
    if (error) { setError(error.message); return; }
    setRecords(prev => prev.filter(r => r.id !== id));
  }, [company?.id]);

  return { records, loading, saving, error, fetch, addRecord, updateStatus, deleteRecord };
}
