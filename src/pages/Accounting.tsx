import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Plus, X, Loader2,
  Pencil, Trash2, BadgeCheck, Send, FileText, Ban, FileSpreadsheet,
  Paperclip, Eye, ReceiptText, Clock, Wallet, ScanSearch, FileDown,
  CheckCircle2, AlertTriangle, ArrowRightLeft, Check,
} from 'lucide-react';
import { useTransactions, Transaction } from '../hooks/useTransactions';
import { RowMenu } from '../components/RowMenu';
import { exportTransactionsCSV, exportTransactionsPDF } from '../utils/exportUtils';
import DocumentAttachmentModal from '../components/DocumentAttachmentModal';
import DocumentViewerModal from '../components/DocumentViewerModal';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { canAccessAccounting, isAdminRole } from '../lib/roles';

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'date' | 'type' | 'amount' | 'status' | 'client' | 'due_date';
type SortDir = 'asc' | 'desc';
type TabID = 'activity' | 'invoices' | 'expenses' | 'recon' | 'aging' | 'pettycash' | 'approvals';
const TYPES = ['Invoice', 'Expense', 'Receipt', 'Petty Cash'] as const;
type TxType = typeof TYPES[number];

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all';
const labelCls = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 inline ml-1 text-slate-300 dark:text-slate-600" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-1 text-blue-500" />
    : <ChevronDown className="w-3 h-3 inline ml-1 text-blue-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const b = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider';
  const map: Record<string, string> = {
    draft:    cn(b, 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'),
    pending:  cn(b, 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'),
    approved: cn(b, 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'),
    paid:     cn(b, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'),
    rejected: cn(b, 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'),
  };
  return <span className={map[status] ?? map.draft}>{status || 'draft'}</span>;
}

function isOverdue(tx: Transaction) {
  return tx?.type === 'Invoice' && tx?.due_date &&
    new Date(tx.due_date) < new Date() &&
    tx?.status !== 'paid' && tx?.status !== 'cancelled' && tx?.status !== 'rejected';
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: TabID; label: string; icon: any }[] = [
  { id: 'activity',  label: 'All Activity', icon: Eye },
  { id: 'invoices',  label: 'Invoices',     icon: FileText },
  { id: 'expenses',  label: 'Expenses',     icon: ReceiptText },
  { id: 'pettycash', label: 'Petty Cash',   icon: Wallet },
  { id: 'approvals', label: 'Approvals',    icon: ScanSearch },
  { id: 'aging',     label: 'AR Aging',     icon: Clock },
  { id: 'recon',     label: 'Bank Recon',   icon: ArrowRightLeft },
];

// ─── Column definitions per tab ───────────────────────────────────────────────
type ColDef = { key: string; label: string; align?: 'left' | 'right' | 'center'; sortable?: SortKey };

const COLS: Record<Exclude<TabID, 'pettycash'>, ColDef[]> = {
  activity: [
    { key: 'date',    label: 'Date',        sortable: 'date' },
    { key: 'type',    label: 'Type',        sortable: 'type' },
    { key: 'desc',    label: 'Description / Project' },
    { key: 'amount',  label: 'Amount',      align: 'right', sortable: 'amount' },
    { key: 'status',  label: 'Status',      align: 'center', sortable: 'status' },
    { key: 'actions', label: '' },
  ],
  invoices: [
    { key: 'date',       label: 'Date',       sortable: 'date' },
    { key: 'invoice_no', label: 'Invoice #' },
    { key: 'client',     label: 'Client',     sortable: 'client' },
    { key: 'desc',       label: 'Description' },
    { key: 'due_date',   label: 'Due Date',   sortable: 'due_date' },
    { key: 'amount',     label: 'Amount',     align: 'right', sortable: 'amount' },
    { key: 'status',     label: 'Status',     align: 'center', sortable: 'status' },
    { key: 'actions',    label: '' },
  ],
  expenses: [
    { key: 'date',    label: 'Date',              sortable: 'date' },
    { key: 'desc',    label: 'Description' },
    { key: 'project', label: 'Category / Project' },
    { key: 'amount',  label: 'Amount',            align: 'right', sortable: 'amount' },
    { key: 'status',  label: 'Status',            align: 'center', sortable: 'status' },
    { key: 'actions', label: '' },
  ],
  approvals: [
    { key: 'date',    label: 'Date',        sortable: 'date' },
    { key: 'type',    label: 'Type' },
    { key: 'desc',    label: 'Description / Project' },
    { key: 'amount',  label: 'Amount',      align: 'right' },
    { key: 'status',  label: 'Status',      align: 'center' },
    { key: 'actions', label: '' },
  ],
  aging: [
    { key: 'invoice_no', label: 'Invoice #' },
    { key: 'client',     label: 'Client',      sortable: 'client' },
    { key: 'date',       label: 'Issued',      sortable: 'date' },
    { key: 'due_date',   label: 'Due Date',    sortable: 'due_date' },
    { key: 'amount',     label: 'Amount',      align: 'right' },
    { key: 'age',        label: 'Age (days)',  align: 'right' },
    { key: 'status',     label: 'Status',      align: 'center' },
    { key: 'actions',    label: '' },
  ],
  recon: [
    { key: 'date',       label: 'Date',        sortable: 'date' },
    { key: 'desc',       label: 'Description' },
    { key: 'type',       label: 'Type' },
    { key: 'amount',     label: 'Amount',      align: 'right' },
    { key: 'reconciled', label: 'Reconciled',  align: 'center' },
    { key: 'actions',    label: '' },
  ],
};

// ─── Petty Cash — Excel-style Cash Book ─────────────────────────────────────
function PettyCashLedger({
  entries,
  getActions,
}: {
  entries: Transaction[];
  getActions: (tx: Transaction) => any[];
}) {
  // Always sort oldest → newest for correct running balance
  const sorted = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let runningBal = 0;
  const rows = sorted.map((tx, i) => {
    const amt     = Number(tx.amount) || 0;
    const cashIn  = amt > 0 ? amt : 0;
    const cashOut = amt < 0 ? Math.abs(amt) : 0;
    runningBal += amt;
    return { tx, sl: i + 1, cashIn, cashOut, balance: runningBal };
  });

  const totalIn  = rows.reduce((s, r) => s + r.cashIn, 0);
  const totalOut = rows.reduce((s, r) => s + r.cashOut, 0);
  const net      = totalIn - totalOut;

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (rows.length === 0) {
    return (
      <div className="px-4 py-14 text-center text-slate-400 text-sm">
        No petty cash entries yet.{' '}
        <span className="text-blue-500 font-semibold">
          Click "New Transaction" → select Petty Cash to add one.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">S.L.</th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Description</th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-600 text-right">Cash In (QR)</th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-600 text-right">Cash Out (QR)</th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 text-right">Balance (QR)</th>
            <th className="w-10 px-3 py-3"></th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {rows.map(({ tx, sl, cashIn, cashOut, balance }) => (
            <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
              <td className="px-3 py-3 text-center">
                <span className="text-xs font-mono text-slate-400">{sl}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-500">{tx.date}</span>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">{tx.desc}</p>
                {tx.project && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{tx.project}</p>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {cashIn > 0
                  ? <span className="font-black text-emerald-600 dark:text-emerald-400">{fmt(cashIn)}</span>
                  : <span className="text-slate-300 dark:text-slate-700">—</span>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {cashOut > 0
                  ? <span className="font-black text-rose-600 dark:text-rose-400">{fmt(cashOut)}</span>
                  : <span className="text-slate-300 dark:text-slate-700">—</span>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={cn('font-black text-sm', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-600')}>
                  {balance < 0 && '('}
                  {fmt(Math.abs(balance))}
                  {balance < 0 && ')'}
                </span>
              </td>
              <td className="w-10 px-3 py-3">
                <RowMenu actions={getActions(tx)} />
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80">
          <tr>
            <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
              Totals
            </td>
            <td className="px-4 py-3 text-right">
              <span className="font-black text-emerald-700 dark:text-emerald-400">{fmt(totalIn)}</span>
            </td>
            <td className="px-4 py-3 text-right">
              <span className="font-black text-rose-600 dark:text-rose-400">{fmt(totalOut)}</span>
            </td>
            <td className="px-4 py-3 text-right">
              <span className={cn('font-black text-base', net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-600')}>
                {net < 0 && '('}
                {fmt(Math.abs(net))}
                {net < 0 && ')'}
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── AR Aging band helper ─────────────────────────────────────────────────────
function ageBand(days: number) {
  if (days <= 0)  return 'bg-slate-100 text-slate-600';
  if (days <= 30) return 'bg-amber-100 text-amber-700';
  if (days <= 60) return 'bg-orange-100 text-orange-700';
  if (days <= 90) return 'bg-rose-100 text-rose-700';
  return 'bg-red-200 text-red-800 font-black';
}

// ─── Add/Edit forms ───────────────────────────────────────────────────────────
const emptyForm = {
  type: 'Invoice' as TxType,
  date: new Date().toISOString().split('T')[0],
  desc: '',
  project: '',
  amount: '',
  client_name: '',
  due_date: '',
  status: 'draft',
};
type FormState = typeof emptyForm;

function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => {
        const v = e.target.value.replace(',', '.');
        if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v);
      }}
      placeholder="0.00"
      className={inputCls}
    />
  );
}

function InvoiceForm({ f, set }: { f: FormState; set: (v: FormState) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" value={f.date} onChange={e => set({ ...f, date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Client *</label>
          <input type="text" value={f.client_name} onChange={e => set({ ...f, client_name: e.target.value })} placeholder="e.g. Snoonu" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description / Item *</label>
        <input type="text" value={f.desc} onChange={e => set({ ...f, desc: e.target.value })} placeholder="e.g. Q1 Rider Supply Services" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Project</label>
          <input type="text" value={f.project} onChange={e => set({ ...f, project: e.target.value })} placeholder="e.g. Snoonu Logistics" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Amount (QR) *</label>
          <AmountInput value={f.amount} onChange={v => set({ ...f, amount: v })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Payment Due Date</label>
        <input type="date" value={f.due_date} onChange={e => set({ ...f, due_date: e.target.value })} className={inputCls} />
      </div>
    </div>
  );
}

function ExpenseForm({ f, set }: { f: FormState; set: (v: FormState) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" value={f.date} onChange={e => set({ ...f, date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category / Project</label>
          <input type="text" value={f.project} onChange={e => set({ ...f, project: e.target.value })} placeholder="e.g. Fleet, Internal" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description *</label>
        <input type="text" value={f.desc} onChange={e => set({ ...f, desc: e.target.value })} placeholder="e.g. Fleet Maintenance" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Amount (QR) *</label>
        <AmountInput value={f.amount} onChange={v => set({ ...f, amount: v })} />
        <p className="text-[10px] text-slate-400 mt-1">Will be recorded as an outflow (negative).</p>
      </div>
    </div>
  );
}

function ReceiptForm({ f, set }: { f: FormState; set: (v: FormState) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" value={f.date} onChange={e => set({ ...f, date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Received From</label>
          <input type="text" value={f.client_name} onChange={e => set({ ...f, client_name: e.target.value })} placeholder="Who paid?" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description *</label>
        <input type="text" value={f.desc} onChange={e => set({ ...f, desc: e.target.value })} placeholder="e.g. Payment for INV-001" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Project</label>
          <input type="text" value={f.project} onChange={e => set({ ...f, project: e.target.value })} placeholder="e.g. Snoonu Logistics" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Amount (QR) *</label>
          <AmountInput value={f.amount} onChange={v => set({ ...f, amount: v })} />
        </div>
      </div>
    </div>
  );
}

function PettyCashForm({
  f, set, dir, setDir,
}: { f: FormState; set: (v: FormState) => void; dir: 'In' | 'Out'; setDir: (d: 'In' | 'Out') => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Direction *</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDir('In')}
            className={cn('py-2.5 text-sm font-bold rounded-lg border transition-colors', dir === 'In' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-100')}>
            + Cash In (Received)
          </button>
          <button type="button" onClick={() => setDir('Out')}
            className={cn('py-2.5 text-sm font-bold rounded-lg border transition-colors', dir === 'Out' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-100')}>
            − Cash Out (Spent)
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" value={f.date} onChange={e => set({ ...f, date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <input type="text" value={f.project} onChange={e => set({ ...f, project: e.target.value })} placeholder="e.g. Office, Meals" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description *</label>
        <input type="text" value={f.desc} onChange={e => set({ ...f, desc: e.target.value })} placeholder="e.g. Office Supplies" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Amount (QR) *</label>
        <AmountInput value={f.amount} onChange={v => set({ ...f, amount: v })} />
      </div>
    </div>
  );
}

function TxTypeToggle({ value, onChange }: { value: TxType; onChange: (v: TxType) => void }) {
  const opts: { type: TxType; emoji: string }[] = [
    { type: 'Invoice',    emoji: '🧾' },
    { type: 'Expense',    emoji: '💸' },
    { type: 'Receipt',    emoji: '✅' },
    { type: 'Petty Cash', emoji: '💰' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map(o => (
        <button key={o.type} type="button" onClick={() => onChange(o.type)}
          className={cn('py-2 px-3 text-xs font-bold rounded-lg border text-left transition-colors',
            value === o.type
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700')}>
          {o.emoji} {o.type}
        </button>
      ))}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, onConfirm, confirmLabel, saving, children }: {
  title: string; onClose: () => void; onConfirm: () => void;
  confirmLabel?: string; saving?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : (confirmLabel ?? 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Accounting() {
  const { user, company, isLoading, isInitialized } = useAuthStore();
  const {
    transactions, addTransaction, updateTransaction, deleteTransaction,
    submitForApproval, approveTransaction, rejectTransaction,
  } = useTransactions();
  const { requests, reviewChangeRequest } = useChangeRequests();

  const [activeTab, setActiveTab]       = useState<TabID>('activity');
  const [sortKey, setSortKey]           = useState<SortKey>('date');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter]     = useState('All Types');

  // Forms
  const [addOpen, setAddOpen]     = useState(false);
  const [newTx, setNewTx]         = useState<FormState>({ ...emptyForm });
  const [addDir, setAddDir]       = useState<'In' | 'Out'>('Out');

  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editForm, setEditForm]     = useState<FormState>({ ...emptyForm });
  const [editDir, setEditDir]       = useState<'In' | 'Out'>('Out');

  const [deleteTarget, setDeleteTarget]         = useState<Transaction | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<Transaction | null>(null);
  const [viewerTarget, setViewerTarget]         = useState<Transaction | null>(null);
  const [saving, setSaving]                     = useState(false);
  const [toast, setToast]                       = useState<string | null>(null);

  const isAdmin   = isAdminRole(user?.role);
  const canAccess = canAccessAccounting(user?.role);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function openAdd() {
    const preType: Partial<Record<TabID, TxType>> = {
      invoices: 'Invoice', expenses: 'Expense', pettycash: 'Petty Cash',
    };
    setNewTx({ ...emptyForm, type: preType[activeTab] ?? 'Invoice' });
    setAddDir('Out');
    setAddOpen(true);
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const txList = transactions || [];

  const filtered = useMemo(() => {
    return txList
      .filter(tx => {
        if (!tx) return false;
        if (activeTab === 'invoices')  return tx.type === 'Invoice' || tx.type === 'Receipt';
        if (activeTab === 'expenses')  return tx.type === 'Expense';
        if (activeTab === 'pettycash') return tx.type === 'Petty Cash';
        if (activeTab === 'approvals') return tx.status === 'pending';
        if (activeTab === 'aging')     return tx.type === 'Invoice' && tx.status !== 'paid' && tx.status !== 'rejected';
        return true; // activity, recon
      })
      .filter(tx => statusFilter === 'All' || tx.status === statusFilter)
      .filter(tx => typeFilter  === 'All Types' || tx.type === typeFilter)
      .sort((a, b) => {
        let c = 0;
        if (sortKey === 'date')     c = (a.date || '').localeCompare(b.date || '');
        if (sortKey === 'type')     c = (a.type || '').localeCompare(b.type || '');
        if (sortKey === 'amount')   c = (a.amount || 0) - (b.amount || 0);
        if (sortKey === 'status')   c = (a.status || '').localeCompare(b.status || '');
        if (sortKey === 'client')   c = (a.client_name || '').localeCompare(b.client_name || '');
        if (sortKey === 'due_date') c = (a.due_date || '').localeCompare(b.due_date || '');
        return sortDir === 'asc' ? c : -c;
      });
  }, [txList, activeTab, statusFilter, typeFilter, sortKey, sortDir]);

  const pending    = useMemo(() => txList.filter(t => t?.status === 'pending'), [txList]);
  const approved   = useMemo(() => txList.filter(t => t?.status === 'approved' || t?.status === 'paid'), [txList]);
  const overdue    = useMemo(() => txList.filter(isOverdue), [txList]);
  const revenue    = useMemo(() => approved.filter(t => t.type === 'Invoice').reduce((s, t) => s + (Number(t.amount) || 0), 0), [approved]);
  const pcBal      = useMemo(() => txList.filter(t => t?.type === 'Petty Cash').reduce((s, t) => s + (Number(t.amount) || 0), 0), [txList]);
  const pendingCR  = useMemo(() => (requests || []).filter(r => r.status === 'pending'), [requests]);

  // ── Row actions ───────────────────────────────────────────────────────────
  function getRowActions(tx: Transaction): any[] {
    const acts: any[] = [];

    // Edit always first so it's never clipped off-screen
    acts.push({
      label: 'Edit',
      icon: <Pencil className="w-4 h-4" />,
      iconCls: 'text-indigo-500',
      onClick: () => {
        setEditTarget(tx);
        setEditForm({
          type:        (tx.type || 'Invoice') as TxType,
          date:        tx.date || new Date().toISOString().split('T')[0],
          desc:        tx.desc || '',
          project:     tx.project || '',
          amount:      String(Math.abs(tx.amount || 0)),
          client_name: tx.client_name || '',
          due_date:    tx.due_date || '',
          status:      tx.status || 'draft',
        });
        setEditDir((tx.amount || 0) >= 0 ? 'In' : 'Out');
      },
    });

    acts.push({ kind: 'divider' });
    acts.push({ kind: 'header', label: 'Workflow' });

    if (tx?.status === 'draft')
      acts.push({ label: 'Submit for Approval', icon: <Send className="w-4 h-4" />, onClick: () => submitForApproval(tx.id) });
    if (isAdmin && tx?.status === 'pending') {
      acts.push({ label: 'Approve', icon: <BadgeCheck className="w-4 h-4" />, iconCls: 'text-emerald-600', onClick: () => { void approveTransaction(tx.id); showToast('Transaction approved'); } });
      acts.push({ label: 'Reject',  icon: <Ban className="w-4 h-4" />,        iconCls: 'text-rose-600',    onClick: () => { void rejectTransaction(tx.id);  showToast('Transaction rejected'); } });
    }

    acts.push({ kind: 'divider' });
    if (tx?.attachment_url)
      acts.push({ label: 'View Document',   icon: <Eye className="w-4 h-4" />,       onClick: () => setViewerTarget(tx) });
    acts.push({ label: tx?.attachment_url ? 'Manage Attachment' : 'Attach File', icon: <Paperclip className="w-4 h-4" />, onClick: () => setAttachmentTarget(tx) });

    if (isAdmin) {
      acts.push({ kind: 'divider' });
      acts.push({ label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setDeleteTarget(tx) });
    }

    return acts;
  }

  // ── Save handlers ─────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!newTx.desc || !newTx.amount) return;
    setSaving(true);
    try {
      let finalType = newTx.type;
      let finalStatus = newTx.status || 'draft';

      // Force UX alignment with active tab
      if (activeTab === 'invoices') finalType = 'Invoice';
      if (activeTab === 'expenses') finalType = 'Expense';
      if (activeTab === 'pettycash') finalType = 'Petty Cash';
      if (activeTab === 'approvals') finalStatus = 'pending';

      const raw   = parseFloat(newTx.amount) || 0;
      const isOut = finalType === 'Expense' || (finalType === 'Petty Cash' && addDir === 'Out');
      const payload = { ...newTx, type: finalType, status: finalStatus, amount: isOut ? -Math.abs(raw) : Math.abs(raw) };
      
      const ok = await addTransaction(payload as any);
      setAddOpen(false);
      setNewTx({ ...emptyForm });

      if (ok === false) {
        showToast('⚠️ Saved locally — DB sync failed (check console)');
      } else {
        // Fallback visibility toast
        const isHidden = 
          (activeTab === 'invoices' && finalType !== 'Invoice' && finalType !== 'Receipt') ||
          (activeTab === 'expenses' && finalType !== 'Expense') ||
          (activeTab === 'pettycash' && finalType !== 'Petty Cash') ||
          (activeTab === 'approvals' && finalStatus !== 'pending') ||
          (activeTab === 'aging' && (finalType !== 'Invoice' || finalStatus === 'paid' || finalStatus === 'rejected')) ||
          (statusFilter !== 'All' && finalStatus !== statusFilter) ||
          (typeFilter !== 'All Types' && finalType !== typeFilter);

        if (isHidden) {
          showToast(`✅ ${finalType} created but hidden by current filter`);
        } else {
          showToast(`✅ ${finalType} added successfully`);
        }
      }
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editTarget || !editForm.desc || !editForm.amount) return;
    setSaving(true);
    try {
      const raw   = parseFloat(editForm.amount) || 0;
      const isOut = editForm.type === 'Expense' || (editForm.type === 'Petty Cash' && editDir === 'Out');
      const ok    = await updateTransaction(editTarget.id, { ...editForm, amount: isOut ? -Math.abs(raw) : Math.abs(raw) } as any);
      setEditTarget(null);
      if (ok === false || ok === 'APPROVAL_REQUIRED') {
        showToast(ok === 'APPROVAL_REQUIRED' ? '🔒 Change submitted for approval' : '⚠️ Updated locally — DB sync failed');
      } else {
        showToast('✅ Transaction updated');
      }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await deleteTransaction(deleteTarget.id);
    setSaving(false);
    setDeleteTarget(null);
    showToast('Transaction deleted');
  }

  // ── Cell renderer ────────────────────────────────────────────────────────
  function renderCell(col: ColDef, tx: Transaction): React.ReactNode {
    const amt = Number(tx.amount) || 0;
    switch (col.key) {
      case 'date':
        return <span className="font-mono text-xs text-slate-500">{tx.date}</span>;
      case 'type':
        return <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{tx.type}</span>;
      case 'invoice_no':
        return <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{tx.invoice_number || '—'}</span>;
      case 'client':
        return <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tx.client_name || '—'}</span>;
      case 'desc':
        return (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white leading-tight text-sm">{tx.desc}</p>
            {activeTab === 'activity' && (
              <p className="text-[10px] text-slate-400 uppercase mt-0.5">{tx.project} · {tx.type}</p>
            )}
            {(activeTab === 'expenses' || activeTab === 'recon') && (
              <p className="text-[10px] text-slate-400 mt-0.5">{tx.project}</p>
            )}
          </div>
        );
      case 'project':
        return <span className="text-xs text-slate-500 dark:text-slate-400">{tx.project || '—'}</span>;
      case 'due_date': {
        const od = isOverdue(tx);
        return (
          <span className={cn('text-xs font-mono', od ? 'text-rose-600 font-bold' : 'text-slate-500')}>
            {tx.due_date || '—'}
            {od && <AlertTriangle className="w-3 h-3 inline ml-1" />}
          </span>
        );
      }
      case 'amount':
        return (
          <span className={cn('font-black text-sm tabular-nums', amt > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {amt > 0 ? '+' : ''}{formatCurrency(amt)}
          </span>
        );
      case 'status':
        return <StatusBadge status={tx.status || 'draft'} />;
      case 'reconciled':
        return (
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', tx.is_reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {tx.is_reconciled ? '✓ Yes' : 'No'}
          </span>
        );
      case 'age': {
        const days = tx.due_date ? Math.floor((Date.now() - new Date(tx.due_date).getTime()) / 86400000) : 0;
        return <span className={cn('text-xs font-bold px-2 py-0.5 rounded', ageBand(days))}>{Math.max(0, days)}d</span>;
      }
      case 'actions':
        return <RowMenu actions={getRowActions(tx)} />;
      default: return null;
    }
  }

  // ── Guards ───────────────────────────────────────────────────────────────
  if (isLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!canAccess) return <Navigate to="/" replace />;

  const cols = COLS[activeTab as Exclude<TabID, 'pettycash'>] ?? COLS.activity;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up relative">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Accounting Workspace</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Invoices, expenses, petty cash &amp; approval tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <RowMenu actions={[
            { kind: 'header', label: 'Export' },
            { label: 'Export CSV', icon: <FileSpreadsheet className="w-4 h-4" />, onClick: () => exportTransactionsCSV(filtered) },
            { label: 'Export PDF', icon: <FileDown className="w-4 h-4" />,        onClick: () => exportTransactionsPDF(filtered, company?.name) },
          ]} />
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Transaction
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Pending',    v: String(pending.length),  c: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/10',    border: 'border-amber-100 dark:border-amber-800' },
          { l: 'Overdue',    v: String(overdue.length),  c: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/10',      border: 'border-rose-100 dark:border-rose-800' },
          { l: 'Revenue',    v: formatCurrency(revenue), c: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-800' },
          { l: 'Petty Cash', v: `${pcBal < 0 ? '-' : ''}${formatCurrency(pcBal)}`, c: pcBal >= 0 ? 'text-blue-600' : 'text-rose-600', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-800' },
        ].map((k, i) => (
          <div key={i} className={cn('p-4 rounded-xl border', k.bg, k.border)}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{k.l}</p>
            <p className={cn('text-2xl font-black mt-1', k.c)}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-lg transition-all whitespace-nowrap relative shrink-0',
              activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800')}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.id === 'approvals' && (pending.length + pendingCR.length) > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white border-2 border-white dark:border-gray-900 animate-pulse">
                {pending.length + pendingCR.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 text-[10px] uppercase font-bold border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
          <option value="All">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        {activeTab === 'activity' && (
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 text-[10px] uppercase font-bold border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            <option>All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Main table container */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* Approvals — change request cards */}
        {activeTab === 'approvals' && pendingCR.length > 0 && (
          <div className="border-b border-slate-100 dark:border-slate-800">
            <div className="px-4 py-2 bg-amber-50/60 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500">
                Change Requests ({pendingCR.length})
              </p>
            </div>
            {pendingCR.map(req => (
              <div key={req.id} className="px-4 py-3 flex items-start gap-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">Change Request — Record #{req.record_id}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{req.requested_by_name} · {req.reason}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {Object.keys(req.new_data || {}).map(key => (
                      <span key={key} className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
                        {key}: <span className="text-slate-400 line-through">{String((req.old_data as any)?.[key] ?? '')}</span>
                        {' → '}
                        <span className="text-blue-600 font-bold">{String((req.new_data as any)?.[key] ?? '')}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { reviewChangeRequest(req.id, 'approved'); showToast('Change approved'); }}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">Approve</button>
                  <button onClick={() => { reviewChangeRequest(req.id, 'rejected'); showToast('Change rejected'); }}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Petty Cash: Excel-style ledger */}
        {activeTab === 'pettycash' && (
          <PettyCashLedger entries={filtered} getActions={getRowActions} />
        )}

        {/* All other tabs: generic table */}
        {activeTab !== 'pettycash' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {cols.map(col => (
                    <th key={col.key}
                      className={cn('px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.sortable && 'cursor-pointer hover:text-blue-600 transition-colors')}
                      onClick={() => col.sortable && toggleSort(col.sortable)}>
                      {col.label}
                      {col.sortable && <SortIcon col={col.sortable} sortKey={sortKey} sortDir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} className="px-4 py-14 text-center text-slate-400 text-sm">
                      No transactions found. Add one with the "New Transaction" button.
                    </td>
                  </tr>
                ) : filtered.map(tx => {
                  if (!tx) return null;
                  return (
                    <tr key={tx.id}
                      className={cn('hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors',
                        isOverdue(tx) && 'bg-rose-50/30 dark:bg-rose-900/5')}>
                      {cols.map(col => (
                        <td key={col.key}
                          className={cn('px-4 py-3',
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                            col.key === 'actions' && 'w-10')}>
                          {renderCell(col, tx)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Row count */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-[10px] text-slate-400 font-semibold">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Add Modal ────────────────────────────────────────────────────────── */}
      {addOpen && (
        <Modal title="New Ledger Entry" onClose={() => setAddOpen(false)} onConfirm={handleAdd}
          confirmLabel="Save Entry" saving={saving}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Transaction Type *</label>
              <TxTypeToggle value={newTx.type} onChange={v => setNewTx({ ...emptyForm, type: v })} />
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              {newTx.type === 'Invoice'    && <InvoiceForm   f={newTx} set={setNewTx} />}
              {newTx.type === 'Expense'    && <ExpenseForm   f={newTx} set={setNewTx} />}
              {newTx.type === 'Receipt'    && <ReceiptForm   f={newTx} set={setNewTx} />}
              {newTx.type === 'Petty Cash' && <PettyCashForm f={newTx} set={setNewTx} dir={addDir} setDir={setAddDir} />}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editTarget && (
        <Modal title="Edit Entry" onClose={() => setEditTarget(null)} onConfirm={handleEdit}
          confirmLabel="Confirm Changes" saving={saving}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Transaction Type</label>
              <TxTypeToggle value={editForm.type} onChange={v => setEditForm({ ...editForm, type: v })} />
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              {editForm.type === 'Invoice'    && <InvoiceForm   f={editForm} set={setEditForm} />}
              {editForm.type === 'Expense'    && <ExpenseForm   f={editForm} set={setEditForm} />}
              {editForm.type === 'Receipt'    && <ReceiptForm   f={editForm} set={setEditForm} />}
              {editForm.type === 'Petty Cash' && <PettyCashForm f={editForm} set={setEditForm} dir={editDir} setDir={setEditDir} />}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full border-2 border-rose-500 shadow-2xl">
            <h2 className="text-xl font-black text-rose-600 mb-2">Delete Permanently?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Remove <span className="font-bold text-slate-900 dark:text-white">"{deleteTarget.desc}"</span> from the ledger? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-500">Cancel</button>
              <button onClick={handleDelete} disabled={saving}
                className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {saving ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachment Modal ──────────────────────────────────────────────────── */}
      {attachmentTarget && (
        <DocumentAttachmentModal
          isOpen={true}
          onClose={() => setAttachmentTarget(null)}
          recordId={attachmentTarget.id}
          currentAttachmentUrl={attachmentTarget.attachment_url}
          onUploadSuccess={url => updateTransaction(attachmentTarget.id, { attachment_url: url })}
        />
      )}

      {/* ── Document Viewer ───────────────────────────────────────────────────── */}
      {viewerTarget && (
        <DocumentViewerModal
          isOpen={true}
          onClose={() => setViewerTarget(null)}
          transaction={viewerTarget}
        />
      )}
    </div>
  );
}
