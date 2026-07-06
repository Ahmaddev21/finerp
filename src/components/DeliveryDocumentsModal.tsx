import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, FileText, Trash2, ExternalLink, AlertTriangle, Loader2, ImageIcon, File, Download, Share2, IdCard, Car, Shield, BookUser, Briefcase, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDeliveryDocuments, DeliveryDocument, DocFolder, formatBytes } from '../hooks/useDeliveryDocuments';
import type { Delivery as DeliveryRecord } from '../hooks/useDeliveries';
import { useAuthStore } from '../store/auth';

interface Props {
  record: DeliveryRecord;
  onClose: () => void;
}

const FOLDERS: { key: DocFolder; label: string; icon: React.ElementType }[] = [
  { key: 'qid',        label: 'QID',               icon: IdCard    },
  { key: 'istimara',   label: 'Istimara',           icon: Car       },
  { key: 'license',    label: 'License',            icon: Shield    },
  { key: 'passport',   label: 'Passport',           icon: BookUser  },
  { key: 'secondment', label: 'Secondment (Iaara)', icon: Briefcase },
  { key: 'other',      label: 'Other',              icon: FolderOpen},
];

function DocIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  if (!mimeType && !fileName) return <File className="w-5 h-5 text-slate-400" />;
  if (mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-rose-500" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'doc' || ext === 'docx' || mimeType?.includes('word') || mimeType?.includes('officedocument'))
    return <FileText className="w-5 h-5 text-blue-600" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export default function DeliveryDocumentsModal({ record, onClose }: Props) {
  const { user } = useAuthStore();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const { documents, loading, uploading, error, fetch, uploadDocument, deleteDocument, getSignedUrl } = useDeliveryDocuments(record.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFolder, setActiveFolder] = useState<DocFolder>('qid');
  const [dragOver, setDragOver] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx'];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;

  const validateAndUpload = async (file: File) => {
    setLocalError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      setLocalError('Only PDF, JPG, PNG, WEBP, HEIC, DOC, and DOCX files are supported.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(`File too large. Maximum size is 10 MB (got ${formatBytes(file.size)}).`);
      return;
    }
    await uploadDocument(file, activeFolder);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
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
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setLocalError('Could not generate a link for this file. Please try again.');
  };

  const handleDownload = async (doc: DeliveryDocument) => {
    setDownloadingId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setDownloadingId(null);
    if (!url) { setLocalError('Could not generate download link. Please try again.'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    a.click();
  };

  const handleWhatsAppShare = async (doc: DeliveryDocument) => {
    setSharingId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setSharingId(null);
    if (!url) { setLocalError('Could not generate share link. Please try again.'); return; }
    const text = encodeURIComponent(`${doc.fileName}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (doc: DeliveryDocument) => {
    if (!window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    await deleteDocument(doc);
    setDeletingId(null);
  };

  const visibleDocs = documents.filter(d => d.folder === activeFolder);
  const activeMeta = FOLDERS.find(f => f.key === activeFolder)!;
  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="min-h-full flex items-center justify-center p-4"
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

        {/* Folder tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto custom-scrollbar">
            {FOLDERS.map(f => {
              const count = documents.filter(d => d.folder === f.key).length;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={() => { setActiveFolder(f.key); setLocalError(null); }}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all',
                    activeFolder === f.key
                      ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {f.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded-full',
                      activeFolder === f.key
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error banner */}
        {displayError && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 shrink-0">
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
              'border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer select-none',
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/10',
              uploading && 'opacity-60 cursor-not-allowed pointer-events-none'
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-semibold">Uploading to {activeMeta.label}…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <Upload className="w-6 h-6" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Upload to <span className="text-blue-600 dark:text-blue-400">{activeMeta.label}</span>
                </p>
                <p className="text-xs text-slate-400">PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX · Max 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
              <activeMeta.icon className="w-9 h-9 opacity-20" />
              <p className="text-sm font-medium">No {activeMeta.label} documents yet</p>
              <p className="text-xs">Upload a file above to add one.</p>
            </div>
          ) : (
            visibleDocs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <DocIcon mimeType={doc.mimeType} fileName={doc.fileName} />
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
                    title="Open"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all disabled:opacity-50"
                  >
                    {openingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    title="Download"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all disabled:opacity-50"
                  >
                    {downloadingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(doc)}
                    disabled={sharingId === doc.id}
                    title="Share via WhatsApp"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all disabled:opacity-50"
                  >
                    {sharingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  </button>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50"
                    >
                      {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
            {visibleDocs.length} {activeMeta.label} document{visibleDocs.length !== 1 ? 's' : ''} · {documents.length} total · Secured to your company account
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
