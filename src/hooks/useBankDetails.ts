import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';

export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'other';

export interface BankRecord {
  id: string;
  employee_name: string;
  employee_role: string;
  bank_name: string;
  account_number: string;
  iban: string;
  card_number: string;
  branch_name: string;
  account_holder_name: string;
  payment_method: PaymentMethod;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ── Masking helpers (export for use in UI) ────────────────────────────────
export function maskAccount(val?: string): string {
  if (!val) return '—';
  const v = val.replace(/\s+/g, '');
  if (v.length <= 4) return '****';
  return `******${v.slice(-4)}`;
}

export function maskCard(val?: string): string {
  if (!val) return '—';
  const v = val.replace(/\s+/g, '');
  if (v.length <= 4) return '**** **** **** ****';
  return `**** **** **** ${v.slice(-4)}`;
}

export function maskIBAN(val?: string): string {
  if (!val) return '—';
  const v = val.replace(/\s+/g, '');
  if (v.length <= 4) return '****';
  const country = v.slice(0, 2).toUpperCase();
  return `${country}** **** **** ${v.slice(-4)}`;
}

// ── Seed data for demo mode (no real credentials) ─────────────────────────
const DEMO_SEED: BankRecord[] = [
  {
    id: 'BNK-001',
    employee_name: 'Ahmad Al-Rashid',
    employee_role: 'admin',
    bank_name: 'Qatar National Bank',
    account_number: '00012345678901',
    iban: 'QA58QNBA000000000012345678901',
    card_number: '4111111111111234',
    branch_name: 'Al Sadd Branch',
    account_holder_name: 'Ahmad Al-Rashid',
    payment_method: 'bank_transfer',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'BNK-002',
    employee_name: 'Sara Mohammed',
    employee_role: 'engineer',
    bank_name: 'Commercial Bank of Qatar',
    account_number: '00098765432100',
    iban: 'QA33CBQK000000000098765432100',
    card_number: '',
    branch_name: 'Corniche Branch',
    account_holder_name: 'Sara Mohammed',
    payment_method: 'bank_transfer',
    notes: 'Salary processed on 1st of month',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function mapRow(row: any): BankRecord {
  return {
    id: row.id,
    employee_name: row.employee_name ?? '',
    employee_role: row.employee_role ?? '',
    bank_name: row.bank_name ?? '',
    account_number: row.account_number ?? '',
    iban: row.iban ?? '',
    card_number: row.card_number ?? '',
    branch_name: row.branch_name ?? '',
    account_holder_name: row.account_holder_name ?? '',
    payment_method: (row.payment_method ?? 'bank_transfer') as PaymentMethod,
    notes: row.notes ?? '',
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useBankDetails() {
  const { company, user } = useAuthStore();
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  // Role guard — only owner/admin may fetch
  const isAuthorized = user?.role === 'owner' || user?.role === 'admin';

  const fetch = useCallback(async () => {
    if (!isAuthorized) {
      setRecords([]);
      return;
    }

    if (!isSupabaseConfigured) {
      setRecords(DEMO_SEED);
      return;
    }

    if (!company?.id) return;

    const seq = ++fetchCount.current;
    setLoading(true);

    try {
      const { data, error: fetchErr } = await supabase
        .from('employee_bank_details')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (seq !== fetchCount.current) return;
      if (fetchErr) throw fetchErr;
      setRecords(data ? data.map(mapRow) : []);
      setError(null);
    } catch (err: any) {
      if (seq === fetchCount.current) setError(err.message);
    } finally {
      if (seq === fetchCount.current) setLoading(false);
    }
  }, [company?.id, isAuthorized]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Add ────────────────────────────────────────────────────────────────
  const addRecord = useCallback(async (
    d: Omit<BankRecord, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (!isAuthorized) return;

    if (!isSupabaseConfigured) {
      const newRec: BankRecord = {
        ...d,
        id: `BNK-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRecords(prev => [newRec, ...prev]);
      return;
    }

    if (!company?.id) return;

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic: BankRecord = { ...d, id: tempId, created_at: now, updated_at: now };
    setRecords(prev => [optimistic, ...prev]);

    try {
      const { error: insErr } = await supabase
        .from('employee_bank_details')
        .insert({
          company_id:           company.id,
          employee_name:        d.employee_name,
          employee_role:        d.employee_role,
          bank_name:            d.bank_name,
          account_number:       d.account_number,
          iban:                 d.iban,
          card_number:          d.card_number,
          branch_name:          d.branch_name,
          account_holder_name:  d.account_holder_name,
          payment_method:       d.payment_method,
          notes:                d.notes,
          created_by:           user?.id ?? null,
        });

      if (insErr) throw insErr;

      await writeAuditLog('CREATE', 'employee_bank_details', tempId,
        `Bank record added for ${d.employee_name}`);

      setError(null);
      await fetch();
    } catch (err: any) {
      setError(err.message);
      setRecords(prev => prev.filter(r => r.id !== tempId));
    }
  }, [company?.id, isAuthorized, user?.id, fetch]);

  // ── Update ─────────────────────────────────────────────────────────────
  const updateRecord = useCallback(async (
    id: string,
    changes: Partial<Omit<BankRecord, 'id' | 'created_at' | 'updated_at'>>
  ) => {
    if (!isAuthorized) return;

    if (!isSupabaseConfigured) {
      setRecords(prev => prev.map(r =>
        r.id === id ? { ...r, ...changes, updated_at: new Date().toISOString() } : r
      ));
      return;
    }

    if (!company?.id) return;

    // Optimistic update
    setRecords(prev => prev.map(r =>
      r.id === id ? { ...r, ...changes, updated_at: new Date().toISOString() } : r
    ));

    try {
      const { error: updErr } = await supabase
        .from('employee_bank_details')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('company_id', company.id);

      if (updErr) throw updErr;

      await writeAuditLog('UPDATE', 'employee_bank_details', id,
        `Bank record updated for employee`);

      setError(null);
    } catch (err: any) {
      setError(err.message);
      await fetch();
    }
  }, [company?.id, isAuthorized, fetch]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteRecord = useCallback(async (id: string, employeeName: string) => {
    if (!isAuthorized) return;

    if (!isSupabaseConfigured) {
      setRecords(prev => prev.filter(r => r.id !== id));
      return;
    }

    if (!company?.id) return;

    setRecords(prev => prev.filter(r => r.id !== id));

    try {
      const { error: delErr } = await supabase
        .from('employee_bank_details')
        .delete()
        .eq('id', id)
        .eq('company_id', company.id);

      if (delErr) throw delErr;

      await writeAuditLog('DELETE', 'employee_bank_details', id,
        `Bank record deleted for ${employeeName}`);

      setError(null);
    } catch (err: any) {
      setError(err.message);
      await fetch();
    }
  }, [company?.id, isAuthorized, fetch]);

  return {
    records,
    loading,
    error,
    isAuthorized,
    addRecord,
    updateRecord,
    deleteRecord,
    refetch: fetch,
  };
}
