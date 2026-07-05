import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Eye, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadAttachment, getSignedAttachmentUrl } from '../services/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | number;
  tableName?: string;
  currentAttachmentUrl?: string;
  onUploadSuccess: (url: string) => void;
  readonly?: boolean;
}

export default function DocumentAttachmentModal({
  isOpen, onClose, recordId, tableName = 'transactions', currentAttachmentUrl, onUploadSuccess, readonly = false
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const company = useAuthStore(s => s.company);

  useEffect(() => {
    const fetchUrl = async () => {
      if (currentAttachmentUrl && isOpen && isSupabaseConfigured) {
        const url = await getSignedAttachmentUrl(currentAttachmentUrl);
        setSignedUrl(url);
      } else {
        setSignedUrl(null);
      }
    };
    fetchUrl();
  }, [currentAttachmentUrl, isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setError('File must be less than 200KB');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      if (!isSupabaseConfigured || !company?.id) {
        // Demo mode: simulate upload
        setSuccess(true);
        onUploadSuccess(`demo/transaction/${recordId}/${file.name}`);
        setUploading(false);
        return;
      }

      const path = await uploadAttachment(file, 'transaction', String(recordId), company.id);

      // Update the record
      const { error: dbError } = await supabase
        .from(tableName)
        .update({ attachment_url: path })
        .eq('id', recordId);

      if (dbError) throw dbError;

      setSuccess(true);
      onUploadSuccess(path);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove this attachment?')) return;
    try {
      setUploading(true);
      if (isSupabaseConfigured) {
        const { error: dbError } = await supabase
          .from(tableName)
          .update({ attachment_url: null })
          .eq('id', recordId);
        if (dbError) throw dbError;
      }
      onUploadSuccess('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Document Attachment
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && !currentAttachmentUrl && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Document uploaded successfully!
            </div>
          )}

          {currentAttachmentUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">Document Attached</p>
                  <p className="text-xs text-slate-400 truncate">{currentAttachmentUrl.split('/').pop()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={signedUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  <Eye className="w-4 h-4" /> View File
                </a>
                {!readonly && (
                  <button
                    onClick={handleDelete}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 p-3 border border-slate-200 dark:border-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>

              {!readonly && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">— OR —</p>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-blue-600 hover:underline">
                    Replace Document
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-1">Upload Document</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 max-w-[200px] mx-auto">
                PDF, JPG, or PNG. Max 200KB. Securely stored and linked to this record.
              </p>
              {!readonly ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</span>
                  ) : 'Select File'}
                </button>
              ) : (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-sm">
                  No document uploaded.
                </div>
              )}
            </div>
          )}

          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} />
        </div>
      </div>
    </div>
  );
}
