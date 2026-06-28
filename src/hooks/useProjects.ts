import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { isAdminRole } from '../lib/roles';

export interface Project {
  id: string;
  name: string;
  client: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  /** Total contract value — what the client pays */
  revenue: number;
  /** Company capital allocated to this project */
  investment: number;
  /** Operational / running expenses */
  expenses: number;
  /** Miscellaneous additional costs */
  additional_costs: number;
  /** Amount already collected from the client */
  payment_received: number;
  edit_count?: number;
  /** 'contracting' when auto-created from the Contracting section */
  source?: string;
}

// ── Derived financial helpers (stateless, deterministic) ──────────
export function calcProjectFinancials(p: Pick<Project, 'revenue' | 'investment' | 'expenses' | 'additional_costs' | 'payment_received'>) {
  const totalCost     = p.investment + p.expenses + p.additional_costs;
  const netProfit     = p.revenue - totalCost;
  const pendingBalance = p.revenue - p.payment_received;
  const profitMargin  = p.revenue > 0 ? (netProfit / p.revenue) * 100 : 0;
  return { totalCost, netProfit, pendingBalance, profitMargin };
}

// Fallback seed data — used only when Supabase is not configured
const seedProjects: Project[] = [
  { id: 'PRJ-001', name: 'Snoonu Logistics Fleet',      client: 'Snoonu',        status: 'Active',    revenue: 450000, investment: 180000, expenses: 120000, additional_costs: 20000, payment_received: 300000 },
  { id: 'PRJ-002', name: 'TechCorp Infrastructure',     client: 'TechCorp Inc.', status: 'Active',    revenue: 120000, investment: 20000,  expenses: 25000,  additional_costs: 0,     payment_received: 80000  },
  { id: 'PRJ-003', name: 'City Delivery Expansion',     client: 'Urban Eats',    status: 'Planning',  revenue: 85000,  investment: 10000,  expenses: 2000,   additional_costs: 0,     payment_received: 0      },
  { id: 'PRJ-004', name: 'Retail Supply Chain Audit',   client: 'MegaMart',      status: 'Completed', revenue: 65000,  investment: 12000,  expenses: 8000,   additional_costs: 2000,  payment_received: 65000  },
  { id: 'PRJ-005', name: 'Q3 Rider Contracting',        client: 'Snoonu',        status: 'Active',    revenue: 280000, investment: 100000, expenses: 90000,  additional_costs: 20000, payment_received: 140000 },
  { id: 'PRJ-006', name: 'Warehouse Optimization',      client: 'LogisTech',     status: 'On Hold',   revenue: 95000,  investment: 30000,  expenses: 8000,   additional_costs: 2000,  payment_received: 47500  },
];

function mapRow(row: any): Project {
  return {
    id:               row.id,
    name:             row.name,
    client:           row.client_name ?? row.client ?? '',
    status:           row.status ?? 'Planning',
    revenue:          Number(row.revenue          ?? 0),
    investment:       Number(row.investment       ?? 0),
    expenses:         Number(row.expenses         ?? 0),
    additional_costs: Number(row.additional_costs ?? 0),
    payment_received: Number(row.payment_received ?? 0),
    edit_count:       row.edit_count ?? 0,
    source:           row.source ?? undefined,
  };
}

export function useProjects() {
  const { company } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>(isSupabaseConfigured ? [] : seedProjects);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setProjects(data ? data.map(mapRow) : []);
  }, [company?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const addProject = useCallback(async (project: Omit<Project, 'id'>) => {
    const newId = `PRJ-${Math.floor(Math.random() * 90000 + 10000)}`;
    const optimistic: Project = { ...project, id: newId };
    setProjects(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;
    if (!company?.id) {
      console.warn('[useProjects] No company ID — entry kept locally.');
      return;
    }

    const { error } = await supabase.from('projects').insert({
      id:               newId,
      company_id:       company.id,
      name:             project.name,
      client_name:      project.client,
      status:           project.status,
      revenue:          project.revenue,
      investment:       project.investment,
      expenses:         project.expenses,
      additional_costs: project.additional_costs,
      payment_received: project.payment_received,
    });
    if (error) {
      setError(error.message);
      setProjects(prev => prev.filter(p => p.id !== newId));
    }
  }, [company?.id]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    const role    = useAuthStore.getState().user?.role;
    const isAdmin = isAdminRole(role);
    const proj    = projects.find(p => p.id === id);
    if (!proj) return false;

    const isSensitive =
      (updates.revenue          !== undefined && updates.revenue          !== proj.revenue)          ||
      (updates.investment       !== undefined && updates.investment       !== proj.investment)       ||
      (updates.expenses         !== undefined && updates.expenses         !== proj.expenses)         ||
      (updates.additional_costs !== undefined && updates.additional_costs !== proj.additional_costs) ||
      (updates.payment_received !== undefined && updates.payment_received !== proj.payment_received) ||
      (updates.status           !== undefined && updates.status           !== proj.status);

    const isSelfCorrection = !isAdmin && (!proj.edit_count || proj.edit_count === 0);
    const needsApproval    = !isAdmin && !isSelfCorrection && isSensitive;

    if (needsApproval) {
      setError('Owner approval required for further edits to this project.');
      return 'APPROVAL_REQUIRED';
    }

    // Optimistic update
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    if (!isSupabaseConfigured) return true;

    const dbPayload: Record<string, any> = {};
    if (updates.name             !== undefined) dbPayload.name             = updates.name;
    if (updates.client           !== undefined) dbPayload.client_name      = updates.client;
    if (updates.status           !== undefined) dbPayload.status           = updates.status;
    if (updates.revenue          !== undefined) dbPayload.revenue          = Number(updates.revenue);
    if (updates.investment       !== undefined) dbPayload.investment       = Number(updates.investment);
    if (updates.expenses         !== undefined) dbPayload.expenses         = Number(updates.expenses);
    if (updates.additional_costs !== undefined) dbPayload.additional_costs = Number(updates.additional_costs);
    if (updates.payment_received !== undefined) dbPayload.payment_received = Number(updates.payment_received);

    if (isSelfCorrection) dbPayload.edit_count = 1;

    const { error } = await supabase.from('projects').update(dbPayload).eq('id', id);
    if (error) { setError(error.message); fetch(); return false; }
    return true;
  }, [fetch, projects]);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { setError(error.message); fetch(); }
  }, [fetch]);

  return { projects, loading, error, addProject, updateProject, deleteProject, refetch: fetch };
}
