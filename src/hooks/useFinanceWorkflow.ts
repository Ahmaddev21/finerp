import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';

export type FWStatus   = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type FWCategory = 'Invoice' | 'Expense' | 'Salary' | 'Contract' | 'Receipt' | 'Other';

export interface FinanceWorkflow {
  id:              string;
  companyId:       string;
  title:           string;
  category:        FWCategory;
  description:     string | null;
  status:          FWStatus;
  filePath:        string | null;    // storage object path (single source — never duplicated)
  fileName:        string | null;
  fileSize:        number | null;
  uploadedBy:      string | null;
  assignedTo:      string | null;
  notes:           string | null;
  transactionRef:  string | null;    // human-readable ref (e.g. INV-260512-001)
  // ── Completion linkage ───────────────────────────────────────────────────────
  destinationType: string | null;    // 'Invoice' | 'Expense' | etc.
  destinationId:   string | null;    // PK of the record created in the target module
  completedBy:     string | null;    // uuid of the admin/owner who processed it
  resolvedAt:      string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface CompletionData {
  amount:      number;
  date:        string;
  description: string;
  project:     string;
  type:        string;
  clientName?: string;
  dueDate?:    string;
}

function mapRow(row: any): FinanceWorkflow {
  return {
    id:              row.id,
    companyId:       row.company_id,
    title:           row.title            ?? '',
    category:        (row.category        ?? 'Other') as FWCategory,
    description:     row.description      ?? null,
    status:          (row.status          ?? 'pending') as FWStatus,
    filePath:        row.file_path        ?? null,
    fileName:        row.file_name        ?? null,
    fileSize:        row.file_size        ?? null,
    uploadedBy:      row.uploaded_by      ?? null,
    assignedTo:      row.assigned_to      ?? null,
    notes:           row.notes            ?? null,
    transactionRef:  row.transaction_ref  ?? null,
    destinationType: row.destination_type ?? null,
    destinationId:   row.destination_id   ?? null,
    completedBy:     row.completed_by     ?? null,
    resolvedAt:      row.resolved_at      ?? null,
    createdAt:       row.created_at       ?? '',
    updatedAt:       row.updated_at       ?? '',
  };
}

function makeInvoiceNumber(date: string): string {
  const d   = new Date(date || Date.now());
  const yy  = String(d.getFullYear()).slice(-2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-${yy}${mm}${dd}-${seq}`;
}

export function useFinanceWorkflow() {
  const { company, isInitialized } = useAuthStore();
  const user = useAuthStore(s => s.user);

  const [workflows, setWorkflows] = useState<FinanceWorkflow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('finance_workflows')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setWorkflows((data ?? []).map(mapRow));
  }, [company?.id]);

  useEffect(() => {
    if (isInitialized && company?.id) fetch();
  }, [fetch, isInitialized, company?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const name = `fw-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'finance_workflows', filter: `company_id=eq.${company.id}` },
        () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id, fetch]);

  // ── Storage helpers ─────────────────────────────────────────────────────────

  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase.storage
      .from('finance_attachments')
      .createSignedUrl(filePath, 3600);
    if (err) { setError(err.message); return null; }
    return data?.signedUrl ?? null;
  }, []);

  const uploadFile = useCallback(async (file: File, workflowId: string): Promise<string | null> => {
    if (!isSupabaseConfigured || !company?.id) return null;
    const ext  = file.name.split('.').pop() ?? 'pdf';
    const path = `${company.id}/finance-workflows/${workflowId}/${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage
      .from('finance_attachments')
      .upload(path, file, { upsert: true });
    if (err) { setError(err.message); return null; }
    return path;
  }, [company?.id]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const addWorkflow = useCallback(async (w: {
    title:        string;
    category:     FWCategory;
    description?: string;
    file?:        File;
  }) => {
    const newId = `FWF-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const optimistic: FinanceWorkflow = {
      id:              newId,
      companyId:       company?.id ?? '',
      title:           w.title,
      category:        w.category,
      description:     w.description ?? null,
      status:          'pending',
      filePath:        null,
      fileName:        w.file?.name ?? null,
      fileSize:        w.file?.size ?? null,
      uploadedBy:      user?.id ?? null,
      assignedTo:      null,
      notes:           null,
      transactionRef:  null,
      destinationType: null,
      destinationId:   null,
      completedBy:     null,
      resolvedAt:      null,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };
    setWorkflows(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;

    let filePath: string | null = null;
    if (w.file) {
      filePath = await uploadFile(w.file, newId);
      if (!filePath) {
        setWorkflows(prev => prev.filter(x => x.id !== newId));
        return;
      }
      setWorkflows(prev => prev.map(x => x.id === newId ? { ...x, filePath } : x));
    }

    const { error: err } = await supabase.from('finance_workflows').insert({
      id:          newId,
      company_id:  company?.id,
      title:       w.title,
      category:    w.category,
      description: w.description || null,
      status:      'pending',
      file_path:   filePath,
      file_name:   w.file?.name ?? null,
      file_size:   w.file?.size ?? null,
      uploaded_by: user?.id ?? null,
    });

    if (err) {
      setError(err.message);
      if (filePath) void supabase.storage.from('finance_attachments').remove([filePath]);
      setWorkflows(prev => prev.filter(x => x.id !== newId));
      return;
    }

    void writeAuditLog('CREATE', 'finance_workflows', newId, `${w.category}: ${w.title}`);
  }, [company?.id, user?.id, uploadFile]);

  const updateWorkflow = useCallback(async (
    id:      string,
    updates: Partial<Pick<FinanceWorkflow, 'status' | 'notes' | 'assignedTo' | 'transactionRef'>>
  ) => {
    const resolvedAt = (updates.status === 'rejected')
      ? new Date().toISOString()
      : undefined;

    setWorkflows(prev => prev.map(w =>
      w.id === id ? { ...w, ...updates, ...(resolvedAt ? { resolvedAt } : {}) } : w
    ));

    if (!isSupabaseConfigured) return;

    const db: Record<string, any> = {};
    if ('status'         in updates) { db.status = updates.status; if (resolvedAt) db.resolved_at = resolvedAt; }
    if ('notes'          in updates) db.notes           = updates.notes          ?? null;
    if ('assignedTo'     in updates) db.assigned_to     = updates.assignedTo     ?? null;
    if ('transactionRef' in updates) db.transaction_ref = updates.transactionRef ?? null;

    const { error: err } = await supabase.from('finance_workflows').update(db).eq('id', id);
    if (err) { setError(err.message); fetch(); return; }
    void writeAuditLog('UPDATE', 'finance_workflows', id, `Updated: ${Object.keys(updates).join(', ')}`);
  }, [fetch]);

  // ── Completion — relational transfer, no file duplication ───────────────────
  //
  // Strategy:
  //   1. Insert a new Accounting transaction referencing the SAME storage path
  //      via attachment_url. The file is never re-uploaded.
  //   2. Update the workflow with destination_type, destination_id, completed_by.
  //      The workflow record stays as a permanent historical reference.
  //   3. If the transaction insert succeeds but the workflow update fails, roll
  //      back by deleting the transaction to keep both sides consistent.

  const completeWorkflow = useCallback(async (
    workflowId: string,
    data:        CompletionData
  ): Promise<{ success: boolean; destinationId?: string; error?: string }> => {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) return { success: false, error: 'Workflow not found' };

    const invoiceNumber = data.type === 'Invoice' ? makeInvoiceNumber(data.date) : undefined;
    const resolvedAt    = new Date().toISOString();

    // ── Demo mode ────────────────────────────────────────────────────────────
    if (!isSupabaseConfigured) {
      const demoDestId = `DEMO-${Date.now()}`;
      setWorkflows(prev => prev.map(w => w.id === workflowId ? {
        ...w,
        status:          'completed',
        destinationType: data.type,
        destinationId:   demoDestId,
        transactionRef:  invoiceNumber ?? demoDestId,
        completedBy:     user?.id ?? null,
        resolvedAt,
      } : w));
      return { success: true, destinationId: demoDestId };
    }

    // ── Step 1: insert Accounting transaction (references same filePath) ─────
    const { data: txData, error: txErr } = await supabase
      .from('transactions')
      .insert({
        date:           data.date,
        type:           data.type,
        description:    data.description,
        project:        data.project || 'Internal',
        amount:         data.amount,
        status:         'approved',           // owner/admin bypass: auto-approved
        invoice_number: invoiceNumber ?? null,
        client_name:    data.clientName ?? null,
        due_date:       data.dueDate    ?? null,
        created_by:     user?.id        ?? null,
        company_id:     company?.id,
        attachment_url: wf.filePath     ?? null,  // ← same storage path, no re-upload
        workflow_ref:   workflowId,               // ← back-link to workflow
      })
      .select('id')
      .single();

    if (txErr) {
      setError(txErr.message);
      return { success: false, error: txErr.message };
    }

    const destId = String(txData.id);

    // ── Step 2: update workflow with destination metadata ────────────────────
    const { error: wfErr } = await supabase.from('finance_workflows').update({
      status:           'completed',
      destination_type: data.type,
      destination_id:   destId,
      transaction_ref:  invoiceNumber ?? destId,
      completed_by:     user?.id      ?? null,
      resolved_at:      resolvedAt,
    }).eq('id', workflowId);

    if (wfErr) {
      // Roll back the transaction to keep both sides consistent
      void supabase.from('transactions').delete().eq('id', txData.id);
      setError(wfErr.message);
      return { success: false, error: wfErr.message };
    }

    // ── Step 3: update optimistic state ─────────────────────────────────────
    setWorkflows(prev => prev.map(w => w.id === workflowId ? {
      ...w,
      status:          'completed',
      destinationType: data.type,
      destinationId:   destId,
      transactionRef:  invoiceNumber ?? destId,
      completedBy:     user?.id ?? null,
      resolvedAt,
    } : w));

    void writeAuditLog('UPDATE', 'finance_workflows', workflowId,
      `Completed → ${data.type} entry #${destId}${invoiceNumber ? ` (${invoiceNumber})` : ''}`);
    void writeAuditLog('CREATE', 'transactions', destId,
      `Linked from workflow ${workflowId} — file ref preserved, no re-upload`);

    return { success: true, destinationId: destId };
  }, [workflows, user, company?.id]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  //
  // Security layers:
  //   1. Client role guard — rejects non-owners immediately
  //   2. RPC `owner_delete_finance_workflow` — server validates role, then
  //      atomically: nullifies workflow_ref in linked transactions (preserving
  //      accounting records) and deletes the workflow row
  //   3. Storage cleanup — only if the RPC confirms no other table references
  //      the same file path (file_safe_to_delete = true)
  //   4. Optimistic state update — only on confirmed success (no premature removal)

  const deleteWorkflow = useCallback(async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Layer 1: client-side role guard
    if (user?.role !== 'owner') {
      return { success: false, error: 'Only owners can delete workflow records.' };
    }

    const wf = workflows.find(w => w.id === id);
    if (!wf) return { success: false, error: 'Workflow not found.' };

    // Demo mode — no DB calls
    if (!isSupabaseConfigured) {
      setWorkflows(prev => prev.filter(w => w.id !== id));
      void writeAuditLog('DELETE', 'finance_workflows', id,
        `Workflow "${wf.title}" deleted (demo mode).`);
      return { success: true };
    }

    if (!company?.id) return { success: false, error: 'No company context.' };

    // Layer 2: server-side RPC — validates owner role, nullifies refs, deletes
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('owner_delete_finance_workflow', {
        p_workflow_id: id,
        p_company_id:  company.id,
      });

    if (rpcErr) {
      const msg = rpcErr.message.includes('UNAUTHORIZED')
        ? 'Only owners can delete workflow records.'
        : rpcErr.message.includes('NOT_FOUND')
        ? 'Workflow not found or access denied.'
        : rpcErr.message;
      setError(msg);
      return { success: false, error: msg };
    }

    const result = rpcResult as {
      deleted:             boolean;
      file_path:           string | null;
      file_safe_to_delete: boolean;
      linked_entry_id:     string | null;
      linked_entry_type:   string | null;
      refs_cleared:        number;
    };

    // Layer 3: safe storage cleanup — only when RPC confirms no other references
    if (result.file_safe_to_delete && result.file_path) {
      void supabase.storage.from('finance_attachments').remove([result.file_path]);
    }

    // Layer 4: update local state only after confirmed deletion
    setWorkflows(prev => prev.filter(w => w.id !== id));

    void writeAuditLog('DELETE', 'finance_workflows', id,
      `Workflow "${wf.title}" deleted by owner.` +
      (result.linked_entry_id
        ? ` Linked ${result.linked_entry_type ?? ''} entry #${result.linked_entry_id} preserved.`
        : '') +
      (result.file_path
        ? result.file_safe_to_delete
          ? ' Document removed from storage.'
          : ' Document preserved (still referenced by accounting).'
        : ' No document attached.'));

    return { success: true };
  }, [workflows, user, company?.id]);

  return {
    workflows,
    loading,
    error,
    addWorkflow,
    updateWorkflow,
    completeWorkflow,
    deleteWorkflow,
    getSignedUrl,
    refetch: fetch,
  };
}
