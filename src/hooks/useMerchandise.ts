import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';
import { Delivery } from './useDeliveries';

// ── Item-type canonical map — single source of truth ─────────────────────
// `field` matches the column name in the `merchandise` table exactly.
export const MERCH_ITEMS = [
  { type: 't_shirt',     label: 'T-Shirt',     field: 't_shirt_qty'      },
  { type: 'trouser',     label: 'Trouser',      field: 'trouser_qty'      },
  { type: 'helmet',      label: 'Helmet',       field: 'helmet_qty'       },
  { type: 'safety_gear', label: 'Safety Gear',  field: 'safety_gears_qty' },
  { type: 'thermal_bag', label: 'Thermal Bag',  field: 'thermal_bag_qty'  },
  { type: 'gillet',      label: 'Gillet',       field: 'gillets_qty'      },
] as const;

export type MerchItemType = typeof MERCH_ITEMS[number]['type'];
export type MerchField    = typeof MERCH_ITEMS[number]['field'];

// ── Types ─────────────────────────────────────────────────────────────────
export interface MerchandiseRecord {
  id: string;
  delivery_id: string;
  delivery_uuid?: string;
  company_id: string;
  t_shirt_qty: number;
  trouser_qty: number;
  helmet_qty: number;
  safety_gears_qty: number;
  thermal_bag_qty: number;
  gillets_qty: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeMerchandise extends Delivery {
  merchandise?: MerchandiseRecord;
}

export interface ReturnItem {
  item_type: MerchItemType;
  item_name: string;
  qty: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useMerchandise() {
  const { company, user } = useAuthStore();
  const [data, setData] = useState<EmployeeMerchandise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;

    const seq = ++fetchCount.current;
    setLoading(true);

    try {
      const { data: deliveries, error: dError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('company_id', company.id)
        .order('name', { ascending: true });

      if (dError) throw dError;

      const { data: merchandise, error: mError } = await supabase
        .from('merchandise')
        .select('*')
        .eq('company_id', company.id);

      if (mError) throw mError;
      if (seq !== fetchCount.current) return;

      const joined: EmployeeMerchandise[] = (deliveries || []).map(d => {
        const m = (merchandise || []).find(record =>
          (record.delivery_uuid && record.delivery_uuid === d.uuid_id) ||
          record.delivery_id === d.id
        );
        return { ...d, merchandise: m };
      });

      setData(joined);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (seq === fetchCount.current) setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Update allocation (existing, unchanged) ───────────────────────────
  const updateMerchandise = useCallback(async (
    deliveryId: string,
    updates: Partial<MerchandiseRecord>
  ) => {
    if (!isSupabaseConfigured || !company?.id) return false;

    const employee = data.find(e => e.id === deliveryId);

    try {
      const { error } = await supabase
        .from('merchandise')
        .upsert({
          delivery_id:   deliveryId,
          delivery_uuid: employee?.uuid_id || undefined,
          company_id:    company.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'delivery_id' });

      if (error) throw error;
      await fetch();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [company?.id, data, fetch]);

  // ── Record employee return ────────────────────────────────────────────
  // 1. Reduces `merchandise` allocation for the employee (in-place update)
  // 2. Inserts rows into `merchandise_returns` for audit trail
  // 3. Writes audit log
  const recordReturn = useCallback(async (
    deliveryId: string,
    employeeName: string,
    returns: ReturnItem[]
  ): Promise<boolean> => {
    if (!returns.length) return false;

    // ── Demo mode (no Supabase) ─────────────────────────────────────────
    if (!isSupabaseConfigured) {
      setData(prev => prev.map(emp => {
        if (emp.id !== deliveryId || !emp.merchandise) return emp;
        const updated = { ...emp.merchandise };
        for (const ret of returns) {
          const item = MERCH_ITEMS.find(i => i.type === ret.item_type);
          if (item) {
            const cur = (updated as Record<string, number>)[item.field] ?? 0;
            (updated as Record<string, number>)[item.field] = Math.max(0, cur - ret.qty);
          }
        }
        return { ...emp, merchandise: updated };
      }));
      return true;
    }

    if (!company?.id) return false;

    const employee = data.find(e => e.id === deliveryId);
    if (!employee?.merchandise) return false;

    const m = employee.merchandise;

    // Build updated qty values — floor at 0, never go negative
    const updatedFields: Record<string, number> = {};
    for (const ret of returns) {
      const item = MERCH_ITEMS.find(i => i.type === ret.item_type);
      if (!item) continue;
      const current = (m as Record<string, number>)[item.field] ?? 0;
      updatedFields[item.field] = Math.max(0, current - ret.qty);
    }

    try {
      // 1. Update the employee's merchandise allocation record
      const { error: updErr } = await supabase
        .from('merchandise')
        .update({ ...updatedFields, updated_at: new Date().toISOString() })
        .eq('id', m.id)
        .eq('company_id', company.id);

      if (updErr) throw updErr;

      // 2. Insert one audit row per item type returned
      const today = new Date().toISOString().split('T')[0];
      const returnRows = returns.map(r => ({
        company_id:    company.id,
        delivery_id:   deliveryId,
        employee_name: employeeName,
        item_type:     r.item_type,
        item_name:     r.item_name,
        returned_qty:  r.qty,
        return_date:   today,
        created_by:    user?.id ?? null,
      }));

      const { error: retErr } = await supabase
        .from('merchandise_returns')
        .insert(returnRows);

      if (retErr) throw retErr;

      // 3. Audit log
      const summary = returns.map(r => `${r.qty}× ${r.item_name}`).join(', ');
      await writeAuditLog(
        'UPDATE', 'merchandise', m.id,
        `Return by ${employeeName}: ${summary}`
      );

      setError(null);
      await fetch();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [company?.id, data, user?.id, fetch]);

  return { data, loading, error, updateMerchandise, recordReturn, refetch: fetch };
}
