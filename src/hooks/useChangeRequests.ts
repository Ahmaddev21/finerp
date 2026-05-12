import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Transaction } from './useTransactions';

export interface ChangeRequest {
  id: number;
  company_id: string;
  record_type: string;
  record_id: string;
  requested_by: string;
  requested_by_name: string;
  status: 'pending' | 'approved' | 'rejected';
  old_data: any;
  new_data: any;
  reason?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
}

const seed: ChangeRequest[] = [
  {
    id: 1,
    company_id: 'demo',
    record_type: 'transaction',
    record_id: '9',
    requested_by: '3',
    requested_by_name: 'BDM User',
    status: 'pending',
    old_data: { date: '2026-03-10', amount: 15000, due_date: '2026-04-10' },
    new_data: { date: '2026-03-11', amount: 15000, due_date: '2026-04-12' },
    reason: 'Correct invoice date after data-entry review.',
    created_at: '2026-04-11T08:15:00.000Z',
  },
];

function mapRow(row: any, names: Record<string, string>): ChangeRequest {
  return {
    id: Number(row.id),
    company_id: row.company_id,
    record_type: row.record_type,
    record_id: String(row.record_id),
    requested_by: row.requested_by,
    requested_by_name: names[row.requested_by] || 'Team Member',
    status: row.status ?? 'pending',
    old_data: normalizePayload(row.old_data),
    new_data: normalizePayload(row.new_data),
    reason: row.reason ?? '',
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    review_note: row.review_note,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function normalizePayload(value: any): any {
  if (!value) return {};
  const raw = typeof value === 'string' ? safeParse(value) : value;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

function safeParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function useChangeRequests() {
  const { company, isInitialized } = useAuthStore();
  const user = useAuthStore(s => s.user);
    const [requests, setRequests] = useState<ChangeRequest[]>(isSupabaseConfigured ? [] : seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) { setLoading(false); return; }
    setLoading(true);

    const [{ data: rawRequests, error: requestError }, { data: members, error: membersError }] = await Promise.all([
      supabase
        .from('change_requests')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('member_profiles')
        .select('*')
        .eq('company_id', company.id),
    ]);

    setLoading(false);

    if (requestError) {
      const missingTable =
        requestError.message?.includes('relation "public.change_requests" does not exist') ||
        requestError.message?.includes('Could not find the table');
      if (missingTable) {
        setRequests([]);
      } else {
        setError(requestError.message);
      }
      return;
    }

    if (membersError) {
      setError(membersError.message);
      return;
    }

    const nameMap = Object.fromEntries(
      (members ?? []).map((member: any) => [
        member.user_id,
        member.username || 'Team Member',
      ])
    );

    setRequests((rawRequests ?? []).map(row => mapRow(row, nameMap)));
  }, [company?.id]);

  useEffect(() => {
    let channel: any;

    const setupChannel = async () => {
      if (isSupabaseConfigured && company?.id) {
        await fetch();
        channel = supabase.channel(`change-requests-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'change_requests', filter: `company_id=eq.${company.id}` },
            () => {
              void fetch();
            }
          )
          .subscribe();
      } else {
        void fetch();
      }
    };

    setupChannel();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [company?.id, fetch]);

  const submitTransactionChangeRequest = useCallback(
    async (transaction: Transaction, updates: Partial<Transaction>, reason: string) => {
      const optimistic: ChangeRequest = {
        id: Date.now(),
        company_id: company?.id ?? 'demo',
        record_type: 'transaction',
        record_id: String(transaction.id),
        requested_by: user?.id ?? 'unknown',
        requested_by_name: user?.name ?? 'Team Member',
        status: 'pending',
        old_data: {
          date: transaction.date,
          amount: transaction.amount,
          due_date: transaction.due_date,
          desc: transaction.desc,
          project: transaction.project,
          client_name: transaction.client_name,
          status: transaction.status,
        },
        new_data: updates,
        reason,
        created_at: new Date().toISOString(),
      };

      setRequests(prev => [optimistic, ...prev]);

      if (!isSupabaseConfigured || !company?.id || !user?.id) {
        return optimistic;
      }

      const { data, error } = await supabase
        .from('change_requests')
        .insert({
          company_id: company.id,
          record_type: 'transaction',
          record_id: String(transaction.id),
          requested_by: user.id,
          status: 'pending',
          old_data: optimistic.old_data,
          new_data: updates,
          reason,
        })
        .select('*')
        .single();

      if (error) {
        setRequests(prev => prev.filter(request => request.id !== optimistic.id));
        throw error;
      }

      const saved = mapRow(data, { [user.id]: user.name });
      setRequests(prev => prev.map(request => (request.id === optimistic.id ? saved : request)));


      return saved;
    },
    [company?.id, user?.id, user?.name]
  );

  const reviewChangeRequest = useCallback(
    async (id: number, status: 'approved' | 'rejected', reviewNote?: string) => {
      const optimisticReviewedAt = new Date().toISOString();
      setRequests(prev =>
        prev.map(request =>
          request.id === id
            ? {
                ...request,
                status,
                reviewed_by: user?.id,
                reviewed_at: optimisticReviewedAt,
                review_note: reviewNote ?? null,
              }
            : request
        )
      );

      if (!isSupabaseConfigured) return;

      
    if (!company) return;const { error } = await supabase
        .from('change_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: optimisticReviewedAt,
          review_note: reviewNote ?? null,
        })
        .eq('id', id);

      if (error) {
        setError(error.message);
        void fetch();
        throw error;
      }


    },
    [fetch, user?.id]
  );

  const pendingCount = useMemo(
    () => requests.filter(request => request.status === 'pending').length,
    [requests]
  );

  const submitChangeRequest = useCallback(
    async (
      recordType: string,
      recordId: string,
      oldData: Record<string, unknown>,
      newData: Record<string, unknown>,
      reason: string
    ) => {
      const optimistic: ChangeRequest = {
        id: Date.now(),
        company_id: company?.id ?? 'demo',
        record_type: recordType,
        record_id: String(recordId),
        requested_by: user?.id ?? 'unknown',
        requested_by_name: user?.name ?? 'Team Member',
        status: 'pending',
        old_data: oldData,
        new_data: newData,
        reason,
        created_at: new Date().toISOString(),
      };

      setRequests(prev => [optimistic, ...prev]);

      if (!isSupabaseConfigured || !company?.id || !user?.id) return optimistic;

      const { data, error } = await supabase
        .from('change_requests')
        .insert({
          company_id: company.id,
          record_type: recordType,
          record_id: String(recordId),
          requested_by: user.id,
          status: 'pending',
          old_data: oldData,
          new_data: newData,
          reason,
        })
        .select('*')
        .single();

      if (error) {
        setRequests(prev => prev.filter(r => r.id !== optimistic.id));
        throw error;
      }

      const saved = mapRow(data, { [user.id]: user.name });
      setRequests(prev => prev.map(r => (r.id === optimistic.id ? saved : r)));
      return saved;
    },
    [company?.id, user?.id, user?.name]
  );

  return {
    requests,
    loading,
    error,
    pendingCount,
    submitTransactionChangeRequest,
    submitChangeRequest,
    reviewChangeRequest,
    refetch: fetch,
  };
}
