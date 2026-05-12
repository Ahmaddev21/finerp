import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../store/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  FileText, Briefcase, ReceiptText, BarChart3, Loader2, Clock, ArrowLeftRight,
  CheckCircle2, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { useProjects } from '../hooks/useProjects';
import { useTransactions } from '../hooks/useTransactions';
import { useTasks } from '../hooks/useTasks';
import OnboardingGuide from '../components/OnboardingGuide';
import RevenueBreakdownModal from '../components/RevenueBreakdownModal';
import ChangeRequestQueue from '../components/ChangeRequestQueue';
import { reconcileProjectFinancials } from '../utils/reconciliation';
import { isAdminRole } from '../lib/roles';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-slate-500 dark:text-slate-400 capitalize">{p.name}:</span>
            <span className="font-semibold text-slate-800 dark:text-white">{formatCurrency(p.value)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showRevenueModal, setShowRevenueModal] = useState(false);

  // Live Supabase data
  const { projects, loading: projLoading } = useProjects();
  const { transactions, loading: txLoading } = useTransactions();
  const { tasks } = useTasks();

  const chartData = useMemo(() => {
    const buckets: Record<string, { name: string; inflow: number; outflow: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short' }) + (d.getFullYear() !== now.getFullYear() ? ` '${String(d.getFullYear()).slice(2)}` : '');
      buckets[key] = { name: label, inflow: 0, outflow: 0 };
    }
      // Only approved/paid transactions affect the chart
    transactions
      .filter(t => t.status === 'paid' || t.status === 'approved')
      .forEach(t => {
        const key = (t.date || '').slice(0, 7);
        if (buckets[key]) {
          const amt = Number(t.amount) || 0;
          // Cash Basis logic for chart: Inflow = Receipts, Outflow = Expenses + Petty Cash Out
          if (t.type === 'Receipt' || (t.type === 'Petty Cash' && amt > 0)) {
            buckets[key].inflow += amt;
          } else if (t.type === 'Expense' || (t.type === 'Petty Cash' && amt < 0)) {
            buckets[key].outflow += Math.abs(amt);
          }
        }
      });
    return Object.values(buckets);
  }, [transactions]);

  // ── Financial Calculations (only approved/paid) ──
  const approvedTx = transactions.filter(t => t.status === 'approved' || t.status === 'paid');

  // Revenue (Accrual Basis) = ACTUAL approved Invoices
  const totalRevenue = approvedTx.filter(t => t.type === 'Invoice').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  
  // Expenses = Expenses + Petty Cash Out
  const totalExpenses = approvedTx.filter(t => t.type === 'Expense' || (t.type === 'Petty Cash' && (Number(t.amount) || 0) < 0)).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  
  // Net Profit (Accrual Basis)
  const netProfit = totalRevenue - totalExpenses;

  // Cash Balance = Distinct Actual Cash Movements (Receipts + Petty Cash In) - (Expenses + Petty Cash Out)
  const cashInflow = approvedTx.filter(t => t.type === 'Receipt' || (t.type === 'Petty Cash' && (Number(t.amount) || 0) > 0)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const cashOutflow = totalExpenses; // Expenses typically equal cash outflows in this simple model
  const cashBalance = cashInflow - cashOutflow;

  // Accounts Receivable = submitted invoices (pending/approved) not yet paid — excludes drafts
  const arInvoices = transactions.filter(t =>
    t.type === 'Invoice' &&
    (t.status === 'pending' || t.status === 'approved') &&
    (Number(t.amount) || 0) > 0
  );
  const accountsReceivable = arInvoices.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Collection rate — denominator is issued (non-draft) invoices only
  const allInvoices = transactions.filter(t =>
    t.type === 'Invoice' &&
    t.status !== 'cancelled' &&
    t.status !== 'rejected' &&
    t.status !== 'draft'
  );
  const paidInvoices = allInvoices.filter(t => t.status === 'paid');
  
  // COLLECTION: Total Collected is the sum of Receipts, not just paid invoices
  const totalBilled = allInvoices.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalCollected = approvedTx.filter(t => t.type === 'Receipt').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Pending approvals
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  // Overdue invoices
  const overdueInvoices = transactions.filter(tx =>
    tx.type === 'Invoice' && tx.due_date &&
    new Date(tx.due_date) < new Date() &&
    tx.status !== 'paid' && tx.status !== 'cancelled' && tx.status !== 'rejected'
  );

  // ── Real Trend Calculations (this month vs last month) ──
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const thisMonthTx = approvedTx.filter(t => t.date >= thisMonthStart);
  const lastMonthTx = approvedTx.filter(t => t.date >= lastMonthStart && t.date <= lastMonthEnd);

  const thisMonthRev = thisMonthTx.filter(t => t.type === 'Invoice').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const lastMonthRev = lastMonthTx.filter(t => t.type === 'Invoice').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const thisMonthExp = thisMonthTx.filter(t => t.type === 'Expense' || (t.type === 'Petty Cash' && (Number(t.amount) || 0) < 0)).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const lastMonthExp = lastMonthTx.filter(t => t.type === 'Expense' || (t.type === 'Petty Cash' && (Number(t.amount) || 0) < 0)).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  function calcTrend(current: number, previous: number): { text: string; up: boolean } {
    if (previous === 0 && current === 0) return { text: '', up: true };
    if (previous === 0) return { text: current > 0 ? 'New' : '', up: current > 0 };
    const pct = ((current - previous) / previous) * 100;
    return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 };
  }

  const revTrend = calcTrend(thisMonthRev, lastMonthRev);
  const expTrend = calcTrend(thisMonthExp, lastMonthExp);
  const profitTrend = calcTrend(thisMonthRev - thisMonthExp, lastMonthRev - lastMonthExp);

  // Reconciliation
  const reconciliation = useMemo(
    () => reconcileProjectFinancials(projects, transactions),
    [projects, transactions]
  );
  const unreconciledCount = reconciliation.filter(r => !r.isReconciled).length;

  const kpis = [
    { title: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, trend: revTrend.text, up: revTrend.up, cls: 'kpi-blue', iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400', sub: 'Approved Invoices (Accrual)', onClick: () => { setShowRevenueModal(true); } },
    { title: 'Total Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, trend: expTrend.text, up: false, cls: 'kpi-rose', iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400', sub: 'Approved Expenses/Petty Cash' },
    { title: 'Net Profit', value: formatCurrency(netProfit), icon: Wallet, trend: profitTrend.text, up: profitTrend.up, cls: 'kpi-emerald', iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400', sub: 'Revenue minus expenses' },
    { title: 'Cash Balance', value: formatCurrency(cashBalance), icon: BarChart3, trend: '', up: cashBalance >= 0, cls: 'kpi-violet', iconBg: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400', sub: `Receipts vs. Settled Expenses` },
    { title: 'Accounts Receivable', value: formatCurrency(accountsReceivable), icon: Clock, trend: '', up: false, cls: 'kpi-amber', iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', sub: `${arInvoices.length} outstanding invoice${arInvoices.length !== 1 ? 's' : ''}` },
  ];

  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const isLoading = projLoading || txLoading;

  const statusBadge = (s: string) => {
    switch (s) {
      case 'draft': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
      case 'approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
      case 'paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">

      {/* Welcome Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, <span className="gradient-text">{user?.name}</span> 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here's what's happening with your business today.</p>
        </div>
      </div>

      {/* Onboarding Guide */}
      <OnboardingGuide projectCount={projects.length} transactionCount={transactions.length} />

      {/* Approval Queue (Admin Only) */}
      <ChangeRequestQueue />

      {/* Alerts Bar */}
      {(pendingCount > 0 || overdueInvoices.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {pendingCount > 0 && isAdminRole(user?.role) && (
            <button onClick={() => navigate('/accounting')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
              <ShieldCheck className="w-4 h-4" />
              {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending approval
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
          {overdueInvoices.length > 0 && (
            <button onClick={() => navigate('/accounting')}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} ({formatCurrency(overdueInvoices.reduce((s, t) => s + t.amount, 0))})
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger">
        {kpis.map(k => (
          <div key={k.title}
            onClick={k.onClick}
            className={cn(
              'bg-white dark:bg-gray-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 card-hover',
              k.cls, k.onClick && 'cursor-pointer'
            )}>
            <div className="flex items-start justify-between mb-3">
              <div className={cn('p-2 rounded-lg', k.iconBg)}>
                <k.icon className="w-4 h-4" />
              </div>
              {k.trend ? (
                <span className={cn(
                  'flex items-center gap-0.5 text-sm font-semibold px-2 py-0.5 rounded',
                  k.up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                       : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                )}>
                  {k.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {k.trend}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{k.title}</p>
            {isLoading
              ? <div className="flex items-center gap-2 h-7"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
              : <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">{k.value}</p>
            }
            {!isLoading && k.sub && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">{k.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Cash Flow — Last 6 Months</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Only approved/paid transactions</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Live data
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} dx={-4} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)', radius: 6 }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                <Bar dataKey="inflow" fill="#6366f1" radius={[5, 5, 0, 0]} name="Cash In" maxBarSize={36} />
                <Bar dataKey="outflow" fill="#f43f5e" radius={[5, 5, 0, 0]} name="Cash Out" maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions + Collection Rate */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Quick Actions</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">Jump to common tasks</p>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Create Invoice', path: '/accounting', icon: FileText, color: 'indigo' },
              { label: 'Record Expense', path: '/accounting', icon: ReceiptText, color: 'rose' },
              { label: 'New Project', path: '/projects', icon: Briefcase, color: 'emerald' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-${a.color}-300 dark:hover:border-${a.color}-700 hover:bg-${a.color}-50 dark:hover:bg-${a.color}-950/30 transition-all group`}>
                <div className={`p-2 bg-${a.color}-50 dark:bg-${a.color}-950/50 text-${a.color}-600 dark:text-${a.color}-400 rounded-lg group-hover:scale-110 transition-transform`}>
                  <a.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{a.label}</span>
                <ArrowUpRight className={`w-4 h-4 text-slate-300 dark:text-slate-600 ml-auto group-hover:text-${a.color}-500 transition-colors`} />
              </button>
            ))}
          </div>
          {/* Money Acquisition Panel */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Money Acquisition</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">Invoice billing → cash collection rate</p>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total Billed</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(totalBilled)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Collected</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(totalCollected)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Outstanding (AR)</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(totalBilled - totalCollected)}</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-500 dark:text-slate-400">Collection Rate</span>
                <span className={cn('text-sm font-bold',
                  collectionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  collectionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                )}>{collectionRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                <div className={cn('h-1.5 rounded-full transition-all duration-700',
                  collectionRate >= 80 ? 'bg-emerald-500' :
                  collectionRate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                )} style={{ width: `${collectionRate}%` }} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatCurrency(totalCollected)} collected from QR {formatCurrency(totalBilled)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Widget */}
      {projects.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Reconciliation Status</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Project financials vs. actual approved transactions</p>
            </div>
            {unreconciledCount === 0 ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" /> All Reconciled
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold">
                <AlertTriangle className="w-4 h-4" /> {unreconciledCount} discrepanc{unreconciledCount === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-left">
                  <th className="px-5 py-3 font-semibold text-sm uppercase tracking-wider">Project</th>
                  <th className="px-5 py-3 font-semibold text-sm uppercase tracking-wider text-right">Book Revenue</th>
                  <th className="px-5 py-3 font-semibold text-sm uppercase tracking-wider text-right">Actual Revenue</th>
                  <th className="px-5 py-3 font-semibold text-sm uppercase tracking-wider text-right">Gap</th>
                  <th className="px-5 py-3 font-semibold text-sm uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reconciliation.slice(0, 5).map(r => (
                  <tr key={r.projectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{r.projectName}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(r.bookRevenue)}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(r.actualRevenue)}</td>
                    <td className={cn('px-5 py-3 text-right font-bold tabular-nums',
                      Math.abs(r.revenueGap) < 10 ? 'text-slate-400' :
                      r.revenueGap > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {r.revenueGap >= 0 ? '+' : '-'}{formatCurrency(Math.abs(r.revenueGap))}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {r.isReconciled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> Gap
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Latest financial activity</p>
          </div>
          <button onClick={() => navigate('/accounting')} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">View all →</button>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Loading…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-left">
                  {['Date', 'Description', 'Type', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 font-semibold text-sm uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-sm font-mono">{tx.date}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{tx.desc}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold',
                        tx.type === 'Invoice' || tx.type === 'Receipt' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      )}>{tx.type}</span>
                    </td>
                    <td className={cn('px-5 py-3.5 font-bold', tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300')}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold', statusBadge(tx.status))}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentTx.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Projects', value: projects.filter(p => p.status === 'Active').length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'In Planning', value: projects.filter(p => p.status === 'Planning').length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'On Hold', value: projects.filter(p => p.status === 'On Hold').length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Open Tasks', value: openTasks.length, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
        ].map(item => (
          <button key={item.label} onClick={() => navigate(item.label === 'Open Tasks' ? '/tasks' : '/projects')}
            className={cn('p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left card-hover cursor-pointer', item.bg)}>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">{item.label}</p>
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" />
              : <p className={cn('text-3xl font-extrabold', item.color)}>{item.value}</p>
            }
          </button>
        ))}
      </div>

      {/* Revenue Breakdown Modal */}
      <RevenueBreakdownModal
        isOpen={showRevenueModal}
        onClose={() => setShowRevenueModal(false)}
        transactions={transactions}
      />
    </div>
  );
}
