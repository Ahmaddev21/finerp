import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ConsultancyPayment {
  id: string;
  invoiceId: string | null;
  clientId: string | null;
  client: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
  status: 'pending' | 'completed' | 'failed';
  transactionId: number | null;
}

const seed: ConsultancyPayment[] = [
  { id: 'CPMT-001', invoiceId: 'CONOUT-001', clientId: 'CCL-001', client: 'TechCorp Inc.', amount: 18900, paymentDate: '2026-03-28', method: 'Bank Transfer', reference: 'TRF-TC-0328', notes: 'Q1 advisory payment', status: 'completed', transactionId: null },
  { id: 'CPMT-002', invoiceId: 'CONOUT-003', clientId: 'CCL-003', client: 'MegaMart', amount: 18480, paymentDate: '2026-02-10', method: 'Bank Transfer', reference: 'TRF-MM-0210', notes: 'Final audit payment', status: 'completed', transactionId: null },
  { id: 'CPMT-003', invoiceId: 'CONOUT-002', clientId: 'CCL-002', client: 'Snoonu', amount: 14440, paymentDate: '2026-04-25', method: 'Cheque', reference: 'CHQ-SNO-0425', notes: 'March ops optimization', status: 'pending', transactionId: null },
];

function mapRow(row: any): ConsultancyPayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? null,
    clientId: row.client_id ?? null,
    client: row.client ?? '',
    amount: Number(row.amount ?? 0),
    paymentDate: (row.payment_date ?? '').toString(),
    method: row.method ?? 'Bank Transfer',
    reference: row.reference ?? '',
    notes: row.notes ?? '',
    status: row.status ?? 'completed',
    transactionId: row.transaction_id ?? null,
  };
}

export function useConsultancyPayments() {
  const { company, isInitialized } = useAuthStore();
  const [payments, setPayments] = useState<ConsultancyPayment[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[consultancy_payments:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultancy_payments')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[consultancy_payments:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setPayments(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  /** Records a payment and auto-creates a receipt transaction */
  const recordPayment = useCallback(async (p: Omit<ConsultancyPayment, 'id' | 'transactionId'>) => {
    const newId = `CPMT-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ConsultancyPayment = { ...p, id: newId, transactionId: null };
    setPayments(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const user = useAuthStore.getState().user;
    const company = useAuthStore.getState().company;
    console.log('[consultancy_payments:insert] client=', p.client, 'amount=', p.amount, 'company_id=', company?.id, 'auth_uid=', user?.id);

    // Auto-create receipt transaction
    const { data: txData } = await supabase.from('transactions').insert({
      date: p.paymentDate || new Date().toISOString().split('T')[0],
      type: 'Receipt',
      description: `[Consultancy] Payment from ${p.client} — ${p.reference || newId}`,
      project: 'Consultancy',
      amount: Math.abs(p.amount),
      status: 'approved',
      created_by: user?.id,
      company_id: company?.id,
    }).select().single();

    const { data: insertData, error } = await supabase.from('consultancy_payments').insert({
      id: newId, company_id: company?.id, invoice_id: p.invoiceId, client_id: p.clientId,
      client: p.client, amount: p.amount, payment_date: p.paymentDate || null,
      method: p.method, reference: p.reference, notes: p.notes,
      status: p.status, transaction_id: txData?.id ?? null,
    }).select();
    console.log('[consultancy_payments:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setPayments(prev => prev.filter(x => x.id !== newId)); return; }

    // If linked to invoice, mark invoice as paid
    if (p.invoiceId) {
      await supabase.from('consultancy_invoices_out').update({ status: 'paid' }).eq('id', p.invoiceId);
    }
  }, [payments.length]);

  return { payments, loading, error, recordPayment, refetch: fetch };
}
