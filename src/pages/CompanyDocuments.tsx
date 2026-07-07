import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, Trash2, ExternalLink, Download, Share2,
  Loader2, AlertTriangle, ImageIcon, File, Building2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCompanyDocuments, CompanyDocument, formatBytes } from '../hooks/useCompanyDocuments';
import { useAuthStore } from '../store/auth';

const ENTITY_CONFIG: Record<string, { title: string; subtitle: string }> = {
  shareup: {
    title: 'Shareup',
    subtitle: 'Company documents for Shareup',
  },
  trading: {
    title: 'Rafi Al Aftab Trading & Contracting',
    subtitle: 'Company documents for RAA Trading & Contracting',
  },
  consultancy: {
    title: 'Rafi Al Aftab Consultancy',
    subtitle: 'Company documents for RAA Consultancy',
  },
};

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function DocIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  if (mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-rose-500" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'doc' || ext === 'docx' || mimeType?.includes('word'))
    return <FileText className="w-5 h-5 text-blue-600" />;
  if (ext === 'xls' || ext === 'xlsx' || mimeType?.includes('excel') || mimeType?.includes('spreadsheet'))
    return <FileText className="w-5 h-5 text-emerald-600" />;
  if (ext === 'ppt' || ext === 'pptx' || mimeType?.includes('powerpoint') || mimeType?.includes('presentation'))
    return <FileText className="w-5 h-5 text-orange-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export default function CompanyDocuments() {
  const { entity = '' } = useParams<{ entity: string }>();
  const config = ENTITY_CONFIG[entity] ?? { title: entity, subtitle: 'Company documents' };
  const { user } = useAuthStore();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const { documents, loading, uploading, error, fetch, uploadDocument, deleteDocument, getSignedUrl } =
    useCompanyDocuments(entity);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const validateAndUpload = async (file: File) => {
    setLocalError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) {
      setLocalError(`File type ".${ext}" is not supported.`);
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(`File too large. Maximum size is 20 MB (got ${formatBytes(file.size)}).`);
      return;
    }
    await uploadDocument(file);
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

  const handleOpen = async (doc: CompanyDocument) => {
    setOpeningId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setOpeningId(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setLocalError('Could not generate a link for this file.');
  };

  const handleDownload = async (doc: CompanyDocument) => {
    setDownloadingId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setDownloadingId(null);
    if (!url) { setLocalError('Could not generate download link.'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    a.click();
  };

  const handleShare = async (doc: CompanyDocument) => {
    setSharingId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setSharingId(null);
    if (!url) { setLocalError('Could not generate share link.'); return; }
    const text = encodeURIComponent(`${doc.fileName}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    await deleteDocument(doc);
    setDeletingId(null);
  };

  const displayError = localError || error;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">

      {/* Page header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{config.subtitle}</p>
        </div>
      </div>

      {/* Error banner */}
      {displayError && (
        <div className="mb-4 flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{displayError}</p>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none mb-6',
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/10',
          uploading && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-sm font-semibold">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload className="w-7 h-7" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Click or drag & drop to upload
            </p>
            <p className="text-xs text-slate-400">
              PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT · Max 20 MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Document list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Documents
          </h2>
          <span className="text-xs text-slate-400">{documents.length} total</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <File className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs">Upload a file above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <DocIcon mimeType={doc.mimeType} fileName={doc.fileName} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(doc.fileSize)}
                    {doc.fileSize ? ' · ' : ''}
                    {new Date(doc.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpen(doc)}
                    disabled={openingId === doc.id}
                    title="Open"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all disabled:opacity-50"
                  >
                    {openingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ExternalLink className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    title="Download"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all disabled:opacity-50"
                  >
                    {downloadingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleShare(doc)}
                    disabled={sharingId === doc.id}
                    title="Share via WhatsApp"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all disabled:opacity-50"
                  >
                    {sharingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Share2 className="w-4 h-4" />}
                  </button>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50"
                    >
                      {deletingId === doc.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
