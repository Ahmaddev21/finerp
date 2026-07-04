import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

import { isAdminRole } from '../lib/roles';

export interface Transaction {
  id: number;
  date: string;
  type: string;
  desc: string;
  project: string;
  amount: number;
  status: string; // draft | pending | approved | paid | completed | rejected | cancelled
  invoice_number?: string;
  client_name?: string;
  due_date?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  attachment_url?: string;
  company_id?: string;
  is_deleted?: boolean;
  is_reconciled?: boolean;
  edit_count?: number;
}

const seed: Transaction[] = [
  { id: 1, date: '2026-04-05', type: 'Invoice', desc: 'Q1 Rider Supply', project: 'Snoonu Logistics', amount: 25000, status: 'paid', invoice_number: 'INV-260405-001', client_name: 'Snoonu', due_date: '2026-05-05' },
  { id: 2, date: '2026-04-04', type: 'Expense', desc: 'Server Hosting', project: 'Internal', amount: -1200, status: 'approved' },
  { id: 3, date: '2026-04-02', type: 'Receipt', desc: 'Payment for INV-001', project: 'Snoonu Logistics', amount: 25000, status: 'approved' },
  { id: 4, date: '2026-04-01', type: 'Petty Cash', desc: 'Office Supplies', project: 'Internal', amount: -150, status: 'approved' },
  { id: 5, date: '2026-03-28', type: 'Invoice', desc: 'Consultation Services', project: 'TechCorp', amount: 8500, status: 'pending', invoice_number: 'INV-260328-001', client_name: 'TechCorp Inc.', due_date: '2026-04-28' },
  { id: 6, date: '2026-03-25', type: 'Expense', desc: 'Fleet Maintenance', project: 'PRJ-001', amount: -3200, status: 'approved' },
  { id: 7, date: '2026-03-20', type: 'Invoice', desc: 'Urban Eats Delivery Retainer', project: 'Urban Eats', amount: 12000, status: 'approved', invoice_number: 'INV-260320-001', client_name: 'Urban Eats', due_date: '2026-04-20' },
  { id: 8, date: '2026-03-18', type: 'Receipt', desc: 'Payment for INV-002', project: 'TechCorp', amount: 8500, status: 'approved' },
  { id: 9, date: '2026-03-10', type: 'Invoice', desc: 'Logistics Fleet Advisory', project: 'Snoonu Logistics', amount: 15000, status: 'draft', invoice_number: 'INV-260310-001', client_name: 'Snoonu', due_date: '2026-04-10' },
  { id: 10, date: '2026-03-05', type: 'Expense', desc: 'Marketing Campaign', project: 'Internal', amount: -4500, status: 'pending' },
];

// Auto-approval threshold (QR)
const AUTO_APPROVE_THRESHOLD = 500;

function mapRow(row: any): Transaction {
  // Ensure amount is handled correctly even if it's 0 or missing
  let amount = 0;
  if (row.amount !== undefined && row.amount !== null) {
    amount = Number(row.amount);
  } else if (row.transaction_type === 'out') {
    amount = -Math.abs(Number(row.amount ?? 0));
  } else {
    amount = Math.abs(Number(row.amount ?? 0));
  }

  return {
    id: row.id,
    date: (row.date ?? row.invoice_date ?? row.expense_date ?? row.receipt_date ?? row.transaction_date ?? '').toString(),
    type: row.type ?? row.transaction_type ?? 'Other',
    desc: row.description ?? '',
    project: row.project ?? row.project_id ?? 'Internal',
    amount,
    status: row.status ?? 'draft',
    invoice_number: row.invoice_number,
    client_name: row.client_name,
    due_date: row.due_date,
    created_by: row.created_by,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    attachment_url: row.attachment_url,
    company_id: row.company_id,
    is_deleted: row.is_deleted ?? false,
    is_reconciled: row.is_reconciled ?? false,
  };
}

// Generate invoice number: INV-YYMMDD-XXX
function generateInvoiceNumber(date: string): string {
  const d = new Date(date || Date.now());
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-${yy}${mm}${dd}-${seq}`;
}

// Determine initial status based on type, amount, and user role
function getInitialStatus(type: string, amount: number, role: string): string {
  // Invoices always start as draft regardless of role.
  // Creating an invoice ≠ approving it — it must go through the workflow
  // (draft → approved → paid) so it doesn't prematurely count as revenue.
  if (type === 'Invoice') return 'draft';

  // Owners and Admins get auto-approval for all other transaction types
  if (isAdminRole(role)) return 'approved';

  // Receipts are always auto-approved for standard users too
  if (type === 'Receipt') return 'approved';

  // Expenses & Petty Cash for non-admins start as pending
  return 'pending';
}

function hasProtectedChanges(tx: Transaction, updates: Partial<Transaction>) {
  if (updates.amount !== undefined && tx.amount !== updates.amount) return true;
  if (updates.date !== undefined && tx.date !== updates.date) return true;
  if (updates.status !== undefined && tx.status !== updates.status) return true;
  return false;
}

export function useTransactions() {
  const { company, isInitialized } = useAuthStore();
  // Always start with seed so the UI has data immediately.
  // Real Supabase data replaces it once the fetch completes.
  const [transactions, setTransactions] = useState<Transaction[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore(s => s.user);
    
  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', company.id)
      .eq('is_deleted', false)
      .order('date', { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setTransactions(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => {
    let channel: any;

    const setupChannel = async () => {
      if (isSupabaseConfigured && company?.id) {
        await fetch();
        channel = supabase.channel(`transactions-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${company.id}` },
            () => {
              void fetch();
            }
          )
          .subscribe();
      } else {
        void fetch();
      }
    };

    setupChannel();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [company?.id, fetch]);

  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    const role = user?.role ?? 'intern';
    const numAmount = Number(tx.amount);
    const initialStatus = getInitialStatus(tx.type, numAmount, role);
    const invoiceNumber = tx.type === 'Invoice' ? generateInvoiceNumber(tx.date) : undefined;

    const optimistic: Transaction = {
      ...tx,
      amount: numAmount,
      id: Date.now(),
      status: initialStatus,
      invoice_number: invoiceNumber,
      created_by: user?.id,
    };
    setTransactions(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return true; // demo mode — keep optimistic, done
    if (!company?.id) {
      // No company context yet — keep optimistic locally, treat as success for UX.
      console.warn('[useTransactions] No company ID — entry kept locally.');
      return true;
    }

    const { data, error } = await supabase.from('transactions').insert({
      date:           tx.date || new Date().toISOString().split('T')[0],
      type:           tx.type,
      description:    tx.desc,
      project:        tx.project,
      amount:         numAmount,
      status:         initialStatus,
      invoice_number: invoiceNumber,
      client_name:    tx.client_name,
      due_date:       tx.due_date || null,
      created_by:     user?.id,
      company_id:     company?.id,
    }).select().single();

    if (error) {
      // ─── IMPORTANT: do NOT rollback the optimistic entry. ─────────────────
      // The entry stays visible so the user never loses their work.
      // Log the error so developers can diagnose RLS / schema issues.
      console.error('[useTransactions] INSERT failed — keeping optimistic entry:', error.message, error);
      setError(`DB sync failed (${error.code ?? 'unknown'}): ${error.message}`);
      return false; // Signal to UI: show a warning, not a success toast
    }

    // Replace temp id with the real DB record
    setTransactions(prev => prev.map(t => t.id === optimistic.id ? mapRow(data) : t));
    return true;
  }, [user, company, isInitialized]);

  const updateTransaction = useCallback(async (id: number, updates: Partial<Transaction>) => {
    const role = user?.role;
    const isAdmin = isAdminRole(role);
    const tx = transactions.find(t => t.id === id);
    if (!tx) return false;

    const isProtected = hasProtectedChanges(tx, updates);
    const needsApproval = !isAdmin && isProtected;

    if (needsApproval) return 'APPROVAL_REQUIRED';

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    if (!isSupabaseConfigured || !company?.id) return true;

    // Map TS field names → DB column names; use !== undefined so empty strings are
    // included (then null-coerced for nullable date/text columns).
    const dbPayload: Record<string, any> = {};
    if (updates.date        !== undefined) dbPayload.date         = updates.date;
    if (updates.type        !== undefined) dbPayload.type         = updates.type;
    if (updates.desc        !== undefined) dbPayload.description  = updates.desc        || null;
    if (updates.project     !== undefined) dbPayload.project      = updates.project     || null;
    if (updates.amount      !== undefined) dbPayload.amount       = Number(updates.amount);
    if (updates.status      !== undefined) dbPayload.status       = updates.status;
    if (updates.client_name !== undefined) dbPayload.client_name  = updates.client_name || null;
    if (updates.due_date    !== undefined) dbPayload.due_date     = updates.due_date    || null;

    if (Object.keys(dbPayload).length === 0) return true;

    const { error } = await supabase
      .from('transactions')
      .update(dbPayload)
      .eq('id', id)
      .eq('company_id', company.id);

    if (error) { setError(error.message); fetch(); return false; }
    return true;
  }, [fetch, transactions, user?.role, company?.id]);

  const deleteTransaction = useCallback(async (id: number) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (!isSupabaseConfigured) return;
    const cid = useAuthStore.getState().company?.id;
    const q = supabase.from('transactions').update({ is_deleted: true }).eq('id', id);
    const { error } = cid ? await q.eq('company_id', cid) : await q;
    if (error) { setError(error.message); fetch(); return; }
  }, [fetch]);

  // ── Approval Workflow Actions ──────────────────
  const submitForApproval = useCallback(async (id: number) => {
    await updateTransaction(id, { status: 'pending' });
  }, [updateTransaction]);

  const approveTransaction = useCallback(async (id: number) => {
    const role = user?.role;
    if (!isAdminRole(role)) {
      setError('Only owners and admins can approve transactions.');
      return;
    }
    await updateTransaction(id, {
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    });
  }, [updateTransaction, user]);

  const rejectTransaction = useCallback(async (id: number) => {
    const role = user?.role;
    if (!isAdminRole(role)) {
      setError('Only owners and admins can reject transactions.');
      return;
    }
    await updateTransaction(id, { status: 'rejected' });
  }, [updateTransaction, user]);

  const markAsPaid = useCallback(async (id: number) => {
    const tx = transactions.find(t => t.id === id);
    if (tx?.type === 'Invoice' && tx.status !== 'approved') {
      setError('Invoice must be approved before marking as paid.');
      return;
    }
    await updateTransaction(id, { status: 'paid' });
  }, [updateTransaction, transactions]);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    submitForApproval,
    approveTransaction,
    rejectTransaction,
    markAsPaid,
    refetch: fetch,
  };
}
