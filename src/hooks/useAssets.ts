import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type AssetStatus = 'Active' | 'Standby' | 'Inactive';

export interface Asset {
  id: string;
  type: string;
  description: string;
  purchase_amount: number;
  purchase_date: string;
  expiry_date: string;
  ownership_type: string;
  remarks: string;
  moved_to: string;
  status: AssetStatus;
}

const seed: Asset[] = [
  {
    id: 'AST-001',
    type: 'Vehicle',
    description: 'Nissan Urvan 2021',
    purchase_amount: 65000,
    purchase_date: '2021-06-15',
    expiry_date: '2024-06-15',
    ownership_type: 'Company Bought',
    remarks: 'Assigned to logistics team',
    moved_to: 'Vehicle List',
    status: 'Active',
  },
  {
    id: 'AST-002',
    type: 'Vehicle',
    description: 'Honda City 2019',
    purchase_amount: 35000,
    purchase_date: '2022-01-10',
    expiry_date: '2024-01-10',
    ownership_type: 'Transferred from Rider',
    remarks: 'Needs maintenance next month',
    moved_to: 'Ahmed Al-Farsi',
    status: 'Standby',
  }
];

export function useAssets() {
  const { company } = useAuthStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchAssets = useCallback(async () => {
    if (!company?.id) {
      setLoading(false);
      return;
    }
    
    if (!isSupabaseConfigured) {
      setAssets(seed);
      setLoading(false);
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from('assets')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      
      setAssets(data.map(row => ({
        id: row.id,
        type: row.type ?? '',
        description: row.description ?? '',
        purchase_amount: Number(row.purchase_amount) || 0,
        purchase_date: row.purchase_date ?? '',
        expiry_date: row.expiry_date ?? '',
        ownership_type: row.ownership_type ?? '',
        remarks: row.remarks ?? '',
        moved_to: row.moved_to ?? '',
        status: (row.status as AssetStatus) ?? 'Active',
      })));
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      // Fallback to local mock data if table doesn't exist yet
      if (err?.code === '42P01') {
        setAssets(seed);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const addAsset = async (asset: Omit<Asset, 'id'>) => {
    const newId = `AST-${String(assets.length + 1).padStart(3, '0')}`;
    const optimisticAsset: Asset = { ...asset, id: newId };
    
    // Optimistic UI update
    setAssets(prev => [optimisticAsset, ...prev]);

    if (!isSupabaseConfigured) return;

    // Background sync
    const { error } = await supabase
      .from('assets')
      .insert({
        company_id: company?.id,
        type: asset.type,
        description: asset.description,
        purchase_amount: asset.purchase_amount,
        purchase_date: asset.purchase_date || null,
        expiry_date: asset.expiry_date || null,
        ownership_type: asset.ownership_type,
        remarks: asset.remarks,
        moved_to: asset.moved_to,
        status: asset.status ?? 'Active',
      });

    if (error) {
      console.error('Failed to save asset:', error);
      // Revert optimistic update on failure
      setAssets(prev => prev.filter(a => a.id !== newId));
      setError(error.message);
    }
  };

  const updateAsset = async (id: string, updates: Partial<Omit<Asset, 'id'>>) => {
    if (!isSupabaseConfigured) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      return;
    }

    const payload: any = { ...updates };
    // Make sure empty dates are null for postgres
    if (payload.purchase_date === '') payload.purchase_date = null;
    if (payload.expiry_date === '') payload.expiry_date = null;

    const { error } = await supabase
      .from('assets')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    await fetchAssets();
  };

  const deleteAsset = async (id: string) => {
    if (!isSupabaseConfigured) {
      setAssets(prev => prev.filter(a => a.id !== id));
      return;
    }

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchAssets();
  };

  return { assets, loading, error, addAsset, updateAsset, deleteAsset, refresh: fetchAssets };
}
