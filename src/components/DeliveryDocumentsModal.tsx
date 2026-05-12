import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, FileText, Trash2, ExternalLink, AlertTriangle, Loader2, ImageIcon, File } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDeliveryDocuments, DeliveryDocument, formatBytes } from '../hooks/useDeliveryDocuments';
import type { Delivery as DeliveryRecord } from '../hooks/useDeliveries';
import { useAuthStore } from '../store/auth';

interface Props {
  record: DeliveryRecord;
  onClose: () => void;
}

function DocIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="w-5 h-5 text-slate-400" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-rose-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export default function DeliveryDocumentsModal({ record, onClose }: Props) {
  const { user } = useAuthStore();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const { documents, loading, uploading, error, fetch, uploadDocument, deleteDocument, getSignedUrl } = useDeliveryDocuments(record.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic'];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (bucket updated by setup script)

  const validateAndUpload = async (file: File) => {
    setLocalError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Only PDF, JPG, PNG, WEBP, and HEIC files are supported.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(`File too large. Maximum size is 10 MB (got ${formatBytes(file.size)}).`);
      return;
    }
    await uploadDocument(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    // Reset input so same file can be re-selected after an error
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndUpload(file);
  };

  const handleOpen = async (doc: DeliveryDocument) => {
    setOpeningId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setOpeningId(null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setLocalError('Could not generate a link for this file. Please try again.');
    }
  };

  const handleDelete = async (doc: DeliveryDocument) => {
    if (!window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    await deleteDocument(doc);
    setDeletingId(null);
  };

  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Documents</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {record.name} &middot; <span className="font-mono text-xs">{record.delivery_code}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {displayError && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{displayError}</p>
          </div>
        )}

        {/* Upload zone */}
        <div className="px-6 pt-4 shrink-0">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none',
              dragOver
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10',
              uploading && 'opacity-60 cursor-not-allowed pointer-events-none'
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-sm font-semibold">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="w-7 h-7" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Click or drag to upload</p>
                <p className="text-xs text-slate-400">PDF, JPG, PNG, WEBP, HEIC · Max 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <FileText className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">No documents uploaded yet</p>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
              >
                <DocIcon mimeType={doc.mimeType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{doc.fileName}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(doc.fileSize)}
                    {doc.fileSize ? ' · ' : ''}
                    {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpen(doc)}
                    disabled={openingId === doc.id}
                    title="Open document"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all disabled:opacity-50"
                  >
                    {openingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ExternalLink className="w-4 h-4" />
                    }
                  </button>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete document"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50"
                    >
                      {deletingId === doc.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <p className="text-xs text-slate-400 text-center">
            {documents.length} document{documents.length !== 1 ? 's' : ''} · Secured to your company account
          </p>
        </div>
      </div>
    </div>
  );
}
