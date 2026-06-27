import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

import { isAdminRole } from '../lib/roles';

export interface ContractingInvoiceOut {
  id: string;
  projectId: string | null;
  invoiceNumber: string;
  client: string;
  description: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'paid';
  issuedDate: string;
  dueDate: string;
  transactionId: number | null;
  edit_count?: number;
  attachment_url?: string;
}

const seed: ContractingInvoiceOut[] = [
  { id: 'CINV-O-001', projectId: 'CPRJ-001', invoiceNumber: 'INV-CTR-001', client: 'Snoonu', description: 'Q1 Fleet Management Services', amount: 112500, status: 'paid', issuedDate: '2026-03-01', dueDate: '2026-04-01', transactionId: null },
  { id: 'CINV-O-002', projectId: 'CPRJ-001', invoiceNumber: 'INV-CTR-002', client: 'Snoonu', description: 'Q2 Fleet Management Services', amount: 112500, status: 'approved', issuedDate: '2026-04-01', dueDate: '2026-05-01', transactionId: null },
  { id: 'CINV-O-003', projectId: 'CPRJ-002', invoiceNumber: 'INV-CTR-003', client: 'TechCorp Inc.', description: 'Infrastructure SLA — March', amount: 20000, status: 'pending', issuedDate: '2026-03-15', dueDate: '2026-04-15', transactionId: null },
  { id: 'CINV-O-004', projectId: 'CPRJ-004', invoiceNumber: 'INV-CTR-004', client: 'Snoonu', description: 'Rider Contracting Block — Batch 1', amount: 93000, status: 'draft', issuedDate: '2026-04-10', dueDate: '2026-05-10', transactionId: null },
];

function mapRow(row: any): ContractingInvoiceOut {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    invoiceNumber: row.invoice_number ?? '',
    client: row.client ?? '',
    description: row.description ?? '',
    amount: Number(row.amount ?? 0),
    status: row.status ?? 'draft',
    issuedDate: (row.issued_date ?? '').toString(),
    dueDate: (row.due_date ?? '').toString(),
    transactionId: row.transaction_id ?? null,
    attachment_url: row.attachment_url ?? undefined,
  };
}

function generateInvoiceNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-CTR-${yy}${mm}-${seq}`;
}

export function useContractingInvoicesOut() {
  const { company, isInitialized } = useAuthStore();
  const [invoices, setInvoices] = useState<ContractingInvoiceOut[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!company) return;
    const cid = company.id;
    console.log('[contracting_invoices_out:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('contracting_invoices_out')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[contracting_invoices_out:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    setInvoices(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addInvoice = useCallback(async (inv: Omit<ContractingInvoiceOut, 'id' | 'invoiceNumber' | 'transactionId'>) => {
    const newId = `CINV-O-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const invoiceNumber = generateInvoiceNumber();
    const optimistic: ContractingInvoiceOut = { ...inv, id: newId, invoiceNumber, transactionId: null };
    setInvoices(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, project_id: inv.projectId, invoice_number: invoiceNumber,
      client: inv.client, description: inv.description, amount: inv.amount,
      status: inv.status, issued_date: inv.issuedDate || null, due_date: inv.dueDate || null };
    console.log('[contracting_invoices_out:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('contracting_invoices_out').insert(payload).select();
    console.log('[contracting_invoices_out:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setInvoices(prev => prev.filter(x => x.id !== newId)); return; }
  }, [invoices.length]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<ContractingInvoiceOut>) => {
    const role = useAuthStore.getState().user?.role;
    const isAdmin = isAdminRole(role);
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    // First Edit Exception: 1st correction is free, 2nd+ sensitive requires approval
    const isSensitive = updates.amount !== undefined || updates.status !== undefined;
    const isSelfCorrection = !isAdmin && (!inv.edit_count || inv.edit_count === 0);
    const needsApproval = !isAdmin && !isSelfCorrection && isSensitive;

    if (needsApproval) return 'APPROVAL_REQUIRED';

    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));

    if (!isSupabaseConfigured) {
      return;
    }

    const payload: Record<string, any> = { ...updates };
    if (isSelfCorrection) payload.edit_count = 1;
    
    // DB mapping
    if (updates.issuedDate) payload.issued_date = updates.issuedDate;
    if (updates.dueDate) payload.due_date = updates.dueDate;

    await supabase.from('contracting_invoices_out').update(payload).eq('id', id);
  }, [invoices]);

  /** Auto-generates a transaction when status → approved */
  const updateStatus = useCallback(async (id: string, status: ContractingInvoiceOut['status']) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (!isSupabaseConfigured || !inv) return;

    // If moving to approved → auto-create transaction
    if (status === 'approved' && inv.status !== 'approved' && inv.status !== 'paid') {
      const user = useAuthStore.getState().user;
      const company = useAuthStore.getState().company;
      const { data: txData } = await supabase.from('transactions').insert({
        date: inv.issuedDate || new Date().toISOString().split('T')[0],
        type: 'Invoice',
        description: `[Contracting] ${inv.invoiceNumber} — ${inv.client}`,
        project: inv.client,
        amount: inv.amount,
        status: 'approved',
        invoice_number: inv.invoiceNumber,
        client_name: inv.client,
        due_date: inv.dueDate || null,
        created_by: user?.id,
        company_id: company?.id,
      }).select().single();

      if (txData) {
        await supabase.from('contracting_invoices_out').update({ status, transaction_id: txData.id }).eq('id', id);
      } else {
        await supabase.from('contracting_invoices_out').update({ status }).eq('id', id);
      }
    } else {
      await supabase.from('contracting_invoices_out').update({ status }).eq('id', id);
    }
  }, [invoices]);

  const deleteInvoice = useCallback(async (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('contracting_invoices_out').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { invoices, loading, error, addInvoice, updateInvoice, updateStatus, deleteInvoice, refetch: fetch };
}
