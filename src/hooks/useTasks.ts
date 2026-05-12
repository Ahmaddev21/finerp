import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type TaskStatus = 'To Do' | 'In Progress' | 'Finished' | 'Unfinished';
export type Priority  = 'High' | 'Medium' | 'Low';
export type AppRole   = 'owner' | 'admin' | 'bdm' | 'engineer' | 'receptionist' | 'developer' | 'intern';

export interface Task {
  id: string;
  title: string;
  project: string;
  assignee: string;           // display name (kept for backward compat)
  assignedToRole: AppRole | null;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;            // 'YYYY-MM-DD' or '—'
  isPrivate: boolean;
}

export interface CompanyMember {
  userId: string;
  role: AppRole;
  username: string;
}

// ── seed data (offline / demo mode) ──────────────────────────────────────────
const seed: Task[] = [
  { id: 'TSK-001', title: 'Review Q2 contract renewals',              project: 'PRJ-001', assignee: 'Owner User',  assignedToRole: 'owner',  assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'High',   status: 'In Progress', dueDate: '2026-08-15', isPrivate: false },
  { id: 'TSK-002', title: 'Follow up on pending invoices',            project: 'PRJ-002', assignee: 'BDM User',    assignedToRole: 'bdm',    assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'High',   status: 'To Do',       dueDate: '2026-08-12', isPrivate: false },
  { id: 'TSK-003', title: 'Update delivery fleet status',             project: 'PRJ-001', assignee: 'Admin User',  assignedToRole: 'admin',  assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'Medium', status: 'To Do',       dueDate: '2026-08-18', isPrivate: false },
  { id: 'TSK-004', title: 'Prepare retail supply chain audit report', project: 'PRJ-004', assignee: 'Owner User',  assignedToRole: 'owner',  assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'Low',    status: 'Finished',    dueDate: '2026-07-05', isPrivate: false },
  { id: 'TSK-005', title: 'Coordinate warehouse optimization kickoff',project: 'PRJ-006', assignee: 'BDM User',    assignedToRole: 'bdm',    assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'Medium', status: 'In Progress', dueDate: '2026-08-20', isPrivate: false },
  { id: 'TSK-006', title: 'Generate monthly financial summary',       project: 'PRJ-003', assignee: 'Admin User',  assignedToRole: 'admin',  assignedToUserId: null, createdByUserId: null, createdByRole: null, priority: 'High',   status: 'To Do',       dueDate: '2026-08-10', isPrivate: false },
];

// ── status maps ───────────────────────────────────────────────────────────────
const STATUS_FROM_DB: Record<string, TaskStatus> = {
  pending:     'To Do',
  in_progress: 'In Progress',
  finished:    'Finished',
  completed:   'Finished',   // legacy
  unfinished:  'Unfinished',
};

const STATUS_TO_DB: Record<TaskStatus, string> = {
  'To Do':       'pending',
  'In Progress': 'in_progress',
  'Finished':    'finished',
  'Unfinished':  'unfinished',
};

function mapRow(row: any): Task {
  const rawDate: string = row.due_date ? row.due_date.toString() : '—';
  return {
    id:               row.id,
    title:            row.title            ?? '',
    project:          row.project          ?? row.project_id ?? '',
    assignee:         row.assignee         ?? '',
    assignedToRole:   row.assigned_to_role   ?? null,
    assignedToUserId: row.assigned_to_user_id ?? null,
    createdByUserId:  row.created_by_user_id  ?? null,
    createdByRole:    row.created_by_role     ?? null,
    priority:         (row.priority        ?? 'Medium') as Priority,
    status:           STATUS_FROM_DB[row.status] ?? 'To Do',
    dueDate:          rawDate === '—' ? '—' : rawDate.slice(0, 10),
    isPrivate:        row.is_private        ?? false,
  };
}

// ── hook ──────────────────────────────────────────────────────────────────────
export function useTasks() {
  const { company, isInitialized } = useAuthStore();

  const [tasks,   setTasks]   = useState<Task[]>(isSupabaseConfigured ? [] : seed);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Auto-persist overdue tasks as 'unfinished' in the DB.
  // Returns the rows array (mutated in-place for status).
  const markOverdue = useCallback(async (rows: any[]): Promise<any[]> => {
    const todayStr = new Date().toISOString().split('T')[0]; // UTC date string
    const overdueIds = rows
      .filter(r => {
        if (!r.due_date || r.due_date === '—') return false;
        if (['finished', 'unfinished'].includes(r.status))  return false;
        return r.due_date.toString().slice(0, 10) < todayStr;
      })
      .map(r => r.id);

    if (overdueIds.length === 0) return rows;

    await supabase.from('tasks').update({ status: 'unfinished' }).in('id', overdueIds);

    return rows.map(r =>
      overdueIds.includes(r.id) ? { ...r, status: 'unfinished' } : r
    );
  }, []);

  const fetchMembers = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from('member_profiles')
      .select('user_id, role, username')
      .eq('company_id', companyId);

    if (data) {
      setMembers(data.map(r => ({
        userId:   r.user_id,
        role:     r.role     as AppRole,
        username: r.username ?? 'User',
      })));
    }
  }, []);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);

    if (err) { setError(err.message); return; }

    const updatedRows = await markOverdue(data ?? []);
    setTasks(updatedRows.map(mapRow));
  }, [company?.id, markOverdue]);

  // Initial load
  useEffect(() => {
    if (isInitialized && company) {
      fetch();
      fetchMembers(company.id);
    }
  }, [fetch, fetchMembers, isInitialized, company]);

  // Realtime subscription — unique channel name prevents StrictMode double-mount collision
  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const name = `tasks-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${company.id}` },
        () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id]);

  // ── mutations ───────────────────────────────────────────────────────────────

  const addTask = useCallback(async (t: Omit<Task, 'id'>) => {
    const newId = `TSK-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const optimistic: Task = { ...t, id: newId };
    setTasks(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;

    const { error: err } = await supabase.from('tasks').insert({
      id:                   newId,
      company_id:           company?.id,
      title:                t.title,
      project:              t.project || null,
      assignee:             t.assignee,
      assigned_to_role:     t.assignedToRole     ?? null,
      assigned_to_user_id:  t.assignedToUserId   ?? null,
      created_by_user_id:   t.createdByUserId     ?? null,
      created_by_role:      t.createdByRole       ?? null,
      priority:             t.priority,
      status:               STATUS_TO_DB[t.status],
      due_date:             t.dueDate === '—' ? null : t.dueDate,
      is_private:           t.isPrivate,
    });

    if (err) {
      setError(err.message);
      setTasks((prev: Task[]) => prev.filter((x: Task) => x.id !== newId));
    }
  }, [company?.id]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    setTasks((prev: Task[]) => prev.map((t: Task) => t.id === id ? { ...t, status } : t));
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase
      .from('tasks')
      .update({ status: STATUS_TO_DB[status] })
      .eq('id', id);
    if (err) { setError(err.message); fetch(); }
  }, [fetch]);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev: Task[]) => prev.filter((t: Task) => t.id !== id));
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from('tasks').delete().eq('id', id);
    if (err) { setError(err.message); fetch(); }
  }, [fetch]);

  return { tasks, members, loading, error, addTask, updateTaskStatus, deleteTask, refetch: fetch };
}
