import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';
import { MERCH_ITEMS, type MerchItemType } from './useMerchandise';

// ── Types ─────────────────────────────────────────────────────────────────
export interface StockBatch {
  id: string;
  item_type: MerchItemType | 'other';
  item_name: string;
  provider: string;
  received_qty: number;
  received_date: string;
  notes: string;
  created_at: string;
}

export interface ReturnRecord {
  id: string;
  delivery_id: string;
  employee_name: string;
  item_type: MerchItemType | 'other';
  item_name: string;
  returned_qty: number;
  return_date: string;
  notes: string;
  created_at: string;
}

export interface AddStockParams {
  provider: string;
  received_date: string;
  notes: string;
  items: Array<{ item_type: string; item_name: string; qty: number }>;
}

// ── Demo seed data ────────────────────────────────────────────────────────
const STOCK_SEED: StockBatch[] = MERCH_ITEMS.map((item, i) => ({
  id: `seed-stock-${i}`,
  item_type: item.type,
  item_name: item.label,
  provider: 'SNOONU',
  received_qty: [50, 40, 30, 20, 25, 30][i],
  received_date: '2025-01-15',
  notes: 'Q1 initial batch',
  created_at: '2025-01-15T08:00:00Z',
}));

// ── Map DB row → StockBatch ───────────────────────────────────────────────
function mapStockRow(row: Record<string, unknown>): StockBatch {
  return {
    id:           String(row.id ?? ''),
    item_type:    (row.item_type ?? 'other') as StockBatch['item_type'],
    item_name:    String(row.item_name ?? ''),
    provider:     String(row.provider ?? 'SNOONU'),
    received_qty: Number(row.received_qty ?? 0),
    received_date:String(row.received_date ?? ''),
    notes:        String(row.notes ?? ''),
    created_at:   String(row.created_at ?? ''),
  };
}

function mapReturnRow(row: Record<string, unknown>): ReturnRecord {
  return {
    id:            String(row.id ?? ''),
    delivery_id:   String(row.delivery_id ?? ''),
    employee_name: String(row.employee_name ?? ''),
    item_type:     (row.item_type ?? 'other') as ReturnRecord['item_type'],
    item_name:     String(row.item_name ?? ''),
    returned_qty:  Number(row.returned_qty ?? 0),
    return_date:   String(row.return_date ?? ''),
    notes:         String(row.notes ?? ''),
    created_at:    String(row.created_at ?? ''),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useMerchandiseStock() {
  const { company, user } = useAuthStore();
  const [stockBatches,  setStockBatches]  = useState<StockBatch[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnRecord[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = useCallback(async () => {
    // Demo mode — use seed data
    if (!isSupabaseConfigured) {
      setStockBatches(STOCK_SEED);
      setReturnHistory([]);
      return;
    }

    if (!company?.id) return;

    const seq = ++fetchCount.current;
    setLoading(true);

    try {
      const [stockRes, returnsRes] = await Promise.all([
        supabase
          .from('merchandise_stock')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('merchandise_returns')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
      ]);

      if (seq !== fetchCount.current) return;
      if (stockRes.error)   throw stockRes.error;
      if (returnsRes.error) throw returnsRes.error;

      setStockBatches((stockRes.data   ?? []).map(mapStockRow));
      setReturnHistory((returnsRes.data ?? []).map(mapReturnRow));
      setError(null);
    } catch (err: unknown) {
      if (seq === fetchCount.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (seq === fetchCount.current) setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Receive a batch from provider ─────────────────────────────────────
  const addStockBatch = useCallback(async (params: AddStockParams): Promise<boolean> => {
    const validItems = params.items.filter(i => i.qty > 0);
    if (!validItems.length) return false;

    // Demo mode
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const newBatches: StockBatch[] = validItems.map(i => ({
        id:           `demo-${Date.now()}-${i.item_type}`,
        item_type:    i.item_type as StockBatch['item_type'],
        item_name:    i.item_name,
        provider:     params.provider,
        received_qty: i.qty,
        received_date: params.received_date,
        notes:        params.notes,
        created_at:   now,
      }));
      setStockBatches(prev => [...newBatches, ...prev]);
      return true;
    }

    if (!company?.id) return false;

    const rows = validItems.map(i => ({
      company_id:    company.id,
      item_type:     i.item_type,
      item_name:     i.item_name,
      provider:      params.provider,
      received_qty:  i.qty,
      received_date: params.received_date,
      notes:         params.notes || null,
      created_by:    user?.id ?? null,
    }));

    try {
      const { error: insErr } = await supabase
        .from('merchandise_stock')
        .insert(rows);

      if (insErr) throw insErr;

      await writeAuditLog(
        'CREATE', 'merchandise_stock', company.id,
        `Stock received from ${params.provider}: ` +
          validItems.map(i => `${i.qty}× ${i.item_name}`).join(', ')
      );

      setError(null);
      await fetch();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Insert failed');
      return false;
    }
  }, [company?.id, user?.id, fetch]);

  return {
    stockBatches,
    returnHistory,
    loading,
    error,
    addStockBatch,
    refetch: fetch,
  };
}
