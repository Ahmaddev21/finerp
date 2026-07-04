import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

/**
 * Centalized API service for FinERP
 * Enforces company_id scoping and provides clean interfaces for records.
 */

export const api = {
  /**
   * Projects
   */
  async getProjects() {
    if (!isSupabaseConfigured) return null;
    const company = useAuthStore.getState().company;
    const query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    return company?.id ? query.eq('company_id', company.id) : query;
  },

  async createProject(project: any) {
    if (!isSupabaseConfigured) return { data: null, error: null };
    const company = useAuthStore.getState().company;
    return await supabase.from('projects').insert({
      ...project,
      company_id: company?.id
    });
  },

  /**
   * Transactions (Invoices, Expenses, etc)
   */
  async getTransactions() {
    if (!isSupabaseConfigured) return null;
    const company = useAuthStore.getState().company;
    const query = supabase.from('transactions').select('*').order('date', { ascending: false });
    return company?.id ? query.eq('company_id', company.id) : query;
  },

  async createTransaction(tx: any) {
    if (!isSupabaseConfigured) return { data: null, error: null };
    const company = useAuthStore.getState().company;
    const user = useAuthStore.getState().user;
    
    return await supabase.from('transactions').insert({
      ...tx,
      company_id: company?.id,
      created_by: user?.id,
      status: tx.status || 'draft'
    });
  },

  /**
   * Company / Members
   */
  async getCompanyMembers() {
    if (!isSupabaseConfigured) return { data: [], error: null };
    const company = useAuthStore.getState().company;
    if (!company) return { data: [], error: 'No company selected' };

    return await supabase
      .from('company_users')
      .select('*, profiles(*)')
      .eq('company_id', company.id);
  },

  async updateMemberRole(userId: string, role: string) {
    if (!isSupabaseConfigured) return { error: null };
    const company = useAuthStore.getState().company;
    if (!company) return { error: 'No company selected' };

    return await supabase
      .from('company_users')
      .update({ role })
      .eq('company_id', company.id)
      .eq('user_id', userId);
  }
};
