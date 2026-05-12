import React, { useState, useEffect } from 'react';
import {
  UserPlus, Calendar, Clock, Phone, MessageSquare, Plus,
  Search, Loader2, X, AlertCircle, Trash2,
  Users, UserCheck, TrendingUp, User,
} from 'lucide-react';
import { useDailyVisitors } from '../hooks/useDailyVisitors';
import { cn } from '../lib/utils';

/* ── UI Components ───────────────────────────────── */
const inputCls = 'w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all';
const th = 'px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500';
const td = 'px-4 py-4 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/50';

export default function DailyVisitors() {
  const { visitors, loading, error, fetchVisitors, addVisitor, deleteVisitor } = useDailyVisitors();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVisitor, setNewVisitor] = useState({
    visitor_name: '',
    visit_date_time: new Date().toISOString().slice(0, 16),
    purpose: '',
    mobile_number: '',
    remarks: '',
  });

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const handleAdd = async () => {
    if (!newVisitor.visitor_name.trim() || !newVisitor.purpose.trim() || !newVisitor.mobile_number.trim()) return;
    try {
      await addVisitor({
        ...newVisitor,
        visitor_name: newVisitor.visitor_name.trim(),
        visit_date_time: new Date(newVisitor.visit_date_time).toISOString(),
      });
      setIsModalOpen(false);
      setNewVisitor({
        visitor_name: '',
        visit_date_time: new Date().toISOString().slice(0, 16),
        purpose: '',
        mobile_number: '',
        remarks: '',
      });
    } catch (err) {
      console.error('Failed to add visitor:', err);
    }
  };

  const filteredVisitors = visitors.filter(v => {
    const q = searchTerm.toLowerCase();
    return (
      (v.visitor_name || '').toLowerCase().includes(q) ||
      v.purpose.toLowerCase().includes(q) ||
      v.mobile_number.includes(searchTerm) ||
      (v.remarks || '').toLowerCase().includes(q)
    );
  });

  const totalVisitors = visitors.length;
  const visitorsToday = visitors.filter(v => {
    const today = new Date().toISOString().split('T')[0];
    return v.visit_date_time.startsWith(today);
  }).length;

  const isFormValid =
    newVisitor.visitor_name.trim() &&
    newVisitor.purpose.trim() &&
    newVisitor.mobile_number.trim();

  return (
    <React.Fragment>
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-7 h-7 text-indigo-600" />
              Daily Visitors
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Maintain a secure record of all guests and office visits.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Record Visit
          </button>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl text-white shadow-xl">
            <div className="relative z-10">
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Visitors</p>
              <h2 className="text-4xl font-black mb-1">{totalVisitors}</h2>
              <p className="text-indigo-200 text-[10px] font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> All-time records
              </p>
            </div>
            <Users className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Visited Today</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">{visitorsToday}</h2>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, purpose…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">Error: {error}</p>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                <tr>
                  <th className={th}>Visitor Name</th>
                  <th className={th}>Date & Time</th>
                  <th className={th}>Purpose of Visit</th>
                  <th className={th}>Mobile Number</th>
                  <th className={th}>Remarks</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {loading && visitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">Fetching records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 text-sm">
                      No visitor records found.
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map(visitor => (
                    <tr key={visitor.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className={td}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {visitor.visitor_name || <span className="text-slate-400 italic font-normal">—</span>}
                          </span>
                        </div>
                      </td>
                      <td className={td}>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {new Date(visitor.visit_date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(visitor.visit_date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="font-medium uppercase tracking-tight text-xs text-slate-700 dark:text-slate-300">
                            {visitor.purpose}
                          </span>
                        </div>
                      </td>
                      <td className={td}>
                        <span className="font-mono text-xs flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {visitor.mobile_number}
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex items-start gap-2 max-w-xs">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                          <p className="text-xs italic text-slate-500 dark:text-slate-400 line-clamp-2">
                            {visitor.remarks || 'No remarks'}
                          </p>
                        </div>
                      </td>
                      <td className={cn(td, 'text-right')}>
                        <button
                          onClick={() => { if (confirm('Delete this record?')) deleteVisitor(visitor.id); }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-indigo-600" /> Record Visit
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Visitor Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Ahmad Al-Mansour"
                    value={newVisitor.visitor_name}
                    onChange={e => setNewVisitor({ ...newVisitor, visitor_name: e.target.value })}
                    className={cn(inputCls, 'pl-11')}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Visit Date & Time</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={newVisitor.visit_date_time}
                    onChange={e => setNewVisitor({ ...newVisitor, visit_date_time: e.target.value })}
                    className={cn(inputCls, 'pl-11')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Purpose of Visit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Meeting, Interview, Maintenance"
                  value={newVisitor.purpose}
                  onChange={e => setNewVisitor({ ...newVisitor, purpose: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="e.g. +974 XXXX XXXX"
                    value={newVisitor.mobile_number}
                    onChange={e => setNewVisitor({ ...newVisitor, mobile_number: e.target.value })}
                    className={cn(inputCls, 'pl-11')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Any additional details..."
                  value={newVisitor.remarks}
                  onChange={e => setNewVisitor({ ...newVisitor, remarks: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!isFormValid || loading}
                className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl transition-all hover:shadow-lg active:scale-95 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}
