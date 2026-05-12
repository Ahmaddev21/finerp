import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { writeAuditLog } from '../lib/audit';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave';

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string | null;   // null for manually-entered employees without system accounts
  employeeName: string;
  role: string;
  date: string;                // 'YYYY-MM-DD'
  checkIn: string | null;      // 'HH:MM' (24-hour) or null
  checkOut: string | null;
  status: AttendanceStatus;
  leaveReason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AttendanceMember {
  userId: string;
  employeeName: string;
  role: string;
}

// ── DB mapper ──────────────────────────────────────────────────────────────────
function mapRow(row: any): AttendanceRecord {
  const sliceTime = (v: any): string | null => (v ? String(v).slice(0, 5) : null);
  return {
    id:           row.id,
    companyId:    row.company_id,
    employeeId:   row.employee_id   ?? null,
    employeeName: row.employee_name ?? '',
    role:         row.role          ?? '',
    date:         row.date ? String(row.date).slice(0, 10) : '',
    checkIn:      sliceTime(row.check_in),
    checkOut:     sliceTime(row.check_out),
    status:       (row.status ?? 'present') as AttendanceStatus,
    leaveReason:  row.leave_reason  ?? null,
    notes:        row.notes         ?? null,
    createdBy:    row.created_by    ?? null,
    createdAt:    row.created_at    ?? '',
  };
}

// ── hook ───────────────────────────────────────────────────────────────────────
export function useAttendance() {
  const { company, isInitialized } = useAuthStore();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Fetch registered team members for quick-fill suggestions in the form
  const fetchMembers = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from('member_profiles')
      .select('user_id, role, username')
      .eq('company_id', companyId);

    if (data) {
      setMembers(data.map(r => ({
        userId:       r.user_id,
        role:         r.role         ?? '',
        employeeName: r.username     ?? 'User',
      })));
    }
  }, []);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('company_id', company.id)
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setRecords((data ?? []).map(mapRow));
  }, [company?.id]);

  useEffect(() => {
    if (isInitialized && company) {
      fetch();
      fetchMembers(company.id);
    }
  }, [fetch, fetchMembers, isInitialized, company]);

  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const name = `attendance-${company.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records', filter: `company_id=eq.${company.id}` },
        () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id]);

  // ── mutations ──────────────────────────────────────────────────────────────

  const addRecord = useCallback(async (
    r: Omit<AttendanceRecord, 'id' | 'companyId' | 'createdAt'>
  ) => {
    const newId = `ATT-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const optimistic: AttendanceRecord = {
      ...r,
      id:        newId,
      companyId: company?.id ?? '',
      createdAt: new Date().toISOString(),
    };
    setRecords(prev => [optimistic, ...prev]);

    if (!isSupabaseConfigured) return;

    const { error: err } = await supabase.from('attendance_records').insert({
      id:            newId,
      company_id:    company?.id,
      employee_id:   r.employeeId   || null,   // null is valid for manual entries
      employee_name: r.employeeName,
      role:          r.role,
      date:          r.date,
      check_in:      r.checkIn      || null,
      check_out:     r.checkOut     || null,
      status:        r.status,
      leave_reason:  r.leaveReason  || null,
      notes:         r.notes        || null,
      created_by:    r.createdBy    || null,
    });

    if (err) {
      setError(err.message);
      setRecords(prev => prev.filter(x => x.id !== newId));
      return;
    }

    void writeAuditLog('CREATE', 'attendance_records', newId,
      `${r.employeeName} (${r.role}) — ${r.date} — ${r.status}`);
  }, [company?.id]);

  const updateRecord = useCallback(async (
    id: string,
    updates: Partial<Pick<AttendanceRecord, 'checkIn' | 'checkOut' | 'status' | 'leaveReason' | 'notes'>>
  ) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    if (!isSupabaseConfigured) return;

    const db: Record<string, any> = {};
    if ('checkIn'     in updates) db.check_in     = updates.checkIn     || null;
    if ('checkOut'    in updates) db.check_out    = updates.checkOut    || null;
    if ('status'      in updates) db.status       = updates.status;
    if ('leaveReason' in updates) db.leave_reason = updates.leaveReason || null;
    if ('notes'       in updates) db.notes        = updates.notes       || null;

    const { error: err } = await supabase
      .from('attendance_records').update(db).eq('id', id);

    if (err) { setError(err.message); fetch(); return; }
    void writeAuditLog('UPDATE', 'attendance_records', id,
      `Updated: ${Object.keys(updates).join(', ')}`);
  }, [fetch]);

  const deleteRecord = useCallback(async (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from('attendance_records').delete().eq('id', id);
    if (err) { setError(err.message); fetch(); return; }
    void writeAuditLog('DELETE', 'attendance_records', id, 'Attendance record deleted');
  }, [fetch]);

  return { records, members, loading, error, addRecord, updateRecord, deleteRecord, refetch: fetch };
}
