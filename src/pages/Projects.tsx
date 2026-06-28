import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Filter, X, ChevronUp, ChevronDown, Loader2,
  AlertCircle, Pencil, Trash2, Eye, Zap, CalendarClock, PauseCircle,
  CheckCircle2, FileSpreadsheet, FileText,
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useProjects, Project, calcProjectFinancials } from '../hooks/useProjects';
import { RowMenu } from '../components/RowMenu';
import { exportProjectsCSV, exportProjectsPDF } from '../utils/exportUtils';
import { useAuthStore } from '../store/auth';

type SortKey = 'name' | 'client' | 'revenue' | 'profit' | 'margin' | 'status';
type SortDir = 'asc' | 'desc';

// All numeric amounts in the form are stored as strings to avoid leading-zero input bug.
// They are parsed to numbers only at submit time.
type FormState = {
  name: string;
  client: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  revenue: string;
  investment: string;
  expenses: string;
  additional_costs: string;
  payment_received: string;
};

const emptyForm: FormState = {
  name: '', client: '', status: 'Planning',
  revenue: '', investment: '', expenses: '', additional_costs: '', payment_received: '',
};

function formToProject(f: FormState): Omit<Project, 'id'> {
  return {
    name:             f.name.trim(),
    client:           f.client.trim(),
    status:           f.status,
    revenue:          parseFloat(f.revenue)          || 0,
    investment:       parseFloat(f.investment)       || 0,
    expenses:         parseFloat(f.expenses)         || 0,
    additional_costs: parseFloat(f.additional_costs) || 0,
    payment_received: parseFloat(f.payment_received) || 0,
  };
}

function projectToForm(p: Project): FormState {
  return {
    name:             p.name,
    client:           p.client,
    status:           p.status,
    revenue:          p.revenue          > 0 ? String(p.revenue)          : '',
    investment:       p.investment       > 0 ? String(p.investment)       : '',
    expenses:         p.expenses         > 0 ? String(p.expenses)         : '',
    additional_costs: p.additional_costs > 0 ? String(p.additional_costs) : '',
    payment_received: p.payment_received > 0 ? String(p.payment_received) : '',
  };
}

const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all';

// Numeric text input — stores as string, validates decimal format, prevents leading zeros
function NumInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? '0.00'}
        onChange={e => {
          const val = e.target.value.replace(',', '.');
          if (val === '' || /^\d*\.?\d*$/.test(val)) onChange(val);
        }}
        className={inputCls}
      />
      {hint && <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">{hint}</p>}
    </div>
  );
}

function ProjForm({ f, set }: { f: FormState; set: (v: FormState) => void }) {
  const num = (label: string, key: keyof FormState, placeholder?: string, hint?: string) => (
    <NumInput
      label={label}
      value={f[key] as string}
      onChange={v => set({ ...f, [key]: v })}
      placeholder={placeholder}
      hint={hint}
    />
  );

  const r  = parseFloat(f.revenue)          || 0;
  const i  = parseFloat(f.investment)       || 0;
  const ex = parseFloat(f.expenses)         || 0;
  const ac = parseFloat(f.additional_costs) || 0;
  const pr = parseFloat(f.payment_received) || 0;
  const totalCost = i + ex + ac;
  const profit    = r - totalCost;
  const pending   = r - pr;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">

      {/* ── Left column: basics ── */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Project Info</p>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Q4 Logistics Expansion"
            value={f.name}
            onChange={e => set({ ...f, name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Client <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Acme Corp"
            value={f.client}
            onChange={e => set({ ...f, client: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
          <select
            value={f.status}
            onChange={e => set({ ...f, status: e.target.value as FormState['status'] })}
            className={inputCls}
          >
            {(['Planning', 'Active', 'On Hold', 'Completed'] as const).map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Live preview — shown once values exist */}
        {r > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 mt-1">
            <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Preview</p>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Cost</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Profit</span>
              <span className={cn('font-bold', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{formatCurrency(profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(pending)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Right column: financials ── */}
      <div className="space-y-3 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 sm:mt-0 mt-3">Financial Details (QR)</p>
        {num('Contract Value',    'revenue',          '0.00', 'Total value agreed with client')}
        {num('Company Investment','investment',        '0.00', 'Capital you put into this project')}
        {num('Operating Expenses','expenses',          '0.00', 'Day-to-day running costs')}
        {num('Additional Costs',  'additional_costs', '0.00', 'Miscellaneous or one-off costs')}
        {num('Payment Received',  'payment_received', '0.00', 'Amount already collected from client')}
      </div>

    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────────
function Modal({ title, sub, children, footer }: {
  title: string; sub?: string; children: React.ReactNode;
  footer: { onClose: () => void; buttons: React.ReactNode };
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded border border-slate-200 dark:border-slate-700 shadow-xl max-w-2xl w-full flex flex-col max-h-[min(90vh,680px)]">
        {/* pinned header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-4 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
            {sub && <p className="text-xs text-slate-400 font-mono mt-0.5">{sub}</p>}
          </div>
          <button
            onClick={footer.onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* scrollable body — flex-1 min-h-0 is the correct flexbox scroll pattern */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {/* pinned footer */}
        <div className="px-5 py-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {footer.buttons}
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey,      setSortKey]      = useState<SortKey>('revenue');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const navigate = useNavigate();

  const [addOpen,       setAddOpen]       = useState(false);
  const [form,          setForm]          = useState<FormState>(emptyForm);
  const [editTarget,    setEditTarget]    = useState<Project | null>(null);
  const [editForm,      setEditForm]      = useState<FormState>(emptyForm);
  const [deleteTarget,  setDeleteTarget]  = useState<Project | null>(null);
  const [saving,        setSaving]        = useState(false);

  const { projects, loading, error, addProject, updateProject, deleteProject } = useProjects();

  const handleCreate = async () => {
    if (!form.name.trim() || !form.client.trim()) return;
    setSaving(true);
    await addProject(formToProject(form));
    setSaving(false);
    setAddOpen(false);
    setForm(emptyForm);
  };

  const openEdit = (p: Project) => {
    setEditTarget(p);
    setEditForm(projectToForm(p));
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const result = await updateProject(editTarget.id, formToProject(editForm));
    setSaving(false);
    if (result !== 'APPROVAL_REQUIRED') setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    await deleteProject(deleteTarget.id);
    setSaving(false);
    setDeleteTarget(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = projects
    .filter(p => {
      const q = search.toLowerCase();
      return (p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
        && (statusFilter === 'All' || p.status === statusFilter);
    })
    .sort((a, b) => {
      const fa = calcProjectFinancials(a), fb = calcProjectFinancials(b);
      let cmp = 0;
      if      (sortKey === 'name')    cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'client')  cmp = a.client.localeCompare(b.client);
      else if (sortKey === 'revenue') cmp = a.revenue - b.revenue;
      else if (sortKey === 'profit')  cmp = fa.netProfit - fb.netProfit;
      else if (sortKey === 'margin')  cmp = fa.profitMargin - fb.profitMargin;
      else if (sortKey === 'status')  cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalRevenue   = filtered.reduce((s, p) => s + p.revenue, 0);
  const totalNetProfit = filtered.reduce((s, p) => s + calcProjectFinancials(p).netProfit, 0);
  const avgMargin      = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

  const Ico = ({ col }: { col: SortKey }) =>
    col !== sortKey
      ? <span className="ml-1 text-slate-300 dark:text-slate-600">↕</span>
      : sortDir === 'asc'
        ? <ChevronUp   className="w-3.5 h-3.5 inline ml-0.5 text-blue-500" />
        : <ChevronDown className="w-3.5 h-3.5 inline ml-0.5 text-blue-500" />;

  const thCls = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none whitespace-nowrap';

  const badge = (s: string) => cn(
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
    s === 'Active'    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
    s === 'Planning'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
    s === 'Completed' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Projects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track contracts, revenue, costs, and profitability.</p>
        </div>
        <div className="flex items-center gap-2">
          <RowMenu
            align="right"
            actions={[
              { kind: 'header', label: 'Export Data' },
              { label: 'Export as CSV', icon: <FileSpreadsheet className="w-4 h-4" />, onClick: () => exportProjectsCSV(projects) },
              { label: 'Export as PDF', icon: <FileText className="w-4 h-4" />, onClick: () => exportProjectsPDF(projects, useAuthStore.getState().company?.name) },
            ]}
          />
          <button
            onClick={() => { setForm(emptyForm); setAddOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded border border-blue-700 text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Projects',  value: String(filtered.length),           color: 'text-slate-900 dark:text-white'             },
          { label: 'Total Revenue',   value: formatCurrency(totalRevenue),       color: 'text-blue-600 dark:text-blue-400'           },
          { label: 'Net Profit',      value: formatCurrency(totalNetProfit),     color: totalNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Avg Margin',      value: `${avgMargin.toFixed(1)}%`,         color: 'text-violet-600 dark:text-violet-400'       },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-900 p-4 rounded border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{c.label}</p>
            <p className={cn('text-xl font-bold', c.color)}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects or clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {['Active', 'Planning', 'On Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Loading projects…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={thCls} onClick={() => handleSort('name')}>Project <Ico col="name" /></th>
                  <th className={thCls} onClick={() => handleSort('client')}>Client <Ico col="client" /></th>
                  <th className={thCls} onClick={() => handleSort('status')}>Status <Ico col="status" /></th>
                  <th className={cn(thCls, 'text-right')} onClick={() => handleSort('revenue')}>Contract Value <Ico col="revenue" /></th>
                  <th className={cn(thCls, 'text-right')}>Total Cost</th>
                  <th className={cn(thCls, 'text-right')} onClick={() => handleSort('profit')}>Net Profit <Ico col="profit" /></th>
                  <th className={cn(thCls, 'text-right')} onClick={() => handleSort('margin')}>Margin <Ico col="margin" /></th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(p => {
                  const { totalCost, netProfit, profitMargin } = calcProjectFinancials(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                          {p.source === 'contracting' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">Contracting</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{p.id}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{p.client}</td>
                      <td className="px-4 py-3.5"><span className={badge(p.status)}>{p.status}</span></td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">{formatCurrency(totalCost)}</td>
                      <td className={cn('px-4 py-3.5 text-right font-bold tabular-nums', netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{formatCurrency(netProfit)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={cn(
                          'inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold min-w-[3rem]',
                          profitMargin >= 20 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          profitMargin >= 10 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                          profitMargin >  0  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                               'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                        )}>{profitMargin.toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <RowMenu align="right" actions={[
                          { kind: 'header', label: 'Change Status' },
                          { label: 'Active',    icon: <Zap className="w-4 h-4" />,          iconCls: 'text-emerald-600 dark:text-emerald-400', checked: p.status === 'Active',    disabled: p.status === 'Active',    onClick: () => updateProject(p.id, { status: 'Active' }) },
                          { label: 'Planning',  icon: <CalendarClock className="w-4 h-4" />, iconCls: 'text-blue-600 dark:text-blue-400',       checked: p.status === 'Planning',  disabled: p.status === 'Planning',  onClick: () => updateProject(p.id, { status: 'Planning' }) },
                          { label: 'On Hold',   icon: <PauseCircle className="w-4 h-4" />,   iconCls: 'text-amber-600 dark:text-amber-400',     checked: p.status === 'On Hold',   disabled: p.status === 'On Hold',   onClick: () => updateProject(p.id, { status: 'On Hold' }) },
                          { label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />,  iconCls: 'text-slate-500 dark:text-slate-400',     checked: p.status === 'Completed', disabled: p.status === 'Completed', onClick: () => updateProject(p.id, { status: 'Completed' }) },
                          { kind: 'divider' },
                          { label: 'View Details', icon: <Eye className="w-4 h-4" />,    iconCls: 'text-violet-600 dark:text-violet-400', onClick: () => navigate(`/projects/${p.id}`) },
                          { label: 'Edit Details', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-blue-600 dark:text-blue-400',    onClick: () => openEdit(p) },
                          { kind: 'divider' },
                          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(p), danger: true },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-400 dark:text-slate-500 text-sm">
                      <Search className="w-7 h-7 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No projects found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      {addOpen && (
        <Modal
          title="Create New Project"
          footer={{
            onClose: () => setAddOpen(false),
            buttons: (
              <>
                <button
                  onClick={() => setAddOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || !form.client.trim() || saving}
                  className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded border border-blue-700 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Project
                </button>
              </>
            ),
          }}
        >
          <ProjForm f={form} set={setForm} />
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <Modal
          title="Edit Project"
          sub={editTarget.id}
          footer={{
            onClose: () => setEditTarget(null),
            buttons: (
              <>
                <button
                  onClick={() => setEditTarget(null)}
                  className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded border border-blue-700 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Save Changes
                </button>
              </>
            ),
          }}
        >
          <ProjForm f={editForm} set={setEditForm} />
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <Modal
          title="Delete Project?"
          footer={{
            onClose: () => setDeleteTarget(null),
            buttons: (
              <>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded border border-red-700 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </button>
              </>
            ),
          }}
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{deleteTarget.name}</span> and all its financial data will be permanently removed.
          </p>
        </Modal>
      )}
    </div>
  );
}
