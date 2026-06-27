import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface ConsultancyInvoiceOut {
  id: string;
  clientId: string | null;
  client: string;
  projectId: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'paid';
  issuedDate: string;
  dueDate: string;
  transactionId: number | null;
  mainProjectId: string | null;
  attachment_url?: string;
}

const seed: ConsultancyInvoiceOut[] = [
  { id: 'CONOUT-001', clientId: 'CCL-001', client: 'TechCorp Inc.', projectId: 'IT Infrastructure Strategy', invoiceNumber: 'INV-CON-001', description: 'IT Infrastructure Strategy — Q1', amount: 18900, status: 'paid', issuedDate: '2026-03-01', dueDate: '2026-04-01', transactionId: null, mainProjectId: null },
  { id: 'CONOUT-002', clientId: 'CCL-002', client: 'Snoonu', projectId: 'Operations Optimization', invoiceNumber: 'INV-CON-002', description: 'Operations Optimization — March', amount: 14440, status: 'approved', issuedDate: '2026-03-31', dueDate: '2026-04-30', transactionId: null, mainProjectId: null },
  { id: 'CONOUT-003', clientId: 'CCL-003', client: 'MegaMart', projectId: 'Supply Chain Audit', invoiceNumber: 'INV-CON-003', description: 'Supply Chain Audit — Final Report', amount: 18480, status: 'paid', issuedDate: '2026-01-15', dueDate: '2026-02-15', transactionId: null, mainProjectId: null },
  { id: 'CONOUT-004', clientId: 'CCL-001', client: 'TechCorp Inc.', projectId: 'IT Infrastructure Strategy', invoiceNumber: 'INV-CON-004', description: 'IT Infrastructure Strategy — Q2', amount: 18900, status: 'pending', issuedDate: '2026-04-01', dueDate: '2026-05-01', transactionId: null, mainProjectId: null },
];

function mapRow(row: any): ConsultancyInvoiceOut {
  return {
    id: row.id,
    clientId: row.client_id ?? null,
    client: row.client ?? '',
    projectId: row.project_id ?? '',
    invoiceNumber: row.invoice_number ?? '',
    description: row.description ?? '',
    amount: Number(row.amount ?? 0),
    status: row.status ?? 'draft',
    issuedDate: (row.issued_date ?? '').toString(),
    dueDate: (row.due_date ?? '').toString(),
    transactionId: row.transaction_id ?? null,
    mainProjectId: row.main_project_id ?? null,
    attachment_url: row.attachment_url ?? undefined,
  };
}

function generateInvoiceNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-CON-${yy}${mm}-${seq}`;
}

export function useConsultancyInvoicesOut() {
  const { company, isInitialized } = useAuthStore();
  const [invoices, setInvoices] = useState<ConsultancyInvoiceOut[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[consultancy_invoices_out:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultancy_invoices_out')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[consultancy_invoices_out:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setInvoices(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addInvoice = useCallback(async (inv: Omit<ConsultancyInvoiceOut, 'id' | 'invoiceNumber' | 'transactionId'>) => {
    const newId = `CONOUT-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const invoiceNumber = generateInvoiceNumber();
    const optimistic: ConsultancyInvoiceOut = { ...inv, id: newId, invoiceNumber, transactionId: null };
    setInvoices(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, client_id: inv.clientId, client: inv.client,
      project_id: inv.projectId, invoice_number: invoiceNumber,
      description: inv.description, amount: inv.amount,
      status: inv.status, issued_date: inv.issuedDate || null, due_date: inv.dueDate || null,
      main_project_id: inv.mainProjectId ?? null };
    console.log('[consultancy_invoices_out:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('consultancy_invoices_out').insert(payload).select();
    console.log('[consultancy_invoices_out:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setInvoices(prev => prev.filter(x => x.id !== newId)); return; }
  }, [invoices.length]);

  /** Auto-generates a revenue transaction when status → approved */
  const updateStatus = useCallback(async (id: string, status: ConsultancyInvoiceOut['status']) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (!isSupabaseConfigured || !inv) return;

    if (status === 'approved' && inv.status !== 'approved' && inv.status !== 'paid') {
      const user = useAuthStore.getState().user;
      const company = useAuthStore.getState().company;
      const { data: txData } = await supabase.from('transactions').insert({
        date: inv.issuedDate || new Date().toISOString().split('T')[0],
        type: 'Invoice',
        description: `[Consultancy] ${inv.invoiceNumber} — ${inv.client}`,
        project: inv.projectId || inv.client,
        amount: inv.amount,
        status: 'approved',
        invoice_number: inv.invoiceNumber,
        client_name: inv.client,
        due_date: inv.dueDate || null,
        created_by: user?.id,
        company_id: company?.id,
      }).select().single();

      if (txData) {
        await supabase.from('consultancy_invoices_out').update({ status, transaction_id: txData.id }).eq('id', id);
      } else {
        await supabase.from('consultancy_invoices_out').update({ status }).eq('id', id);
      }
    } else {
      await supabase.from('consultancy_invoices_out').update({ status }).eq('id', id);
    }
  }, [invoices]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<ConsultancyInvoiceOut>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.clientId !== undefined) payload.client_id = updates.clientId;
    if (updates.client !== undefined) payload.client = updates.client;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.issuedDate !== undefined) payload.issued_date = updates.issuedDate;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
    if (updates.mainProjectId !== undefined) payload.main_project_id = updates.mainProjectId;
    const { error } = await supabase.from('consultancy_invoices_out').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  const deleteInvoice = useCallback(async (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('consultancy_invoices_out').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { invoices, loading, error, addInvoice, updateInvoice, updateStatus, deleteInvoice, refetch: fetch };
}
