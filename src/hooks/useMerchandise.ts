import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { Delivery } from './useDeliveries';

export interface MerchandiseRecord {
  id: string;
  delivery_id: string;    // TEXT — old column, still used for UNIQUE conflict resolution
  delivery_uuid?: string; // UUID FK → deliveries.uuid_id (new column from Phase 3)
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

export function useMerchandise() {
  const { company } = useAuthStore();
  const [data, setData] = useState<EmployeeMerchandise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);
  
  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    
    const currentFetch = ++fetchCount.current;
    setLoading(true);
    
    try {
      // 1. Fetch all deliveries (employees) for this company
      const { data: deliveries, error: dError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('company_id', company.id)
        .order('name', { ascending: true });

      if (dError) throw dError;

      // 2. Fetch all merchandise records for this company
      const { data: merchandise, error: mError } = await supabase
        .from('merchandise')
        .select('*')
        .eq('company_id', company.id);

      if (mError) throw mError;

      if (currentFetch !== fetchCount.current) return; // Stale request protection

      // 3. Join them — prefer UUID FK match (Phase 3), fall back to TEXT for legacy rows
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
      if (currentFetch === fetchCount.current) setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateMerchandise = async (deliveryId: string, updates: Partial<MerchandiseRecord>) => {
    if (!isSupabaseConfigured || !company?.id) return false;

    // Look up the delivery's uuid_id from already-fetched state so we can populate the FK column.
    const employee = data.find((e: EmployeeMerchandise) => e.id === deliveryId);

    try {
      const { error } = await supabase
        .from('merchandise')
        .upsert({
          delivery_id: deliveryId,
          delivery_uuid: employee?.uuid_id || undefined,
          company_id: company.id,
          ...updates,
          updated_at: new Date().toISOString()
        }, { onConflict: 'delivery_id' });

      if (error) throw error;
      await fetch();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  return { data, loading, error, updateMerchandise, refetch: fetch };
}
