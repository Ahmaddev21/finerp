import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  useMoneyRequisitions,
  type MoneyRequisition as MR,
  type MRStatus,
} from '../hooks/useMoneyRequisitions';
import { useAuthStore } from '../store/auth';
import { isAdminRole } from '../lib/roles';
import { cn } from '../lib/utils';
import {
  Plus, X, Wallet, Loader2, Check, Ban, Search,
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all';

const STATUS_TABS: { key: MRStatus | 'all'; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

function statusCls(s: MRStatus) {
  switch (s) {
    case 'pending':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'accepted': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
}

function statusLabel(s: MRStatus) {
  switch (s) {
    case 'pending':  return 'Pending';
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected';
  }
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Modal shell ─────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" /> {title}
            </h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Create Requisition Modal ────────────────────────────────────────────── */
function CreateModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { date: string; payTo: string; description: string; amount: number; remarks?: string }) => Promise<{ success: boolean; error?: string }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,        setDate]        = useState(today);
  const [payTo,       setPayTo]       = useState('');
  const [description, setDescription] = useState('');
  const [amount,      setAmount]      = useState('');
  const [remarks,     setRemarks]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const canSubmit = date && payTo.trim() && description.trim() && Number(amount) > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const result = await onSubmit({
      date, payTo: payTo.trim(), description: description.trim(),
      amount: Number(amount), remarks: remarks.trim() || undefined,
    });
    setSaving(false);
    if (result.success) onClose();
    else setError(result.error || 'Failed to create requisition');
  };

  return (
    <Modal title="New Money Requisition" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-lg">{error}</div>
        )}
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Pay To</label>
          <input type="text" value={payTo} onChange={e => setPayTo(e.target.value)} placeholder="Recipient name" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Description / Purpose</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this payment for?" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Amount (QAR)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Remarks (optional)</label>
          <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit Requisition
        </button>
      </div>
    </Modal>
  );
}

/* ── Reject Reason Modal ─────────────────────────────────────────────────── */
function RejectModal({ requisition, onClose, onConfirm }: {
  requisition: MR;
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
}) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(note.trim() || undefined);
    setSaving(false);
  };

  return (
    <Modal title="Reject Requisition" onClose={onClose}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        Reject the requisition to <span className="font-semibold">{requisition.payTo}</span> for QR {requisition.amount.toLocaleString()}?
      </p>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Reason (optional)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Why is this being rejected?" className={inputCls} />
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Reject
        </button>
      </div>
    </Modal>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function MoneyRequisition() {
  const { requisitions, loading, error, addRequisition, decideRequisition } = useMoneyRequisitions();
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'owner';
  const canDecide = isAdminRole(user?.role);

  const [statusFilter, setStatusFilter] = useState<MRStatus | 'all'>('all');
  const [search,        setSearch]        = useState('');
  const [showCreate,    setShowCreate]    = useState(false);
  const [rejectTarget,  setRejectTarget]  = useState<MR | null>(null);

  const counts = {
    all:      requisitions.length,
    pending:  requisitions.filter(r => r.status === 'pending').length,
    accepted: requisitions.filter(r => r.status === 'accepted').length,
    rejected: requisitions.filter(r => r.status === 'rejected').length,
  };

  const filtered = requisitions.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.payTo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAccept = async (id: string) => {
    await decideRequisition(id, 'accepted');
  };

  const handleReject = async (note?: string) => {
    if (!rejectTarget) return;
    await decideRequisition(rejectTarget.id, 'rejected', note);
    setRejectTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Money Requisition</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Payment requisition approvals
            {counts.pending > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold rounded-full">
                {counts.pending} pending
              </span>
            )}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> New Requisition
          </button>
        )}
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
                statusFilter === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab.label}
              {counts[tab.key as keyof typeof counts] > 0 && (
                <span className="ml-1 text-[10px] text-slate-400">{counts[tab.key as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pay to, description…"
            className="w-56 pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No requisitions found</p>
            <p className="text-xs mt-1">
              {search ? 'Try a different search term' : isOwner ? 'Create your first requisition to get started' : 'Nothing awaiting approval'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['S/L', 'Date', 'Pay To', 'Description / Purpose', 'Amount (QAR)', 'Status', 'Remarks', ''].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide',
                        i === 0 ? 'text-left w-10' : i === 7 ? 'text-right' : 'text-left'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{r.payTo}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{r.description}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {r.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded', statusCls(r.status))}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[10rem]">
                      <p className="text-xs text-slate-400 truncate">{r.remarks || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status === 'pending' && canDecide && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAccept(r.id)}
                            title="Accept"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRejectTarget(r)}
                            title="Reject"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSubmit={addRequisition} />
      )}

      {rejectTarget && (
        <RejectModal
          requisition={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}
