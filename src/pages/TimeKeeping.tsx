import React, { useState, useMemo } from 'react';
import {
  Clock, Plus, X, Trash2, Edit2, Loader2, Users,
  CheckCircle2, XCircle, AlertCircle, Coffee, CalendarDays,
  ChevronLeft, ChevronRight, Search, MinusCircle, TrendingUp,
  BarChart2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { useAttendance, AttendanceRecord, AttendanceStatus, AttendanceMember } from '../hooks/useAttendance';
import { roleLabel } from '../lib/roles';

// ── date helpers (local-timezone safe — no toISOString) ───────────────────────

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00'); // noon avoids any DST/timezone edge
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt24(t: string | null) { return t ? t.slice(0, 5) : '—'; }

function getWeekBounds(today: string): [string, string] {
  const d = new Date(today + 'T12:00:00');
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day; // Monday = start
  const mon = new Date(d);
  mon.setDate(d.getDate() + offset);
  const start = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
  return [start, today];
}

function getMonthBounds(today: string): [string, string] {
  return [today.slice(0, 8) + '01', today];
}

function fmtMonthLabel(today: string) {
  return new Date(today + 'T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function fmtWeekLabel(start: string, end: string) {
  const s = new Date(start + 'T12:00:00').toLocaleString('en-US', { day: 'numeric', month: 'short' });
  const e = new Date(end   + 'T12:00:00').toLocaleString('en-US', { day: 'numeric', month: 'short' });
  return `${s} – ${e}`;
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<AttendanceStatus, { label: string; cls: string; border: string; icon: React.ReactNode; color: string }> = {
  present:  { label: 'Present',  color: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-400', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  absent:   { label: 'Absent',   color: 'text-rose-600    dark:text-rose-400',    border: 'border-l-rose-400',    cls: 'bg-rose-50    text-rose-700    dark:bg-rose-950/30    dark:text-rose-400',    icon: <XCircle      className="w-3.5 h-3.5" /> },
  late:     { label: 'Late',     color: 'text-amber-600  dark:text-amber-400',   border: 'border-l-amber-400',   cls: 'bg-amber-50   text-amber-700   dark:bg-amber-950/30   dark:text-amber-400',   icon: <AlertCircle  className="w-3.5 h-3.5" /> },
  half_day: { label: 'Half Day', color: 'text-sky-600    dark:text-sky-400',     border: 'border-l-sky-400',     cls: 'bg-sky-50     text-sky-700     dark:bg-sky-950/30     dark:text-sky-400',     icon: <Coffee       className="w-3.5 h-3.5" /> },
  leave:    { label: 'On Leave', color: 'text-violet-600 dark:text-violet-400',  border: 'border-l-violet-400',  cls: 'bg-violet-50  text-violet-700  dark:bg-violet-950/30  dark:text-violet-400',  icon: <CalendarDays className="w-3.5 h-3.5" /> },
};

const ROLE_BADGE: Record<string, string> = {
  owner:        'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  admin:        'bg-blue-100   text-blue-700   dark:bg-blue-950/40   dark:text-blue-300',
  bdm:          'bg-amber-100  text-amber-700  dark:bg-amber-950/40  dark:text-amber-300',
  engineer:     'bg-teal-100   text-teal-700   dark:bg-teal-950/40   dark:text-teal-300',
  receptionist: 'bg-pink-100   text-pink-700   dark:bg-pink-950/40   dark:text-pink-300',
  developer:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  intern:       'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
};

const ALL_ROLES = ['owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'] as const;
const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'leave'];

const LEAVE_REASONS = [
  'Sick leave', 'Annual vacation', 'Emergency leave', 'Personal leave',
  'Maternity/Paternity leave', 'Unpaid leave', 'Doctor appointment', 'No show', 'Other',
];

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shadow-sm';

// ── form types ────────────────────────────────────────────────────────────────

interface FormState {
  employeeId: string; employeeName: string; role: string; date: string;
  checkIn: string; checkOut: string; status: AttendanceStatus; leaveReason: string; notes: string;
}

function blankForm(date: string, prefill?: { employeeId?: string; employeeName?: string; role?: string }): FormState {
  return { employeeId: prefill?.employeeId ?? '', employeeName: prefill?.employeeName ?? '',
    role: prefill?.role ?? '', date, checkIn: '', checkOut: '', status: 'present', leaveReason: '', notes: '' };
}

// ── modal ─────────────────────────────────────────────────────────────────────

function RecordModal({ mode, form, members, existingKeys, onChange, onSave, onClose, saving }: {
  mode: 'add' | 'edit'; form: FormState; members: AttendanceMember[]; existingKeys: Set<string>;
  onChange: (f: FormState) => void; onSave: () => void; onClose: () => void; saving: boolean;
}) {
  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });
  const showTime   = ['present', 'late', 'half_day'].includes(form.status);
  const showReason = ['absent', 'leave', 'half_day'].includes(form.status);
  const today      = todayLocal();

  const isDuplicate = mode === 'add' && !!form.employeeName.trim() && !!form.date
    && existingKeys.has(`${form.employeeName.trim().toLowerCase()}|${form.date}`);
  const canSave = !!form.employeeName.trim() && !!form.role && !!form.date && !isDuplicate;

  const handleStatusChange = (s: AttendanceStatus) => set({
    status: s,
    checkIn:     (s === 'absent' || s === 'leave') ? '' : form.checkIn,
    checkOut:    (s === 'absent' || s === 'leave') ? '' : form.checkOut,
    leaveReason: (s === 'present' || s === 'late') ? '' : form.leaveReason,
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 w-[18px] h-[18px] text-indigo-500" />
              {mode === 'add' ? 'Mark Attendance' : 'Edit Record'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{mode === 'add' ? 'Add an attendance entry for any employee' : 'Update the status or times below'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {mode === 'add' ? (
            <>
              {members.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quick fill from team</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <button key={m.userId} type="button"
                        onClick={() => set({ employeeId: m.userId, employeeName: m.employeeName, role: m.role })}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                          form.employeeId === m.userId
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        )}>
                        <span className={cn('w-2 h-2 rounded-full', ROLE_BADGE[m.role]?.split(' ')[0] ?? 'bg-slate-400')} />
                        {m.employeeName}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <p className="text-xs text-slate-400 mb-2">Or enter manually:</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Employee Name <span className="text-rose-400">*</span></label>
                <input autoFocus type="text" placeholder="e.g. Ahmed Al-Farsi" value={form.employeeName}
                  onChange={e => set({ employeeName: e.target.value, employeeId: '' })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role <span className="text-rose-400">*</span></label>
                <select value={form.role} onChange={e => set({ role: e.target.value })} className={inputCls}>
                  <option value="">Select role…</option>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date <span className="text-rose-400">*</span></label>
                <input type="date" value={form.date} max={today} onChange={e => set({ date: e.target.value })} className={inputCls} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', ROLE_BADGE[form.role] ?? ROLE_BADGE.intern)}>{roleLabel(form.role)}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{form.employeeName}</span>
              <span className="text-xs text-slate-400 ml-auto">{form.date}</span>
            </div>
          )}

          {/* Status buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status <span className="text-rose-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => handleStatusChange(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all justify-center',
                    form.status === s ? STATUS_META[s].cls + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}>
                  {STATUS_META[s].icon}{STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {showTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check In</label>
                <input type="time" value={form.checkIn} onChange={e => set({ checkIn: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check Out</label>
                <input type="time" value={form.checkOut} onChange={e => set({ checkOut: e.target.value })} className={inputCls} />
              </div>
            </div>
          )}

          {showReason && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason <span className="text-slate-300 font-normal">(optional)</span></label>
              <select value={form.leaveReason} onChange={e => set({ leaveReason: e.target.value })} className={inputCls}>
                <option value="">Select reason…</option>
                {LEAVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })}
              placeholder="Any additional details…" className={inputCls + ' resize-none'} />
          </div>

          {isDuplicate && (
            <p className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl">
              A record for "{form.employeeName}" on {form.date} already exists.
            </p>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
          <button onClick={onSave} disabled={!canSave || saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {mode === 'add' ? 'Save Record' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function TimeKeeping() {
  const { user } = useAuthStore();
  const { records, members, loading, error, addRecord, updateRecord, deleteRecord } = useAttendance();

  const today = todayLocal();

  const [dateFilter,    setDateFilter]    = useState(today);
  const [showAllDates,  setShowAllDates]  = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<AttendanceStatus | 'all'>('all');
  const [search,        setSearch]        = useState('');
  const [analyticsView, setAnalyticsView] = useState<'week' | 'month'>('week');
  const [modalMode,     setModalMode]     = useState<'add' | 'edit' | null>(null);
  const [editTarget,    setEditTarget]    = useState<AttendanceRecord | null>(null);
  const [form,          setForm]          = useState<FormState>(blankForm(today));
  const [saving,        setSaving]        = useState(false);

  const safeRecords = Array.isArray(records) ? records : [];
  const safeMembers = Array.isArray(members) ? members : [];

  const existingKeys = useMemo(
    () => new Set(safeRecords.map(r => `${r.employeeName.trim().toLowerCase()}|${r.date}`)),
    [safeRecords],
  );

  const filteredRecords = useMemo(() => safeRecords.filter(r => {
    if (!showAllDates && r.date !== dateFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.employeeName.toLowerCase().includes(q) && !r.role.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [safeRecords, dateFilter, showAllDates, statusFilter, search]);

  const unmarkedMembers = useMemo(() => {
    if (showAllDates) return [];
    const marked = new Set(safeRecords.filter(r => r.date === dateFilter).map(r => r.employeeName.trim().toLowerCase()));
    return safeMembers.filter(m => {
      if (marked.has(m.employeeName.trim().toLowerCase())) return false;
      if (search) {
        const q = search.toLowerCase();
        return m.employeeName.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
      }
      return true;
    });
  }, [safeMembers, safeRecords, dateFilter, showAllDates, search]);

  const dateSummary = useMemo(() => {
    const dr = safeRecords.filter(r => r.date === dateFilter);
    const c  = (s: AttendanceStatus) => dr.filter(r => r.status === s).length;
    return { present: c('present'), absent: c('absent'), late: c('late'), half_day: c('half_day'), leave: c('leave') };
  }, [safeRecords, dateFilter]);

  // ── Attendance analytics ──
  const analyticsData = useMemo(() => {
    const [rangeStart, rangeEnd] = analyticsView === 'week' ? getWeekBounds(today) : getMonthBounds(today);
    const inRange = safeRecords.filter(r => r.date >= rangeStart && r.date <= rangeEnd);

    const peopleMap = new Map<string, { name: string; role: string }>();
    safeMembers.forEach(m => peopleMap.set(m.employeeName.toLowerCase(), { name: m.employeeName, role: m.role }));
    inRange.forEach(r => {
      if (!peopleMap.has(r.employeeName.toLowerCase()))
        peopleMap.set(r.employeeName.toLowerCase(), { name: r.employeeName, role: r.role });
    });

    return Array.from(peopleMap.values()).map(({ name, role }) => {
      const recs = inRange.filter(r => r.employeeName.toLowerCase() === name.toLowerCase());
      const present  = recs.filter(r => r.status === 'present').length;
      const late     = recs.filter(r => r.status === 'late').length;
      const half_day = recs.filter(r => r.status === 'half_day').length;
      const absent   = recs.filter(r => r.status === 'absent').length;
      const leave    = recs.filter(r => r.status === 'leave').length;
      const total    = present + late + half_day + absent + leave;
      const attended = present + late + half_day;
      const rate     = total > 0 ? Math.round((attended / total) * 100) : 0;
      return { name, role, present, late, half_day, absent, leave, total, attended, rate };
    }).sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [safeRecords, safeMembers, analyticsView, today]);

  const [weekStart] = getWeekBounds(today);

  // ── modal helpers ──
  const openAdd = (prefill?: { employeeId?: string; employeeName?: string; role?: string }) => {
    setForm(blankForm(showAllDates ? today : dateFilter, prefill));
    setEditTarget(null);
    setModalMode('add');
  };
  const openEdit = (rec: AttendanceRecord) => {
    setForm({ employeeId: rec.employeeId ?? '', employeeName: rec.employeeName, role: rec.role,
      date: rec.date, checkIn: rec.checkIn ?? '', checkOut: rec.checkOut ?? '',
      status: rec.status, leaveReason: rec.leaveReason ?? '', notes: rec.notes ?? '' });
    setEditTarget(rec);
    setModalMode('edit');
  };
  const handleSave = async () => {
    setSaving(true);
    if (modalMode === 'add') {
      await addRecord({ employeeId: form.employeeId || null, employeeName: form.employeeName.trim(),
        role: form.role, date: form.date, checkIn: form.checkIn || null, checkOut: form.checkOut || null,
        status: form.status, leaveReason: form.leaveReason || null, notes: form.notes || null, createdBy: user?.id ?? null });
    } else if (editTarget) {
      await updateRecord(editTarget.id, { checkIn: form.checkIn || null, checkOut: form.checkOut || null,
        status: form.status, leaveReason: form.leaveReason || null, notes: form.notes || null });
    }
    setSaving(false);
    setModalMode(null);
  };

  const navigateDate = (dir: 1 | -1) => {
    const next = shiftDate(dateFilter, dir);
    if (next <= today) { setDateFilter(next); setShowAllDates(false); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-500" /> Time Keeping
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track daily attendance, check-in times and team presence
          </p>
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 shrink-0">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {/* ── Today summary stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { s: 'present'  as AttendanceStatus, count: dateSummary.present,  label: 'Present'  },
          { s: 'late'     as AttendanceStatus, count: dateSummary.late,     label: 'Late'     },
          { s: 'half_day' as AttendanceStatus, count: dateSummary.half_day, label: 'Half Day' },
          { s: 'absent'   as AttendanceStatus, count: dateSummary.absent,   label: 'Absent'   },
          { s: 'leave'    as AttendanceStatus, count: dateSummary.leave,    label: 'On Leave' },
        ]).map(({ s, count, label }) => (
          <button key={s}
            onClick={() => { setShowAllDates(false); setStatusFilter(statusFilter === s ? 'all' : s); }}
            className={cn(
              'flex items-center gap-3 bg-white dark:bg-gray-900 border rounded-2xl px-4 py-3 text-left transition-all shadow-sm',
              statusFilter === s
                ? 'border-indigo-400 ring-2 ring-indigo-400/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            )}>
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', STATUS_META[s].cls)}>
              {STATUS_META[s].icon}
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{count}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Date nav + filters ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-5 py-4 space-y-3">

        {/* Date row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Prev */}
          <button onClick={() => navigateDate(-1)} disabled={showAllDates}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Date input */}
          <input type="date" value={dateFilter} max={today} disabled={showAllDates}
            onChange={e => { if (e.target.value) { setDateFilter(e.target.value); setShowAllDates(false); } }}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-40 cursor-pointer" />

          {/* Next — fixed: uses navigateDate which uses local-safe shiftDate */}
          <button onClick={() => navigateDate(1)} disabled={showAllDates || dateFilter >= today}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Today button — always enabled when not on today */}
          {dateFilter !== today && !showAllDates && (
            <button onClick={() => { setDateFilter(today); setShowAllDates(false); }}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 transition-colors">
              Today
            </button>
          )}

          <button onClick={() => setShowAllDates(v => !v)}
            className={cn(
              'px-3 py-2 text-xs font-bold rounded-xl border transition-colors',
              showAllDates
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}>All Dates</button>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search name or role…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-52" />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit">
          {(['all', ...ALL_STATUSES] as const).map(s => {
            const count = s === 'all' ? filteredRecords.length : filteredRecords.filter(r => r.status === s).length;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                )}>
                {s === 'all' ? 'All' : STATUS_META[s].label}
                <span className={cn('text-[10px] font-black px-1.5 rounded-full',
                  statusFilter === s ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Attendance records ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading records…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 gap-2 text-rose-500">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        ) : filteredRecords.length === 0 && (showAllDates || unmarkedMembers.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <Users className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No records found</p>
              <p className="text-xs text-slate-400 mt-0.5">Click <span className="font-bold text-indigo-500">Add Record</span> to mark attendance</p>
            </div>
          </div>
        ) : (
          <>
            {filteredRecords.map((rec) => {
              const sm = STATUS_META[rec.status];
              return (
                <div key={rec.id}
                  className={cn(
                    'group bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800',
                    'border-l-[3px] shadow-sm hover:shadow-md transition-all',
                    sm.border
                  )}>
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    {/* Status icon */}
                    <div className="shrink-0">{sm.icon}</div>

                    {/* Name + role */}
                    <div className="min-w-0 w-44 shrink-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{rec.employeeName}</p>
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold mt-0.5', ROLE_BADGE[rec.role] ?? ROLE_BADGE.intern)}>
                        {roleLabel(rec.role)}
                      </span>
                    </div>

                    {/* Date */}
                    <span className={cn('text-xs font-semibold shrink-0 w-20', rec.date === today ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500')}>
                      {rec.date === today ? 'Today' : rec.date}
                    </span>

                    {/* Times */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn('text-xs font-mono font-semibold', rec.checkIn ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600')}>
                        {fmt24(rec.checkIn)}
                      </span>
                      {rec.checkIn && <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>}
                      <span className={cn('text-xs font-mono font-semibold',
                        rec.checkOut ? 'text-slate-700 dark:text-slate-300' : rec.checkIn ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600')}>
                        {rec.checkOut ? fmt24(rec.checkOut) : rec.checkIn ? '…' : '—'}
                      </span>
                    </div>

                    {/* Status badge */}
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0', sm.cls)}>
                      {sm.icon}{sm.label}
                    </span>

                    {/* Reason / notes */}
                    <div className="flex-1 min-w-0">
                      {rec.leaveReason
                        ? <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 truncate">{rec.leaveReason}</p>
                        : rec.notes
                          ? <p className="text-xs text-slate-400 truncate">{rec.notes}</p>
                          : null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteRecord(rec.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Unmarked members */}
            {!showAllDates && statusFilter === 'all' && unmarkedMembers.map(m => (
              <div key={m.userId}
                className="group bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 shadow-sm opacity-60 hover:opacity-100 transition-all">
                <div className="flex items-center gap-4 px-5 py-3.5">
                  <MinusCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  <div className="min-w-0 w-44 shrink-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{m.employeeName}</p>
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold mt-0.5', ROLE_BADGE[m.role] ?? ROLE_BADGE.intern)}>
                      {roleLabel(m.role)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">Not marked yet</span>
                  <div className="flex-1" />
                  <button onClick={() => openAdd({ employeeId: m.userId, employeeName: m.employeeName, role: m.role })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50">
                    <Plus className="w-3 h-3" /> Mark
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Count footer */}
        {(filteredRecords.length > 0 || unmarkedMembers.length > 0) && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-1">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            {!showAllDates && statusFilter === 'all' && unmarkedMembers.length > 0 && ` · ${unmarkedMembers.length} not yet marked`}
          </p>
        )}
      </div>

      {/* ── Attendance Analytics ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Attendance Insights</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {analyticsView === 'week'
                  ? `This week · ${fmtWeekLabel(weekStart, today)}`
                  : `This month · ${fmtMonthLabel(today)}`}
              </p>
            </div>
          </div>
          {/* Week / Month toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setAnalyticsView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  analyticsView === v
                    ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                )}>
                {v === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {analyticsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <TrendingUp className="w-8 h-8 opacity-20" />
            <p className="text-sm font-semibold">No attendance data for this period</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_60px_140px_220px] px-6 py-2.5 bg-slate-50 dark:bg-slate-800/40">
              {['Employee', 'Rate', 'Days', 'Breakdown'].map(h => (
                <p key={h} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</p>
              ))}
            </div>

            {analyticsData.map((row, i) => (
              <div key={row.name}
                className="grid grid-cols-[1fr_60px_140px_220px] px-6 py-3.5 items-center hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">

                {/* Name + role */}
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                    i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600'
                  )}>
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{row.name}</p>
                    <span className={cn('inline-flex items-center px-1.5 py-px rounded-md text-[9px] font-bold', ROLE_BADGE[row.role] ?? ROLE_BADGE.intern)}>
                      {roleLabel(row.role)}
                    </span>
                  </div>
                </div>

                {/* Rate */}
                <div>
                  <p className={cn('text-sm font-black',
                    row.rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                    row.rate >= 70 ? 'text-amber-600 dark:text-amber-400' :
                    'text-rose-600 dark:text-rose-400'
                  )}>
                    {row.total > 0 ? `${row.rate}%` : '—'}
                  </p>
                </div>

                {/* Bar + count */}
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      {row.total > 0 && (
                        <div className={cn('h-full rounded-full transition-all',
                          row.rate >= 90 ? 'bg-emerald-500' : row.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        )} style={{ width: `${row.rate}%` }} />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold shrink-0">{row.attended}/{row.total}d</p>
                  </div>
                </div>

                {/* Status breakdown chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {row.present  > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{row.present}P</span>}
                  {row.late     > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50  text-amber-700  dark:bg-amber-950/30  dark:text-amber-400" >{row.late}L</span>}
                  {row.half_day > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50    text-sky-700    dark:bg-sky-950/30    dark:text-sky-400"  >{row.half_day}H</span>}
                  {row.absent   > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50   text-rose-700   dark:bg-rose-950/30   dark:text-rose-400" >{row.absent}A</span>}
                  {row.leave    > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">{row.leave}V</span>}
                  {row.total === 0 && <span className="text-[10px] text-slate-300 dark:text-slate-600">No records</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="px-6 py-3 border-t border-slate-50 dark:border-slate-800 flex items-center gap-4 flex-wrap">
          {[
            { key: 'P', label: 'Present',  cls: 'bg-emerald-100 text-emerald-700' },
            { key: 'L', label: 'Late',     cls: 'bg-amber-100  text-amber-700'  },
            { key: 'H', label: 'Half Day', cls: 'bg-sky-100    text-sky-700'    },
            { key: 'A', label: 'Absent',   cls: 'bg-rose-100   text-rose-700'   },
            { key: 'V', label: 'Leave',    cls: 'bg-violet-100 text-violet-700' },
          ].map(l => (
            <span key={l.key} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={cn('w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-black', l.cls)}>{l.key}</span>
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalMode && (
        <RecordModal mode={modalMode} form={form} members={safeMembers} existingKeys={existingKeys}
          onChange={setForm} onSave={handleSave} onClose={() => setModalMode(null)} saving={saving} />
      )}
    </div>
  );
}
