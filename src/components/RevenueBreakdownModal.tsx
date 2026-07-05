import React, { useState, useMemo } from 'react';
import { X, Search, TrendingUp, AlertTriangle, DollarSign, Filter } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import type { Transaction } from '../hooks/useTransactions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

type GroupBy = 'none' | 'project' | 'client' | 'status';

export default function RevenueBreakdownModal({ isOpen, onClose, transactions }: Props) {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  React.useEffect(() => {
    if (isOpen) {
      console.log('RevenueBreakdownModal: Mounted with', transactions.length, 'transactions');
    }
  }, [isOpen, transactions.length]);

  // Revenue invoices — exclude voided records
  const invoices = transactions.filter(tx =>
    tx.type === 'Invoice' &&
    tx.amount > 0 &&
    tx.status !== 'cancelled' &&
    tx.status !== 'rejected'
  );

  const filtered = invoices.filter(tx => {
    const q = search.toLowerCase();
    const desc = (tx.desc || '').toLowerCase();
    const proj = (tx.project || '').toLowerCase();
    const client = (tx.client_name || '').toLowerCase();
    const inv = (tx.invoice_number || '').toLowerCase();
    
    return !q ||
      desc.includes(q) ||
      proj.includes(q) ||
      client.includes(q) ||
      inv.includes(q);
  });

  // Totals
  const totalInvoiced = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalApproved = filtered.filter(t => t.status === 'approved' || t.status === 'paid').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalPaid = filtered.filter(t => t.status === 'paid').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalPending = filtered.filter(t => t.status === 'pending' || t.status === 'draft').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Grouped
  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, Transaction[]>();
    filtered.forEach(tx => {
      const key = groupBy === 'project' ? (tx.project || 'No Project') :
                  groupBy === 'client' ? (tx.client_name || 'No Client') :
                  (tx.status || 'draft');
      map.set(key, [...(map.get(key) || []), tx]);
    });
    return [...map.entries()].sort((a, b) => {
      const sumA = a[1].reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const sumB = b[1].reduce((s, t) => s + (Number(t.amount) || 0), 0);
      return sumB - sumA;
    });
  }, [filtered, groupBy]);

  const isOverdue = (tx: Transaction) =>
    tx.due_date && new Date(tx.due_date) < new Date() && tx.status !== 'paid';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" 
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Revenue Breakdown
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{filtered.length} invoices found</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 pt-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">Total Invoiced</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totalInvoiced)}</p>
          </div>
          <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Approved</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalApproved)}</p>
          </div>
          <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Paid</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
            <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">Pending</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalPending)}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="px-5 pt-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-slate-200"
            />
          </div>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 cursor-pointer">
            <option value="none">No Grouping</option>
            <option value="project">By Project</option>
            <option value="client">By Client</option>
            <option value="status">By Status</option>
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {groups ? (
            groups.map(([group, txs]) => (
              <div key={group} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{group}</h4>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(txs.reduce((s, t) => s + t.amount, 0))}</span>
                </div>
                <InvoiceTable invoices={txs} isOverdue={isOverdue} />
              </div>
            ))
          ) : (
            <InvoiceTable invoices={filtered} isOverdue={isOverdue} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <p className="text-sm text-slate-400">Only approved/paid invoices affect dashboard KPIs</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Grand Total: {formatCurrency(totalInvoiced)}</p>
        </div>
      </div>
    </div>
  );
}

function InvoiceTable({ invoices, isOverdue }: { invoices: Transaction[]; isOverdue: (tx: Transaction) => boolean }) {
  const statusColor: Record<string, string> = {
    draft: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
    pending: 'text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300',
    approved: 'text-blue-700 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300',
    paid: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300',
    rejected: 'text-red-700 bg-red-100 dark:bg-red-950/40 dark:text-red-300',
  };

  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-sm text-slate-400">
        <tr>
          <th className="text-left py-2 font-semibold">Inv #</th>
          <th className="text-left py-2 font-semibold">Description</th>
          <th className="text-left py-2 font-semibold">Client</th>
          <th className="text-right py-2 font-semibold">Amount</th>
          <th className="text-center py-2 font-semibold">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
        {invoices.map(tx => (
          <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
            <td className="py-2.5 font-mono text-sm text-blue-600 dark:text-blue-400">{tx.invoice_number || '—'}</td>
            <td className="py-2.5 text-slate-700 dark:text-slate-300">{tx.desc}</td>
            <td className="py-2.5 text-slate-500 dark:text-slate-400 text-sm">{tx.client_name || tx.project}</td>
            <td className="py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(tx.amount)}</td>
            <td className="py-2.5 text-center">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-semibold ${statusColor[tx.status] || statusColor.draft}`}>
                {tx.status}
                {isOverdue(tx) && <AlertTriangle className="w-3 h-3 text-red-500" />}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
