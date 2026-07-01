import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type FolderType = 'qid' | 'estamara' | 'license' | 'passport';

export interface CompanyDoc {
  id: string;
  folder: FolderType;
  fileName: string;
  filePath: string;
  uploadedByName: string | null;
  uploadedAt: string;
  label: string | null;
}

function mapRow(row: any): CompanyDoc {
  return {
    id:             row.id,
    folder:         row.folder as FolderType,
    fileName:       row.file_name,
    filePath:       row.file_path,
    uploadedByName: row.profiles?.username ?? null,
    uploadedAt:     row.uploaded_at,
    label:          row.label ?? null,
  };
}

export function useDocumentFolders() {
  const { user, company } = useAuthStore();
  const [docs,      setDocs]      = useState<CompanyDoc[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    if (!isSupabaseConfigured || !company?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('company_documents')
      .select('*, profiles(username)')
      .eq('company_id', company.id)
      .order('uploaded_at', { ascending: false });
    if (!err && data) setDocs(data.map(mapRow));
    setLoading(false);
  }, [company?.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const ch = supabase
      .channel('company_documents_rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'company_documents',
        filter: `company_id=eq.${company.id}`,
      }, fetchDocs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [company?.id, fetchDocs]);

  const uploadDoc = useCallback(async (file: File, folder: FolderType, label?: string) => {
    if (!company?.id || !user?.id) return;
    setUploading(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `company-docs/${company.id}/${folder}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('finance_attachments')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from('company_documents').insert({
        company_id:  company.id,
        folder,
        file_name:   file.name,
        file_path:   path,
        uploaded_by: user.id,
        label:       label || null,
      });
      if (dbErr) {
        void supabase.storage.from('finance_attachments').remove([path]);
        throw dbErr;
      }
      await fetchDocs();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [company?.id, user?.id, fetchDocs]);

  const deleteDoc = useCallback(async (id: string, filePath: string) => {
    await supabase.storage.from('finance_attachments').remove([filePath]);
    await supabase.from('company_documents').delete().eq('id', id);
    await fetchDocs();
  }, [fetchDocs]);

  const getUrl = useCallback(async (filePath: string): Promise<string> => {
    const { data } = await supabase.storage
      .from('finance_attachments')
      .createSignedUrl(filePath, 60 * 60);
    return data?.signedUrl ?? '';
  }, []);

  return { docs, loading, uploading, error, uploadDoc, deleteDoc, getUrl };
}
