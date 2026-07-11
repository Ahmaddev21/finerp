import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, Trash2, ExternalLink, Download, Share2,
  Loader2, AlertTriangle, ImageIcon, File, Building2,
  Users, Plus, X, ChevronDown, Banknote, CheckCircle2, Clock, RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCompanyDocuments, CompanyDocument, formatBytes } from '../hooks/useCompanyDocuments';
import { useCompanyEmployees, CompanyEmployee } from '../hooks/useCompanyEmployees';
import { useCompanyWPS, WPSRecord, WPSStatus } from '../hooks/useCompanyWPS';
import { useAuthStore } from '../store/auth';

// ── Config ────────────────────────────────────────────────────────────────────

const ENTITY_CONFIG: Record<string, { title: string; subtitle: string; color: string }> = {
  shareup: {
    title: 'Shareup',
    subtitle: 'Company documents, employees & WPS records for Shareup',
    color: 'bg-violet-600',
  },
  trading: {
    title: 'Rafi Al Aftab Trading & Contracting',
    subtitle: 'Company documents, employees & WPS records for RAA Trading',
    color: 'bg-blue-600',
  },
  consultancy: {
    title: 'Rafi Al Aftab Consultancy',
    subtitle: 'Company documents, employees & WPS records for RAA Consultancy',
    color: 'bg-emerald-600',
  },
};

const ALLOWED_EXT = ['pdf','jpg','jpeg','png','webp','heic','doc','docx','xls','xlsx','ppt','pptx','txt','csv'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

function DocIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  if (mimeType?.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-rose-500" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'doc' || ext === 'docx') return <FileText className="w-4 h-4 text-blue-600" />;
  if (ext === 'xls' || ext === 'xlsx') return <FileText className="w-4 h-4 text-emerald-600" />;
  if (ext === 'ppt' || ext === 'pptx') return <FileText className="w-4 h-4 text-orange-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

function WPSBadge({ status, onClick }: { status: WPSStatus; onClick?: () => void }) {
  const map: Record<WPSStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:    { label: 'Pending',    cls: 'bg-amber-50  dark:bg-amber-950/30  text-amber-600  dark:text-amber-400  border-amber-200  dark:border-amber-800',   icon: <Clock className="w-3 h-3" /> },
    processing: { label: 'Processing', cls: 'bg-blue-50   dark:bg-blue-950/30   text-blue-600   dark:text-blue-400   border-blue-200   dark:border-blue-800',    icon: <RefreshCw className="w-3 h-3" /> },
    paid:       { label: 'Paid',       cls: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <button
      onClick={onClick}
      title={onClick ? 'Click to cycle status' : undefined}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold transition-opacity',
        cls,
        onClick && 'hover:opacity-80 cursor-pointer'
      )}
    >
      {icon}{label}
    </button>
  );
}

const WPS_STATUS_CYCLE: WPSStatus[] = ['pending', 'processing', 'paid'];

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionCard({ icon, title, count, accent, children }: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className={cn('h-1 w-full', accent)} />
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0', accent)}>
          {icon}
        </div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── SECTION 1: Company Documents ──────────────────────────────────────────────

function DocumentsSection({ entity, isOwnerOrAdmin }: { entity: string; isOwnerOrAdmin: boolean }) {
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
    if (!ALLOWED_EXT.includes(ext)) { setLocalError(`File type ".${ext}" is not supported.`); return; }
    if (file.size > MAX_SIZE_BYTES) { setLocalError(`File too large. Max 20 MB.`); return; }
    await uploadDocument(file);
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
    a.href = url; a.download = doc.fileName; a.click();
  };

  const handleShare = async (doc: CompanyDocument) => {
    setSharingId(doc.id);
    const url = await getSignedUrl(doc.filePath);
    setSharingId(null);
    if (!url) { setLocalError('Could not generate share link.'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${doc.fileName}\n${url}`)}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!window.confirm(`Delete "${doc.fileName}"?`)) return;
    setDeletingId(doc.id);
    await deleteDocument(doc);
    setDeletingId(null);
  };

  const displayError = localError || error;

  return (
    <SectionCard icon={<FileText className="w-4 h-4" />} title="Company Documents" count={documents.length} accent="bg-blue-600">
      {displayError && (
        <div className="mx-5 mt-4 flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{displayError}</p>
          <button onClick={() => setLocalError(null)} className="ml-auto text-rose-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Upload zone */}
      <div className="p-4">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndUpload(f); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none',
            dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/10',
            uploading && 'opacity-60 cursor-not-allowed pointer-events-none'
          )}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-semibold">Uploading…</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-slate-400">
              <Upload className="w-5 h-5" />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Click or drag & drop to upload</p>
                <p className="text-xs text-slate-400">PDF, DOC, XLS, PNG, JPG and more · Max 20 MB</p>
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) validateAndUpload(f); e.target.value = ''; }}
        />
      </div>

      {/* Document rows */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <File className="w-8 h-8 opacity-20" />
          <p className="text-sm">No documents yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <DocIcon mimeType={doc.mimeType} fileName={doc.fileName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{doc.fileName}</p>
                <p className="text-xs text-slate-400">
                  {formatBytes(doc.fileSize)}{doc.fileSize ? ' · ' : ''}
                  {new Date(doc.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {[
                  { id: openingId, fn: () => handleOpen(doc), icon: <ExternalLink className="w-3.5 h-3.5" />, cls: 'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30', label: 'Open' },
                  { id: downloadingId, fn: () => handleDownload(doc), icon: <Download className="w-3.5 h-3.5" />, cls: 'hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30', label: 'Download' },
                  { id: sharingId, fn: () => handleShare(doc), icon: <Share2 className="w-3.5 h-3.5" />, cls: 'hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30', label: 'Share' },
                ].map(({ id, fn, icon, cls, label }) => (
                  <button key={label} onClick={fn} disabled={id === doc.id} title={label}
                    className={cn('p-1.5 rounded-lg text-slate-400 transition-all disabled:opacity-50', cls)}>
                    {id === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
                  </button>
                ))}
                {isOwnerOrAdmin && (
                  <button onClick={() => handleDelete(doc)} disabled={deletingId === doc.id} title="Delete"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50">
                    {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── SECTION 2: Employees ──────────────────────────────────────────────────────

function EmployeesSection({ entity, isOwnerOrAdmin }: { entity: string; isOwnerOrAdmin: boolean }) {
  const { employees, loading, saving, error, fetch, addEmployee, deleteEmployee } = useCompanyEmployees(entity);

  const [showForm, setShowForm] = useState(false);
  const [name, setName]               = useState('');
  const [position, setPosition]       = useState('');
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber]       = useState('');
  const [expiryDate, setExpiryDate]   = useState('');

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setName(''); setPosition(''); setNationality(''); setIdNumber(''); setExpiryDate(''); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await addEmployee({ name, position, nationality, idNumber, idExpiryDate: expiryDate });
    if (ok) resetForm();
  };

  return (
    <SectionCard icon={<Users className="w-4 h-4" />} title="Employees" count={employees.length} accent="bg-violet-600">
      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Add form */}
      {isOwnerOrAdmin && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Employee Name *</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Position</label>
                  <input
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    placeholder="e.g. Engineer, Driver"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nationality</label>
                  <input
                    value={nationality}
                    onChange={e => setNationality(e.target.value)}
                    placeholder="e.g. Indian, Pakistani"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">QID / Passport No.</label>
                  <input
                    value={idNumber}
                    onChange={e => setIdNumber(e.target.value)}
                    placeholder="ID number"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">QID Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Employee
                </button>
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-violet-200 dark:border-violet-800 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}
        </div>
      )}

      {/* Employee table */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <Users className="w-8 h-8 opacity-20" />
          <p className="text-sm">No employees added yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-2.5">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Position</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Nationality</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">QID / Passport</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">QID Expiry</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {employees.map(emp => (
                <EmployeeRow key={emp.id} emp={emp} isOwnerOrAdmin={isOwnerOrAdmin} onDelete={deleteEmployee} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function expiryInfo(dateStr: string | null): { label: string; cls: string } {
  if (!dateStr) return { label: '—', cls: 'text-slate-300 dark:text-slate-600' };
  const expiry = new Date(dateStr);
  expiry.setHours(23, 59, 59, 999);
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000);
  const formatted = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (daysLeft < 0)  return { label: `${formatted} (expired)`,       cls: 'text-rose-500 dark:text-rose-400 font-semibold' };
  if (daysLeft <= 7) return { label: `${formatted} (${daysLeft}d)`,   cls: 'text-rose-500 dark:text-rose-400 font-semibold' };
  if (daysLeft <= 30) return { label: `${formatted} (${daysLeft}d)`,  cls: 'text-amber-500 dark:text-amber-400 font-semibold' };
  return { label: formatted, cls: 'text-slate-500 dark:text-slate-400' };
}

function EmployeeRow({ emp, isOwnerOrAdmin, onDelete }: { emp: CompanyEmployee; isOwnerOrAdmin: boolean; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!window.confirm(`Remove "${emp.name}" from the employee list?`)) return;
    setDeleting(true);
    await onDelete(emp.id);
    setDeleting(false);
  };
  const expiry = expiryInfo(emp.idExpiryDate);
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{emp.name}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{emp.position || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{emp.nationality || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{emp.idNumber || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
      <td className={cn('px-4 py-3 text-xs whitespace-nowrap', expiry.cls)}>{expiry.label}</td>
      <td className="px-4 py-3">
        {isOwnerOrAdmin && (
          <button onClick={handleDelete} disabled={deleting} title="Remove employee"
            className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </td>
    </tr>
  );
}

// ── SECTION 3: WPS Details ────────────────────────────────────────────────────

function WPSSection({ entity, isOwnerOrAdmin, employeeNames }: {
  entity: string;
  isOwnerOrAdmin: boolean;
  employeeNames: string[];
}) {
  const { records, loading, saving, error, fetch, addRecord, updateStatus, deleteRecord } = useCompanyWPS(entity);

  const [showForm, setShowForm] = useState(false);
  const [empName, setEmpName]       = useState('');
  const [bankName, setBankName]     = useState('');
  const [account, setAccount]       = useState('');
  const [amount, setAmount]         = useState('');
  const [month, setMonth]           = useState('');
  const [status, setStatus]         = useState<WPSStatus>('pending');

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setEmpName(''); setBankName(''); setAccount(''); setAmount(''); setMonth(''); setStatus('pending'); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;
    const ok = await addRecord({
      employeeName: empName,
      bankName,
      accountNumber: account,
      wpsAmount: amount ? parseFloat(amount) : null,
      paymentMonth: month,
      status,
    });
    if (ok) resetForm();
  };

  const cycleStatus = (rec: WPSRecord) => {
    const idx = WPS_STATUS_CYCLE.indexOf(rec.status);
    const next = WPS_STATUS_CYCLE[(idx + 1) % WPS_STATUS_CYCLE.length];
    updateStatus(rec.id, next);
  };

  const totalPaid = records.filter(r => r.status === 'paid' && r.wpsAmount).reduce((s, r) => s + (r.wpsAmount ?? 0), 0);

  return (
    <SectionCard icon={<Banknote className="w-4 h-4" />} title="Employee WPS Details" count={records.length} accent="bg-emerald-600">
      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Summary strip */}
      {records.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-6 flex-wrap">
          {[
            { label: 'Total Records', value: records.length, cls: 'text-slate-700 dark:text-slate-300' },
            { label: 'Paid',          value: records.filter(r => r.status === 'paid').length, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Pending',       value: records.filter(r => r.status === 'pending').length, cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'Total Paid (QAR)', value: totalPaid.toLocaleString('en', { minimumFractionDigits: 2 }), cls: 'text-emerald-600 dark:text-emerald-400 font-mono text-sm' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center">
              <div className={cn('font-bold text-base', cls)}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {isOwnerOrAdmin && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Employee Name *</label>
                  <input
                    autoFocus
                    list="wps-employees"
                    value={empName}
                    onChange={e => setEmpName(e.target.value)}
                    placeholder="Employee name"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    required
                  />
                  <datalist id="wps-employees">
                    {employeeNames.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Bank Name</label>
                  <input
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. QNB, QIIB"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Account / IBAN</label>
                  <input
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    placeholder="Account number"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">WPS Amount (QAR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Payment Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as WPSStatus)}
                      className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all pr-8"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="paid">Paid</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || !empName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add WPS Record
                </button>
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add WPS Record
            </button>
          )}
        </div>
      )}

      {/* WPS table */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <Banknote className="w-8 h-8 opacity-20" />
          <p className="text-sm">No WPS records yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-2.5">Employee</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Bank</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Account</th>
                <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Amount (QAR)</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Month</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {records.map(rec => (
                <WPSRow key={rec.id} rec={rec} isOwnerOrAdmin={isOwnerOrAdmin}
                  onCycleStatus={() => cycleStatus(rec)}
                  onDelete={() => deleteRecord(rec.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function WPSRow({ rec, isOwnerOrAdmin, onCycleStatus, onDelete }: {
  rec: WPSRecord;
  isOwnerOrAdmin: boolean;
  onCycleStatus: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!window.confirm(`Delete WPS record for "${rec.employeeName}"?`)) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  const monthLabel = rec.paymentMonth
    ? new Date(rec.paymentMonth + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{rec.employeeName}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{rec.bankName || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{rec.accountNumber || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
        {rec.wpsAmount != null ? rec.wpsAmount.toLocaleString('en', { minimumFractionDigits: 2 }) : <span className="text-slate-300 dark:text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{monthLabel}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <WPSBadge status={rec.status} onClick={isOwnerOrAdmin ? onCycleStatus : undefined} />
      </td>
      <td className="px-4 py-3">
        {isOwnerOrAdmin && (
          <button onClick={handleDelete} disabled={deleting} title="Delete record"
            className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyDocuments() {
  const { entity = '' } = useParams<{ entity: string }>();
  const config = ENTITY_CONFIG[entity] ?? { title: entity, subtitle: '', color: 'bg-slate-600' };
  const { user } = useAuthStore();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  // Pull employee names to power the WPS datalist autocomplete
  const { employees } = useCompanyEmployees(entity);
  const employeeNames = employees.map(e => e.name);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', config.color)}>
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{config.subtitle}</p>
        </div>
      </div>

      {/* Section 1: Documents */}
      <DocumentsSection entity={entity} isOwnerOrAdmin={isOwnerOrAdmin} />

      {/* Section 2: Employees */}
      <EmployeesSection entity={entity} isOwnerOrAdmin={isOwnerOrAdmin} />

      {/* Section 3: WPS */}
      <WPSSection entity={entity} isOwnerOrAdmin={isOwnerOrAdmin} employeeNames={employeeNames} />

    </div>
  );
}
