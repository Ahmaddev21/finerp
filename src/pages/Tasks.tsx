import React, { useState } from 'react';
import {
  AlertCircle, CheckCircle2, Circle, Clock, Lock, Loader2, Plus, X, Trash2,
  ListTodo, Zap, CheckSquare, XCircle, CalendarDays, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProjects } from '../hooks/useProjects';
import { useAuthStore } from '../store/auth';
import { useTasks, Task, TaskStatus, Priority, AppRole } from '../hooks/useTasks';
import { roleLabel } from '../lib/roles';

const ALL_ROLES: AppRole[] = ['owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'];

const ROLE_COLORS: Record<AppRole, string> = {
  owner:        'bg-violet-100 text-violet-700  dark:bg-violet-950/40 dark:text-violet-300',
  admin:        'bg-blue-100   text-blue-700    dark:bg-blue-950/40   dark:text-blue-300',
  bdm:          'bg-amber-100  text-amber-700   dark:bg-amber-950/40  dark:text-amber-300',
  engineer:     'bg-teal-100   text-teal-700    dark:bg-teal-950/40   dark:text-teal-300',
  receptionist: 'bg-pink-100   text-pink-700    dark:bg-pink-950/40   dark:text-pink-300',
  developer:    'bg-indigo-100 text-indigo-700  dark:bg-indigo-950/40 dark:text-indigo-300',
  intern:       'bg-slate-100  text-slate-600   dark:bg-slate-800     dark:text-slate-400',
};

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  High:   { color: 'text-rose-500',   bg: 'bg-rose-500',   label: 'High'   },
  Medium: { color: 'text-amber-500',  bg: 'bg-amber-500',  label: 'Medium' },
  Low:    { color: 'text-sky-500',    bg: 'bg-sky-500',    label: 'Low'    },
};

const STATUS_CONFIG: Record<TaskStatus, {
  border: string; icon: React.ReactNode; badge: string; label: string;
}> = {
  'To Do':       { border: 'border-slate-300  dark:border-slate-600',  icon: <Circle       className="w-4 h-4 text-slate-400" />,        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',                    label: 'To Do'       },
  'In Progress': { border: 'border-indigo-400 dark:border-indigo-500', icon: <Clock        className="w-4 h-4 text-indigo-500" />,        badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',              label: 'In Progress' },
  'Finished':    { border: 'border-emerald-400 dark:border-emerald-500',icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,      badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',          label: 'Finished'    },
  'Unfinished':  { border: 'border-rose-400   dark:border-rose-500',   icon: <XCircle      className="w-4 h-4 text-rose-500" />,         badge: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',                      label: 'Unfinished'  },
};

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shadow-sm';

export default function Tasks() {
  const { projects }  = useProjects();
  const { user }      = useAuthStore();
  const hookResult    = useTasks();
  const tasks         = hookResult.tasks   ?? [];
  const members       = hookResult.members ?? [];
  const loading       = hookResult.loading ?? false;
  const { addTask, updateTaskStatus, deleteTask } = hookResult;

  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'All'>('All');
  const [form, setForm] = useState({
    title: '', project: '', assignedToRole: '' as AppRole | '',
    assignedToUserId: '', priority: 'Medium' as Priority,
    dueDate: '', isPrivate: false,
  });

  const todayStr       = new Date().toISOString().split('T')[0];
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const allTasks = tasks.filter((t: Task) => !t.isPrivate || isOwnerOrAdmin);

  const visibleTasks = allTasks.filter(
    (t: Task) => filterStatus === 'All' || t.status === filterStatus
  );

  const membersForRole = members.filter((m: { role: string }) => m.role === form.assignedToRole);

  const canFinish = (task: Task) =>
    isOwnerOrAdmin ||
    (task.assignedToUserId ? task.assignedToUserId === user?.id : task.assignedToRole === user?.role);

  const isOverdue = (d: string, s: TaskStatus) =>
    s !== 'Finished' && s !== 'Unfinished' && d !== '—' && d < todayStr;

  const handleAdd = async () => {
    if (!form.title.trim() || !form.assignedToRole || !form.dueDate) return;
    const selectedMember = members.find((m: { userId: string }) => m.userId === form.assignedToUserId);
    const displayName = (selectedMember as { username?: string } | undefined)?.username
      ?? roleLabel(form.assignedToRole as AppRole);
    await addTask({
      title: form.title.trim(), project: form.project,
      assignee: displayName, assignedToRole: form.assignedToRole as AppRole,
      assignedToUserId: form.assignedToUserId || null,
      createdByUserId: user?.id ?? null, createdByRole: user?.role ?? null,
      priority: form.priority, status: 'To Do',
      dueDate: form.dueDate, isPrivate: isOwnerOrAdmin ? form.isPrivate : false,
    });
    setIsModalOpen(false);
    setForm({ title: '', project: '', assignedToRole: '', assignedToUserId: '', priority: 'Medium', dueDate: '', isPrivate: false });
  };

  const getProjName = (id: string) => projects.find(p => p.id === id)?.name ?? id;

  const overdueCount  = allTasks.filter(t => isOverdue(t.dueDate, t.status)).length;
  const openCount     = allTasks.filter(t => t.status === 'To Do').length;
  const inProgCount   = allTasks.filter(t => t.status === 'In Progress').length;
  const finishedCount = allTasks.filter(t => t.status === 'Finished').length;

  const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Finished', 'Unfinished'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Assign, track and complete team work — all in one place
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',        value: openCount,     icon: ListTodo,      color: 'text-slate-600  dark:text-slate-300',  ring: 'hover:border-slate-400',  status: 'To Do'       as TaskStatus },
          { label: 'In Progress', value: inProgCount,   icon: Zap,           color: 'text-indigo-600 dark:text-indigo-400', ring: 'hover:border-indigo-400', status: 'In Progress' as TaskStatus },
          { label: 'Finished',    value: finishedCount, icon: CheckSquare,   color: 'text-emerald-600 dark:text-emerald-400',ring: 'hover:border-emerald-400',status: 'Finished'    as TaskStatus },
          { label: 'Overdue',     value: overdueCount,  icon: AlertCircle,   color: 'text-rose-600   dark:text-rose-400',   ring: 'hover:border-rose-400',   status: null },
        ].map(({ label, value, icon: Icon, color, ring, status }) => (
          <button
            key={label}
            onClick={() => status && setFilterStatus(filterStatus === status ? 'All' : status)}
            className={cn(
              'flex items-center gap-3 bg-white dark:bg-gray-900 border rounded-2xl px-4 py-3.5 text-left transition-all shadow-sm',
              status && filterStatus === status
                ? 'border-indigo-400 ring-2 ring-indigo-400/20'
                : `border-slate-200 dark:border-slate-800 ${ring}`,
              !status && 'cursor-default'
            )}
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 shrink-0', color)}>
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit">
        {(['All', ...STATUSES] as const).map(s => {
          const count = s === 'All' ? allTasks.length : allTasks.filter(t => t.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                filterStatus === s
                  ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {s}
              <span className={cn(
                'text-[10px] font-black px-1.5 rounded-full',
                filterStatus === s
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Task list ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading tasks…</span>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <ListTodo className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No tasks here</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {filterStatus === 'All' ? 'Click New Task to create your first task' : `No tasks with status "${filterStatus}"`}
              </p>
            </div>
          </div>
        ) : (
          visibleTasks.map((task: Task) => {
            const sc      = STATUS_CONFIG[task.status];
            const pc      = PRIORITY_CONFIG[task.priority];
            const overdue = isOverdue(task.dueDate, task.status);
            const done    = task.status === 'Finished' || task.status === 'Unfinished';

            return (
              <div
                key={task.id}
                className={cn(
                  'group bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800',
                  'border-l-[3px] shadow-sm hover:shadow-md transition-all duration-150',
                  sc.border,
                  task.status === 'Unfinished' && 'bg-rose-50/40 dark:bg-rose-950/10'
                )}
              >
                <div className="flex items-start gap-4 px-5 py-4">

                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">{sc.icon}</div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 min-w-0">
                      {task.isPrivate && isOwnerOrAdmin && (
                        <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                      )}
                      <p className={cn(
                        'text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug',
                        done && 'line-through text-slate-400 dark:text-slate-500'
                      )}>
                        {task.title}
                      </p>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Role */}
                      {task.assignedToRole && (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold',
                          ROLE_COLORS[task.assignedToRole as AppRole]
                        )}>
                          {task.assignee || roleLabel(task.assignedToRole)}
                        </span>
                      )}

                      {/* Project */}
                      {task.project && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          <ChevronRight className="w-2.5 h-2.5" />
                          {getProjName(task.project)}
                        </span>
                      )}

                      {/* Due date */}
                      {task.dueDate && task.dueDate !== '—' && (
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg',
                          overdue
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                            : done
                              ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 line-through'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        )}>
                          <CalendarDays className="w-2.5 h-2.5" />
                          {overdue ? 'Overdue · ' : ''}{task.dueDate}
                        </span>
                      )}

                      {/* Priority */}
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', pc.bg)} />
                        {pc.label}
                      </span>
                    </div>
                  </div>

                  {/* Right: actions + status */}
                  <div className="flex items-center gap-2 shrink-0">

                    {/* Status badge */}
                    <span className={cn(
                      'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold',
                      sc.badge
                    )}>
                      {task.status}
                    </span>

                    {/* Action buttons */}
                    {task.status === 'To Do' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'In Progress')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
                      >
                        Start
                      </button>
                    )}
                    {task.status === 'In Progress' && (
                      <>
                        <button
                          onClick={() => updateTaskStatus(task.id, 'To Do')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Pause
                        </button>
                        {canFinish(task) && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'Finished')}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
                          >
                            Done
                          </button>
                        )}
                      </>
                    )}
                    {task.status === 'To Do' && canFinish(task) && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'Finished')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                      >
                        Done
                      </button>
                    )}
                    {(task.status === 'Finished' || task.status === 'Unfinished') && (isOwnerOrAdmin || task.status === 'Finished') && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'To Do')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Reopen
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer count ── */}
      {visibleTasks.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-2">
          {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
          {filterStatus !== 'All' && ` · ${filterStatus}`}
        </p>
      )}

      {/* ── New Task modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">New Task</h3>
                <p className="text-xs text-slate-400 mt-0.5">Fill in the details to assign a task</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  autoFocus type="text"
                  placeholder="e.g. Review Q3 contracts"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  className={inputCls}
                />
              </div>

              {/* Assign to Role */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Assign to Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={form.assignedToRole}
                  onChange={e => setForm({ ...form, assignedToRole: e.target.value as AppRole | '', assignedToUserId: '' })}
                  className={inputCls}
                >
                  <option value="">Select a role…</option>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>

              {/* Specific person */}
              {form.assignedToRole && membersForRole.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Specific Person <span className="text-slate-300 font-normal normal-case">(optional)</span>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Project <span className="text-slate-300 font-normal normal-case">(optional)</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })} className={inputCls}>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Deadline <span className="text-rose-400">*</span>
                  </label>
                  <input type="date" value={form.dueDate} min={todayStr} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
                </div>
              </div>

              {/* Private */}
              {isOwnerOrAdmin && (
                <label className="flex items-start gap-3 cursor-pointer py-3 px-4 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 select-none">
                  <input
                    type="checkbox" checked={form.isPrivate}
                    onChange={e => setForm({ ...form, isPrivate: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Private Task
                    </p>
                    <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">Only visible to Owner and Admin</p>
                  </div>
                </label>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.title.trim() || !form.assignedToRole || !form.dueDate}
                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
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
