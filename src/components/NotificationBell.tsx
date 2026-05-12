import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../hooks/useNotifications';
import { dismissNotification } from '../hooks/useNotifications';

interface Props {
  notifications: Notification[];
  onDismiss: () => void;
}

export default function NotificationBell({ notifications, onDismiss }: Props & { key?: React.Key }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = notifications.length;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBg = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30';
      case 'medium': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30';
      default: return 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30';
    }
  };

  const handleClick = (n: Notification) => {
    dismissNotification(n.id);
    navigate(n.link);
    setOpen(false);
    onDismiss();
  };

  const handleDismissAll = () => {
    notifications.forEach(n => dismissNotification(n.id));
    setOpen(false);
    onDismiss();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[28rem] bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50"
          style={{ animation: 'menuFadeIn 0.15s ease forwards' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
            {unread > 0 && (
              <button onClick={handleDismissAll} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                <CheckCheck className="w-3.5 h-3.5" /> Dismiss all
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">All caught up</p>
                <p className="text-xs text-slate-300 dark:text-slate-600">No pending notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3 group`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${getBg(n.severity)}`}>
                    {getIcon(n.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{n.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
