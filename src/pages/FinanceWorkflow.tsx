import React, { useState, useCallback, useMemo } from 'react';
import {
  useFinanceWorkflow,
  type FinanceWorkflow as FW,
  type FWStatus,
  type FWCategory,
  type CompletionData,
} from '../hooks/useFinanceWorkflow';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';
import {
  Upload, Search, X, FileText, Eye, Loader2,
  ExternalLink, Download, Paperclip, FileUp,
  CheckCircle2, ArrowRight, Trash2, AlertTriangle,
  StickyNote, Pencil, Send,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES: FWCategory[] = ['Invoice', 'Expense', 'Salary', 'Contract', 'Receipt', 'Other'];

// Category → default accounting type mapping
const CATEGORY_TX_TYPE: Record<FWCategory, string> = {
  Invoice:  'Invoice',
  Expense:  'Expense',
  Salary:   'Expense',
  Contract: 'Invoice',
  Receipt:  'Receipt',
  Other:    'Expense',
};

const TX_TYPES = ['Invoice', 'Expense', 'Receipt', 'Petty Cash', 'Salary'];

const STATUS_TABS: { key: FWStatus | 'all' | 'notes'; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
  { key: 'rejected',    label: 'Rejected' },
  { key: 'notes',       label: 'Notes' },
];

// ── Notes helpers ─────────────────────────────────────────────────────────────

interface NoteEntry {
  id: string;
  text: string;
  createdAt: string;
  editedAt?: string;
}

function parseNotes(raw: string | null | undefined): NoteEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Legacy plain-text note — wrap it so it still appears
  if (raw.trim()) return [{ id: 'legacy', text: raw, createdAt: new Date().toISOString() }];
  return [];
}

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function statusCls(s: FWStatus) {
  switch (s) {
    case 'pending':     return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'completed':   return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'rejected':    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
}

function statusLabel(s: FWStatus) {
  switch (s) {
    case 'pending':     return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'completed':   return 'Completed';
    case 'rejected':    return 'Rejected';
  }
}

function categoryCls(c: FWCategory) {
  switch (c) {
    case 'Invoice':  return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'Expense':  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'Salary':   return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'Contract': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'Receipt':  return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
    case 'Other':    return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

// ── Notes View (top-level tab) ────────────────────────────────────────────────

type FlatNote = NoteEntry & {
  workflowId:       string;
  workflowTitle:    string;
  workflowCategory: FWCategory;
};

function NotesView({
  workflows,
  isOwner,
  updateWorkflow,
  onOpenWorkflow,
}: {
  workflows:      FW[];
  isOwner:        boolean;
  updateWorkflow: (id: string, updates: any) => Promise<void>;
  onOpenWorkflow: (wf: FW) => void;
}) {
  const [selectedWfId, setSelectedWfId] = useState(workflows[0]?.id ?? '');
  const [newText,      setNewText]      = useState('');
  const [editId,       setEditId]       = useState<string | null>(null);
  const [editWfId,     setEditWfId]     = useState<string | null>(null);
  const [editText,     setEditText]     = useState('');
  const [saving,       setSaving]       = useState(false);

  const allNotes: FlatNote[] = useMemo(() =>
    workflows.flatMap(wf =>
      parseNotes(wf.notes).map(n => ({
        ...n,
        workflowId:       wf.id,
        workflowTitle:    wf.title,
        workflowCategory: wf.category,
      }))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [workflows]);

  const addNote = async () => {
    if (!newText.trim() || !selectedWfId) return;
    const wf = workflows.find(w => w.id === selectedWfId);
    if (!wf) return;
    setSaving(true);
    const entry: NoteEntry = { id: crypto.randomUUID(), text: newText.trim(), createdAt: new Date().toISOString() };
    await updateWorkflow(selectedWfId, { notes: JSON.stringify([...parseNotes(wf.notes), entry]) });
    setNewText('');
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editId || !editWfId || !editText.trim()) return;
    const wf = workflows.find(w => w.id === editWfId);
    if (!wf) return;
    setSaving(true);
    const updated = parseNotes(wf.notes).map(n =>
      n.id === editId ? { ...n, text: editText.trim(), editedAt: new Date().toISOString() } : n
    );
    await updateWorkflow(editWfId, { notes: JSON.stringify(updated) });
    setEditId(null);
    setEditWfId(null);
    setEditText('');
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Compose — owner only */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" /> New Note
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Attach to Document *
            </label>
            {workflows.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No documents uploaded yet.</p>
            ) : (
              <select
                value={selectedWfId}
                onChange={e => setSelectedWfId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
              >
                {workflows.map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.title} · {wf.category}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              rows={3}
              placeholder="Write your note here…"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all resize-none"
            />
          </div>

          <button
            onClick={addNote}
            disabled={!newText.trim() || !selectedWfId || saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {saving ? 'Submitting…' : 'Submit Note'}
          </button>
        </div>
      )}

      {/* Notes list */}
      {allNotes.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No notes yet</p>
          {isOwner && <p className="text-xs mt-1">Select a document above and write your first note.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            {allNotes.length} note{allNotes.length !== 1 ? 's' : ''}
          </p>
          {allNotes.map(n => {
            const sourceWf = workflows.find(w => w.id === n.workflowId);
            const isEditing = editId === n.id && editWfId === n.workflowId;
            return (
              <div key={`${n.workflowId}-${n.id}`} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                {/* Document tag — clickable to open details */}
                <button
                  type="button"
                  onClick={() => sourceWf && onOpenWorkflow(sourceWf)}
                  className="flex items-center gap-2 group"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-xs">
                    {n.workflowTitle}
                  </span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', categoryCls(n.workflowCategory))}>
                    {n.workflowCategory}
                  </span>
                </button>

                {/* Note body */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving || !editText.trim()}
                        className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditId(null); setEditWfId(null); setEditText(''); }}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{n.text}</p>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-400">{fmtNoteDate(n.createdAt)}</p>
                        {n.editedAt && (
                          <p className="text-[10px] text-slate-400 italic">edited · {fmtNoteDate(n.editedAt)}</p>
                        )}
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => { setEditId(n.id); setEditWfId(n.workflowId); setEditText(n.text); }}
                          className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors shrink-0"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Upload Modal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose:  () => void;
  onSubmit: (data: { title: string; category: FWCategory; description: string; file?: File }) => Promise<void>;
}

function UploadModal({ onClose, onSubmit }: UploadModalProps) {
  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState<FWCategory>('Invoice');
  const [description, setDescription] = useState('');
  const [file,        setFile]        = useState<File | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [dragOver,    setDragOver]    = useState(false);

  const pickFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) { alert('File too large — max 10 MB'); return; }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit({ title: title.trim(), category, description: description.trim(), file: file ?? undefined });
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileUp className="w-5 h-5 text-blue-600" /> Upload Document
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fw-file-input')?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
            )}
          >
            <input
              id="fw-file-input"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText className="w-8 h-8 text-blue-600 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-auto p-1 text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Drop file or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPEG, PNG · Max 10 MB</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Snoonu Invoice – April 2026"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    category === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Context for the admin processing this document…"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {submitting ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Modal ─────────────────────────────────────────────────────────────
// Creates a linked Accounting entry from the workflow document.
// The physical file is NOT re-uploaded — attachment_url references the same
// storage path as the workflow record.

interface CompleteModalProps {
  wf:         FW;
  onClose:    () => void;
  onComplete: (id: string, data: CompletionData) => Promise<{ success: boolean; error?: string }>;
}

function CompleteModal({ wf, onClose, onComplete }: CompleteModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [txType,      setTxType]      = useState(CATEGORY_TX_TYPE[wf.category] ?? 'Expense');
  const [amount,      setAmount]      = useState('');
  const [date,        setDate]        = useState(today);
  const [description, setDescription] = useState(wf.title);
  const [project,     setProject]     = useState('Internal');
  const [clientName,  setClientName]  = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [err,         setErr]         = useState('');

  const showInvoiceFields = txType === 'Invoice';
  const isExpenseType     = txType === 'Expense' || txType === 'Petty Cash' || txType === 'Salary';

  const handleSubmit = async () => {
    const raw = parseFloat(amount);
    if (!amount.trim() || isNaN(raw) || raw === 0) { setErr('Enter a valid amount'); return; }
    setErr('');
    setSubmitting(true);

    // Expenses/salaries/petty cash are stored as negative amounts in accounting
    const finalAmount = isExpenseType ? -Math.abs(raw) : Math.abs(raw);

    const result = await onComplete(wf.id, {
      amount:      finalAmount,
      date,
      description: description.trim() || wf.title,
      project:     project.trim()     || 'Internal',
      type:        txType,
      clientName:  clientName.trim()  || undefined,
      dueDate:     dueDate            || undefined,
    });

    setSubmitting(false);
    if (result.success) {
      onClose();
    } else {
      setErr(result.error ?? 'Failed to create accounting entry. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Process & Complete
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Creates a linked accounting entry. The uploaded document will be<br />
              referenced directly — no re-upload.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors ml-3 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source document info */}
        <div className="mx-5 mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded shrink-0', categoryCls(wf.category))}>{wf.category}</span>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{wf.title}</p>
          </div>
          {wf.fileName && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> {wf.fileName}
              <span className="ml-1 text-emerald-500 font-medium">· file will be shared, not duplicated</span>
            </p>
          )}
        </div>

        {/* Form */}
        <div className="p-5 space-y-3">
          {err && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400">
              {err}
            </div>
          )}

          {/* Accounting type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Accounting Type</label>
            <select
              value={txType}
              onChange={e => setTxType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            >
              {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Amount + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Amount (QR) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Project</label>
            <input
              type="text"
              value={project}
              onChange={e => setProject(e.target.value)}
              placeholder="Internal"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Invoice-specific fields */}
          {showInvoiceFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Client</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Client name"
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount.trim() || submitting}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? 'Processing…' : 'Confirm & Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
// Owner-only. Shows relational impact (linked entries, file lifecycle) before
// allowing permanent deletion. Requires explicit checkbox confirmation.

interface DeleteConfirmModalProps {
  wf:        FW;
  onClose:   () => void;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
}

function DeleteConfirmModal({ wf, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [err,       setErr]       = useState('');

  const hasLinkedEntry = !!wf.destinationId;
  // Predict file fate: if completed with a linked entry, the transaction holds
  // the same file path → storage object will be preserved.
  const fileWillBePreserved = hasLinkedEntry && !!wf.filePath;
  const fileWillBeDeleted   = !!wf.filePath && !fileWillBePreserved;

  const handleConfirm = async () => {
    setDeleting(true);
    setErr('');
    const result = await onConfirm();
    if (!result.success) {
      setErr(result.error ?? 'Deletion failed. Please try again.');
      setDeleting(false);
    }
    // On success the parent unmounts this modal via setSelected(null)
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !deleting && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-red-100 dark:border-red-900/30 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Workflow</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Owner-only action · permanent · cannot be undone
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {/* What's being deleted */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded shrink-0', categoryCls(wf.category))}>
                {wf.category}
              </span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{wf.title}</p>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">{wf.id}</p>
          </div>

          {/* Warning: linked accounting entry */}
          {hasLinkedEntry && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Linked Accounting Entry Will Be Preserved
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                This workflow was processed into a{' '}
                <strong>{wf.destinationType}</strong> entry (#{wf.destinationId}).{' '}
                <strong>That record stays in Accounting</strong> — only the
                workflow reference linking back to it will be removed.
              </p>
            </div>
          )}

          {/* File lifecycle */}
          {wf.filePath && (
            <div className={cn(
              'p-3 rounded-xl border',
              fileWillBePreserved
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60'
            )}>
              <p className={cn(
                'text-xs font-bold flex items-center gap-1.5 mb-1',
                fileWillBePreserved
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-blue-700 dark:text-blue-400'
              )}>
                <FileText className="w-3.5 h-3.5" />
                {fileWillBePreserved ? 'Document Will Be Preserved' : 'Document Will Be Deleted'}
              </p>
              <p className={cn(
                'text-xs leading-relaxed',
                fileWillBePreserved
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-blue-600 dark:text-blue-300'
              )}>
                {fileWillBePreserved
                  ? 'The uploaded file is still referenced by the linked accounting entry and will remain in storage.'
                  : 'No other records reference this file. It will be permanently removed from storage.'}
              </p>
            </div>
          )}

          {/* Error */}
          {err && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400">
              {err}
            </div>
          )}

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-red-600"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed select-none">
              I understand this permanently deletes the workflow record.
              {hasLinkedEntry && ' The linked accounting entry will be preserved.'}
              {fileWillBeDeleted && ' The uploaded document will be removed from storage.'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmed || deleting}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Details Modal ──────────────────────────────────────────────────────────────

interface DetailsModalProps {
  wf:              FW;
  onClose:         () => void;
  onUpdate:        (id: string, updates: Partial<Pick<FW, 'status' | 'notes' | 'assignedTo' | 'transactionRef'>>) => Promise<void>;
  onComplete:      (id: string, data: CompletionData) => Promise<{ success: boolean; error?: string }>;
  onRequestDelete: (id: string) => void;  // triggers DeleteConfirmModal at page level
  getSignedUrl:    (path: string) => Promise<string | null>;
  isOwner:         boolean;               // only owners see the delete option
}

function DetailsModal({ wf, onClose, onUpdate, onComplete, onRequestDelete, getSignedUrl, isOwner }: DetailsModalProps) {
  const [signedUrl,    setSignedUrl]    = useState<string | null>(null);
  const [loadingUrl,   setLoadingUrl]   = useState(false);
  const [txnRef,       setTxnRef]       = useState(wf.transactionRef ?? '');
  const [saving,       setSaving]       = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  React.useEffect(() => {
    if (!wf.filePath) return;
    setLoadingUrl(true);
    getSignedUrl(wf.filePath).then(url => {
      setSignedUrl(url);
      setLoadingUrl(false);
    });
  }, [wf.filePath, getSignedUrl]);

  const isPdf = wf.fileName?.toLowerCase().endsWith('.pdf') ?? false;

  const handleSaveRef = async () => {
    setSaving(true);
    await onUpdate(wf.id, { transactionRef: txnRef || null });
    setSaving(false);
  };

  const isResolved = wf.status === 'completed' || wf.status === 'rejected';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && !showComplete && onClose()}
      >
        <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded', categoryCls(wf.category))}>{wf.category}</span>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded', statusCls(wf.status))}>{statusLabel(wf.status)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{wf.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{wf.id} · {new Date(wf.createdAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors ml-4 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left: document viewer */}
            <div className="flex-1 border-r border-slate-100 dark:border-slate-800 flex flex-col min-w-0">
              {!wf.filePath ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Paperclip className="w-12 h-12 opacity-40" />
                  <p className="text-sm">No document attached</p>
                </div>
              ) : loadingUrl ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : signedUrl ? (
                <>
                  <div className="flex-1 overflow-hidden">
                    {isPdf ? (
                      <iframe src={signedUrl} className="w-full h-full border-0" title={wf.fileName ?? 'document'} />
                    ) : (
                      <img src={signedUrl} alt={wf.fileName ?? ''} className="w-full h-full object-contain p-4" />
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-4 shrink-0">
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                    </a>
                    <a href={signedUrl} download={wf.fileName ?? 'document'} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <FileText className="w-12 h-12 opacity-40" />
                  <p className="text-sm">Unable to load preview</p>
                </div>
              )}
            </div>

            {/* Right: workflow controls */}
            <div className="w-72 shrink-0 flex flex-col overflow-y-auto p-4 gap-4">

              {/* ── Completed: show linked accounting entry info ── */}
              {wf.status === 'completed' && wf.destinationId ? (
                <div className="border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Linked Accounting Entry
                  </p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-emerald-500 shrink-0 w-12">Type</dt>
                      <dd className="text-emerald-700 dark:text-emerald-300 font-semibold">{wf.destinationType}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-emerald-500 shrink-0 w-12">Entry</dt>
                      <dd className="text-emerald-700 dark:text-emerald-300 font-mono">#{wf.destinationId}</dd>
                    </div>
                    {wf.transactionRef && (
                      <div className="flex gap-2">
                        <dt className="text-emerald-500 shrink-0 w-12">Ref</dt>
                        <dd className="text-emerald-700 dark:text-emerald-300 font-mono">{wf.transactionRef}</dd>
                      </div>
                    )}
                    {wf.resolvedAt && (
                      <div className="flex gap-2">
                        <dt className="text-emerald-500 shrink-0 w-12">At</dt>
                        <dd className="text-emerald-700 dark:text-emerald-300">{new Date(wf.resolvedAt).toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-[10px] text-emerald-500/70 mt-2">
                    Document file is shared — not duplicated in storage.
                  </p>
                </div>
              ) : null}

              {/* ── Rejected ── */}
              {wf.status === 'rejected' && (
                <div className="border border-red-200 dark:border-red-900/50 rounded-xl p-3 bg-red-50 dark:bg-red-950/20">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">Rejected</p>
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {wf.resolvedAt ? `On ${new Date(wf.resolvedAt).toLocaleDateString()}` : 'This workflow was rejected.'}
                  </p>
                  {isOwner && (
                    <button
                      onClick={() => onUpdate(wf.id, { status: 'pending' })}
                      className="mt-2 w-full py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              )}

              {/* ── Active status controls (pending / in_progress only) ── */}
              {(wf.status === 'pending' || wf.status === 'in_progress') && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Status</p>
                  <div className="space-y-1.5">
                    {(['pending', 'in_progress'] as const).map(s => (
                      <button
                        key={s}
                        disabled={wf.status === s}
                        onClick={() => onUpdate(wf.id, { status: s })}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-colors',
                          wf.status === s
                            ? cn(statusCls(s), 'border-current cursor-default')
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                        )}
                      >
                        {wf.status === s && '✓ '}{statusLabel(s)}
                      </button>
                    ))}
                    <button
                      onClick={() => onUpdate(wf.id, { status: 'rejected' })}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-colors bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700"
                    >
                      Reject
                    </button>
                  </div>

                  {/* Process & Complete — creates linked accounting entry */}
                  <button
                    onClick={() => setShowComplete(true)}
                    className="mt-3 w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Process &amp; Complete
                    <ArrowRight className="w-3 h-3 ml-auto" />
                  </button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center">
                    Creates accounting entry · no file re-upload
                  </p>
                </div>
              )}

              {/* Description */}
              {wf.description && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{wf.description}</p>
                </div>
              )}

              {/* Manual transaction ref (only if not yet auto-linked) */}
              {!wf.destinationId && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Manual Reference</p>
                  <input
                    type="text"
                    value={txnRef}
                    onChange={e => setTxnRef(e.target.value)}
                    placeholder="e.g. TXN-12345"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                  <button
                    onClick={handleSaveRef}
                    disabled={saving}
                    className="mt-1.5 w-full py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? 'Saving…' : 'Save Reference'}
                  </button>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Info</p>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-slate-400 shrink-0 w-16">ID</dt>
                    <dd className="text-slate-700 dark:text-slate-300 font-mono truncate">{wf.id}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate-400 shrink-0 w-16">Created</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{new Date(wf.createdAt).toLocaleString()}</dd>
                  </div>
                  {wf.fileName && (
                    <div className="flex gap-2">
                      <dt className="text-slate-400 shrink-0 w-16">File</dt>
                      <dd className="text-slate-700 dark:text-slate-300 truncate" title={wf.fileName}>{wf.fileName}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Delete — owner ONLY, all statuses allowed, triggers confirm modal */}
              {isOwner && (
                <button
                  onClick={() => onRequestDelete(wf.id)}
                  className="w-full py-2 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Workflow
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion sub-modal — z-60 stacks above z-50 details modal */}
      {showComplete && (
        <CompleteModal
          wf={wf}
          onClose={() => setShowComplete(false)}
          onComplete={onComplete}
        />
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FinanceWorkflow() {
  const { workflows, loading, error, addWorkflow, updateWorkflow, completeWorkflow, deleteWorkflow, getSignedUrl } =
    useFinanceWorkflow();
  const user    = useAuthStore(s => s.user);
  const isOwner = user?.role === 'owner';

  const [statusFilter, setStatusFilter] = useState<FWStatus | 'all' | 'notes'>('all');
  const [search,       setSearch]       = useState('');
  const [showUpload,    setShowUpload]    = useState(false);
  const [selected,      setSelected]      = useState<FW | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<FW | null>(null);

  const counts = {
    all:         workflows.length,
    pending:     workflows.filter(w => w.status === 'pending').length,
    in_progress: workflows.filter(w => w.status === 'in_progress').length,
    completed:   workflows.filter(w => w.status === 'completed').length,
    rejected:    workflows.filter(w => w.status === 'rejected').length,
  };

  const filtered = workflows.filter(w => {
    if (statusFilter === 'notes') return false; // handled by NotesView
    if (statusFilter !== 'all' && w.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        w.title.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleUpdate = useCallback(async (
    id:      string,
    updates: Partial<Pick<FW, 'status' | 'notes' | 'assignedTo' | 'transactionRef'>>
  ) => {
    await updateWorkflow(id, updates);
    // Sync the selected workflow view without waiting for a full refetch
    setSelected(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  }, [updateWorkflow]);

  // Opens the DeleteConfirmModal (renders at page level above DetailsModal)
  const handleRequestDelete = useCallback((id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (wf) setDeleteTarget(wf);
  }, [workflows]);

  // Called by DeleteConfirmModal on confirmation
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return { success: false as const };
    const result = await deleteWorkflow(deleteTarget.id);
    if (result.success) {
      setDeleteTarget(null);
      setSelected(null);
    }
    return result;
  }, [deleteTarget, deleteWorkflow]);

  const handleComplete = useCallback(async (id: string, data: CompletionData) => {
    const result = await completeWorkflow(id, data);
    if (result.success) {
      // Sync selected so DetailsModal immediately shows the linked entry info
      setSelected(prev => prev?.id === id ? {
        ...prev,
        status:          'completed',
        destinationType: data.type,
        destinationId:   result.destinationId ?? null,
        resolvedAt:      new Date().toISOString(),
      } : prev);
    }
    return result;
  }, [completeWorkflow]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Finance Workflow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Secure document transfer for accounting processing
            {counts.pending > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold rounded-full">
                {counts.pending} pending
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shrink-0"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1',
                tab.key === 'notes' && statusFilter === 'notes'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : tab.key === 'notes'
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  : statusFilter === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab.key === 'notes' && <StickyNote className="w-3 h-3" />}
              {tab.label}
              {tab.key !== 'notes' && counts[tab.key as keyof typeof counts] > 0 && (
                <span className="ml-1 text-[10px] text-slate-400">
                  {counts[tab.key as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {statusFilter !== 'notes' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, category…"
              className="w-56 pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        )}
      </div>

      {/* Notes tab — full-page view */}
      {statusFilter === 'notes' && (
        <NotesView
          workflows={workflows}
          isOwner={isOwner}
          updateWorkflow={updateWorkflow}
          onOpenWorkflow={wf => setSelected(wf)}
        />
      )}

      {/* Table — hidden when Notes tab is active */}
      {statusFilter !== 'notes' && <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No documents found</p>
            <p className="text-xs mt-1">
              {search ? 'Try a different search term' : 'Upload your first document to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['#', 'Document', 'Category', 'Status', 'Linked Entry', 'Date', ''].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide',
                        i === 0 ? 'text-left w-8' : i === 6 ? 'text-right w-16' : 'text-left'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((wf, i) => (
                  <tr
                    key={wf.id}
                    onClick={() => setSelected(wf)}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{wf.title}</p>
                      {wf.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{wf.description}</p>
                      )}
                      {parseNotes(wf.notes).length > 0 && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          <StickyNote className="w-2.5 h-2.5" />
                          {parseNotes(wf.notes).length} note{parseNotes(wf.notes).length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded', categoryCls(wf.category))}>
                        {wf.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded', statusCls(wf.status))}>
                        {statusLabel(wf.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {wf.destinationId ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono truncate max-w-[90px]">
                            {wf.transactionRef ?? `#${wf.destinationId}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(wf.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(wf)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Modals */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSubmit={addWorkflow}
        />
      )}
      {selected && (
        <DetailsModal
          wf={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onComplete={handleComplete}
          onRequestDelete={handleRequestDelete}
          getSignedUrl={getSignedUrl}
          isOwner={isOwner}
        />
      )}

      {/* DeleteConfirmModal renders above DetailsModal (z-[60]) — owner only */}
      {deleteTarget && isOwner && (
        <DeleteConfirmModal
          wf={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
