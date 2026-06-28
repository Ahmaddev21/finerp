import React, { useState } from 'react';
import {
  Users, Clock, Star, Plus, X, Loader2,
  Globe, Building2, ArrowDownLeft, ArrowUpRight, CreditCard,
  Receipt, Mail, Phone, Pencil, Trash2, Paperclip,
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { useProjects } from '../hooks/useProjects';
import { useEngagements, EngagementStatus } from '../hooks/useEngagements';
import { useConsultancyPartners } from '../hooks/useConsultancyPartners';
import { useConsultancyClients } from '../hooks/useConsultancyClients';
import { useConsultancyInvoicesIn, EXCHANGE_RATES, SupportedCurrency } from '../hooks/useConsultancyInvoicesIn';
import { useConsultancyInvoicesOut } from '../hooks/useConsultancyInvoicesOut';
import { useConsultancyPayments } from '../hooks/useConsultancyPayments';
import { RowMenu } from '../components/RowMenu';
import DocumentAttachmentModal from '../components/DocumentAttachmentModal';

const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all';

/* ── Status badge ──────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    Completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'On Hold': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
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
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

/* ── Workflow Actions ──────────────────────────── */
function WorkflowActions({ status, onApprove, onReject }: { status: string; onApprove: () => void; onReject?: () => void }) {
  if (status === 'draft') return <button onClick={onApprove} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30">Submit</button>;
  if (status === 'pending') return (
    <div className="flex gap-1">
      <button onClick={onApprove} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Approve</button>
      {onReject && <button onClick={onReject} className="text-xs font-bold text-red-600 dark:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">Reject</button>}
    </div>
  );
  if (status === 'approved') return <button onClick={onApprove} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Mark Paid</button>;
  return null;
}

/* ── Tab config ────────────────────────────────── */
type TabID = 'engagements' | 'partners' | 'clients' | 'invoices-in' | 'invoices-out' | 'payments';

const tabDefs: { id: TabID; label: string; icon: any }[] = [
  { id: 'engagements', label: 'Engagements', icon: Users },
  { id: 'partners', label: 'EU Partners', icon: Globe },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'invoices-in', label: 'Invoices ← Partners', icon: ArrowDownLeft },
  { id: 'invoices-out', label: 'Invoices → Clients', icon: ArrowUpRight },
  { id: 'payments', label: 'Payments', icon: CreditCard },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Consultation() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabID>('engagements');
  const [modal, setModal] = useState<string | null>(null);

  // Data hooks
  const { engagements, loading: engLoading, addEngagement, logHours, updateEngagement, deleteEngagement } = useEngagements();
  const { partners, loading: ptrLoading, addPartner, updatePartner, deletePartner } = useConsultancyPartners();
  const { clients, loading: clLoading, addClient, updateClient, deleteClient } = useConsultancyClients();
  const { invoices: invoicesIn, loading: iiLoading, addInvoice: addInvIn, updateInvoice: updateConsInvIn, updateStatus: updateInvInStatus, deleteInvoice: deleteConsInvIn } = useConsultancyInvoicesIn();
  const { invoices: invoicesOut, loading: ioLoading, addInvoice: addInvOut, updateInvoice: updateConsInvOut, updateStatus: updateInvOutStatus, deleteInvoice: deleteConsInvOut } = useConsultancyInvoicesOut();
  const { payments, loading: payLoading, recordPayment } = useConsultancyPayments();
  const { projects: mainProjects } = useProjects();

  // Forms
  const [engForm, setEngForm] = useState({ client: '', service: '', consultant: '', hourlyRate: '', startDate: '' });
  const [ptrForm, setPtrForm] = useState({ name: '', country: '', contactPerson: '', contactEmail: '', contactPhone: '', notes: '' });
  const [clForm, setClForm] = useState({ name: '', country: 'Qatar', contactPerson: '', contactEmail: '', contactPhone: '', industry: '', notes: '' });
  const [invInForm, setInvInForm] = useState({ partnerId: '', invoiceRef: '', description: '', currency: 'EUR' as SupportedCurrency, originalAmount: '', projectId: '', receivedDate: '', dueDate: '', mainProjectId: '' });
  const [invOutForm, setInvOutForm] = useState({ clientId: '', description: '', amount: '', projectId: '', issuedDate: '', dueDate: '', mainProjectId: '' });
  const [payForm, setPayForm] = useState({ invoiceId: '', clientId: '', client: '', amount: '', paymentDate: '', method: 'Bank Transfer', reference: '', notes: '' });

  const [logModal, setLogModal] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState('');

  // Edit IDs
  const [editEngId, setEditEngId] = useState<string | null>(null);
  const [editPtrId, setEditPtrId] = useState<string | null>(null);
  const [editClId, setEditClId] = useState<string | null>(null);
  const [editInvInId, setEditInvInId] = useState<string | null>(null);
  const [editInvOutId, setEditInvOutId] = useState<string | null>(null);

  // Attachment modal
  const [attachTarget, setAttachTarget] = useState<{ id: string; table: string; url?: string } | null>(null);

  // Computed
  const totalHours = engagements.reduce((s, e) => s + e.hoursBilled, 0);
  const totalRevenue = engagements.reduce((s, e) => s + (e.hoursBilled * e.hourlyRate), 0);
  const activeCount = engagements.filter(e => e.status === 'Active').length;

  // Compute exchange
  const computedRate = EXCHANGE_RATES[invInForm.currency] || 1;
  const computedQR = (parseFloat(invInForm.originalAmount) || 0) * computedRate;

  const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const td = 'px-4 py-3';
  const tdMono = cn(td, 'font-mono text-xs text-slate-400 dark:text-slate-500');

  const LoadingState = () => (
    <div className="flex items-center justify-center py-20 gap-3 text-slate-400 dark:text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Loading…</span>
    </div>
  );
  const EmptyState = ({ msg }: { msg: string }) => (
    <tr><td colSpan={20} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{msg}</td></tr>
  );

  const addLabel: Record<TabID, string> = {
    engagements: 'New Engagement', partners: 'New Partner', clients: 'New Client',
    'invoices-in': 'Record Invoice', 'invoices-out': 'New Invoice', payments: 'Record Payment',
  };

  /* ── Save handlers ───────────────────────────────── */
  const handleSaveEngagement = async () => {
    if (!engForm.client || !engForm.service) return;
    if (editEngId) {
      await updateEngagement(editEngId, { client: engForm.client, consultant: engForm.consultant || user?.name || 'Unassigned', service: engForm.service, hourlyRate: parseFloat(engForm.hourlyRate) || 0, startDate: engForm.startDate });
    } else {
      await addEngagement({ client: engForm.client, consultant: engForm.consultant || user?.name || 'Unassigned', service: engForm.service, hourlyRate: parseFloat(engForm.hourlyRate) || 0, hoursBilled: 0, startDate: engForm.startDate || new Date().toISOString().split('T')[0], status: 'Active' });
    }
    setModal(null); setEditEngId(null); setEngForm({ client: '', service: '', consultant: '', hourlyRate: '', startDate: '' });
  };

  const handleLogHours = async () => {
    if (!logModal || !hoursInput) return;
    await logHours(logModal, parseFloat(hoursInput));
    setLogModal(null); setHoursInput('');
  };

  const handleSavePartner = async () => {
    if (!ptrForm.name) return;
    if (editPtrId) {
      await updatePartner(editPtrId, { name: ptrForm.name, country: ptrForm.country, contactPerson: ptrForm.contactPerson, contactEmail: ptrForm.contactEmail, contactPhone: ptrForm.contactPhone, notes: ptrForm.notes });
    } else {
      await addPartner({ name: ptrForm.name, country: ptrForm.country, contactPerson: ptrForm.contactPerson, contactEmail: ptrForm.contactEmail, contactPhone: ptrForm.contactPhone, status: 'active', notes: ptrForm.notes });
    }
    setModal(null); setEditPtrId(null); setPtrForm({ name: '', country: '', contactPerson: '', contactEmail: '', contactPhone: '', notes: '' });
  };

  const handleSaveClient = async () => {
    if (!clForm.name) return;
    if (editClId) {
      await updateClient(editClId, { name: clForm.name, country: clForm.country, contactPerson: clForm.contactPerson, contactEmail: clForm.contactEmail, contactPhone: clForm.contactPhone, industry: clForm.industry, notes: clForm.notes });
    } else {
      await addClient({ name: clForm.name, country: clForm.country, contactPerson: clForm.contactPerson, contactEmail: clForm.contactEmail, contactPhone: clForm.contactPhone, industry: clForm.industry, status: 'active', notes: clForm.notes });
    }
    setModal(null); setEditClId(null); setClForm({ name: '', country: 'Qatar', contactPerson: '', contactEmail: '', contactPhone: '', industry: '', notes: '' });
  };

  const handleSaveInvIn = async () => {
    if (!invInForm.partnerId || !invInForm.originalAmount) return;
    const partner = partners.find(p => p.id === invInForm.partnerId);
    const origAmt = parseFloat(invInForm.originalAmount) || 0;
    if (editInvInId) {
      await updateConsInvIn(editInvInId, {
        partnerId: invInForm.partnerId, partnerName: partner?.name || '',
        projectId: invInForm.projectId, invoiceRef: invInForm.invoiceRef,
        description: invInForm.description, currency: invInForm.currency,
        originalAmount: origAmt, exchangeRate: computedRate, convertedAmount: origAmt * computedRate,
        receivedDate: invInForm.receivedDate, dueDate: invInForm.dueDate,
        mainProjectId: invInForm.mainProjectId || null,
      });
    } else {
      await addInvIn({
        partnerId: invInForm.partnerId, partnerName: partner?.name || '',
        projectId: invInForm.projectId, invoiceRef: invInForm.invoiceRef,
        description: invInForm.description, currency: invInForm.currency,
        originalAmount: origAmt,
        exchangeRate: computedRate, convertedAmount: computedQR,
        status: 'draft', receivedDate: invInForm.receivedDate, dueDate: invInForm.dueDate,
        mainProjectId: invInForm.mainProjectId || null,
      });
    }
    setModal(null); setEditInvInId(null); setInvInForm({ partnerId: '', invoiceRef: '', description: '', currency: 'EUR', originalAmount: '', projectId: '', receivedDate: '', dueDate: '', mainProjectId: '' });
  };

  const handleSaveInvOut = async () => {
    if (!invOutForm.clientId || !invOutForm.amount) return;
    const client = clients.find(c => c.id === invOutForm.clientId);
    if (editInvOutId) {
      await updateConsInvOut(editInvOutId, {
        clientId: invOutForm.clientId, client: client?.name || '',
        projectId: invOutForm.projectId, description: invOutForm.description,
        amount: parseFloat(invOutForm.amount) || 0,
        issuedDate: invOutForm.issuedDate, dueDate: invOutForm.dueDate,
        mainProjectId: invOutForm.mainProjectId || null,
      });
    } else {
      await addInvOut({
        clientId: invOutForm.clientId, client: client?.name || '',
        projectId: invOutForm.projectId, description: invOutForm.description,
        amount: parseFloat(invOutForm.amount) || 0, status: 'draft',
        issuedDate: invOutForm.issuedDate, dueDate: invOutForm.dueDate,
        mainProjectId: invOutForm.mainProjectId || null,
      });
    }
    setModal(null); setEditInvOutId(null); setInvOutForm({ clientId: '', description: '', amount: '', projectId: '', issuedDate: '', dueDate: '', mainProjectId: '' });
  };

  const handleRecordPayment = async () => {
    if (!payForm.client || !payForm.amount) return;
    await recordPayment({
      invoiceId: payForm.invoiceId || null, clientId: payForm.clientId || null,
      client: payForm.client, amount: parseFloat(payForm.amount) || 0,
      paymentDate: payForm.paymentDate, method: payForm.method,
      reference: payForm.reference, notes: payForm.notes, status: 'completed',
    });
    setModal(null); setPayForm({ invoiceId: '', clientId: '', client: '', amount: '', paymentDate: '', method: 'Bank Transfer', reference: '', notes: '' });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consultancy</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Advisory services, partners, clients, and financials.</p>
        </div>
        <button onClick={() => {
          // Clear edit state when opening new entry
          if (activeTab === 'engagements') { setEditEngId(null); setEngForm({ client: '', service: '', consultant: '', hourlyRate: '', startDate: '' }); }
          if (activeTab === 'partners') { setEditPtrId(null); setPtrForm({ name: '', country: '', contactPerson: '', contactEmail: '', contactPhone: '', notes: '' }); }
          if (activeTab === 'clients') { setEditClId(null); setClForm({ name: '', country: 'Qatar', contactPerson: '', contactEmail: '', contactPhone: '', industry: '', notes: '' }); }
          if (activeTab === 'invoices-in') { setEditInvInId(null); setInvInForm({ partnerId: '', invoiceRef: '', description: '', currency: 'EUR', originalAmount: '', projectId: '', receivedDate: '', dueDate: '', mainProjectId: '' }); }
          if (activeTab === 'invoices-out') { setEditInvOutId(null); setInvOutForm({ clientId: '', description: '', amount: '', projectId: '', issuedDate: '', dueDate: '', mainProjectId: '' }); }
          setModal(activeTab);
        }} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5">
          <Plus className="w-4 h-4" />{addLabel[activeTab]}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-gray-900 flex items-center gap-1 overflow-x-auto">
        {tabDefs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ ENGAGEMENTS TAB ═══ */}
      {activeTab === 'engagements' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Active Engagements" value={activeCount} color="kpi-violet" />
            <KPI label="Hours Billed" value={`${totalHours}h`} color="kpi-blue" />
            <KPI label="Billed Revenue" value={formatCurrency(totalRevenue)} color="kpi-emerald" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {engLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Client', 'Service', 'Consultant', 'Rate/hr', 'Hours', 'Total', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {engagements.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{e.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{e.client}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{e.service}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{e.consultant}</td>
                        <td className={cn(td, 'text-slate-800 dark:text-slate-200')}>QR {e.hourlyRate}</td>
                        <td className={cn(td, 'font-semibold text-slate-800 dark:text-slate-200')}>{e.hoursBilled}h</td>
                        <td className={cn(td, 'font-bold text-emerald-600 dark:text-emerald-400')}>{formatCurrency(e.hoursBilled * e.hourlyRate)}</td>
                        <td className={td}><StatusBadge status={e.status} /></td>
                        <td className={td}>
                          <div className="flex items-center gap-1">
                            {e.status === 'Active' && (
                              <button onClick={() => { setLogModal(e.id); setHoursInput(''); }}
                                className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30">
                                + Log Hours
                              </button>
                            )}
                            <RowMenu actions={[
                              { label: 'Edit', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-indigo-500', onClick: () => { setEngForm({ client: e.client, service: e.service, consultant: e.consultant, hourlyRate: String(e.hourlyRate), startDate: e.startDate }); setEditEngId(e.id); setModal('engagements'); } },
                              { label: 'Attach File', icon: <Paperclip className="w-4 h-4" />, iconCls: 'text-blue-500', onClick: () => setAttachTarget({ id: e.id, table: 'engagements', url: e.attachment_url }) },
                              { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, iconCls: 'text-red-500', danger: true, onClick: () => { if (window.confirm('Delete this engagement?')) deleteEngagement(e.id); } },
                            ]} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {engagements.length === 0 && <EmptyState msg="No engagements yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ PARTNERS TAB ═══ */}
      {activeTab === 'partners' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Active Partners" value={partners.filter(p => p.status === 'active').length} color="kpi-emerald" />
            <KPI label="Countries" value={new Set(partners.map(p => p.country).filter(Boolean)).size} color="kpi-blue" />
            <KPI label="Total" value={partners.length} color="" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {ptrLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Partner', 'Country', 'Contact', 'Email', 'Phone', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {partners.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{p.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{p.name}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Globe className="w-3.5 h-3.5 text-blue-500" />{p.country || '—'}
                          </span>
                        </td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{p.contactPerson || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.contactEmail || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.contactPhone || '—'}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                        <td className={td}>
                          <RowMenu actions={[
                            { label: 'Edit', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-indigo-500', onClick: () => { setPtrForm({ name: p.name, country: p.country, contactPerson: p.contactPerson, contactEmail: p.contactEmail, contactPhone: p.contactPhone, notes: p.notes }); setEditPtrId(p.id); setModal('partners'); } },
                            { label: 'Attach File', icon: <Paperclip className="w-4 h-4" />, iconCls: 'text-blue-500', onClick: () => setAttachTarget({ id: p.id, table: 'consultancy_partners', url: p.attachment_url }) },
                            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, iconCls: 'text-red-500', danger: true, onClick: () => { if (window.confirm('Delete this partner?')) deletePartner(p.id); } },
                          ]} />
                        </td>
                      </tr>
                    ))}
                    {partners.length === 0 && <EmptyState msg="No partners yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ CLIENTS TAB ═══ */}
      {activeTab === 'clients' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Active Clients" value={clients.filter(c => c.status === 'active').length} color="kpi-emerald" />
            <KPI label="Industries" value={new Set(clients.map(c => c.industry).filter(Boolean)).size} color="kpi-violet" />
            <KPI label="Total" value={clients.length} color="" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {clLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Client', 'Industry', 'Country', 'Contact', 'Email', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clients.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{c.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{c.name}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{c.industry || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{c.country || '—'}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300')}>{c.contactPerson || '—'}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{c.contactEmail || '—'}</td>
                        <td className={td}><StatusBadge status={c.status} /></td>
                        <td className={td}>
                          <RowMenu actions={[
                            { label: 'Edit', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-indigo-500', onClick: () => { setClForm({ name: c.name, country: c.country, contactPerson: c.contactPerson, contactEmail: c.contactEmail, contactPhone: c.contactPhone, industry: c.industry, notes: c.notes }); setEditClId(c.id); setModal('clients'); } },
                            { label: 'Attach File', icon: <Paperclip className="w-4 h-4" />, iconCls: 'text-blue-500', onClick: () => setAttachTarget({ id: c.id, table: 'consultancy_clients', url: c.attachment_url }) },
                            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, iconCls: 'text-red-500', danger: true, onClick: () => { if (window.confirm('Delete this client?')) deleteClient(c.id); } },
                          ]} />
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && <EmptyState msg="No clients yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ INVOICES IN (from partners) TAB ═══ */}
      {activeTab === 'invoices-in' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Pending" value={invoicesIn.filter(i => i.status === 'pending').length} color="kpi-blue" />
            <KPI label="Approved Cost" value={formatCurrency(invoicesIn.filter(i => i.status === 'approved').reduce((s, i) => s + i.convertedAmount, 0))} color="kpi-rose" sub="In QR" />
            <KPI label="Paid" value={formatCurrency(invoicesIn.filter(i => i.status === 'paid').reduce((s, i) => s + i.convertedAmount, 0))} color="" sub="Settled" />
            <KPI label="Total Cost" value={formatCurrency(invoicesIn.reduce((s, i) => s + i.convertedAmount, 0))} color="kpi-violet" sub="All invoices in QR" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {iiLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['Ref', 'Partner', 'Description', 'Currency', 'Original', 'Rate', 'QR Amount', 'Status', 'Actions'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoicesIn.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={cn(td, 'font-mono text-xs text-slate-500')}>{i.invoiceRef || i.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{i.partnerName}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 max-w-[180px] truncate')}>{i.description}</td>
                        <td className={td}>
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold',
                            i.currency === 'EUR' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          )}>{i.currency}</span>
                        </td>
                        <td className={cn(td, 'text-slate-700 dark:text-slate-300 font-semibold')}>{i.currency} {i.originalAmount.toLocaleString()}</td>
                        <td className={cn(td, 'text-slate-400 dark:text-slate-500 text-xs')}>{i.exchangeRate}</td>
                        <td className={cn(td, 'font-bold text-slate-700 dark:text-slate-300')}>-{formatCurrency(i.convertedAmount)}</td>
                        <td className={td}><StatusBadge status={i.status} /></td>
                        <td className={td}>
                          <div className="flex items-center gap-1">
                            <WorkflowActions
                              status={i.status}
                              onApprove={() => updateInvInStatus(i.id, i.status === 'draft' ? 'pending' : i.status === 'pending' ? 'approved' : 'paid')}
                            />
                            <RowMenu actions={[
                              { label: 'Edit', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-indigo-500', onClick: () => { setInvInForm({ partnerId: i.partnerId || '', invoiceRef: i.invoiceRef, description: i.description, currency: i.currency, originalAmount: String(i.originalAmount), projectId: i.projectId, receivedDate: i.receivedDate, dueDate: i.dueDate, mainProjectId: i.mainProjectId || '' }); setEditInvInId(i.id); setModal('invoices-in'); } },
                              { label: 'Attach File', icon: <Paperclip className="w-4 h-4" />, iconCls: 'text-blue-500', onClick: () => setAttachTarget({ id: i.id, table: 'consultancy_invoices_in', url: i.attachment_url }) },
                              { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, iconCls: 'text-red-500', danger: true, onClick: () => { if (window.confirm('Delete this invoice?')) deleteConsInvIn(i.id); } },
                            ]} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {invoicesIn.length === 0 && <EmptyState msg="No partner invoices yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ INVOICES OUT (to clients) TAB ═══ */}
      {activeTab === 'invoices-out' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Draft" value={invoicesOut.filter(i => i.status === 'draft').length} color="" />
            <KPI label="Pending" value={invoicesOut.filter(i => i.status === 'pending').length} color="kpi-blue" />
            <KPI label="Approved" value={formatCurrency(invoicesOut.filter(i => i.status === 'approved').reduce((s, i) => s + i.amount, 0))} color="kpi-emerald" sub="Revenue pending" />
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
                          <div className="flex items-center gap-1">
                            <WorkflowActions
                              status={i.status}
                              onApprove={() => updateInvOutStatus(i.id, i.status === 'draft' ? 'pending' : i.status === 'pending' ? 'approved' : 'paid')}
                            />
                            <RowMenu actions={[
                              { label: 'Edit', icon: <Pencil className="w-4 h-4" />, iconCls: 'text-indigo-500', onClick: () => { setInvOutForm({ clientId: i.clientId || '', description: i.description, amount: String(i.amount), projectId: i.projectId, issuedDate: i.issuedDate, dueDate: i.dueDate, mainProjectId: i.mainProjectId || '' }); setEditInvOutId(i.id); setModal('invoices-out'); } },
                              { label: 'Attach File', icon: <Paperclip className="w-4 h-4" />, iconCls: 'text-blue-500', onClick: () => setAttachTarget({ id: i.id, table: 'consultancy_invoices_out', url: i.attachment_url }) },
                              { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, iconCls: 'text-red-500', danger: true, onClick: () => { if (window.confirm('Delete this invoice?')) deleteConsInvOut(i.id); } },
                            ]} />
                          </div>
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

      {/* ═══ PAYMENTS TAB ═══ */}
      {activeTab === 'payments' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Collected" value={formatCurrency(payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0))} color="kpi-emerald" sub="From clients" />
            <KPI label="Pending" value={payments.filter(p => p.status === 'pending').length} color="kpi-blue" />
            <KPI label="Total Payments" value={payments.length} color="" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {payLoading ? <LoadingState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50/60 dark:bg-slate-800/40"><tr>
                    {['ID', 'Client', 'Amount', 'Date', 'Method', 'Reference', 'Invoice', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={tdMono}>{p.id}</td>
                        <td className={cn(td, 'font-semibold text-slate-900 dark:text-slate-100')}>{p.client}</td>
                        <td className={cn(td, 'font-bold text-emerald-600 dark:text-emerald-400')}>+{formatCurrency(p.amount)}</td>
                        <td className={cn(td, 'text-slate-500 dark:text-slate-400 text-xs')}>{p.paymentDate}</td>
                        <td className={cn(td, 'text-slate-600 dark:text-slate-300 text-xs')}>{p.method}</td>
                        <td className={cn(td, 'font-mono text-xs text-slate-400')}>{p.reference || '—'}</td>
                        <td className={cn(td, 'font-mono text-xs text-blue-600 dark:text-blue-400')}>{p.invoiceId || '—'}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {payments.length === 0 && <EmptyState msg="No payments yet." />}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Engagement */}
      {modal === 'engagements' && (
        <Modal title={editEngId ? 'Edit Engagement' : 'New Engagement'} onClose={() => { setModal(null); setEditEngId(null); }}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <input type="text" value={engForm.client} onChange={e => setEngForm({ ...engForm, client: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Service <span className="text-rose-400">*</span></label>
              <input type="text" value={engForm.service} onChange={e => setEngForm({ ...engForm, service: e.target.value })} placeholder="e.g. IT Strategy Advisory" className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Consultant</label>
                <input type="text" value={engForm.consultant} onChange={e => setEngForm({ ...engForm, consultant: e.target.value })} placeholder={user?.name} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Rate/hr (QR)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={engForm.hourlyRate}
                  onChange={e => {
                    let val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setEngForm({ ...engForm, hourlyRate: val });
                  }}
                  placeholder="0.00"
                  className={inputCls}
                /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input type="date" value={engForm.startDate} onChange={e => setEngForm({ ...engForm, startDate: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => { setModal(null); setEditEngId(null); }} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleSaveEngagement} disabled={!engForm.client || !engForm.service} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">{editEngId ? 'Save Changes' : 'Add Engagement'}</button>
          </div>
        </Modal>
      )}

      {/* Partner */}
      {modal === 'partners' && (
        <Modal title={editPtrId ? 'Edit Partner' : 'New European Partner'} onClose={() => { setModal(null); setEditPtrId(null); }}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name <span className="text-rose-400">*</span></label>
              <input type="text" value={ptrForm.name} onChange={e => setPtrForm({ ...ptrForm, name: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Country</label>
              <input type="text" value={ptrForm.country} onChange={e => setPtrForm({ ...ptrForm, country: e.target.value })} placeholder="e.g. Germany, France" className={inputCls} /></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
              <input type="text" value={ptrForm.contactPerson} onChange={e => setPtrForm({ ...ptrForm, contactPerson: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={ptrForm.contactEmail} onChange={e => setPtrForm({ ...ptrForm, contactEmail: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input type="text" value={ptrForm.contactPhone} onChange={e => setPtrForm({ ...ptrForm, contactPhone: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <input type="text" value={ptrForm.notes} onChange={e => setPtrForm({ ...ptrForm, notes: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => { setModal(null); setEditPtrId(null); }} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleSavePartner} disabled={!ptrForm.name} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">{editPtrId ? 'Save Changes' : 'Add Partner'}</button>
          </div>
        </Modal>
      )}

      {/* Client */}
      {modal === 'clients' && (
        <Modal title={editClId ? 'Edit Client' : 'New Client'} onClose={() => { setModal(null); setEditClId(null); }}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name <span className="text-rose-400">*</span></label>
              <input type="text" value={clForm.name} onChange={e => setClForm({ ...clForm, name: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                <input type="text" value={clForm.industry} onChange={e => setClForm({ ...clForm, industry: e.target.value })} placeholder="e.g. Technology" className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Country</label>
                <input type="text" value={clForm.country} onChange={e => setClForm({ ...clForm, country: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
              <input type="text" value={clForm.contactPerson} onChange={e => setClForm({ ...clForm, contactPerson: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={clForm.contactEmail} onChange={e => setClForm({ ...clForm, contactEmail: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input type="text" value={clForm.contactPhone} onChange={e => setClForm({ ...clForm, contactPhone: e.target.value })} className={inputCls} /></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => { setModal(null); setEditClId(null); }} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleSaveClient} disabled={!clForm.name} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">{editClId ? 'Save Changes' : 'Add Client'}</button>
          </div>
        </Modal>
      )}

      {/* Invoice In (from partner — multi-currency) */}
      {modal === 'invoices-in' && (
        <Modal title={editInvInId ? 'Edit Partner Invoice' : 'Record Partner Invoice'} onClose={() => { setModal(null); setEditInvInId(null); }}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Partner <span className="text-rose-400">*</span></label>
              <select value={invInForm.partnerId} onChange={e => setInvInForm({ ...invInForm, partnerId: e.target.value })} className={inputCls}>
                <option value="">Select partner…</option>
                {partners.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name} ({p.country})</option>)}
              </select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Invoice Ref</label>
                <input type="text" value={invInForm.invoiceRef} onChange={e => setInvInForm({ ...invInForm, invoiceRef: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Project</label>
                <input type="text" value={invInForm.projectId} onChange={e => setInvInForm({ ...invInForm, projectId: e.target.value })} placeholder="e.g. IT Strategy" className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input type="text" value={invInForm.description} onChange={e => setInvInForm({ ...invInForm, description: e.target.value })} className={inputCls} /></div>

            {/* Multi-currency input */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Currency Conversion</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                  <select value={invInForm.currency} onChange={e => setInvInForm({ ...invInForm, currency: e.target.value as SupportedCurrency })} className={inputCls}>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="QR">QR</option>
                  </select></div>
                <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={invInForm.originalAmount}
                    onChange={e => {
                      let val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) setInvInForm({ ...invInForm, originalAmount: val });
                    }}
                    placeholder="0.00"
                    className={inputCls}
                  /></div>
                <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Rate → QR</label>
                  <input type="text" value={computedRate.toFixed(4)} readOnly className={cn(inputCls, 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed')} /></div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Converted amount:</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">QR {computedQR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Received</label>
                <input type="date" value={invInForm.receivedDate} onChange={e => setInvInForm({ ...invInForm, receivedDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Due</label>
                <input type="date" value={invInForm.dueDate} onChange={e => setInvInForm({ ...invInForm, dueDate: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Link to Main Project</label>
              <select value={invInForm.mainProjectId} onChange={e => setInvInForm({ ...invInForm, mainProjectId: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {mainProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => { setModal(null); setEditInvInId(null); }} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleSaveInvIn} disabled={!invInForm.partnerId || !invInForm.originalAmount} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">{editInvInId ? 'Save Changes' : 'Record Invoice'}</button>
          </div>
        </Modal>
      )}

      {/* Invoice Out (to client) */}
      {modal === 'invoices-out' && (
        <Modal title={editInvOutId ? 'Edit Invoice to Client' : 'New Invoice to Client'} onClose={() => { setModal(null); setEditInvOutId(null); }}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <select value={invOutForm.clientId} onChange={e => setInvOutForm({ ...invOutForm, clientId: e.target.value })} className={inputCls}>
                <option value="">Select client…</option>
                {clients.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input type="text" value={invOutForm.description} onChange={e => setInvOutForm({ ...invOutForm, description: e.target.value })} className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <input type="text" value={invOutForm.projectId} onChange={e => setInvOutForm({ ...invOutForm, projectId: e.target.value })} placeholder="e.g. IT Strategy" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Date</label>
                <input type="date" value={invOutForm.issuedDate} onChange={e => setInvOutForm({ ...invOutForm, issuedDate: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input type="date" value={invOutForm.dueDate} onChange={e => setInvOutForm({ ...invOutForm, dueDate: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Link to Main Project</label>
              <select value={invOutForm.mainProjectId} onChange={e => setInvOutForm({ ...invOutForm, mainProjectId: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {mainProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => { setModal(null); setEditInvOutId(null); }} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleSaveInvOut} disabled={!invOutForm.clientId || !invOutForm.amount} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">{editInvOutId ? 'Save Changes' : 'Create Invoice'}</button>
          </div>
        </Modal>
      )}

      {/* Payment */}
      {modal === 'payments' && (
        <Modal title="Record Client Payment" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client <span className="text-rose-400">*</span></label>
              <select value={payForm.clientId} onChange={e => {
                const cl = clients.find(c => c.id === e.target.value);
                setPayForm({ ...payForm, clientId: e.target.value, client: cl?.name || '' });
              }} className={inputCls}>
                <option value="">Select client…</option>
                {clients.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Linked Invoice</label>
              <select value={payForm.invoiceId} onChange={e => setPayForm({ ...payForm, invoiceId: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {invoicesOut.filter(i => i.status === 'approved').map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.client} ({formatCurrency(i.amount)})</option>)}
              </select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} className={inputCls}>
                  <option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>Online</option>
                </select></div>
              <div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference</label>
                <input type="text" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} className={inputCls} /></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleRecordPayment} disabled={!payForm.client || !payForm.amount} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl">Record Payment</button>
          </div>
        </Modal>
      )}

      {/* Log Hours Modal */}
      {logModal && (
        <Modal title="Log Hours" onClose={() => setLogModal(null)}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Hours to add <span className="text-rose-400">*</span></label>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={hoursInput}
              onChange={e => {
                let val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) setHoursInput(val);
              }}
              placeholder="e.g. 4.5"
              className={inputCls}
            />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setLogModal(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
            <button onClick={handleLogHours} disabled={!hoursInput} className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl flex items-center gap-2">
              <Clock className="w-4 h-4" /> Save Hours
            </button>
          </div>
        </Modal>
      )}

      {/* Document Attachment Modal */}
      {attachTarget && (
        <DocumentAttachmentModal
          isOpen={true}
          onClose={() => setAttachTarget(null)}
          recordId={attachTarget.id}
          tableName={attachTarget.table}
          currentAttachmentUrl={attachTarget.url}
          onUploadSuccess={url => {
            setAttachTarget(prev => prev ? { ...prev, url } : null);
          }}
        />
      )}
    </div>
  );
}
