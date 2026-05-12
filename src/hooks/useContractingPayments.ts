import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ContractingPayment {
  id: string;
  projectId: string | null;
  invoiceId: string | null;
  direction: 'in' | 'out';
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
  status: 'pending' | 'completed' | 'failed';
  transactionId: number | null;
}

const seed: ContractingPayment[] = [
  { id: 'CPAY-001', projectId: 'CPRJ-001', invoiceId: 'CINV-O-001', direction: 'in', amount: 112500, paymentDate: '2026-03-28', method: 'Bank Transfer', reference: 'TRF-SNO-0328', notes: 'Q1 payment received', status: 'completed', transactionId: null },
  { id: 'CPAY-002', projectId: 'CPRJ-002', invoiceId: 'CINV-I-003', direction: 'out', amount: 15500, paymentDate: '2026-04-08', method: 'Bank Transfer', reference: 'TRF-DEC-0408', notes: 'Electrical work settlement', status: 'completed', transactionId: null },
  { id: 'CPAY-003', projectId: 'CPRJ-001', invoiceId: 'CINV-I-001', direction: 'out', amount: 42000, paymentDate: '2026-04-15', method: 'Cheque', reference: 'CHQ-GFS-1205', notes: 'Fleet maintenance payment', status: 'pending', transactionId: null },
];

function mapRow(row: any): ContractingPayment {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    invoiceId: row.invoice_id ?? null,
    direction: row.direction ?? 'in',
    amount: Number(row.amount ?? 0),
    paymentDate: (row.payment_date ?? '').toString(),
    method: row.method ?? 'Bank Transfer',
    reference: row.reference ?? '',
    notes: row.notes ?? '',
    status: row.status ?? 'completed',
    transactionId: row.transaction_id ?? null,
  };
}

export function useContractingPayments() {
  const { company, isInitialized } = useAuthStore();
  const [payments, setPayments] = useState<ContractingPayment[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[contracting_payments:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_payments')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[contracting_payments:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setPayments(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  /** Records a payment and auto-creates a transaction */
  const recordPayment = useCallback(async (p: Omit<ContractingPayment, 'id' | 'transactionId'>) => {
    const newId = `CPAY-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ContractingPayment = { ...p, id: newId, transactionId: null };
    setPayments(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const user = useAuthStore.getState().user;
    const company = useAuthStore.getState().company;
    console.log('[contracting_payments:insert] direction=', p.direction, 'amount=', p.amount, 'company_id=', company?.id, 'auth_uid=', user?.id);

    // Auto-create transaction
    const txType = p.direction === 'in' ? 'Receipt' : 'Expense';
    const txAmount = p.direction === 'in' ? Math.abs(p.amount) : -Math.abs(p.amount);
    const txDesc = p.direction === 'in'
      ? `[Contracting] Payment received — ${p.reference || newId}`
      : `[Contracting] Payment to subcontractor — ${p.reference || newId}`;

    const { data: txData } = await supabase.from('transactions').insert({
      date: p.paymentDate || new Date().toISOString().split('T')[0],
      type: txType,
      description: txDesc,
      project: 'Contracting',
      amount: txAmount,
      status: 'approved',
      created_by: user?.id,
      company_id: company?.id,
    }).select().single();

    const { data: insertData, error } = await supabase.from('contracting_payments').insert({
      id: newId, company_id: company?.id, project_id: p.projectId, invoice_id: p.invoiceId,
      direction: p.direction, amount: p.amount, payment_date: p.paymentDate || null,
      method: p.method, reference: p.reference, notes: p.notes,
      status: p.status, transaction_id: txData?.id ?? null,
    }).select();
    console.log('[contracting_payments:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setPayments(prev => prev.filter(x => x.id !== newId)); return; }
  }, [payments.length]);

  return { payments, loading, error, recordPayment, refetch: fetch };
}
