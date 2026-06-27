import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ContractingInvoiceIn {
  id: string;
  projectId: string | null;
  subcontractorId: string | null;
  subcontractor: string;
  invoiceRef: string;
  description: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'paid';
  receivedDate: string;
  dueDate: string;
  transactionId: number | null;
  attachment_url?: string;
}

const seed: ContractingInvoiceIn[] = [
  { id: 'CINV-I-001', projectId: 'CPRJ-001', subcontractorId: 'SUB-002', subcontractor: 'Gulf Fleet Services', invoiceRef: 'GFS-2026-041', description: 'Fleet maintenance — March batch', amount: 42000, status: 'approved', receivedDate: '2026-03-28', dueDate: '2026-04-28', transactionId: null },
  { id: 'CINV-I-002', projectId: 'CPRJ-001', subcontractorId: 'SUB-001', subcontractor: 'Al Rashid Construction', invoiceRef: 'ARC-INV-198', description: 'Warehouse bay construction', amount: 68000, status: 'pending', receivedDate: '2026-04-05', dueDate: '2026-05-05', transactionId: null },
  { id: 'CINV-I-003', projectId: 'CPRJ-002', subcontractorId: 'SUB-003', subcontractor: 'Doha Electrical Co.', invoiceRef: 'DEC-0412', description: 'Server room electrical work', amount: 15500, status: 'paid', receivedDate: '2026-03-10', dueDate: '2026-04-10', transactionId: null },
  { id: 'CINV-I-004', projectId: 'CPRJ-004', subcontractorId: 'SUB-002', subcontractor: 'Gulf Fleet Services', invoiceRef: 'GFS-2026-055', description: 'Rider equipment procurement', amount: 31000, status: 'draft', receivedDate: '2026-04-12', dueDate: '2026-05-12', transactionId: null },
];

function mapRow(row: any): ContractingInvoiceIn {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    subcontractorId: row.subcontractor_id ?? null,
    subcontractor: row.subcontractor ?? '',
    invoiceRef: row.invoice_ref ?? '',
    description: row.description ?? '',
    amount: Number(row.amount ?? 0),
    status: row.status ?? 'draft',
    receivedDate: (row.received_date ?? '').toString(),
    dueDate: (row.due_date ?? '').toString(),
    transactionId: row.transaction_id ?? null,
    attachment_url: row.attachment_url ?? undefined,
  };
}

export function useContractingInvoicesIn() {
  const { company, isInitialized } = useAuthStore();
  const [invoices, setInvoices] = useState<ContractingInvoiceIn[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[contracting_invoices_in:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_invoices_in')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[contracting_invoices_in:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setInvoices(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addInvoice = useCallback(async (inv: Omit<ContractingInvoiceIn, 'id' | 'transactionId'>) => {
    const newId = `CINV-I-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ContractingInvoiceIn = { ...inv, id: newId, transactionId: null };
    setInvoices(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, project_id: inv.projectId, subcontractor_id: inv.subcontractorId,
      subcontractor: inv.subcontractor, invoice_ref: inv.invoiceRef,
      description: inv.description, amount: inv.amount, status: inv.status,
      received_date: inv.receivedDate || null, due_date: inv.dueDate || null };
    console.log('[contracting_invoices_in:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracting_invoices_in').insert(payload).select();
    console.log('[contracting_invoices_in:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setInvoices(prev => prev.filter(x => x.id !== newId)); return; }
  }, [invoices.length]);

  /** Auto-generates an expense transaction when status → approved */
  const updateStatus = useCallback(async (id: string, status: ContractingInvoiceIn['status']) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (!isSupabaseConfigured || !inv) return;

    if (status === 'approved' && inv.status !== 'approved' && inv.status !== 'paid') {
      const user = useAuthStore.getState().user;
      const company = useAuthStore.getState().company;
      const { data: txData } = await supabase.from('transactions').insert({
        date: inv.receivedDate || new Date().toISOString().split('T')[0],
        type: 'Expense',
        description: `[Contracting] Subcon: ${inv.subcontractor} — ${inv.invoiceRef}`,
        project: inv.subcontractor,
        amount: -Math.abs(inv.amount),
        status: 'approved',
        created_by: user?.id,
        company_id: company?.id,
      }).select().single();

      if (txData) {
        await supabase.from('contracting_invoices_in').update({ status, transaction_id: txData.id }).eq('id', id);
      } else {
        await supabase.from('contracting_invoices_in').update({ status }).eq('id', id);
      }
    } else {
      await supabase.from('contracting_invoices_in').update({ status }).eq('id', id);
    }
  }, [invoices]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<ContractingInvoiceIn>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.subcontractor !== undefined) payload.subcontractor = updates.subcontractor;
    if (updates.subcontractorId !== undefined) payload.subcontractor_id = updates.subcontractorId;
    if (updates.invoiceRef !== undefined) payload.invoice_ref = updates.invoiceRef;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.receivedDate !== undefined) payload.received_date = updates.receivedDate;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    const { error } = await supabase.from('contracting_invoices_in').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  const deleteInvoice = useCallback(async (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('contracting_invoices_in').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { invoices, loading, error, addInvoice, updateInvoice, updateStatus, deleteInvoice, refetch: fetch };
}
