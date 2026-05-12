import React from 'react';
import { useChangeRequests, ChangeRequest } from '../hooks/useChangeRequests';
import { useTransactions } from '../hooks/useTransactions';
import { 
  Check, X, ArrowRight, User, Calendar, 
  Tag, FileEdit, AlertCircle, Loader2,
  ChevronRight,
  Info
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { isAdminRole } from '../lib/roles';

export default function ChangeRequestQueue() {
  const { user } = useAuthStore();
  const { requests, loading, reviewChangeRequest } = useChangeRequests();
  const { updateTransaction } = useTransactions();
  const [reviewingId, setReviewingId] = React.useState<number | null>(null);

  const isAdmin = isAdminRole(user?.role);
  const pendingRequests = requests.filter(r => r.status === 'pending');

  if (!isAdmin || pendingRequests.length === 0) return null;

  async function handleReview(request: ChangeRequest, status: 'approved' | 'rejected') {
    setReviewingId(request.id);
    try {
      // 1. Update the change_request record
      await reviewChangeRequest(request.id, status);
      
      // 2. If approved, apply the changes to the actual record
      if (status === 'approved' && request.record_type === 'transaction') {
        await updateTransaction(Number(request.record_id), request.new_data);
      }
    } catch (err) {
      console.error('Failed to review request:', err);
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-100 dark:border-amber-900/50 shadow-sm overflow-hidden animate-fade-in-up">
      <div className="px-5 py-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Approval Queue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Review sensitive edits made by team members</p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-amber-500/20 animate-pulse">
          {pendingRequests.length} Pending
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {pendingRequests.map(request => (
          <div key={request.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              {/* Left Side: Metadata */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                    {request.requested_by_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{request.requested_by_name}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Info className="w-3 h-3" /> Reason for edit
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                    "{request.reason || 'No reason provided.'}"
                  </p>
                </div>
              </div>

              {/* Middle Side: The Diff */}
              <div className="flex-[2] grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Original</p>
                  <div className="space-y-1.5">
                    {Object.entries(request.old_data).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-white/50 dark:bg-white/5">
                        <span className="text-slate-500 capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {key === 'amount' ? formatCurrency(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 shadow-sm relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 hidden md:block">
                    <div className="p-1 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 rounded-full text-blue-500 shadow-sm">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2 px-1">Proposed Balance</p>
                  <div className="space-y-1.5">
                    {Object.entries(request.new_data).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-100 dark:ring-blue-900/50">
                        <span className="text-blue-500/70 font-semibold capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {key === 'amount' ? formatCurrency(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="flex flex-col gap-2 min-w-[120px]">
                <button
                  onClick={() => void handleReview(request, 'approved')}
                  disabled={!!reviewingId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {reviewingId === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => void handleReview(request, 'rejected')}
                  disabled={!!reviewingId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
