import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export type DocFolder = 'qid' | 'istimara' | 'license' | 'passport' | 'secondment' | 'other' | 'general';

export interface DeliveryDocument {
  id: string;
  deliveryId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
  folder: DocFolder;
}

function mapRow(row: any): DeliveryDocument {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size ?? null,
    mimeType: row.mime_type ?? null,
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
    folder: (row.folder as DocFolder) ?? 'general',
  };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export { formatBytes };

export function useDeliveryDocuments(deliveryId: string | null) {
  const { company } = useAuthStore();
  const [documents, setDocuments] = useState<DeliveryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured || !deliveryId || !company?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_documents')
      .select('*')
      .eq('delivery_id', deliveryId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDocuments(data ? data.map(mapRow) : []);
  }, [deliveryId, company?.id]);

  const uploadDocument = useCallback(async (file: File, folder: DocFolder = 'general'): Promise<boolean> => {
    if (!isSupabaseConfigured || !deliveryId || !company?.id) return false;
    const user = useAuthStore.getState().user;
    setUploading(true);
    setError(null);

    try {
      // Sanitize filename to avoid storage path issues
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
      const path = `${company.id}/delivery-documents/${deliveryId}/${folder}/${Date.now()}_${safeName}`;

      // Word docs have a MIME type that Supabase buckets don't whitelist by default.
      // Upload as octet-stream so Storage accepts it; the real type is saved in the DB row.
      const wordMimes = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const uploadContentType = wordMimes.includes(file.type) ? 'application/octet-stream' : (file.type || 'application/octet-stream');

      const { error: uploadErr } = await supabase.storage
        .from('finance_attachments')
        .upload(path, file, { upsert: false, contentType: uploadContentType });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase
        .from('delivery_documents')
        .insert({
          delivery_id: deliveryId,
          company_id: company.id,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id ?? null,
          folder,
        });

      if (insertErr) {
        // Roll back the storage upload if metadata insert fails
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
  }, [deliveryId, company?.id, fetch]);

  const deleteDocument = useCallback(async (doc: DeliveryDocument): Promise<void> => {
    if (!isSupabaseConfigured) return;
    setError(null);
    try {
      // Delete from storage first, then metadata
      await supabase.storage.from('finance_attachments').remove([doc.filePath]);
      const { error } = await supabase
        .from('delivery_documents')
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const getSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    console.log('[docs:getSignedUrl] path=', path);
    const { data, error } = await supabase.storage
      .from('finance_attachments')
      .createSignedUrl(path, 3600);
    if (error) {
      console.error('[docs:getSignedUrl] ERROR:', error.message, error);
      return null;
    }
    console.log('[docs:getSignedUrl] signedUrl=', data?.signedUrl?.slice(0, 80) + '…');
    return data?.signedUrl ?? null;
  }, []);

  return { documents, loading, uploading, error, fetch, uploadDocument, deleteDocument, getSignedUrl };
}
