import React, { useState, useRef } from 'react';
import { Truck, Search, Plus, X, User, Shield, CreditCard, Smartphone, Mail, Key, MoreVertical, Filter, Bike, Car, Download, Eye, EyeOff, AlertTriangle, Hash, FolderOpen, Trash2, Pencil, IdCard, BookUser, FileUp, Upload, Clock, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDeliveries, DeliveryStatus, DeliveryCategory } from '../hooks/useDeliveries';
import type { Delivery as DeliveryRecord } from '../hooks/useDeliveries';
import { useAssets } from '../hooks/useAssets';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { useAuthStore } from '../store/auth';
import { countPriorEdits, writeAuditLog } from '../lib/audit';
import { exportFleetCSV } from '../utils/exportUtils';
import { RowMenu } from '../components/RowMenu';
import DeliveryDocumentsModal from '../components/DeliveryDocumentsModal';
import { useDocumentFolders, type FolderType } from '../hooks/useDocumentFolders';

// ── Document folder config ────────────────────────────────────────────────────
const FOLDER_TABS: { key: FolderType; label: string; icon: React.ElementType }[] = [
  { key: 'qid',      label: 'QID',      icon: IdCard   },
  { key: 'estamara', label: 'Estamara', icon: Car      },
  { key: 'license',  label: 'License',  icon: Shield   },
  { key: 'passport', label: 'Passport', icon: BookUser },
];
const FOLDER_KEYS = new Set<string>(FOLDER_TABS.map(f => f.key));

type DeliveryTab = 'All' | 'Rider' | 'Driver' | 'Vehicles' | 'Inactive' | FolderType;

// ── Document Folder View ──────────────────────────────────────────────────────
function DocumentFolderView({ folder, isOwner }: { folder: FolderType; isOwner: boolean }) {
  const { docs, loading, uploading, error, uploadDoc, deleteDoc, getUrl } = useDocumentFolders();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const folderDocs = docs.filter(d => d.folder === folder);
  const meta = FOLDER_TABS.find(f => f.key === folder)!;
  const Icon = meta.icon;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await uploadDoc(file, folder);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm('Delete this file?')) return;
    setDeletingId(id);
    await deleteDoc(id, filePath);
    setDeletingId(null);
  };

  const handleOpen = async (filePath: string) => {
    const url = await getUrl(filePath);
    if (url) window.open(url, '_blank');
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
            <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{meta.label} Documents</h2>
            <p className="text-xs text-slate-400">{folderDocs.length} file{folderDocs.length !== 1 ? 's' : ''} stored</p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-colors"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Drop zone — owner only */}
      {isOwner && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
            dragOver
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
          )}
        >
          <FileUp className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Drop files here or <span className="text-emerald-600 dark:text-emerald-400">browse</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, DOCX — max 10 MB each</p>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading files…
        </div>
      ) : folderDocs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
          <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No {meta.label} files yet</p>
          {isOwner && <p className="text-xs mt-1">Upload files using the button above.</p>}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {folderDocs.map((doc, i) => {
            const ext = doc.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
            const isImg = /jpe?g|png|gif|webp/i.test(ext);
            return (
              <div key={doc.id} className={cn(
                'flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
                i !== 0 && 'border-t border-slate-100 dark:border-slate-800'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black',
                  isImg ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : ext === 'PDF' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                )}>
                  {ext.slice(0, 4)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{fmtDate(doc.uploadedAt)}</span>
                    {doc.uploadedByName && (
                      <span className="text-xs text-slate-300 dark:text-slate-600">· {doc.uploadedByName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpen(doc.filePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(doc.id, doc.filePath)}
                      disabled={deletingId === doc.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all';

export default function Delivery() {
  const { deliveries, loading, error, addDelivery, updateDelivery, updateDeliveryStatus, deleteDelivery } = useDeliveries();
  const { submitChangeRequest } = useChangeRequests();
  const { user } = useAuthStore();
  const { assets } = useAssets();

  const guardedUpdateStatus = async (record: DeliveryRecord, newStatus: DeliveryStatus) => {
    const isOwner = user?.role === 'owner';
    if (!isOwner && user?.id) {
      const prior = await countPriorEdits(user.id, record.id, 'deliveries');
      if (prior >= 1) {
        await submitChangeRequest(
          'delivery',
          record.id,
          { status: record.status },
          { status: newStatus },
          `Status change requested by ${user.name}`
        );
        return;
      }
    }
    await updateDeliveryStatus(record.id, newStatus);
    if (user?.id) {
      await writeAuditLog('UPDATE', 'deliveries', record.id, `Status changed to ${newStatus}`);
    }
  };
  const vehicles = assets.filter(a => a.type === 'Vehicle');
  const [categoryFilter, setCategoryFilter] = useState<DeliveryTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    emp_number: '',
    name: '',
    company: '',
    snoonu_id: '',
    snoonu_email: '',
    password: '',
    qid: '',
    qid_expiry: '',
    passport_number: '',
    passport_expiry: '',
    car_number: '',
    bike_number: '',
    bike_expiry: '',
    car_expiry: '',
    mobile_number: '',
    status: 'Active' as DeliveryStatus,
    category: 'Rider' as DeliveryCategory
  });

  const isOwner = user?.role === 'owner';

  // Filtering & Sorting
  const filtered = deliveries
    .filter(d => {
      if (FOLDER_KEYS.has(categoryFilter)) return false; // folder view active
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
                           d.name.toLowerCase().includes(q) ||
                           d.emp_number.toLowerCase().includes(q) ||
                           d.delivery_code.toLowerCase().includes(q) ||
                           (d.qid || '').toLowerCase().includes(q) ||
                           (d.passport_number || '').toLowerCase().includes(q) ||
                           (d.snoonu_id || '').toLowerCase().includes(q) ||
                           (d.bike_number || '').toLowerCase().includes(q) ||
                           (d.car_number || '').toLowerCase().includes(q);
      if (categoryFilter === 'Inactive') {
        return d.status === 'Inactive' && matchesSearch;
      }
      // Active tabs: exclude Inactive records
      if (d.status === 'Inactive') return false;
      const matchesCategory = categoryFilter === 'All' || d.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const numA = parseInt(a.emp_number.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.emp_number.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

  const emptyForm = {
    emp_number: '', name: '', company: '', snoonu_id: '', snoonu_email: '', password: '',
    qid: '', qid_expiry: '', passport_number: '', passport_expiry: '',
    car_number: '', bike_number: '', bike_expiry: '', car_expiry: '',
    mobile_number: '', status: 'Active' as DeliveryStatus, category: 'Rider' as DeliveryCategory,
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditRecord(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.emp_number || !form.name) return;
    if (editRecord) {
      const ok = await updateDelivery(editRecord.id, form);
      if (!ok) return;
      if (user?.id) {
        await writeAuditLog('UPDATE', 'deliveries', editRecord.id, `Edited ${form.category}: ${form.name} (${form.emp_number})`);
      }
    } else {
      const newId = await addDelivery({ ...form, description: `New ${form.category} added: ${form.name}` });
      if (!newId) return;
      if (user?.id) {
        await writeAuditLog('CREATE', 'deliveries', newId, `Added ${form.category}: ${form.name} (${form.emp_number})`);
      }
    }
    closeModal();
  };

  const [editRecord, setEditRecord] = useState<DeliveryRecord | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [docsRecord, setDocsRecord] = useState<DeliveryRecord | null>(null);

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Header with Category & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Rider', 'Driver'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {cat === 'Rider' && <Bike className="w-4 h-4" />}
              {cat === 'Driver' && <Car className="w-4 h-4" />}
              {cat === 'All' && <Filter className="w-4 h-4" />}
              {cat === 'Rider' ? 'Rider (Bike)' : cat === 'Driver' ? 'Driver (Car)' : 'All'}
            </button>
          ))}
          <button
            onClick={() => setCategoryFilter('Vehicles')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
              categoryFilter === 'Vehicles'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <Car className="w-4 h-4" /> Vehicle List
          </button>
          <button
            onClick={() => setCategoryFilter('Inactive')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
              categoryFilter === 'Inactive'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <EyeOff className="w-4 h-4" /> Inactive
            {deliveries.filter(d => d.status === 'Inactive').length > 0 && (
              <span className={cn(
                'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                categoryFilter === 'Inactive'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
              )}>
                {deliveries.filter(d => d.status === 'Inactive').length}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Document folder tabs */}
          {FOLDER_TABS.map(f => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
                categoryFilter === f.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => exportFleetCSV(filtered)}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, QID, passport, Snoonu ID, bike/car #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(inputCls, 'pl-10')}
            />
          </div>
          <button
            onClick={() => {
              setEditRecord(null);
              setForm({ ...emptyForm, category: (categoryFilter === 'Rider' || categoryFilter === 'Driver') ? categoryFilter : 'Rider' });
              setIsOpen(true);
            }}
            disabled={categoryFilter === 'All' || categoryFilter === 'Vehicles' || categoryFilter === 'Inactive' || FOLDER_KEYS.has(categoryFilter)}
            title={categoryFilter === 'All' ? 'Select a category first' : categoryFilter === 'Vehicles' ? 'Manage vehicles in Assets' : categoryFilter === 'Inactive' ? 'Cannot add inactive entries directly' : FOLDER_KEYS.has(categoryFilter) ? 'Switch to Rider or Driver to add entries' : 'Add new entry'}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Document Folder View */}
      {FOLDER_KEYS.has(categoryFilter) && (
        <DocumentFolderView folder={categoryFilter as FolderType} isOwner={isOwner} />
      )}

      {/* Main Table Content */}
      {!FOLDER_KEYS.has(categoryFilter) && <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {categoryFilter === 'Vehicles' ? (
          /* ── Vehicle List ─────────────────────────────── */
          <div className="overflow-x-auto min-h-[450px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50/60 dark:bg-slate-800/40">
                <tr>
                  {['S.L', 'Vehicle Name', 'Assigned Employee', 'Expiry Date', 'Ownership', 'Status', 'Remarks'].map(h => (
                    <th key={h} className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vehicles.map((v, index) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <Car className="w-4 h-4 text-indigo-500" />
                        {v.description}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{v.moved_to || '—'}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {v.expiry_date ? (
                        <span className={cn(
                          new Date(v.expiry_date) < new Date() ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'
                        )}>{v.expiry_date}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{v.ownership_type}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                        v.status === 'Active'   ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        v.status === 'Standby'  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500'
                      )}>{v.status}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate">{v.remarks || '—'}</td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Car className="w-8 h-8 opacity-20" />
                        <p className="font-medium">No vehicles found — add them in Assets</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading fleet data...</p>
          </div>
        ) : (
          /* ── Rider / Driver Table ─────────────────────── */
          <div className="overflow-x-auto min-h-[450px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50/60 dark:bg-slate-800/40">
                <tr>
                  {['S.L', 'Internal Code', 'EMP Number', 'Name', 'Company', 'Snoonu ID', 'Email', 'Password', 'QID', 'QID Expiry', 'Passport', 'Passport Expiry', 'Vehicle No.', 'Vehicle Expiry', 'Mobile', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((d, index) => {
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-5 py-4 font-medium text-slate-400">{index + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-slate-300" />
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{d.delivery_code}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-600 dark:text-emerald-400">{d.emp_number}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{d.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-tight">{d.category}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{d.company}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{d.snoonu_id}</td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{d.snoonu_email}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 select-none">
                            {d.password ? (revealedPasswords.has(d.id) ? d.password : '••••••••') : '—'}
                          </span>
                          {d.password && (
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(d.id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                              {revealedPasswords.has(d.id)
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{d.qid}</span>
                          {d.qid_expiry && <span className="text-[10px] text-rose-500 font-bold mt-0.5">Exp: {d.qid_expiry}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{d.qid_expiry || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{d.passport_number}</span>
                          {d.passport_expiry && <span className="text-[10px] text-amber-600 font-bold mt-0.5">Exp: {d.passport_expiry}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{d.passport_expiry || '—'}</td>
                      <td className="px-5 py-4">
                        {d.category === 'Rider' ? (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                            <Bike className="w-3.5 h-3.5" /> {d.bike_number}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                            <Car className="w-3.5 h-3.5" /> {d.car_number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {(() => {
                          const expiry = d.category === 'Rider' ? d.bike_expiry : d.car_expiry;
                          if (!expiry) return <span className="text-slate-400">—</span>;
                          return (
                            <span className={cn(
                              new Date(expiry) < new Date()
                                ? 'text-rose-500 font-bold'
                                : 'text-slate-600 dark:text-slate-300'
                            )}>{expiry}</span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{d.mobile_number}</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                          d.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500'
                        )}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <RowMenu
                          actions={[
                            {
                              label: 'Edit',
                              icon: <Pencil className="w-4 h-4" />,
                              iconCls: 'text-indigo-500',
                              onClick: () => {
                                setEditRecord(d);
                                setForm({
                                  emp_number: d.emp_number,
                                  name: d.name,
                                  company: d.company,
                                  snoonu_id: d.snoonu_id,
                                  snoonu_email: d.snoonu_email,
                                  password: d.password ?? '',
                                  qid: d.qid,
                                  qid_expiry: d.qid_expiry ?? '',
                                  passport_number: d.passport_number,
                                  passport_expiry: d.passport_expiry ?? '',
                                  car_number: d.car_number ?? '',
                                  bike_number: d.bike_number ?? '',
                                  bike_expiry: d.bike_expiry ?? '',
                                  car_expiry: d.car_expiry ?? '',
                                  mobile_number: d.mobile_number,
                                  status: d.status,
                                  category: d.category,
                                });
                                setIsOpen(true);
                              },
                            },
                            { kind: 'divider' },
                            { kind: 'header', label: 'Documents' },
                            {
                              label: 'View / Upload Docs',
                              icon: <FolderOpen className="w-4 h-4" />,
                              iconCls: 'text-blue-500',
                              onClick: () => setDocsRecord(d),
                            },
                            { kind: 'divider' },
                            { kind: 'header', label: 'Manage Status' },
                            {
                              label: 'Set Active',
                              icon: <Shield className="w-4 h-4" />,
                              iconCls: 'text-emerald-500',
                              onClick: () => void guardedUpdateStatus(d, 'Active'),
                              checked: d.status === 'Active'
                            },
                            {
                              label: 'Set Inactive',
                              icon: <Shield className="w-4 h-4" />,
                              iconCls: 'text-slate-400',
                              onClick: () => void guardedUpdateStatus(d, 'Inactive'),
                              checked: d.status === 'Inactive'
                            },
                            { kind: 'divider' },
                            {
                              label: 'Delete',
                              icon: <Trash2 className="w-4 h-4" />,
                              iconCls: user?.role === 'owner' ? 'text-rose-500' : 'text-slate-300',
                              disabled: user?.role !== 'owner',
                              onClick: () => {
                                if (user?.role !== 'owner') return;
                                if (confirm(`Delete ${d.name}? This cannot be undone.`)) {
                                  void (async () => {
                                    const ok = await deleteDelivery(d.id);
                                    if (ok && user?.id) {
                                      await writeAuditLog('DELETE', 'deliveries', d.id, `Deleted ${d.category}: ${d.name} (${d.emp_number})`);
                                    }
                                  })();
                                }
                              }
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Search className="w-8 h-8 opacity-20" />
                        <p className="font-medium">No matching records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Documents Modal */}
      {docsRecord && (
        <DeliveryDocumentsModal
          record={docsRecord}
          onClose={() => setDocsRecord(null)}
        />
      )}

      {/* Add / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full p-4 sm:p-8 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 sm:mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editRecord ? `Edit ${form.category}` : `Add New ${form.category}`}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {editRecord ? 'Update the details below and save.' : 'Complete the details below to add to the fleet.'}
                </p>
              </div>
              <button onClick={closeModal} className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">EMP Number <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={form.emp_number} onChange={e => setForm({ ...form, emp_number: e.target.value })} placeholder="e.g. EMP1001" className={cn(inputCls, 'pl-10')} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmad Abdullah" className={cn(inputCls, 'pl-10')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company</label>
                  <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Snoonu Logistics" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snoonu ID</label>
                  <input type="text" value={form.snoonu_id} onChange={e => setForm({ ...form, snoonu_id: e.target.value })} placeholder="e.g. SN-9921" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snoonu Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={form.snoonu_email} onChange={e => setForm({ ...form, snoonu_email: e.target.value })} placeholder="email@snoonu.com" className={cn(inputCls, 'pl-10')} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Portal Password</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={form.password} 
                      onChange={e => setForm({ ...form, password: e.target.value })} 
                      placeholder="Password" 
                      className={cn(inputCls, 'pl-10 pr-10')} 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QID Number</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={form.qid} onChange={e => setForm({ ...form, qid: e.target.value })} placeholder="290..." className={cn(inputCls, 'pl-10')} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QID Expiry Date</label>
                  <input type="date" value={form.qid_expiry} onChange={e => setForm({ ...form, qid_expiry: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Number</label>
                  <input type="text" value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} placeholder="Passport No." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Expiry Date</label>
                  <input type="date" value={form.passport_expiry} onChange={e => setForm({ ...form, passport_expiry: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {form.category === 'Rider' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bike Number</label>
                    <div className="relative">
                      <Bike className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form.bike_number} onChange={e => setForm({ ...form, bike_number: e.target.value })} placeholder="Bike Plate No." className={cn(inputCls, 'pl-10')} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Car Number</label>
                    <div className="relative">
                      <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form.car_number} onChange={e => setForm({ ...form, car_number: e.target.value })} placeholder="Car Plate No." className={cn(inputCls, 'pl-10')} />
                    </div>
                  </div>
                )}
                {form.category === 'Rider' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bike Expiry Date</label>
                    <input type="date" value={form.bike_expiry} onChange={e => setForm({ ...form, bike_expiry: e.target.value })} className={inputCls} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Car Expiry Date</label>
                    <input type="date" value={form.car_expiry} onChange={e => setForm({ ...form, car_expiry: e.target.value })} className={inputCls} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mobile Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} placeholder="+974..." className={cn(inputCls, 'pl-10')} />
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end gap-4">
              <button onClick={closeModal} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={!form.emp_number || !form.name}
                className="px-8 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-5 h-5" /> {editRecord ? 'Save Changes' : `Save ${form.category}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
