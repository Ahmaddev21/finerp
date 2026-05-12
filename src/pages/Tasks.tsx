import React, { useState } from 'react';
import {
  AlertCircle, CheckSquare, Circle, Clock, Lock, Loader2, Plus, X, Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProjects } from '../hooks/useProjects';
import { useAuthStore } from '../store/auth';
import { useTasks, Task, TaskStatus, Priority, AppRole } from '../hooks/useTasks';
import { roleLabel } from '../lib/roles';

// ── constants ──────────────────────────────────────────────────────────────────

const ALL_ROLES: AppRole[] = ['owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'];

const ROLE_COLORS: Record<AppRole, string> = {
  owner:        'bg-violet-100 text-violet-700  border-violet-200  dark:bg-violet-950/40 dark:text-violet-300  dark:border-violet-800',
  admin:        'bg-blue-100   text-blue-700    border-blue-200    dark:bg-blue-950/40   dark:text-blue-300    dark:border-blue-800',
  bdm:          'bg-amber-100  text-amber-700   border-amber-200   dark:bg-amber-950/40  dark:text-amber-300   dark:border-amber-800',
  engineer:     'bg-teal-100   text-teal-700    border-teal-200    dark:bg-teal-950/40   dark:text-teal-300    dark:border-teal-800',
  receptionist: 'bg-pink-100   text-pink-700    border-pink-200    dark:bg-pink-950/40   dark:text-pink-300    dark:border-pink-800',
  developer:    'bg-indigo-100 text-indigo-700  border-indigo-200  dark:bg-indigo-950/40 dark:text-indigo-300  dark:border-indigo-800',
  intern:       'bg-slate-100  text-slate-600   border-slate-200   dark:bg-slate-800     dark:text-slate-400   dark:border-slate-700',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  High:   'bg-rose-50  text-rose-600  border-rose-200  dark:bg-rose-950/30  dark:text-rose-400  dark:border-rose-800',
  Medium: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  Low:    'bg-sky-50   text-sky-600   border-sky-200   dark:bg-sky-950/30   dark:text-sky-400   dark:border-sky-800',
};

const STATUS_STYLES: Record<TaskStatus, { cls: string; icon: React.ReactNode; dot: string }> = {
  'To Do':       { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',      icon: <Circle       className="w-3 h-3" />,     dot: 'bg-slate-400'  },
  'In Progress': { cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400', icon: <Clock        className="w-3 h-3" />,     dot: 'bg-indigo-500' },
  'Finished':    { cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', icon: <CheckSquare className="w-3 h-3" />, dot: 'bg-emerald-500'},
  'Unfinished':  { cls: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',         icon: <AlertCircle  className="w-3 h-3" />,     dot: 'bg-rose-500'   },
};

const inputCls = [
  'w-full px-3.5 py-2.5 text-sm',
  'bg-slate-50 dark:bg-slate-800',
  'border border-slate-200 dark:border-slate-700 rounded-xl',
  'text-slate-800 dark:text-slate-200 placeholder:text-slate-400',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all',
].join(' ');

// ── component ──────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { projects } = useProjects();
  const { user }     = useAuthStore();
  const hookResult   = useTasks();
  const tasks        = hookResult.tasks   ?? [];
  const members      = hookResult.members ?? [];
  const loading      = hookResult.loading ?? false;
  const { addTask, updateTaskStatus, deleteTask } = hookResult;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'All'>('All');
  const [form, setForm] = useState({
    title:            '',
    project:          '',
    assignedToRole:   '' as AppRole | '',
    assignedToUserId: '',
    priority:         'Medium' as Priority,
    dueDate:          '',
    isPrivate:        false,
  });

  const todayStr       = new Date().toISOString().split('T')[0];
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const visibleTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((t: Task) => !t.isPrivate || isOwnerOrAdmin)
    .filter((t: Task) => filterStatus === 'All' || t.status === filterStatus);

  const membersForRole = (Array.isArray(members) ? members : [])
    .filter((m: { role: string }) => m.role === form.assignedToRole);

  const allTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((t: Task) => !t.isPrivate || isOwnerOrAdmin);

  const canFinish = (task: Task): boolean => {
    if (isOwnerOrAdmin) return true;
    if (task.assignedToUserId) return task.assignedToUserId === user?.id;
    return task.assignedToRole === user?.role;
  };

  const handleAdd = async () => {
    if (!form.title.trim() || !form.assignedToRole || !form.dueDate) return;
    const selectedMember = members.find((m: { userId: string }) => m.userId === form.assignedToUserId);
    const displayName = (selectedMember as { username?: string } | undefined)?.username
      ?? roleLabel(form.assignedToRole as AppRole);

    await addTask({
      title:            form.title.trim(),
      project:          form.project,
      assignee:         displayName,
      assignedToRole:   form.assignedToRole as AppRole,
      assignedToUserId: form.assignedToUserId || null,
      createdByUserId:  user?.id   ?? null,
      createdByRole:    user?.role ?? null,
      priority:         form.priority,
      status:           'To Do',
      dueDate:          form.dueDate,
      isPrivate:        isOwnerOrAdmin ? form.isPrivate : false,
    });

    setIsModalOpen(false);
    setForm({ title: '', project: '', assignedToRole: '', assignedToUserId: '', priority: 'Medium', dueDate: '', isPrivate: false });
  };

  const getProjName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const isOverdue   = (d: string, s: TaskStatus) =>
    s !== 'Finished' && s !== 'Unfinished' && d !== '—' && d < todayStr;

  const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Finished', 'Unfinished'];

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">

      {/* ── header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {allTasks.filter(t => t.status !== 'Finished' && t.status !== 'Unfinished').length} open
            {' · '}
            {allTasks.filter(t => t.status === 'Finished').length} finished
            {allTasks.filter(t => t.status === 'Unfinished').length > 0 && (
              <span className="text-rose-500 font-semibold">
                {' · '}{allTasks.filter(t => t.status === 'Unfinished').length} unfinished
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* ── stat pills ── */}
      <div className="flex flex-wrap gap-2">
        {(['All', ...STATUSES] as const).map(s => {
          const count = s === 'All'
            ? allTasks.length
            : allTasks.filter(t => t.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
                filterStatus === s
                  ? s === 'Unfinished'
                      ? 'bg-rose-500 text-white border-rose-500'
                      : s === 'Finished'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : s === 'In Progress'
                              ? 'bg-indigo-500 text-white border-indigo-500'
                              : 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-800 dark:border-slate-200'
                  : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400',
              )}
            >
              {s !== 'All' && (
                <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_STYLES[s as TaskStatus]?.dot)} />
              )}
              {s}
              <span className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-extrabold',
                filterStatus === s ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">

        {/* table header */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[180px_1fr_115px_90px_140px_180px_40px] px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
              {['Assigned To', 'Task', 'Deadline', 'Priority', 'Status', 'Actions', ''].map((h, i) => (
                <div key={i} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {h}
                </div>
              ))}
            </div>

            {/* rows */}
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading…</span>
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-300 dark:text-slate-600">
                <Circle className="w-10 h-10 opacity-40" />
                <p className="text-sm font-semibold">No tasks yet</p>
                <p className="text-xs">Click <span className="font-bold text-indigo-500">New Task</span> to get started</p>
              </div>
            ) : (
              visibleTasks.map((task, idx) => {
                const ss = STATUS_STYLES[task.status];
                const overdue = isOverdue(task.dueDate, task.status);
                const isLastRow = idx === visibleTasks.length - 1;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'grid grid-cols-[180px_1fr_115px_90px_140px_180px_40px] px-5 py-3.5 items-center group transition-colors',
                      'hover:bg-slate-50/80 dark:hover:bg-slate-800/30',
                      !isLastRow && 'border-b border-slate-50 dark:border-slate-800/60',
                      task.status === 'Unfinished' && 'bg-rose-50/30 dark:bg-rose-950/10',
                    )}
                  >
                    {/* ── Assigned To ── */}
                    <div className="flex flex-col gap-1">
                      {task.assignedToRole ? (
                        <span className={cn(
                          'inline-flex items-center w-fit px-2 py-0.5 rounded-lg text-[11px] font-bold border',
                          ROLE_COLORS[task.assignedToRole as AppRole],
                        )}>
                          {roleLabel(task.assignedToRole)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {task.assignee && task.assignee !== roleLabel(task.assignedToRole ?? '') && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{task.assignee}</span>
                      )}
                    </div>

                    {/* ── Task title ── */}
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {task.isPrivate && isOwnerOrAdmin && (
                          <Lock className="w-3 h-3 text-violet-400 shrink-0" />
                        )}
                        <p className={cn(
                          'text-sm font-semibold truncate text-slate-900 dark:text-slate-100',
                          (task.status === 'Finished' || task.status === 'Unfinished') &&
                            'line-through text-slate-400 dark:text-slate-500',
                        )}>
                          {task.title}
                        </p>
                      </div>
                      {task.project && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {getProjName(task.project)}
                        </p>
                      )}
                    </div>

                    {/* ── Deadline ── */}
                    <div className="flex items-center gap-1">
                      {task.dueDate !== '—' ? (
                        <>
                          {overdue && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                          <span className={cn(
                            'text-xs font-medium',
                            overdue
                              ? 'text-rose-500 font-bold'
                              : task.status === 'Unfinished'
                                  ? 'text-rose-500 line-through opacity-70'
                                  : 'text-slate-500 dark:text-slate-400',
                          )}>
                            {task.dueDate}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </div>

                    {/* ── Priority ── */}
                    <div>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border',
                        PRIORITY_COLORS[task.priority],
                      )}>
                        {task.priority}
                      </span>
                    </div>

                    {/* ── Status ── */}
                    <div>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold',
                        ss.cls,
                      )}>
                        {ss.icon}
                        {task.status}
                      </span>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {task.status === 'To Do' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'In Progress')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
                        >
                          → Start
                        </button>
                      )}
                      {task.status === 'In Progress' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'To Do')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          ← Back
                        </button>
                      )}
                      {(task.status === 'To Do' || task.status === 'In Progress') && canFinish(task) && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'Finished')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                        >
                          ✓ Finish
                        </button>
                      )}
                      {task.status === 'Finished' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'To Do')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          ↩ Reopen
                        </button>
                      )}
                      {task.status === 'Unfinished' && isOwnerOrAdmin && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'To Do')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          ↩ Reopen
                        </button>
                      )}
                    </div>

                    {/* ── Delete ── */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* table footer */}
        {visibleTasks.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
              {filterStatus !== 'All' && ` · filtered by "${filterStatus}"`}
            </p>
          </div>
        )}
      </div>

      {/* ── new task modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Task</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Review Q3 contracts"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  className={inputCls}
                />
              </div>

              {/* Assign to Role */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assign to Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={form.assignedToRole}
                  onChange={e => setForm({ ...form, assignedToRole: e.target.value as AppRole | '', assignedToUserId: '' })}
                  className={inputCls}
                >
                  <option value="">Select a role…</option>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>

              {/* Specific user (optional, only shows when role has members) */}
              {form.assignedToRole && membersForRole.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Specific Person
                    <span className="text-slate-400 text-xs font-normal ml-1">(optional)</span>
                  </label>
                  <select
                    value={form.assignedToUserId}
                    onChange={e => setForm({ ...form, assignedToUserId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Any {roleLabel(form.assignedToRole as AppRole)}</option>
                    {membersForRole.map((m: { userId: string; username: string }) => (
                      <option key={m.userId} value={m.userId}>{m.username}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Project
                    <span className="text-slate-400 text-xs font-normal ml-1">(optional)</span>
                  </label>
                  <select
                    value={form.project}
                    onChange={e => setForm({ ...form, project: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Priority + Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value as Priority })}
                    className={inputCls}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Deadline <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    min={todayStr}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Private — owner/admin only */}
              {isOwnerOrAdmin && (
                <label className="flex items-start gap-3 cursor-pointer py-3 px-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 select-none">
                  <input
                    type="checkbox"
                    checked={form.isPrivate}
                    onChange={e => setForm({ ...form, isPrivate: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Private Task
                    </p>
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                      Visible only to Owner and Admin
                    </p>
                  </div>
                </label>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.title.trim() || !form.assignedToRole || !form.dueDate}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
