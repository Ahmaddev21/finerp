import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type SupportedCurrency = 'QR' | 'EUR' | 'USD' | 'GBP';

export interface ConsultancyInvoiceIn {
  id: string;
  partnerId: string | null;
  partnerName: string;
  projectId: string;
  invoiceRef: string;
  description: string;
  currency: SupportedCurrency;
  originalAmount: number;
  exchangeRate: number;
  convertedAmount: number; // always QR
  status: 'draft' | 'pending' | 'approved' | 'paid';
  receivedDate: string;
  dueDate: string;
  transactionId: number | null;
  mainProjectId: string | null;
  attachment_url?: string;
}

// Default exchange rates (to QR)
export const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  QR: 1,
  EUR: 3.98,   // 1 EUR ≈ 3.98 QR
  USD: 3.64,   // 1 USD ≈ 3.64 QR
  GBP: 4.62,   // 1 GBP ≈ 4.62 QR
};

const seed: ConsultancyInvoiceIn[] = [
  { id: 'CONIN-001', partnerId: 'PTR-001', partnerName: 'Eurotech Solutions GmbH', projectId: 'IT Infrastructure Strategy', invoiceRef: 'ET-2026-0041', description: 'Q1 Advisory hours — IT strategy', currency: 'EUR', originalAmount: 12500, exchangeRate: 3.98, convertedAmount: 49750, status: 'approved', receivedDate: '2026-03-15', dueDate: '2026-04-15', transactionId: null, mainProjectId: null },
  { id: 'CONIN-002', partnerId: 'PTR-002', partnerName: 'Nordic Advisory AS', projectId: 'Operations Optimization', invoiceRef: 'NA-INV-221', description: 'Supply chain assessment — Phase 1', currency: 'EUR', originalAmount: 8200, exchangeRate: 3.98, convertedAmount: 32636, status: 'pending', receivedDate: '2026-04-01', dueDate: '2026-05-01', transactionId: null, mainProjectId: null },
  { id: 'CONIN-003', partnerId: 'PTR-003', partnerName: 'Mediterranean Logistics SRL', projectId: 'Warehouse Process Design', invoiceRef: 'ML-2026-018', description: 'Warehouse layout consulting', currency: 'EUR', originalAmount: 6800, exchangeRate: 3.98, convertedAmount: 27064, status: 'draft', receivedDate: '2026-04-10', dueDate: '2026-05-10', transactionId: null, mainProjectId: null },
];

function mapRow(row: any): ConsultancyInvoiceIn {
  return {
    id: row.id,
    partnerId: row.partner_id ?? null,
    partnerName: row.partner_name ?? '',
    projectId: row.project_id ?? '',
    invoiceRef: row.invoice_ref ?? '',
    description: row.description ?? '',
    currency: row.currency ?? 'QR',
    originalAmount: Number(row.original_amount ?? 0),
    exchangeRate: Number(row.exchange_rate ?? 1),
    convertedAmount: Number(row.converted_amount ?? 0),
    status: row.status ?? 'draft',
    receivedDate: (row.received_date ?? '').toString(),
    dueDate: (row.due_date ?? '').toString(),
    transactionId: row.transaction_id ?? null,
    mainProjectId: row.main_project_id ?? null,
    attachment_url: row.attachment_url ?? undefined,
  };
}

export function useConsultancyInvoicesIn() {
  const { company, isInitialized } = useAuthStore();
  const [invoices, setInvoices] = useState<ConsultancyInvoiceIn[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    if (!company?.id) return;
    const cid = company.id;
    console.log('[consultancy_invoices_in:fetch] company_id=', cid, 'isInitialized=', useAuthStore.getState().isInitialized);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultancy_invoices_in')
      .select('*, consultancy_partners(name)')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    setLoading(false);
    console.log('[consultancy_invoices_in:fetch] rows=', data?.length ?? 0, 'error=', error?.message ?? null);
    if (error) { setError(error.message); return; }
    if (data && data.length > 0) {
      setInvoices(data.map(row => ({
        ...mapRow(row),
        partnerName: row.consultancy_partners?.name ?? row.partner_name ?? '',
      })));
    }
  }, [company?.id]);

  useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);

  const addInvoice = useCallback(async (inv: Omit<ConsultancyInvoiceIn, 'id' | 'transactionId'>) => {
    const newId = `CONIN-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const optimistic: ConsultancyInvoiceIn = { ...inv, id: newId, transactionId: null };
    setInvoices(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const userId = useAuthStore.getState().user?.id;
    const payload = { id: newId, company_id: companyId, partner_id: inv.partnerId, project_id: inv.projectId,
      invoice_ref: inv.invoiceRef, description: inv.description,
      currency: inv.currency, original_amount: inv.originalAmount,
      exchange_rate: inv.exchangeRate, converted_amount: inv.convertedAmount,
      status: inv.status, received_date: inv.receivedDate || null, due_date: inv.dueDate || null,
      main_project_id: inv.mainProjectId ?? null };
    console.log('[consultancy_invoices_in:insert] payload=', JSON.stringify(payload), 'auth_uid=', userId);
    const { data: insertData, error } = await supabase.from('consultancy_invoices_in').insert(payload).select();
    console.log('[consultancy_invoices_in:insert] response data=', JSON.stringify(insertData), 'error=', error?.message ?? null, 'error_code=', error?.code ?? null);
    if (error) { setError(error.message); setInvoices(prev => prev.filter(x => x.id !== newId)); return; }
  }, [invoices.length]);

  /** Auto-generates an expense transaction (in QR) when status → approved */
  const updateStatus = useCallback(async (id: string, status: ConsultancyInvoiceIn['status']) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (!isSupabaseConfigured || !inv) return;

    if (status === 'approved' && inv.status !== 'approved' && inv.status !== 'paid') {
      const user = useAuthStore.getState().user;
      const company = useAuthStore.getState().company;
      const currencyNote = inv.currency !== 'QR'
        ? ` (${inv.currency} ${inv.originalAmount.toLocaleString()} @ ${inv.exchangeRate})`
        : '';
      const { data: txData } = await supabase.from('transactions').insert({
        date: inv.receivedDate || new Date().toISOString().split('T')[0],
        type: 'Expense',
        description: `[Consultancy] Partner: ${inv.partnerName} — ${inv.invoiceRef}${currencyNote}`,
        project: inv.projectId || 'Consultancy',
        amount: -Math.abs(inv.convertedAmount),
        status: 'approved',
        created_by: user?.id,
        company_id: company?.id,
      }).select().single();

      if (txData) {
        await supabase.from('consultancy_invoices_in').update({ status, transaction_id: txData.id }).eq('id', id);
      } else {
        await supabase.from('consultancy_invoices_in').update({ status }).eq('id', id);
      }
    } else {
      await supabase.from('consultancy_invoices_in').update({ status }).eq('id', id);
    }
  }, [invoices]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<ConsultancyInvoiceIn>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (!isSupabaseConfigured) return;
    const payload: Record<string, any> = {};
    if (updates.partnerId !== undefined) payload.partner_id = updates.partnerId;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.invoiceRef !== undefined) payload.invoice_ref = updates.invoiceRef;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.originalAmount !== undefined) payload.original_amount = updates.originalAmount;
    if (updates.exchangeRate !== undefined) payload.exchange_rate = updates.exchangeRate;
    if (updates.convertedAmount !== undefined) payload.converted_amount = updates.convertedAmount;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.receivedDate !== undefined) payload.received_date = updates.receivedDate;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
    if (updates.mainProjectId !== undefined) payload.main_project_id = updates.mainProjectId;
    const { error } = await supabase.from('consultancy_invoices_in').update(payload).eq('id', id);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  const deleteInvoice = useCallback(async (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (!isSupabaseConfigured) return;
    const companyId = useAuthStore.getState().company?.id;
    const { error } = await supabase.from('consultancy_invoices_in').delete().eq('id', id).eq('company_id', companyId);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { invoices, loading, error, addInvoice, updateInvoice, updateStatus, deleteInvoice, refetch: fetch };
}
