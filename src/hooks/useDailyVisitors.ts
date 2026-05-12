import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface DailyVisitor {
  id: string;
  company_id: string;
  visitor_name: string;
  visit_date_time: string;
  purpose: string;
  mobile_number: string;
  remarks: string;
  created_at: string;
}

interface VisitorsState {
  visitors: DailyVisitor[];
  loading: boolean;
  error: string | null;
  fetchVisitors: () => Promise<void>;
  addVisitor: (visitor: Omit<DailyVisitor, 'id' | 'company_id' | 'created_at'>) => Promise<void>;
  deleteVisitor: (id: string) => Promise<void>;
}

export const useDailyVisitors = create<VisitorsState>((set, get) => ({
  visitors: [],
  loading: false,
  error: null,

  fetchVisitors: async () => {
    const { company } = useAuthStore.getState();
    if (!company) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_visitors')
        .select('*')
        .eq('company_id', company.id)
        .order('visit_date_time', { ascending: false });

      if (error) throw error;
      set({ visitors: data || [] });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  addVisitor: async (visitor) => {
    const { company } = useAuthStore.getState();
    if (!company) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_visitors')
        .insert([{ ...visitor, company_id: company.id }])
        .select()
        .single();

      if (error) throw error;
      set({ visitors: [data, ...get().visitors] });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteVisitor: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('daily_visitors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set({ visitors: get().visitors.filter(v => v.id !== id) });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
}));
