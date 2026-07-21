import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';
import { isAdminRole } from '../lib/roles';

export type MRStatus = 'pending' | 'accepted' | 'rejected';

export interface MoneyRequisition {
  id:            string;
  companyId:     string;
  date:          string;
  payTo:         string;
  description:   string;
  amount:        number;
  remarks:       string | null;
  status:        MRStatus;
  createdBy:     string | null;
  decidedBy:     string | null;
  decidedAt:     string | null;
  decisionNote:  string | null;
  createdAt:     string;
  updatedAt:     string;
}

function mapRow(row: any): MoneyRequisition {
  return {
    id:           row.id,
    companyId:    row.company_id,
    date:         (row.date ?? '').toString(),
    payTo:        row.pay_to        ?? '',
    description:  row.description   ?? '',
    amount:       Number(row.amount ?? 0),
    remarks:      row.remarks       ?? null,
    status:       (row.status       ?? 'pending') as MRStatus,
    createdBy:    row.created_by    ?? null,
    decidedBy:    row.decided_by    ?? null,
    decidedAt:    row.decided_at    ?? null,
    decisionNote: row.decision_note ?? null,
    createdAt:    row.created_at    ?? '',
    updatedAt:    row.updated_at    ?? '',
  };
}

export function useMoneyRequisitions() {
  const { company, isInitialized } = useAuthStore();
  const user = useAuthStore(s => s.user);

  const [requisitions, setRequisitions] = useState<MoneyRequisition[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('money_requisitions')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (err) { setError(err.message); return; }
      setRequisitions((data ?? []).map(mapRow));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (isInitialized && company?.id) fetch();
  }, [fetch, isInitialized, company?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const name = `mrq-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'money_requisitions', filter: `company_id=eq.${company.id}` },
        () => { fetch(); })
      .subscribe((status, err) => {
        if (err) console.error('[MoneyRequisitions] realtime error:', err.message);
      });
    return () => { supabase.removeChannel(channel); };
  }, [company?.id, fetch]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const addRequisition = useCallback(async (r: {
    date:         string;
    payTo:        string;
    description:  string;
    amount:       number;
    remarks?:     string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (user?.role !== 'owner') {
      return { success: false, error: 'Only owners can create money requisitions.' };
    }

    const newId = `MRQ-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const optimistic: MoneyRequisition = {
      id:           newId,
      companyId:    company?.id ?? '',
      date:         r.date,
      payTo:        r.payTo,
      description:  r.description,
      amount:       r.amount,
      remarks:      r.remarks ?? null,
      status:       'pending',
      createdBy:    user?.id ?? null,
      decidedBy:    null,
      decidedAt:    null,
      decisionNote: null,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };
    setRequisitions(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return { success: true };

    const { error: err } = await supabase.from('money_requisitions').insert({
      id:          newId,
      company_id:  company?.id,
      date:        r.date,
      pay_to:      r.payTo,
      description: r.description,
      amount:      r.amount,
      remarks:     r.remarks ?? null,
      status:      'pending',
      created_by:  user?.id ?? null,
    });

    if (err) {
      setError(err.message);
      setRequisitions(prev => prev.filter(x => x.id !== newId));
      return { success: false, error: err.message };
    }

    void writeAuditLog('CREATE', 'money_requisitions', newId, `Requisition to ${r.payTo}: QR ${r.amount}`);
    return { success: true };
  }, [company?.id, user?.id, user?.role]);

  // ── Decide (accept/reject) ────────────────────────────────────────────────

  const decideRequisition = useCallback(async (
    id: string,
    decision: 'accepted' | 'rejected',
    note?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isAdminRole(user?.role)) {
      return { success: false, error: 'Only owner/admin can accept or reject requisitions.' };
    }

    const decidedAt = new Date().toISOString();

    setRequisitions(prev => prev.map(r => r.id === id
      ? { ...r, status: decision, decidedBy: user?.id ?? null, decidedAt, decisionNote: note ?? null }
      : r
    ));

    if (!isSupabaseConfigured) return { success: true };

    const { error: err } = await supabase.from('money_requisitions').update({
      status:        decision,
      decided_by:    user?.id ?? null,
      decided_at:    decidedAt,
      decision_note: note ?? null,
    }).eq('id', id);

    if (err) { setError(err.message); fetch(); return { success: false, error: err.message }; }

    void writeAuditLog('UPDATE', 'money_requisitions', id, `Requisition ${decision}${note ? `: ${note}` : ''}`);
    return { success: true };
  }, [user?.id, user?.role, fetch]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteRequisition = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (user?.role !== 'owner') {
      return { success: false, error: 'Only owners can delete requisitions.' };
    }

    setRequisitions(prev => prev.filter(r => r.id !== id));

    if (!isSupabaseConfigured) return { success: true };

    const { error: err } = await supabase.from('money_requisitions').delete().eq('id', id);
    if (err) { setError(err.message); fetch(); return { success: false, error: err.message }; }

    void writeAuditLog('DELETE', 'money_requisitions', id, 'Requisition deleted by owner.');
    return { success: true };
  }, [user?.role, fetch]);

  return {
    requisitions,
    loading,
    error,
    addRequisition,
    decideRequisition,
    deleteRequisition,
    refetch: fetch,
  };
}
