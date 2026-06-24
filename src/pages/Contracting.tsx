import React, { useState } from 'react';
import {
  FileText, AlertTriangle, CheckCircle, Clock, Plus, X, Loader2,
  Briefcase, Receipt, CreditCard, Send, ShieldCheck, Ban, Users2,
  ArrowDownLeft, ArrowUpRight, Building2,
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useContracts, Contract } from '../hooks/useContracts';
import { useContractingProjects } from '../hooks/useContractingProjects';
import { useQuotations } from '../hooks/useQuotations';
import { useContractingInvoicesOut } from '../hooks/useContractingInvoicesOut';
import { useContractingInvoicesIn } from '../hooks/useContractingInvoicesIn';
import { useContractingPayments } from '../hooks/useContractingPayments';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { useAuthStore } from '../store/auth';
import { useProjects } from '../hooks/useProjects';

const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all';

/* ── Status badge helper ───────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    Planning: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    Completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'On Hold': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    'Pending Signature': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    'Expiring Soon': 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    Expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    approved: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    inactive: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize', cfg[status] || cfg.draft)}>
      {status}
    </span>
  );
}

/* ── KPI Card ──────────────────────────────────── */
function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={cn('bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800', color)}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Modal Shell ───────────────────────────────── */
function Modal({ title, onClose, children, accent = 'indigo' }: { title: string; onClose: () => void; children: React.ReactNode; accent?: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Tab types ─────────────────────────────────── */
type TabID = 'contracts' | 'projects' | 'quotations' | 'invoices-out' | 'invoices-in' | 'payments' | 'subcontractors';

const tabs: { id: TabID; label: string; icon: any }[] = [
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'subcontractors', label: 'Subcontractors', icon: Building2 },
  { id: 'quotations', label: 'Quotations', icon: Send },
  { id: 'invoices-out', label: 'Invoices → Clients', icon: ArrowUpRight },
  { id: 'invoices-in', label: 'Invoices ← Subcon', icon: ArrowDownLeft },
  { id: 'payments', label: 'Payments', icon: CreditCard },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Contracting() {
  const { user } = useAuthStore();
  const isEngineer = user?.role === 'engineer';
  const visibleTabs = isEngineer ? tabs.filter(t => t.id !== 'quotations') : tabs;

  const [activeTab, setActiveTab] = useState<TabID>('contracts');
  const [modal, setModal] = useState<string | null>(null);

  // Data hooks
  const { contracts, loading: ctrLoading, addContract } = useContracts();
  const { projects, loading: prjLoading, addProject } = useContractingProjects();
  const { projects: mainProjects } = useProjects();
  const { subcontractors, loading: subLoading, addSubcontractor } = useSubcontractors();
  const { quotations, loading: qLoading, addQuotation, updateStatus: updateQuotStatus } = useQuotations();
  const { invoices: invoicesOut, loading: ioLoading, addInvoice: addInvOut, updateStatus: updateInvOutStatus } = useContractingInvoicesOut();
  const { invoices: invoicesIn, loading: iiLoading, addInvoice: addInvIn, updateStatus: updateInvInStatus } = useContractingInvoicesIn();
  const { payments, loading: payLoading, recordPayment } = useContractingPayments();

  // Forms
  const [ctrForm, setCtrForm] = useState({ title: '', client: '', value: '', startDate: '', endDate: '' });
  const [prjForm, setPrjForm] = useState({ name: '', client: '', value: '', status: 'Active' as const, startDate: '', endDate: '', description: '', contractId: '', mainProjectId: '' });
  const [subForm, setSubForm] = useState({ name: '', contactPerson: '', phone: '', email: '', companyDetails: '' });
  const [qotForm, setQotForm] = useState({ client: '', description: '', amount: '', validUntil: '', projectId: '', notes: '' });
  const [invOutForm, setInvOutForm] = useState({ client: '', description: '', amount: '', issuedDate: '', dueDate: '', projectId: '' });
  const [invInForm, setInvInForm] = useState({ subcontractor: '', subcontractorId: '', invoiceRef: '', description: '', amount: '', receivedDate: '', dueDate: '', projectId: '' });
  const [payForm, setPayForm] = useState({ direction: 'in' as 'in' | 'out', amount: '', paymentDate: '', method: 'Bank Transfer', reference: '', notes: '', projectId: '', invoiceId: '' });

  const loading = ctrLoading || prjLoading || subLoading || qLoading || ioLoading || iiLoading || payLoading;

  /* ── Add handlers ───────────────────────────────── */
  const handleAddContract = async () => {
    if (!ctrForm.title || !ctrForm.client) return;
    const val = parseFloat(ctrForm.value) || 0;
    const initialStatus: Contract['status'] = user?.role === 'owner' ? 'Active' : 'Pending Signature';
    await addContract({ title: ctrForm.title, client: ctrForm.client, value: val, startDate: ctrForm.startDate, endDate: ctrForm.endDate, status: initialStatus });
    setModal(null); setCtrForm({ title: '', client: '', value: '', startDate: '', endDate: '' });
  };

  const handleAddProject = async () => {
    if (!prjForm.name || !prjForm.client) return;
    const val = parseFloat(prjForm.value) || 0;
    await addProject({ name: prjForm.name, client: prjForm.client, value: val, status: prjForm.status, startDate: prjForm.startDate, endDate: prjForm.endDate, description: prjForm.description, contractId: prjForm.contractId || null, mainProjectId: prjForm.mainProjectId || null });
    setModal(null); setPrjForm({ name: '', client: '', value: '', status: 'Active', startDate: '', endDate: '', description: '', contractId: '', mainProjectId: '' });
  };

  const handleAddSubcontractor = async () => {
    if (!subForm.name) return;
    await addSubcontractor({ name: subForm.name, contactPerson: subForm.contactPerson, phone: subForm.phone, email: subForm.email, companyDetails: subForm.companyDetails, status: 'active' });
    setModal(null); setSubForm({ name: '', contactPerson: '', phone: '', email: '', companyDetails: '' });
  };

  const handleAddQuotation = async () => {
    if (!qotForm.client || !qotForm.description) return;
    const val = parseFloat(qotForm.amount) || 0;
    await addQuotation({ client: qotForm.client, description: qotForm.description, amount: val, validUntil: qotForm.validUntil, projectId: qotForm.projectId || null, notes: qotForm.notes, status: 'draft' });
    setModal(null); setQotForm({ client: '', description: '', amount: '', validUntil: '', projectId: '', notes: '' });
  };

  const handleAddInvOut = async () => {
    if (!invOutForm.client || !invOutForm.amount) return;
    const val = parseFloat(invOutForm.amount) || 0;
    await addInvOut({ client: invOutForm.client, description: invOutForm.description, amount: val, issuedDate: invOutForm.issuedDate, dueDate: invOutForm.dueDate, projectId: invOutForm.projectId || null, status: 'draft' });
    setModal(null); setInvOutForm({ client: '', description: '', amount: '', issuedDate: '', dueDate: '', projectId: '' });
  };

  const handleAddInvIn = async () => {
    if (!invInForm.subcontractor || !invInForm.amount) return;
    const val = parseFloat(invInForm.amount) || 0;
    await addInvIn({ subcontractor: invInForm.subcontractor, subcontractorId: invInForm.subcontractorId || null, invoiceRef: invInForm.invoiceRef, description: invInForm.description, amount: val, receivedDate: invInForm.receivedDate, dueDate: invInForm.dueDate, projectId: invInForm.projectId || null, status: 'draft' });
    setModal(null); setInvInForm({ subcontractor: '', subcontractorId: '', invoiceRef: '', description: '', amount: '', receivedDate: '', dueDate: '', projectId: '' });
  };

  const handleRecordPayment = async () => {
    if (!payForm.amount) return;
    const val = parseFloat(payForm.amount) || 0;
    await recordPayment({ 
      direction: payForm.direction, 
      amount: val, 
      paymentDate: payForm.paymentDate || new Date().toISOString().split('T')[0], 
      method: payForm.method, 
      reference: payForm.reference, 
      notes: payForm.notes, 
      projectId: payForm.projectId || null, 
      invoiceId: payForm.invoiceId || null, 
      status: 'completed' 
    });
    setModal(null); setPayForm({ direction: 'in', amount: '', paymentDate: '', method: 'Bank Transfer', reference: '', notes: '', projectId: '', invoiceId: '' });
  };

  /* ── Table header class ─────────────────────────── */
  const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const td = 'px-4 py-3';
  const tdMono = cn(td, 'font-mono text-xs text-slate-400 dark:text-slate-500');

  /* ── Action buttons per status ──────────────────── */
  function WorkflowActions({ status, onApprove, onReject }: { status: string; onApprove: () => void; onReject?: () => void }) {
    if (status === 'draft') return <button onClick={onApprove} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30">Submit</button>;
    if (status === 'pending') return (
      <div className="flex gap-1">
        <button onClick={onApprove} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Approve</button>
        {onReject && <button onClick={onReject} className="text-xs font-bold text-red-600 dark:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">Reject</button>}
      </div>
    );
    if (status === 'approved') return <button onClick={onApprove} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Mark Paid</button>;
    return null;
  }

  /* ── Loading state ──────────────────────────────── */
  const LoadingState = () => (
    <div className="flex items-center justify-center py-20 gap-3 text-slate-400 dark:text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Loading…</span>
    </div>
  );

  const EmptyState = ({ msg }: { msg: string }) => (
    <tr><td colSpan={20} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{msg}</td></tr>
  );

  /* ── New button per tab ─────────────────────────── */
  const addLabel: Record<TabID, string> = {
    contracts: 'New Contract', projects: 'New Project', subcontractors: 'New Subcontractor',
    quotations: 'New Quotation', 'invoices-out': 'New Invoice', 'invoices-in': 'Record Invoice',
    payments: 'Record Payment',
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contracting</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage contracts, projects, invoices, and payments.</p>
        </div>
        {!isEngineer && (
          <button onClick={() => setModal(activeTab)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5">
            <Plus className="w-4 h-4" />{addLabel[activeTab]}
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-gray-900 flex items-center gap-1 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CONTRACTS TAB ═══ */}
      {activeTab === 'contracts' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Active" value={contracts.filter(c => c.status === 'Active').length} color="kpi-emerald" />
            <KPI label="Pending Signatures" value={contracts.filter(c => c.status === 'Pending Signature').length} color="kpi-blue" />
            <KPI label="Expiring Soon" value={contracts.filter(c => c.status === 'Expiring Soon').length} color="kpi-rose" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {ctrLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Title', 'Client', 'Value', 'Start', 'End', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {contracts.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{c.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{c.title}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{c.client}</td>
                        <td className={cn(td, 'font-semibold text-slate-800 dark:text-slate-200 text-right')}>{formatCurrency(c.value)}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{c.startDate}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{c.endDate}</td>
                        <td className={td}><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                    {contracts.length === 0 && <EmptyState msg="No contracts yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ PROJECTS TAB ═══ */}
      {activeTab === 'projects' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Active" value={projects.filter(p => p.status === 'Active').length} color="kpi-emerald" />
            <KPI label="Planning" value={projects.filter(p => p.status === 'Planning').length} color="kpi-blue" />
            <KPI label="Completed" value={projects.filter(p => p.status === 'Completed').length} color="" />
            <KPI label="Total Value" value={formatCurrency(projects.reduce((s, p) => s + p.value, 0))} color="kpi-violet" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {prjLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Project', 'Client', 'Value', 'Contract', 'Start', 'End', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {projects.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{p.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{p.name}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{p.client}</td>
                        <td className={cn(td, 'font-semibold text-slate-800 dark:text-slate-200 text-right')}>{formatCurrency(p.value)}</td>
                        <td className={cn(td, 'text-xs text-blue-600 dark:text-blue-400 font-mono')}>{p.contractId || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.startDate || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.endDate || '—'}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {projects.length === 0 && <EmptyState msg="No projects yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ SUBCONTRACTORS TAB ═══ */}
      {activeTab === 'subcontractors' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Active" value={subcontractors.filter(s => s.status === 'active').length} color="kpi-emerald" />
            <KPI label="Inactive" value={subcontractors.filter(s => s.status === 'inactive').length} color="" />
            <KPI label="Total" value={subcontractors.length} color="kpi-blue" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {subLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Company', 'Contact', 'Phone', 'Email', 'Detail', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subcontractors.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{s.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{s.name}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{s.contactPerson || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{s.phone || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{s.email || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate')}>{s.companyDetails || '—'}</td>
                        <td className={td}><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                    {subcontractors.length === 0 && <EmptyState msg="No subcontractors yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ QUOTATIONS TAB ═══ */}
      {activeTab === 'quotations' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Draft" value={quotations.filter(q => q.status === 'draft').length} color="" />
            <KPI label="Pending" value={quotations.filter(q => q.status === 'pending').length} color="kpi-blue" />
            <KPI label="Approved" value={quotations.filter(q => q.status === 'approved').length} color="kpi-emerald" />
            <KPI label="Total Value" value={formatCurrency(quotations.reduce((s, q) => s + q.amount, 0))} color="kpi-violet" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {qLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Client', 'Description', 'Amount', 'Valid Until', 'Project', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {quotations.map(q => (
                      <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{q.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{q.client}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 max-w-[200px] truncate')}>{q.description}</td>
                        <td className={cn(td, 'font-semibold text-slate-800 dark:text-slate-200 text-right')}>{formatCurrency(q.amount)}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{q.validUntil || '—'}</td>
                        <td className={cn(td, 'text-xs text-blue-600 dark:text-blue-400 font-mono')}>{q.projectId || '—'}</td>
                        <td className={td}><StatusBadge status={q.status} /></td>
                        <td className={td}>
                          <WorkflowActions
                            status={q.status}
                            onApprove={() => updateQuotStatus(q.id, q.status === 'draft' ? 'pending' : 'approved')}
                            onReject={() => updateQuotStatus(q.id, 'rejected')}
                          />
                        </td>
                      </tr>
                    ))}
                    {quotations.length === 0 && <EmptyState msg="No quotations yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ INVOICES OUT TAB ═══ */}
      {activeTab === 'invoices-out' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Draft" value={invoicesOut.filter(i => i.status === 'draft').length} color="" />
            <KPI label="Pending" value={invoicesOut.filter(i => i.status === 'pending').length} color="kpi-blue" />
            <KPI label="Approved" value={formatCurrency(invoicesOut.filter(i => i.status === 'approved').reduce((s, i) => s + i.amount, 0))} color="kpi-emerald" sub="Revenue pending collection" />
            <KPI label="Paid" value={formatCurrency(invoicesOut.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0))} color="kpi-violet" sub="Collected" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {ioLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['Invoice #', 'Client', 'Description', 'Amount', 'Issued', 'Due', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoicesOut.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={cn(td, 'font-mono text-xs text-blue-600 dark:text-blue-400')}>{i.invoiceNumber}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{i.client}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 max-w-[200px] truncate')}>{i.description}</td>
                        <td className={cn(td, 'font-bold text-emerald-600 dark:text-emerald-400 text-right')}>+{formatCurrency(i.amount)}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{i.issuedDate}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{i.dueDate || '—'}</td>
                        <td className={td}><StatusBadge status={i.status} /></td>
                        <td className={td}>
                          <WorkflowActions
                            status={i.status}
                            onApprove={() => updateInvOutStatus(i.id, i.status === 'draft' ? 'pending' : i.status === 'pending' ? 'approved' : 'paid')}
                          />
                        </td>
                      </tr>
                    ))}
                    {invoicesOut.length === 0 && <EmptyState msg="No client invoices yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ INVOICES IN TAB ═══ */}
      {activeTab === 'invoices-in' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Pending" value={invoicesIn.filter(i => i.status === 'pending').length} color="kpi-blue" />
            <KPI label="Approved" value={formatCurrency(invoicesIn.filter(i => i.status === 'approved').reduce((s, i) => s + i.amount, 0))} color="kpi-rose" sub="Cost to settle" />
            <KPI label="Paid" value={formatCurrency(invoicesIn.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0))} color="" sub="Settled" />
            <KPI label="Total Cost" value={formatCurrency(invoicesIn.reduce((s, i) => s + i.amount, 0))} color="kpi-violet" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {iiLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['Ref', 'Subcontractor', 'Description', 'Amount', 'Received', 'Due', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoicesIn.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={cn(td, 'font-mono text-xs text-slate-500 dark:text-slate-400')}>{i.invoiceRef || i.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{i.subcontractor}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 max-w-[200px] truncate')}>{i.description}</td>
                        <td className={cn(td, 'font-bold text-slate-700 dark:text-slate-300 text-right')}>-{formatCurrency(i.amount)}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{i.receivedDate}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{i.dueDate || '—'}</td>
                        <td className={td}><StatusBadge status={i.status} /></td>
                        <td className={td}>
                          <WorkflowActions
                            status={i.status}
                            onApprove={() => updateInvInStatus(i.id, i.status === 'draft' ? 'pending' : i.status === 'pending' ? 'approved' : 'paid')}
                          />
                        </td>
                      </tr>
                    ))}
                    {invoicesIn.length === 0 && <EmptyState msg="No subcontractor invoices yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ PAYMENTS TAB ═══ */}
      {activeTab === 'payments' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Received" value={formatCurrency(payments.filter(p => p.direction === 'in' && p.status === 'completed').reduce((s, p) => s + p.amount, 0))} color="kpi-emerald" sub="From clients" />
            <KPI label="Sent" value={formatCurrency(payments.filter(p => p.direction === 'out' && p.status === 'completed').reduce((s, p) => s + p.amount, 0))} color="kpi-rose" sub="To subcontractors" />
            <KPI label="Pending" value={payments.filter(p => p.status === 'pending').length} color="kpi-blue" />
            <KPI label="Total Transactions" value={payments.length} color="" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {payLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Direction', 'Amount', 'Date', 'Method', 'Reference', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{p.id}</td>
                        <td className={td}>
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                            p.direction === 'in' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                          )}>
                            {p.direction === 'in' ? <><ArrowDownLeft className="w-3 h-3" /> Received</> : <><ArrowUpRight className="w-3 h-3" /> Sent</>}
                          </span>
                        </td>
                        <td className={cn(td, 'font-bold', p.direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300')}>
                          {p.direction === 'in' ? '+' : '-'}{formatCurrency(p.amount)}
                        </td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.paymentDate}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 text-xs')}>{p.method}</td>
                        <td className={cn(td, 'font-mono text-xs text-slate-400 dark:text-slate-500')}>{p.reference || '—'}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {payments.length === 0 && <EmptyState msg="No payments recorded yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ MODALS ═══ */}
      {modal === 'contracts' && (
        <Modal title="New Contract" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Title <span className="text-rose-400">*</span></label>
              <input type="text" value={ctrForm.title} onChange={e => setCtrForm({ ...ctrForm, title: e.target.value })} placeholder="Contract title" className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <input type="text" value={ctrForm.client} onChange={e => setCtrForm({ ...ctrForm, client: e.target.value })} placeholder="Client name" className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Value (QR)</label>
              <input 
                type="text"
                inputMode="decimal"
                value={ctrForm.value} 
                onChange={e => {
                  let val = e.target.value.replace(',', '.');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setCtrForm({ ...ctrForm, value: val });
                }} 
                placeholder="0.00" 
                className={inputCls} 
              /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Start</label>
                <input type="date" value={ctrForm.startDate} onChange={e => setCtrForm({ ...ctrForm, startDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">End</label>
                <input type="date" value={ctrForm.endDate} onChange={e => setCtrForm({ ...ctrForm, endDate: e.target.value })} className={inputCls} /></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddContract} disabled={!ctrForm.title || !ctrForm.client} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Add Contract</button>
          </div>
        </Modal>
      )}

      {modal === 'projects' && (
        <Modal title="New Contracting Project" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Project Name <span className="text-rose-400">*</span></label>
              <input type="text" value={prjForm.name} onChange={e => setPrjForm({ ...prjForm, name: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <input type="text" value={prjForm.client} onChange={e => setPrjForm({ ...prjForm, client: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Value (QR)</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={prjForm.value} 
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setPrjForm({ ...prjForm, value: val });
                  }} 
                  placeholder="0.00" 
                  className={inputCls} 
                /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Linked Contract</label>
                <select
                  value={prjForm.contractId}
                  onChange={e => {
                    const cId = e.target.value;
                    const c = contracts.find(x => x.id === cId);
                    setPrjForm({
                      ...prjForm,
                      contractId: cId,
                      ...(c ? {
                        name: prjForm.name || c.title,
                        client: c.client,
                        value: String(c.value),
                        startDate: prjForm.startDate || c.startDate,
                        endDate: prjForm.endDate || c.endDate,
                      } : {}),
                    });
                  }}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Start</label>
                <input type="date" value={prjForm.startDate} onChange={e => setPrjForm({ ...prjForm, startDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">End</label>
                <input type="date" value={prjForm.endDate} onChange={e => setPrjForm({ ...prjForm, endDate: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input type="text" value={prjForm.description} onChange={e => setPrjForm({ ...prjForm, description: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Link to Main Project</label>
              <select value={prjForm.mainProjectId} onChange={e => setPrjForm({ ...prjForm, mainProjectId: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {mainProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddProject} disabled={!prjForm.name || !prjForm.client} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Add Project</button>
          </div>
        </Modal>
      )}

      {modal === 'subcontractors' && (
        <Modal title="New Subcontractor" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name <span className="text-rose-400">*</span></label>
              <input type="text" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
              <input type="text" value={subForm.contactPerson} onChange={e => setSubForm({ ...subForm, contactPerson: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input type="text" value={subForm.phone} onChange={e => setSubForm({ ...subForm, phone: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Details</label>
              <input type="text" value={subForm.companyDetails} onChange={e => setSubForm({ ...subForm, companyDetails: e.target.value })} placeholder="e.g. Civil works, fleet maintenance" className={inputCls} /></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddSubcontractor} disabled={!subForm.name} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Add Subcontractor</button>
          </div>
        </Modal>
      )}

      {modal === 'quotations' && (
        <Modal title="New Quotation" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <input type="text" value={qotForm.client} onChange={e => setQotForm({ ...qotForm, client: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-rose-400">*</span></label>
              <input type="text" value={qotForm.description} onChange={e => setQotForm({ ...qotForm, description: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (QR)</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={qotForm.amount} 
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setQotForm({ ...qotForm, amount: val });
                  }} 
                  placeholder="0.00" 
                  className={inputCls} 
                /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Valid Until</label>
                <input type="date" value={qotForm.validUntil} onChange={e => setQotForm({ ...qotForm, validUntil: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Linked Project</label>
              <select
                value={qotForm.projectId}
                onChange={e => {
                  const pId = e.target.value;
                  const p = projects.find(x => x.id === pId);
                  setQotForm({
                    ...qotForm,
                    projectId: pId,
                    ...(p ? { client: qotForm.client || p.client } : {}),
                  });
                }}
                className={inputCls}
              >
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddQuotation} disabled={!qotForm.client || !qotForm.description} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Add Quotation</button>
          </div>
        </Modal>
      )}

      {modal === 'invoices-out' && (
        <Modal title="New Invoice to Client" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <input type="text" value={invOutForm.client} onChange={e => setInvOutForm({ ...invOutForm, client: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input type="text" value={invOutForm.description} onChange={e => setInvOutForm({ ...invOutForm, description: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (QR) <span className="text-rose-400">*</span></label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={invOutForm.amount} 
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setInvOutForm({ ...invOutForm, amount: val });
                  }} 
                  placeholder="0.00" 
                  className={inputCls} 
                /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Project</label>
                <select
                  value={invOutForm.projectId}
                  onChange={e => {
                    const pId = e.target.value;
                    const p = projects.find(x => x.id === pId);
                    setInvOutForm({
                      ...invOutForm,
                      projectId: pId,
                      ...(p ? { client: invOutForm.client || p.client } : {}),
                    });
                  }}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Date</label>
                <input type="date" value={invOutForm.issuedDate} onChange={e => setInvOutForm({ ...invOutForm, issuedDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input type="date" value={invOutForm.dueDate} onChange={e => setInvOutForm({ ...invOutForm, dueDate: e.target.value })} className={inputCls} /></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddInvOut} disabled={!invOutForm.client || !invOutForm.amount} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Create Invoice</button>
          </div>
        </Modal>
      )}

      {modal === 'invoices-in' && (
        <Modal title="Record Subcontractor Invoice" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Subcontractor <span className="text-rose-400">*</span></label>
              <select value={invInForm.subcontractorId} onChange={e => {
                const sub = subcontractors.find(s => s.id === e.target.value);
                setInvInForm({ ...invInForm, subcontractorId: e.target.value, subcontractor: sub?.name || '' });
              }} className={inputCls}>
                <option value="">Select subcontractor…</option>
                {subcontractors.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Invoice Ref</label>
                <input type="text" value={invInForm.invoiceRef} onChange={e => setInvInForm({ ...invInForm, invoiceRef: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (QR) <span className="text-rose-400">*</span></label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={invInForm.amount} 
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setInvInForm({ ...invInForm, amount: val });
                  }} 
                  placeholder="0.00" 
                  className={inputCls} 
                /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input type="text" value={invInForm.description} onChange={e => setInvInForm({ ...invInForm, description: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Received</label>
                <input type="date" value={invInForm.receivedDate} onChange={e => setInvInForm({ ...invInForm, receivedDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Due</label>
                <input type="date" value={invInForm.dueDate} onChange={e => setInvInForm({ ...invInForm, dueDate: e.target.value })} className={inputCls} /></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleAddInvIn} disabled={!invInForm.subcontractor || !invInForm.amount} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Record Invoice</button>
          </div>
        </Modal>
      )}

      {modal === 'payments' && (
        <Modal title="Record Payment" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Direction</label>
              <select value={payForm.direction} onChange={e => setPayForm({ ...payForm, direction: e.target.value as 'in' | 'out' })} className={inputCls}>
                <option value="in">Received from Client</option>
                <option value="out">Sent to Subcontractor</option>
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (QR) <span className="text-rose-400">*</span></label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={payForm.amount} 
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setPayForm({ ...payForm, amount: val });
                  }} 
                  placeholder="0.00" 
                  className={inputCls} 
                /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={payForm.paymentDate} onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} className={inputCls}>
                  <option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>Online</option>
                </select></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference</label>
                <input type="text" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="TRF-xxx" className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <input type="text" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleRecordPayment} disabled={!payForm.amount} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl">Record Payment</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
