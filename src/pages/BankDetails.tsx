import React, { useState } from 'react';
import {
  Lock, Search, Plus, X, Eye, EyeOff, Trash2, Edit2,
  AlertTriangle, ShieldCheck, CreditCard, Building2,
  User, Banknote, ChevronRight, Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useBankDetails,
  maskAccount, maskCard, maskIBAN,
  type BankRecord, type PaymentMethod
} from '../hooks/useBankDetails';
import { useAuthStore } from '../store/auth';
import { roleLabel } from '../lib/roles';

/* ── Shared style constants ──────────────────────────────────────────────── */
const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all';
const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2';

/* ── Payment metadata ────────────────────────────────────────────────────── */
const paymentColors: Record<PaymentMethod, string> = {
  bank_transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cash:          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cheque:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  other:         'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const paymentLabel: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

/* ── Empty form factory ──────────────────────────────────────────────────── */
type FormState = Omit<BankRecord, 'id' | 'created_at' | 'updated_at'>;

function emptyForm(): FormState {
  return {
    employee_name: '',
    employee_role: '',
    bank_name: '',
    account_number: '',
    iban: '',
    card_number: '',
    branch_name: '',
    account_holder_name: '',
    payment_method: 'bank_transfer',
    notes: '',
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   FormModal — defined at module level so React never sees a new component
   type on re-render. Receiving form state as props prevents the unmount
   cycle that caused single-character input freezing.
   ───────────────────────────────────────────────────────────────────────── */
interface FormModalProps {
  isEdit: boolean;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

function FormModal({ isEdit, form, setForm, saving, onClose, onSave }: FormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Edit Bank Record' : 'Add Bank Record'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 ml-8">Sensitive data — handle with care</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Employee info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Employee Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full Name <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.employee_name}
                    onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))}
                    placeholder="Employee full name"
                    className={cn(inputCls, 'pl-10')}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select
                  value={form.employee_role}
                  onChange={e => setForm(f => ({ ...f, employee_role: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select role</option>
                  {['owner','admin','bdm','engineer','receptionist','developer','intern'].map(r => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bank info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Bank Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Bank Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                    placeholder="e.g. Qatar National Bank"
                    className={cn(inputCls, 'pl-10')}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Branch Name / Code</label>
                <input
                  type="text"
                  value={form.branch_name}
                  onChange={e => setForm(f => ({ ...f, branch_name: e.target.value }))}
                  placeholder="e.g. Al Sadd Branch"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Account Holder Name</label>
                <input
                  type="text"
                  value={form.account_holder_name}
                  onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))}
                  placeholder="As printed on card/account"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <select
                  value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod }))}
                  className={inputCls}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sensitive fields */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/40">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Sensitive Financial Data — Restricted Access
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelCls}>Account Number</label>
                <input
                  type="text"
                  value={form.account_number}
                  onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                  placeholder="Bank account number"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>IBAN</label>
                <input
                  type="text"
                  value={form.iban}
                  onChange={e => setForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
                  placeholder="e.g. QA58QNBA000000000012345678901"
                  autoComplete="off"
                  className={cn(inputCls, 'font-mono')}
                />
              </div>
              <div>
                <label className={labelCls}>Card Number (optional)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.card_number}
                    onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))}
                    placeholder="16-digit card number"
                    autoComplete="off"
                    maxLength={19}
                    className={cn(inputCls, 'pl-10 font-mono')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (internal use only)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Salary date, special instructions, etc."
              rows={2}
              className={cn(inputCls, 'resize-none')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.employee_name}
            className="px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Lock className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DetailPanel — also at module level for the same reason.
   ───────────────────────────────────────────────────────────────────────── */
interface DetailPanelProps {
  rec: BankRecord;
  showSensitive: Record<string, boolean>;
  onToggleReveal: (recordId: string, field: string) => void;
  onClose: () => void;
  onEdit: (rec: BankRecord) => void;
  onDelete: (rec: BankRecord) => void;
}

function DetailPanel({ rec, showSensitive, onToggleReveal, onClose, onEdit, onDelete }: DetailPanelProps) {
  const isRevealed = (field: string) => !!showSensitive[`${rec.id}_${field}`];

  const fields = [
    { label: 'Account Number', masked: maskAccount(rec.account_number), raw: rec.account_number, key: 'acct' },
    { label: 'IBAN',           masked: maskIBAN(rec.iban),               raw: rec.iban,           key: 'iban' },
    { label: 'Card Number',    masked: maskCard(rec.card_number),         raw: rec.card_number,    key: 'card' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {rec.employee_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{rec.employee_name}</h3>
              <span className="text-[11px] text-slate-500">
                {roleLabel(rec.employee_role)} · {rec.bank_name || 'No bank set'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Holder</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {rec.account_holder_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {rec.branch_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Method</span>
              <div className="mt-0.5">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                  paymentColors[rec.payment_method]
                )}>
                  {paymentLabel[rec.payment_method]}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {rec.bank_name || '—'}
              </p>
            </div>
          </div>

          {/* Sensitive fields — masked by default */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/30 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Sensitive Fields — Click eye to reveal
              </span>
            </div>
            {fields.map(f => (
              <div key={f.key} className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{f.label}</span>
                  <p className={cn(
                    'font-mono text-sm mt-0.5',
                    f.raw ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                  )}>
                    {f.raw ? (isRevealed(f.key) ? f.raw : f.masked) : '—'}
                  </p>
                </div>
                {f.raw && (
                  <button
                    onClick={() => onToggleReveal(rec.id, f.key)}
                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title={isRevealed(f.key) ? 'Hide' : 'Reveal'}
                  >
                    {isRevealed(f.key) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          {rec.notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Notes</span>
              <p className="text-sm text-slate-600 dark:text-slate-300">{rec.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[10px] text-slate-400 flex gap-4">
            <span>Added: {new Date(rec.created_at).toLocaleDateString()}</span>
            {rec.updated_at !== rec.created_at && (
              <span>Updated: {new Date(rec.updated_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-2 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => onEdit(rec)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Edit Record
          </button>
          <button
            onClick={() => onDelete(rec)}
            className="px-4 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function BankDetails() {
  const { records, loading, error, isAuthorized, addRecord, updateRecord, deleteRecord } = useBankDetails();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<BankRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<BankRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BankRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  // ── Hard gate ─────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-5 bg-rose-100 dark:bg-rose-900/30 rounded-3xl">
          <Lock className="w-10 h-10 text-rose-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Access Restricted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            This module is restricted to Owner and Admin roles only.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <Shield className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">
            Your role: <strong>{roleLabel(user?.role)}</strong>
          </span>
        </div>
      </div>
    );
  }

  // ── Filtered list ─────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.employee_name.toLowerCase().includes(q) ||
      r.employee_role.toLowerCase().includes(q) ||
      r.bank_name.toLowerCase().includes(q) ||
      r.account_holder_name.toLowerCase().includes(q)
    );
  });

  // ── Handlers ──────────────────────────────────────────────────────────
  const openAdd = () => { setForm(emptyForm()); setAddOpen(true); };

  const openEdit = (rec: BankRecord) => {
    setForm({
      employee_name:       rec.employee_name,
      employee_role:       rec.employee_role,
      bank_name:           rec.bank_name,
      account_number:      rec.account_number,
      iban:                rec.iban,
      card_number:         rec.card_number,
      branch_name:         rec.branch_name,
      account_holder_name: rec.account_holder_name,
      payment_method:      rec.payment_method,
      notes:               rec.notes,
    });
    setEditRecord(rec);
    setDetailRecord(null);
  };

  const handleSaveNew = async () => {
    if (!form.employee_name) return;
    setSaving(true);
    await addRecord(form);
    setSaving(false);
    setAddOpen(false);
    setForm(emptyForm());
  };

  const handleSaveEdit = async () => {
    if (!editRecord || !form.employee_name) return;
    setSaving(true);
    await updateRecord(editRecord.id, form);
    setSaving(false);
    setEditRecord(null);
    setForm(emptyForm());
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteRecord(confirmDelete.id, confirmDelete.employee_name);
    setConfirmDelete(null);
    if (detailRecord?.id === confirmDelete.id) setDetailRecord(null);
  };

  const toggleFieldReveal = (recordId: string, field: string) => {
    const key = `${recordId}_${field}`;
    setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
              Employee Banking Details
            </h2>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Restricted to Owner &amp; Admin · {records.length} record{records.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, bank, role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(inputCls, 'pl-10')}
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* ── Security Notice ─────────────────────────────────────────────── */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Confidential Payroll Data</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            Sensitive fields are masked by default. All access and edits are logged in the Audit Trail. Do not share or export this data without authorization.
          </p>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading secure records…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50/60 dark:bg-slate-800/40">
                <tr>
                  {['S.L', 'Employee', 'Role', 'Bank', 'Account (masked)', 'IBAN (masked)', 'Payment', 'Updated', ''].map(h => (
                    <th key={h} className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((rec, index) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    onClick={() => setDetailRecord(rec)}
                  >
                    <td className="px-5 py-4 font-medium text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {rec.employee_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{rec.employee_name}</p>
                          {rec.account_holder_name && rec.account_holder_name !== rec.employee_name && (
                            <p className="text-[10px] text-slate-400">{rec.account_holder_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {rec.employee_role ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold">
                          {roleLabel(rec.employee_role)}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {rec.bank_name || '—'}
                        </span>
                        {rec.branch_name && (
                          <span className="text-[10px] text-slate-400">{rec.branch_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {maskAccount(rec.account_number)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {maskIBAN(rec.iban)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                        paymentColors[rec.payment_method]
                      )}>
                        {paymentLabel[rec.payment_method]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                      {new Date(rec.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(rec); }}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete(rec); }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-0.5" />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                          <Banknote className="w-8 h-8 opacity-30" />
                        </div>
                        <p className="font-medium">
                          {search ? 'No matching records' : 'No banking records yet'}
                        </p>
                        {!search && (
                          <button onClick={openAdd} className="text-sm text-blue-500 hover:text-blue-600 font-semibold">
                            Add first record
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {addOpen && (
        <FormModal
          isEdit={false}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => { setAddOpen(false); setForm(emptyForm()); }}
          onSave={handleSaveNew}
        />
      )}
      {editRecord && (
        <FormModal
          isEdit={true}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => { setEditRecord(null); setForm(emptyForm()); }}
          onSave={handleSaveEdit}
        />
      )}
      {detailRecord && (
        <DetailPanel
          rec={detailRecord}
          showSensitive={showSensitive}
          onToggleReveal={toggleFieldReveal}
          onClose={() => setDetailRecord(null)}
          onEdit={openEdit}
          onDelete={rec => { setConfirmDelete(rec); setDetailRecord(null); }}
        />
      )}

      {/* ── Delete Confirm ──────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Delete Banking Record</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Permanently delete the banking record for:
            </p>
            <p className="font-bold text-slate-900 dark:text-white mb-4">
              {confirmDelete.employee_name}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl mb-5">
              This action cannot be undone. The deletion will be logged in the Audit Trail.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
