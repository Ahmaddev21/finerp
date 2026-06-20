import React, { useState } from 'react';
import { Truck, Search, Plus, X, User, Shield, CreditCard, Smartphone, Mail, Key, MoreVertical, Filter, Bike, Car, Download, Eye, EyeOff, AlertTriangle, Hash, FolderOpen } from 'lucide-react';
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

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all';

export default function Delivery() {
  const { deliveries, loading, error, addDelivery, updateDeliveryStatus } = useDeliveries();
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
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Rider' | 'Driver' | 'Vehicles' | 'Inactive'>('All');
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

  // Filtering & Sorting
  const filtered = deliveries
    .filter(d => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
                           d.name.toLowerCase().includes(q) ||
                           d.emp_number.toLowerCase().includes(q) ||
                           d.delivery_code.toLowerCase().includes(q);
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

  const handleAdd = async () => {
    if (!form.emp_number || !form.name) return;
    await addDelivery({
      ...form,
      description: `New ${form.category} added: ${form.name}`
    });
    setIsOpen(false);
    setForm({
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
      status: 'Active',
      category: 'Rider'
    });
  };

  const [showPassword, setShowPassword] = useState(false);
  const [docsRecord, setDocsRecord] = useState<DeliveryRecord | null>(null);

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
              placeholder="Search by name, EMP, or Code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(inputCls, 'pl-10')}
            />
          </div>
          <button
            onClick={() => {
              setForm(prev => ({ ...prev, category: (categoryFilter === 'All' || categoryFilter === 'Vehicles' || categoryFilter === 'Inactive') ? 'Rider' : categoryFilter }));
              setIsOpen(true);
            }}
            disabled={categoryFilter === 'All' || categoryFilter === 'Vehicles' || categoryFilter === 'Inactive'}
            title={categoryFilter === 'All' ? 'Select a category first' : categoryFilter === 'Vehicles' ? 'Manage vehicles in Assets' : categoryFilter === 'Inactive' ? 'Cannot add inactive entries directly' : 'Add new entry'}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
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
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{d.password}</td>
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
      </div>

      {/* Documents Modal */}
      {docsRecord && (
        <DeliveryDocumentsModal
          record={docsRecord}
          onClose={() => setDocsRecord(null)}
        />
      )}

      {/* New Entry Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New {form.category}</h3>
                <p className="text-sm text-slate-500 mt-1">Complete the details below to add to the fleet.</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
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

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company</label>
                  <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Snoonu Logistics" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Snoonu ID</label>
                  <input type="text" value={form.snoonu_id} onChange={e => setForm({ ...form, snoonu_id: e.target.value })} placeholder="e.g. SN-9921" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
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

              <div className="grid grid-cols-2 gap-5">
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

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Number</label>
                  <input type="text" value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} placeholder="Passport No." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Expiry Date</label>
                  <input type="date" value={form.passport_expiry} onChange={e => setForm({ ...form, passport_expiry: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
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
              <button onClick={() => setIsOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                Discard
              </button>
              <button 
                onClick={handleAdd} 
                disabled={!form.emp_number || !form.name}
                className="px-8 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-5 h-5" /> Save {form.category}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
