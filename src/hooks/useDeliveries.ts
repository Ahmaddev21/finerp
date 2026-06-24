import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type DeliveryStatus = 'In Transit' | 'Scheduled' | 'Delivered' | 'Issue Reported' | 'Active' | 'Inactive';
export type DeliveryCategory = 'Rider' | 'Driver';

export interface Delivery {
  id: string;            // TEXT primary key (UUID stored as text)
  uuid_id: string;       // UUID column — used as FK target by merchandise.delivery_uuid
  delivery_code: string; // Public Display ID (e.g., DEL-123456)
  emp_number: string;
  name: string;
  company: string;
  snoonu_id: string;
  snoonu_email: string;
  password?: string;
  qid: string;
  qid_expiry?: string;
  passport_number: string;
  passport_expiry?: string;
  car_number?: string;
  bike_number?: string;
  bike_expiry?: string;
  car_expiry?: string;
  mobile_number: string;
  status: DeliveryStatus;
  category: DeliveryCategory;
  description: string;
}

function mapRow(row: any): Delivery {
  let category: DeliveryCategory = 'Rider';
  const rawCat = (row.category || '').toLowerCase();
  if (rawCat === 'driver') category = 'Driver';
  else if (rawCat === 'rider') category = 'Rider';
  else category = row.bike_number ? 'Rider' : 'Driver';

  return {
    id: row.id,
    uuid_id: row.uuid_id ?? '',
    delivery_code: row.delivery_code || (row.id ? row.id.slice(0, 8).toUpperCase() : 'DEL-NEW'),
    emp_number: row.emp_number ?? '',
    name: row.name ?? '',
    company: row.company ?? '',
    snoonu_id: row.snoonu_id ?? '',
    snoonu_email: row.snoonu_email ?? '',
    password: row.password ?? '',
    qid: row.qid ?? '',
    qid_expiry: row.qid_expiry ?? '',
    passport_number: row.passport_number ?? '',
    passport_expiry: row.passport_expiry ?? '',
    car_number: row.car_number ?? '',
    bike_number: row.bike_number ?? '',
    bike_expiry: row.bike_expiry ?? '',
    car_expiry: row.car_expiry ?? '',
    mobile_number: row.mobile_number ?? '',
    status: row.status ?? 'Active',
    category,
    description: row.description ?? '',
  };
}

export function useDeliveries() {
  const { company } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);
  
  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    
    const currentFetch = ++fetchCount.current;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (currentFetch !== fetchCount.current) return; // stale — skip data update only

      if (error) throw error;
      setDeliveries(data ? data.map(mapRow) : []);
      setError(null);
    } catch (err: any) {
      if (currentFetch === fetchCount.current) setError(err.message);
    } finally {
      setLoading(false); // always clear — prevents infinite spinner
    }
  }, [company?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const addDelivery = useCallback(async (d: Omit<Delivery, 'id' | 'delivery_code' | 'uuid_id'>): Promise<string | null> => {
    if (!isSupabaseConfigured || !company?.id) return null;

    const tempId = crypto.randomUUID();
    const displayCode = `DEL-${String(Date.now()).slice(-6)}`;

    const optimistic: Delivery = {
      ...d,
      id: tempId,
      uuid_id: '',
      delivery_code: displayCode
    };

    setDeliveries(prev => [optimistic, ...prev]);

    try {
      const { error } = await supabase.from('deliveries').insert({
        id: tempId,
        delivery_code: displayCode,
        company_id: company.id,
        emp_number: d.emp_number,
        name: d.name,
        company: d.company,
        snoonu_id: d.snoonu_id,
        snoonu_email: d.snoonu_email,
        password: d.password,
        qid: d.qid,
        qid_expiry: d.qid_expiry || null,
        passport_number: d.passport_number,
        passport_expiry: d.passport_expiry || null,
        car_number: d.car_number,
        bike_number: d.bike_number,
        bike_expiry: d.bike_expiry || null,
        car_expiry: d.car_expiry || null,
        mobile_number: d.mobile_number,
        status: d.status,
        category: d.category,
        description: d.description || `New ${d.category} entry`
      });

      if (error) throw error;
      setError(null);
      return tempId;
    } catch (err: any) {
      setError(err.message);
      setDeliveries(prev => prev.filter(item => item.id !== tempId));
      return null;
    }
  }, [company?.id]);

  const deleteDelivery = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !company?.id) return false;

    setDeliveries(prev => prev.filter(d => d.id !== id));

    try {
      const { error } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', id)
        .eq('company_id', company.id);

      if (error) throw error;
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.message);
      fetch();
      return false;
    }
  }, [company?.id, fetch]);

  const updateDeliveryStatus = useCallback(async (id: string, status: DeliveryStatus) => {
    if (!isSupabaseConfigured || !company?.id) return;
    
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status })
        .eq('id', id)
        .eq('company_id', company.id);

      if (error) throw error;
      setError(null);
    } catch (err: any) {
      setError(err.message);
      fetch(); // Refresh state on error to ensure consistency
    }
  }, [company?.id, fetch]);

  return { deliveries, loading, error, addDelivery, updateDeliveryStatus, deleteDelivery, refetch: fetch };
}
