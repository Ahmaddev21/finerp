import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, AlertTriangle, CheckCircle, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { isAdminRole } from '../lib/roles';

function downloadCSV(logs: any[]) {
  const headers = ['ID', 'Timestamp', 'User', 'Action', 'Table', 'Record', 'Details'];
  const rows = logs.map(l => [l.id, l.time, l.user, l.action, l.table, l.record, l.details]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const { logs, loading, error, refetch } = useAuditLogs();

  if (!isAdminRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const filtered = logs.filter(l =>
    l.user.includes(search) ||
    l.action.includes(search.toUpperCase()) ||
    l.table.includes(search) ||
    l.details.toLowerCase().includes(search.toLowerCase())
  );

  const actionStyle = (a: string) => cn(
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold',
    a === 'CREATE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
    a === 'UPDATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
    'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
  );

  const actionIcon = (a: string) =>
    a === 'CREATE' ? <CheckCircle className="w-3 h-3" /> :
    a === 'UPDATE' ? <Clock className="w-3 h-3" /> :
    <AlertTriangle className="w-3 h-3" />;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            System activity and change history.
            {isSupabaseConfigured && <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">● Live</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-52 transition-all" />
          </div>
          <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => downloadCSV(filtered)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <FileText className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Supabase not configured — showing seed data. Add <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> to your <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">.env</code> file.</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Loading logs…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/60 dark:bg-slate-800/40">
                <tr>
                  {['Timestamp', 'User', 'Action', 'Table', 'Record ID', 'Details'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{log.time}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">{log.user}</td>
                    <td className="px-5 py-3.5"><span className={actionStyle(log.action)}>{actionIcon(log.action)}{log.action}</span></td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{log.table}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-500">{log.record}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 text-sm">{log.details}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">No logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
