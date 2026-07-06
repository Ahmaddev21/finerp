import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { useProjects, calcProjectFinancials } from '../hooks/useProjects';
import { useContractingProjects } from '../hooks/useContractingProjects';
import { useContractingInvoicesOut } from '../hooks/useContractingInvoicesOut';
import { useContractingInvoicesIn } from '../hooks/useContractingInvoicesIn';
import { useConsultancyInvoicesOut } from '../hooks/useConsultancyInvoicesOut';
import { useConsultancyInvoicesIn } from '../hooks/useConsultancyInvoicesIn';
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, FileText,
  Truck, Users, Percent, Edit2, Save, X, Loader2,
  CreditCard, BarChart2, Clock,
} from 'lucide-react';

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all';

// Numeric input that stores as string to prevent leading-zero bug
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="0.00"
        onChange={e => {
          const val = e.target.value.replace(',', '.');
          if (val === '' || /^\d*\.?\d*$/.test(val)) onChange(val);
        }}
        className={inputCls}
      />
    </div>
  );
}

type EditState = {
  name: string; client: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  revenue: string; investment: string; expenses: string;
  additional_costs: string; payment_received: string;
};

export default function ProjectDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { projects, loading, updateProject } = useProjects();
  const { projects: ctrProjects } = useContractingProjects();
  const { invoices: ctrInvOut } = useContractingInvoicesOut();
  const { invoices: ctrInvIn } = useContractingInvoicesIn();
  const { invoices: conInvOut } = useConsultancyInvoicesOut();
  const { invoices: conInvIn } = useConsultancyInvoicesIn();
  const project = projects.find(p => p.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm]   = useState<EditState>({
    name: '', client: '', status: 'Active',
    revenue: '', investment: '', expenses: '', additional_costs: '', payment_received: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setEditForm({
        name:             project.name,
        client:           project.client,
        status:           project.status,
        revenue:          project.revenue          > 0 ? String(project.revenue)          : '',
        investment:       project.investment       > 0 ? String(project.investment)       : '',
        expenses:         project.expenses         > 0 ? String(project.expenses)         : '',
        additional_costs: project.additional_costs > 0 ? String(project.additional_costs) : '',
        payment_received: project.payment_received > 0 ? String(project.payment_received) : '',
      });
    }
  }, [project]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400 dark:text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" /> <span className="font-medium">Loading project…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-3">Project not found</p>
        <button onClick={() => navigate('/projects')} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
          Return to Projects
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await updateProject(project.id, {
      name:             editForm.name.trim(),
      client:           editForm.client.trim(),
      status:           editForm.status,
      revenue:          parseFloat(editForm.revenue)          || 0,
      investment:       parseFloat(editForm.investment)       || 0,
      expenses:         parseFloat(editForm.expenses)         || 0,
      additional_costs: parseFloat(editForm.additional_costs) || 0,
      payment_received: parseFloat(editForm.payment_received) || 0,
    });
    setSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({
      name: project.name, client: project.client, status: project.status,
      revenue:          project.revenue          > 0 ? String(project.revenue)          : '',
      investment:       project.investment       > 0 ? String(project.investment)       : '',
      expenses:         project.expenses         > 0 ? String(project.expenses)         : '',
      additional_costs: project.additional_costs > 0 ? String(project.additional_costs) : '',
      payment_received: project.payment_received > 0 ? String(project.payment_received) : '',
    });
    setIsEditing(false);
  };

  const { totalCost, netProfit, pendingBalance, profitMargin } = calcProjectFinancials(project);

  const statusBadge = cn(
    'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border',
    project.status === 'Active'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
    project.status === 'Planning'  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' :
    project.status === 'Completed' ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                   : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Hero Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{project.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{project.client}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{project.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={statusBadge}>{project.status}</span>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Financial KPIs ── */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Financial Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Contract Value',
              value: formatCurrency(project.revenue),
              icon: TrendingUp,
              bg: 'bg-blue-50 dark:bg-blue-950/40',
              iconColor: 'text-blue-600 dark:text-blue-400',
              valueColor: 'text-blue-700 dark:text-blue-300',
            },
            {
              label: 'Total Cost',
              value: formatCurrency(totalCost),
              icon: TrendingDown,
              bg: 'bg-rose-50 dark:bg-rose-950/40',
              iconColor: 'text-rose-600 dark:text-rose-400',
              valueColor: 'text-rose-700 dark:text-rose-300',
            },
            {
              label: 'Net Profit',
              value: formatCurrency(netProfit),
              icon: Wallet,
              bg: netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40',
              iconColor: netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              valueColor: netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
            },
            {
              label: 'Profit Margin',
              value: `${profitMargin.toFixed(1)}%`,
              icon: Percent,
              bg: 'bg-violet-50 dark:bg-violet-950/40',
              iconColor: 'text-violet-600 dark:text-violet-400',
              valueColor: profitMargin >= 15 ? 'text-emerald-700 dark:text-emerald-300' : profitMargin > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300',
            },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded-xl', c.bg)}>
                  <c.icon className={cn('w-4 h-4', c.iconColor)} />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</span>
              </div>
              <p className={cn('text-2xl font-extrabold', c.valueColor)}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cost & Payment Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cost breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
              <BarChart2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Cost Breakdown</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Company Investment', value: project.investment,       color: 'bg-blue-500' },
              { label: 'Operating Expenses', value: project.expenses,         color: 'bg-amber-500' },
              { label: 'Additional Costs',   value: project.additional_costs, color: 'bg-rose-500' },
            ].map(row => {
              const pct = totalCost > 0 ? (row.value / totalCost) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{row.label}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(row.value)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', row.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">Total Cost</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Payment tracking */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Payment Tracking</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Contract Value</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(project.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Payment Received</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(project.payment_received)}</span>
            </div>
            {/* Progress bar */}
            {project.revenue > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Collected</span>
                  <span>{Math.min(100, (project.payment_received / project.revenue * 100)).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, project.payment_received / project.revenue * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Pending Balance</span>
              </div>
              <span className={cn('font-bold text-lg', pendingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {formatCurrency(Math.max(0, pendingBalance))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Linked Module Revenue ── */}
      {(() => {
        const linkedCtrIds = new Set(ctrProjects.filter(cp => cp.mainProjectId === project.id).map(cp => cp.id));
        const ctrRevenue   = ctrInvOut.filter(i => i.projectId && linkedCtrIds.has(i.projectId)).reduce((s, i) => s + i.amount, 0);
        const ctrCost      = ctrInvIn.filter(i => i.projectId && linkedCtrIds.has(i.projectId)).reduce((s, i) => s + i.amount, 0);
        const conRevenue   = conInvOut.filter(i => i.mainProjectId === project.id).reduce((s, i) => s + i.amount, 0);
        const conCost      = conInvIn.filter(i => i.mainProjectId === project.id).reduce((s, i) => s + i.convertedAmount, 0);
        const totalLinkedRevenue = ctrRevenue + conRevenue;
        const totalLinkedCost    = ctrCost + conCost;
        const linkedProjectCount = linkedCtrIds.size;
        const hasLinked = linkedProjectCount > 0 || conInvOut.some(i => i.mainProjectId === project.id) || conInvIn.some(i => i.mainProjectId === project.id);
        return (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Linked Module Revenue</h2>
            {!hasLinked ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No contracting projects or consultancy invoices linked to this project yet. Link them from the Contracting and Consultation modules.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contracting */}
                <Link to="/erp/contracting" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-5 card-hover group block">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform"><FileText className="w-5 h-5" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Contracting</h3>
                      <p className="text-xs text-slate-400">{linkedProjectCount} linked project{linkedProjectCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Revenue (invoiced)</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(ctrRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Subcontractor costs</span><span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(ctrCost)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800"><span className="font-bold text-slate-700 dark:text-slate-300">Net</span><span className={cn('font-bold', ctrRevenue - ctrCost >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatCurrency(ctrRevenue - ctrCost)}</span></div>
                  </div>
                </Link>
                {/* Consultation */}
                <Link to="/erp/consultation" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 p-5 card-hover group block">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl group-hover:scale-110 transition-transform"><Users className="w-5 h-5" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Consultation</h3>
                      <p className="text-xs text-slate-400">{conInvOut.filter(i => i.mainProjectId === project.id).length} linked invoice{conInvOut.filter(i => i.mainProjectId === project.id).length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Revenue (to clients)</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(conRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Partner costs</span><span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(conCost)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800"><span className="font-bold text-slate-700 dark:text-slate-300">Net</span><span className={cn('font-bold', conRevenue - conCost >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatCurrency(conRevenue - conCost)}</span></div>
                  </div>
                </Link>
              </div>
            )}
            {hasLinked && (
              <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-3 flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /><span className="text-slate-500 dark:text-slate-400">Total Module Revenue</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLinkedRevenue)}</span></div>
                <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /><span className="text-slate-500 dark:text-slate-400">Total Module Cost</span><span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalLinkedCost)}</span></div>
                <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-500" /><span className="text-slate-500 dark:text-slate-400">Net</span><span className={cn('font-bold', totalLinkedRevenue - totalLinkedCost >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatCurrency(totalLinkedRevenue - totalLinkedCost)}</span></div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/erp/contracting" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-5 card-hover group block">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><FileText className="w-5 h-5" /></div>
          <h3 className="font-bold text-slate-900 dark:text-white">Contracting</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage contracts and invoices.</p>
        </Link>
        <Link to="/erp/delivery" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 p-5 card-hover group block">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><Truck className="w-5 h-5" /></div>
          <h3 className="font-bold text-slate-900 dark:text-white">Delivery</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track supply and delivery operations.</p>
        </Link>
        <Link to="/erp/consultation" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 p-5 card-hover group block">
          <div className="p-2.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><Users className="w-5 h-5" /></div>
          <h3 className="font-bold text-slate-900 dark:text-white">Consultation</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Advisory and consulting services.</p>
        </Link>
      </div>

      {/* ── Edit Modal ── */}
      {isEditing && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto animate-fade-in">
          <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Project</h3>
              <button onClick={handleCancel} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Project Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Client</label>
                <input type="text" value={editForm.client} onChange={e => setEditForm({ ...editForm, client: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as EditState['status'] })} className={inputCls}>
                  <option>Active</option><option>Planning</option><option>On Hold</option><option>Completed</option>
                </select>
              </div>

              <div className="pt-1">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Financial Details (QR)</p>
                <div className="space-y-3">
                  <NumField label="Contract Value"      value={editForm.revenue}          onChange={v => setEditForm({ ...editForm, revenue:          v })} />
                  <NumField label="Company Investment"  value={editForm.investment}       onChange={v => setEditForm({ ...editForm, investment:       v })} />
                  <NumField label="Operating Expenses"  value={editForm.expenses}         onChange={v => setEditForm({ ...editForm, expenses:         v })} />
                  <NumField label="Additional Costs"    value={editForm.additional_costs} onChange={v => setEditForm({ ...editForm, additional_costs: v })} />
                  <NumField label="Payment Received"    value={editForm.payment_received} onChange={v => setEditForm({ ...editForm, payment_received: v })} />
                </div>
              </div>

              {/* Live preview in edit modal */}
              {(() => {
                const r  = parseFloat(editForm.revenue)          || 0;
                const i  = parseFloat(editForm.investment)       || 0;
                const ex = parseFloat(editForm.expenses)         || 0;
                const ac = parseFloat(editForm.additional_costs) || 0;
                const pr = parseFloat(editForm.payment_received) || 0;
                const tc = i + ex + ac;
                const np = r - tc;
                const pb = r - pr;
                return (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1.5">Calculated</p>
                    <div className="flex justify-between"><span className="text-slate-500">Total Cost</span><span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(tc)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Net Profit</span><span className={cn('font-bold', np >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatCurrency(np)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Pending Balance</span><span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(Math.max(0, pb))}</span></div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={handleCancel} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
