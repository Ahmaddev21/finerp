import React, { useState, useMemo } from 'react';
import {
  Clock, Plus, X, Trash2, Edit2, Loader2, Users,
  CheckCircle2, XCircle, AlertCircle, Coffee, CalendarDays,
  ChevronLeft, ChevronRight, Search, MinusCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { useAttendance, AttendanceRecord, AttendanceStatus, AttendanceMember } from '../hooks/useAttendance';
import { roleLabel } from '../lib/roles';

// ── constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<AttendanceStatus, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  present:  { label: 'Present',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  absent:   { label: 'Absent',   cls: 'bg-rose-50    text-rose-700    border-rose-200    dark:bg-rose-950/30    dark:text-rose-400    dark:border-rose-800',    dot: 'bg-rose-500',    icon: <XCircle      className="w-3.5 h-3.5" /> },
  late:     { label: 'Late',     cls: 'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950/30   dark:text-amber-400   dark:border-amber-800',   dot: 'bg-amber-500',   icon: <AlertCircle  className="w-3.5 h-3.5" /> },
  half_day: { label: 'Half Day', cls: 'bg-sky-50     text-sky-700     border-sky-200     dark:bg-sky-950/30     dark:text-sky-400     dark:border-sky-800',     dot: 'bg-sky-500',     icon: <Coffee       className="w-3.5 h-3.5" /> },
  leave:    { label: 'On Leave', cls: 'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-950/30  dark:text-violet-400  dark:border-violet-800',  dot: 'bg-violet-500',  icon: <CalendarDays className="w-3.5 h-3.5" /> },
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

const inputCls = [
  'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800',
  'border border-slate-200 dark:border-slate-700 rounded-xl',
  'text-slate-800 dark:text-slate-200 placeholder:text-slate-400',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all',
].join(' ');

function todayLocal() { return new Date().toISOString().split('T')[0]; }
function shiftDate(base: string, days: number) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function fmt24(t: string | null) { return t ? t.slice(0, 5) : '—'; }

// ── form types ────────────────────────────────────────────────────────────────

interface FormState {
  employeeId:   string;
  employeeName: string;
  role:         string;
  date:         string;
  checkIn:      string;
  checkOut:     string;
  status:       AttendanceStatus;
  leaveReason:  string;
  notes:        string;
}

function blankForm(date: string, prefill?: { employeeId?: string; employeeName?: string; role?: string }): FormState {
  return {
    employeeId:   prefill?.employeeId   ?? '',
    employeeName: prefill?.employeeName ?? '',
    role:         prefill?.role         ?? '',
    date,
    checkIn:     '',
    checkOut:    '',
    status:      'present',
    leaveReason: '',
    notes:       '',
  };
}

// ── modal ─────────────────────────────────────────────────────────────────────

function RecordModal({
  mode, form, members, existingKeys,
  onChange, onSave, onClose, saving,
}: {
  mode:         'add' | 'edit';
  form:         FormState;
  members:      AttendanceMember[];
  existingKeys: Set<string>;
  onChange:     (f: FormState) => void;
  onSave:       () => void;
  onClose:      () => void;
  saving:       boolean;
}) {
  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });

  const showTime   = ['present', 'late', 'half_day'].includes(form.status);
  const showReason = ['absent', 'leave', 'half_day'].includes(form.status);

  // Duplicate check: same name (case-insensitive) + date
  const isDuplicate = mode === 'add'
    && !!form.employeeName.trim() && !!form.date
    && existingKeys.has(`${form.employeeName.trim().toLowerCase()}|${form.date}`);

  const canSave = !!form.employeeName.trim() && !!form.role && !!form.date && !isDuplicate;

  const handleStatusChange = (s: AttendanceStatus) => {
    set({
      status:      s,
      checkIn:     (s === 'absent' || s === 'leave') ? '' : form.checkIn,
      checkOut:    (s === 'absent' || s === 'leave') ? '' : form.checkOut,
      leaveReason: (s === 'present' || s === 'late') ? '' : form.leaveReason,
    });
  };

  // Quick-fill from a known team member
  const fillMember = (m: AttendanceMember) =>
    set({ employeeId: m.userId, employeeName: m.employeeName, role: m.role });

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            {mode === 'add' ? 'Mark Attendance' : 'Edit Record'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {mode === 'add' ? (
            <>
              {/* Team member quick-fill — only shown when members exist */}
              {members.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Quick fill from team
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => fillMember(m)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                          form.employeeId === m.userId
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full shrink-0', ROLE_BADGE[m.role]?.split(' ')[0] ?? 'bg-slate-400')} />
                        {m.employeeName}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Or enter any employee manually:</p>
                  </div>
                </div>
              )}

              {/* Employee Name — free text, works for ANY employee */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Employee Name <span className="text-rose-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Ahmed Al-Farsi"
                  value={form.employeeName}
                  onChange={e => set({ employeeName: e.target.value, employeeId: '' })}
                  className={inputCls}
                />
              </div>

              {/* Role — all 7 roles always available */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => set({ role: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select role…</option>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            /* Edit mode: show employee info read-only */
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', ROLE_BADGE[form.role] ?? ROLE_BADGE.intern)}>
                {roleLabel(form.role)}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{form.employeeName}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{form.date}</span>
            </div>
          )}

          {/* Date — only editable in add mode */}
          {mode === 'add' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date" value={form.date} max={todayLocal()}
                onChange={e => set({ date: e.target.value })}
                className={inputCls}
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Status <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    form.status === s
                      ? cn(STATUS_META[s].cls, 'ring-2 ring-offset-1 ring-current')
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  )}
                >
                  {STATUS_META[s].icon}
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Check In / Check Out — present, late, half_day */}
          {showTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Check In</label>
                <input type="time" value={form.checkIn} onChange={e => set({ checkIn: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Check Out</label>
                <input type="time" value={form.checkOut} onChange={e => set({ checkOut: e.target.value })} className={inputCls} />
              </div>
            </div>
          )}

          {/* Reason — absent, leave, half_day */}
          {showReason && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reason
                <span className="text-slate-400 text-xs font-normal ml-1">(optional)</span>
              </label>
              <select value={form.leaveReason} onChange={e => set({ leaveReason: e.target.value })} className={inputCls}>
                <option value="">Select reason…</option>
                {LEAVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes
              <span className="text-slate-400 text-xs font-normal ml-1">(optional)</span>
            </label>
            <textarea
              rows={2} value={form.notes}
              onChange={e => set({ notes: e.target.value })}
              placeholder="Any additional details…"
              className={inputCls + ' resize-none'}
            />
          </div>

          {isDuplicate && (
            <p className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl">
              A record for "{form.employeeName}" on {form.date} already exists. Edit that row instead.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            Cancel
          </button>
          <button
            onClick={onSave} disabled={!canSave || saving}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all"
          >
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

  const [dateFilter,   setDateFilter]   = useState(today);
  const [showAllDates, setShowAllDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [search,       setSearch]       = useState('');

  const [modalMode,  setModalMode]  = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [form,       setForm]       = useState<FormState>(blankForm(today));
  const [saving,     setSaving]     = useState(false);

  const safeRecords = Array.isArray(records) ? records : [];
  const safeMembers = Array.isArray(members) ? members : [];

  // Duplicate guard keyed by lower-case name + date
  const existingKeys = useMemo(
    () => new Set(safeRecords.map(r => `${r.employeeName.trim().toLowerCase()}|${r.date}`)),
    [safeRecords],
  );

  // ── records for the current filters
  const filteredRecords = useMemo(() => {
    return safeRecords.filter(r => {
      if (!showAllDates && r.date !== dateFilter)                    return false;
      if (statusFilter !== 'all' && r.status !== statusFilter)       return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.employeeName.toLowerCase().includes(q) && !r.role.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [safeRecords, dateFilter, showAllDates, statusFilter, search]);

  // ── system members who have NO record yet for the selected date (date view only)
  const unmarkedMembers = useMemo(() => {
    if (showAllDates) return [];
    const markedNames = new Set(
      safeRecords
        .filter(r => r.date === dateFilter)
        .map(r => r.employeeName.trim().toLowerCase())
    );
    return safeMembers.filter(m => {
      if (!markedNames.has(m.employeeName.trim().toLowerCase())) {
        if (search) {
          const q = search.toLowerCase();
          return m.employeeName.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
        }
        return true;
      }
      return false;
    });
  }, [safeMembers, safeRecords, dateFilter, showAllDates, search]);

  // ── date summary (ignores status/search filter for context)
  const dateSummary = useMemo(() => {
    const dr = safeRecords.filter(r => r.date === dateFilter);
    const c  = (s: AttendanceStatus) => dr.filter(r => r.status === s).length;
    return { present: c('present'), absent: c('absent'), late: c('late'), half_day: c('half_day'), leave: c('leave') };
  }, [safeRecords, dateFilter]);

  // ── modal helpers
  const openAdd = (prefill?: { employeeId?: string; employeeName?: string; role?: string }) => {
    setForm(blankForm(showAllDates ? today : dateFilter, prefill));
    setEditTarget(null);
    setModalMode('add');
  };

  const openEdit = (rec: AttendanceRecord) => {
    setForm({
      employeeId:   rec.employeeId  ?? '',
      employeeName: rec.employeeName,
      role:         rec.role,
      date:         rec.date,
      checkIn:      rec.checkIn     ?? '',
      checkOut:     rec.checkOut    ?? '',
      status:       rec.status,
      leaveReason:  rec.leaveReason ?? '',
      notes:        rec.notes       ?? '',
    });
    setEditTarget(rec);
    setModalMode('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    if (modalMode === 'add') {
      await addRecord({
        employeeId:   form.employeeId   || null,
        employeeName: form.employeeName.trim(),
        role:         form.role,
        date:         form.date,
        checkIn:      form.checkIn      || null,
        checkOut:     form.checkOut     || null,
        status:       form.status,
        leaveReason:  form.leaveReason  || null,
        notes:        form.notes        || null,
        createdBy:    user?.id          ?? null,
      });
    } else if (editTarget) {
      await updateRecord(editTarget.id, {
        checkIn:     form.checkIn     || null,
        checkOut:    form.checkOut    || null,
        status:      form.status,
        leaveReason: form.leaveReason || null,
        notes:       form.notes       || null,
      });
    }
    setSaving(false);
    setModalMode(null);
  };

  // ── how many rows total to show in footer
  const totalShown = filteredRecords.length + (showAllDates ? 0 : (statusFilter === 'all' ? unmarkedMembers.length : 0));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-500" /> Time Keeping
          </h1>
          {!showAllDates && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
              <span>{dateFilter === today ? 'Today' : dateFilter}</span>
              {dateSummary.present  > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dateSummary.present} present</span>}
              {dateSummary.late     > 0 && <span className="text-amber-500   dark:text-amber-400   font-semibold">{dateSummary.late} late</span>}
              {dateSummary.half_day > 0 && <span className="text-sky-600     dark:text-sky-400     font-semibold">{dateSummary.half_day} half day</span>}
              {dateSummary.absent   > 0 && <span className="text-rose-600    dark:text-rose-400    font-semibold">{dateSummary.absent} absent</span>}
              {dateSummary.leave    > 0 && <span className="text-violet-600  dark:text-violet-400  font-semibold">{dateSummary.leave} on leave</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm px-5 py-4 space-y-4">

        {/* Date row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setDateFilter(d => shiftDate(d, -1)); setShowAllDates(false); }}
              disabled={showAllDates}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            ><ChevronLeft className="w-4 h-4" /></button>

            <input
              type="date" value={dateFilter} max={today} disabled={showAllDates}
              onChange={e => { setDateFilter(e.target.value); setShowAllDates(false); }}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-40"
            />

            <button
              onClick={() => { if (shiftDate(dateFilter, 1) <= today) { setDateFilter(d => shiftDate(d, 1)); setShowAllDates(false); } }}
              disabled={showAllDates || dateFilter >= today}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            ><ChevronRight className="w-4 h-4" /></button>

            <button
              onClick={() => { setDateFilter(today); setShowAllDates(false); }}
              disabled={showAllDates || dateFilter === today}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >Today</button>
          </div>

          <button
            onClick={() => setShowAllDates(v => !v)}
            className={cn(
              'px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors',
              showAllDates
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >All Dates</button>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text" placeholder="Search name or role…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-48"
            />
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {(['all', ...ALL_STATUSES] as const).map(s => {
            const active = statusFilter === s;
            const count  = s === 'all' ? filteredRecords.length : filteredRecords.filter(r => r.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active && s !== 'all' ? 'all' : s)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  active
                    ? s === 'all'
                        ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                        : cn(STATUS_META[s].cls, 'border-current')
                    : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                )}
              >
                {s !== 'all' && <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_META[s].dot)} />}
                {s === 'all' ? 'All' : STATUS_META[s].label}
                <span className={cn('rounded-full px-1.5 py-px text-[10px] font-extrabold', active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">

            {/* Header */}
            <div className="grid grid-cols-[36px_200px_120px_105px_88px_88px_145px_1fr_72px] px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
              {['#', 'Employee', 'Role', 'Date', 'Check In', 'Check Out', 'Status', 'Reason / Notes', ''].map((h, i) => (
                <div key={i} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{h}</div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 gap-2 text-rose-500">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
            ) : filteredRecords.length === 0 && (showAllDates || unmarkedMembers.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-300 dark:text-slate-600">
                <Users className="w-10 h-10 opacity-40" />
                <p className="text-sm font-semibold">No records found</p>
                <p className="text-xs">Click <span className="font-bold text-indigo-500">Add Record</span> to get started</p>
              </div>
            ) : (
              <>
                {/* Existing records */}
                {filteredRecords.map((rec, idx) => {
                  const sm     = STATUS_META[rec.status];
                  const isLast = idx === filteredRecords.length - 1 && (showAllDates || (statusFilter !== 'all' || unmarkedMembers.length === 0));
                  return (
                    <div
                      key={rec.id}
                      className={cn(
                        'grid grid-cols-[36px_200px_120px_105px_88px_88px_145px_1fr_72px] px-4 py-3.5 items-center group transition-colors',
                        'hover:bg-slate-50/80 dark:hover:bg-slate-800/30',
                        !isLast && 'border-b border-slate-50 dark:border-slate-800/60',
                        rec.status === 'absent' && 'bg-rose-50/20 dark:bg-rose-950/5',
                      )}
                    >
                      <div className="text-xs font-bold text-slate-300 dark:text-slate-600 tabular-nums">{idx + 1}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{rec.employeeName}</p>
                      </div>
                      <div>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold', ROLE_BADGE[rec.role] ?? ROLE_BADGE.intern)}>
                          {roleLabel(rec.role)}
                        </span>
                      </div>
                      <div>
                        <span className={cn('text-xs font-medium', rec.date === today ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400')}>
                          {rec.date === today ? 'Today' : rec.date}
                        </span>
                      </div>
                      <div>
                        <span className={cn('text-xs font-semibold tabular-nums', rec.checkIn ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600')}>
                          {fmt24(rec.checkIn)}
                        </span>
                      </div>
                      <div>
                        <span className={cn(
                          'text-xs font-semibold tabular-nums',
                          rec.checkOut ? 'text-slate-700 dark:text-slate-300'
                            : rec.checkIn ? 'text-amber-400 dark:text-amber-500'
                            : 'text-slate-300 dark:text-slate-600'
                        )}>
                          {rec.checkOut ? fmt24(rec.checkOut) : rec.checkIn ? '…' : '—'}
                        </span>
                      </div>
                      <div>
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border', sm.cls)}>
                          {sm.icon}{sm.label}
                        </span>
                      </div>
                      <div className="min-w-0 pr-2">
                        {rec.leaveReason
                          ? <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 truncate">{rec.leaveReason}</p>
                          : rec.notes
                            ? <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{rec.notes}</p>
                            : <span className="text-xs text-slate-200 dark:text-slate-700">—</span>
                        }
                      </div>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteRecord(rec.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Unmarked system members (date view, status=all only) */}
                {!showAllDates && statusFilter === 'all' && unmarkedMembers.map((m, idx) => {
                  const globalIdx = filteredRecords.length + idx;
                  const isLast    = idx === unmarkedMembers.length - 1;
                  return (
                    <div
                      key={m.userId}
                      className={cn(
                        'grid grid-cols-[36px_200px_120px_105px_88px_88px_145px_1fr_72px] px-4 py-3.5 items-center group transition-colors opacity-60',
                        'hover:bg-slate-50/80 dark:hover:bg-slate-800/30 hover:opacity-100',
                        !isLast && 'border-b border-slate-50 dark:border-slate-800/60',
                      )}
                    >
                      <div className="text-xs font-bold text-slate-300 dark:text-slate-600 tabular-nums">{globalIdx + 1}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{m.employeeName}</p>
                      </div>
                      <div>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold', ROLE_BADGE[m.role] ?? ROLE_BADGE.intern)}>
                          {roleLabel(m.role)}
                        </span>
                      </div>
                      <div>
                        <span className={cn('text-xs font-medium', dateFilter === today ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400')}>
                          {dateFilter === today ? 'Today' : dateFilter}
                        </span>
                      </div>
                      <div><span className="text-xs text-slate-300 dark:text-slate-600">—</span></div>
                      <div><span className="text-xs text-slate-300 dark:text-slate-600">—</span></div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                          <MinusCircle className="w-3.5 h-3.5" /> Not marked
                        </span>
                      </div>
                      <div><span className="text-xs text-slate-200 dark:text-slate-700">—</span></div>
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openAdd({ employeeId: m.userId, employeeName: m.employeeName, role: m.role })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                          title="Mark attendance"
                        ><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {totalShown > 0 && (
          <div className="px-5 py-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
              {!showAllDates && statusFilter === 'all' && unmarkedMembers.length > 0 && ` · ${unmarkedMembers.length} not yet marked`}
              {!showAllDates && ` · ${dateFilter === today ? 'today' : dateFilter}`}
              {showAllDates && ' · all dates'}
              {statusFilter !== 'all' && ` · ${STATUS_META[statusFilter].label}`}
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <RecordModal
          mode={modalMode}
          form={form}
          members={safeMembers}
          existingKeys={existingKeys}
          onChange={setForm}
          onSave={handleSave}
          onClose={() => setModalMode(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
