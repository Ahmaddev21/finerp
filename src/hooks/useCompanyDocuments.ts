import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export interface CompanyDocument {
  id: string;
  entity: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

function mapRow(row: any): CompanyDocument {
  return {
    id: row.id,
    entity: row.entity,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size ?? null,
    mimeType: row.mime_type ?? null,
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
  };
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function useCompanyDocuments(entity: string) {
  const { company } = useAuthStore();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !entity || !company?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('company_entity_documents')
      .select('*')
      .eq('entity', entity)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDocuments(data ? data.map(mapRow) : []);
  }, [entity, company?.id]);

  const uploadDocument = useCallback(async (file: File): Promise<boolean> => {
    if (!isSupabaseConfigured || !entity || !company?.id) return false;
    const user = useAuthStore.getState().user;
    setUploading(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
      const path = `${company.id}/company-docs/${entity}/${Date.now()}_${safeName}`;

      const wordMimes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ];
      const uploadContentType = wordMimes.includes(file.type)
        ? 'application/octet-stream'
        : (file.type || 'application/octet-stream');

      const { error: uploadErr } = await supabase.storage
        .from('finance_attachments')
        .upload(path, file, { upsert: false, contentType: uploadContentType });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase
        .from('company_entity_documents')
        .insert({
          entity,
          company_id: company.id,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id ?? null,
        });

      if (insertErr) {
        await supabase.storage.from('finance_attachments').remove([path]);
        throw insertErr;
      }

      await fetch();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setUploading(false);
    }
  }, [entity, company?.id, fetch]);

  const deleteDocument = useCallback(async (doc: CompanyDocument): Promise<void> => {
    if (!isSupabaseConfigured) return;
    setError(null);
    try {
      await supabase.storage.from('finance_attachments').remove([doc.filePath]);
      const { error } = await supabase
        .from('company_entity_documents')
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const getSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('finance_attachments')
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  }, []);

  return { documents, loading, uploading, error, fetch, uploadDocument, deleteDocument, getSignedUrl };
}
