import React, { useState } from 'react';
import { Plus, X, Car, Loader2, FileText, Download, AlertCircle, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAssets, Asset } from '../hooks/useAssets';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { useAuthStore } from '../store/auth';
import { countPriorEdits, writeAuditLog } from '../lib/audit';
import { RowMenu } from '../components/RowMenu';

const th = "px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 tracking-wide uppercase text-[10px]";
const td = "px-4 py-3.5 text-sm border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300";
const inputCls = "w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all";

export default function Assets() {
  const { assets, loading, error, addAsset, updateAsset, deleteAsset } = useAssets();
  const { submitChangeRequest } = useChangeRequests();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditForm({
      description: asset.description,
      type: asset.type,
      expiry_date: asset.expiry_date,
      ownership_type: asset.ownership_type,
      moved_to: asset.moved_to,
      remarks: asset.remarks,
      status: asset.status,
    });
    setEditMsg('');
  };

  const handleSaveEdit = async () => {
    if (!editingAsset || !editForm.description?.trim()) return;
    setEditSaving(true);
    setEditMsg('');
    try {
      const isOwner = user?.role === 'owner';
      if (!isOwner && user?.id) {
        const prior = await countPriorEdits(user.id, editingAsset.id, 'assets');
        if (prior >= 1) {
          await submitChangeRequest(
            'asset',
            editingAsset.id,
            { description: editingAsset.description, moved_to: editingAsset.moved_to, status: editingAsset.status, expiry_date: editingAsset.expiry_date },
            editForm,
            `Asset edit requested by ${user.name}`
          );
          setEditMsg('Edit submitted for Owner approval.');
          setEditSaving(false);
          return;
        }
      }
      await updateAsset(editingAsset.id, editForm);
      await writeAuditLog('UPDATE', 'assets', editingAsset.id, `Updated: ${JSON.stringify(editForm)}`);
      setEditingAsset(null);
    } catch (err: any) {
      setEditMsg(err.message);
    } finally {
      setEditSaving(false);
    }
  };
  
  const [newAsset, setNewAsset] = useState({
    type: 'Vehicle',
    description: '',
    purchase_amount: '' as string | number,
    purchase_date: '',
    expiry_date: '',
    ownership_type: 'Company Bought',
    remarks: '',
    moved_to: ''
  });

  const handleAdd = async () => {
    if (!newAsset.description.trim()) return;
    
    const payload = { ...newAsset, purchase_amount: Number(newAsset.purchase_amount) || 0 };
    await addAsset(payload);
    
    setIsModalOpen(false);
    setNewAsset({
      type: 'Vehicle',
      description: '',
      purchase_amount: '',
      purchase_date: '',
      expiry_date: '',
      ownership_type: 'Company Bought',
      remarks: '',
      moved_to: ''
    });
  };

  const filteredAssets = assets.filter(a => 
    a.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.moved_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredAssets.reduce((sum, a) => sum + (Number(a.purchase_amount) || 0), 0);

  return (
    <React.Fragment>
      <div className="space-y-5 max-w-7xl mx-auto animate-fade-in-up">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-6 h-6 text-indigo-600" />
              Assets Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Track vehicles, equipment, and company property.
            </p>
          </div>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">Failed to save or fetch data: {error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Assets</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{filteredAssets.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Value</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {totalValue.toLocaleString()} QR
            </p>
          </div>
          <div className="col-span-2">
            <input
              type="text"
              placeholder="Search by description, assignment, or type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-full min-h-[80px] px-4 bg-white dark:bg-gray-900 border border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Loading Assets…</span>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/60 dark:bg-slate-800/40">
                  <tr>
                    <th className={th}>Type</th>
                    <th className={th}>Description</th>
                    <th className={th}>Purchase Value</th>
                    <th className={th}>Asset Dates</th>
                    <th className={th}>Ownership</th>
                    <th className={th}>Moved To</th>
                    <th className={th}>Remarks</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No assets found matching your criteria.</td></tr>
                  ) : (
                    filteredAssets.map(asset => (
                      <tr key={asset.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className={td}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            {asset.type}
                          </span>
                        </td>
                        <td className={cn(td, 'font-bold')}>{asset.description}</td>
                        <td className={cn(td, 'font-mono')}>{asset.purchase_amount.toLocaleString()} QR</td>
                        <td className={td}>
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="text-slate-500">Purchase: {asset.purchase_date || '—'}</span>
                            <span className={cn('font-semibold', 
                              asset.expiry_date && new Date(asset.expiry_date) < new Date() ? 'text-rose-500' : 'text-slate-500'
                            )}>
                              Expiry: {asset.expiry_date || '—'}
                            </span>
                          </div>
                        </td>
                        <td className={td}>
                          <span className={cn('text-[11px] font-bold uppercase tracking-wide',
                            asset.ownership_type.includes('Rider') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {asset.ownership_type}
                          </span>
                        </td>
                        <td className={td}>{asset.moved_to || '—'}</td>
                        <td className={cn(td, 'text-xs max-w-[200px] truncate')} title={asset.remarks}>{asset.remarks || '—'}</td>
                        <td className={cn(td, 'text-right')}>
                          <RowMenu actions={[
                            { label: 'Edit Asset', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(asset) },
                            { label: 'Delete Asset', danger: true, onClick: () => deleteAsset(asset.id) }
                          ]} align="right" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-indigo-600" /> New Asset Entry
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-5 mb-8">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Asset Type</label>
                <select value={newAsset.type} onChange={e => setNewAsset({ ...newAsset, type: e.target.value })} className={inputCls}>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Property">Property</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="text-rose-500">*</span></label>
                <input autoFocus type="text" placeholder="e.g. Nissan Urvan 2021" value={newAsset.description} onChange={e => setNewAsset({ ...newAsset, description: e.target.value })} className={inputCls} />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Purchase Amount (QR)</label>
                <input type="number" min="0" value={newAsset.purchase_amount} onChange={e => setNewAsset({ ...newAsset, purchase_amount: e.target.value === '' ? '' : Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Ownership Type</label>
                <select value={newAsset.ownership_type} onChange={e => setNewAsset({ ...newAsset, ownership_type: e.target.value })} className={inputCls}>
                  <option value="Company Bought">Company Bought</option>
                  <option value="Transferred from Rider">Transferred from Rider</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Purchase Date</label>
                <input type="date" value={newAsset.purchase_date} onChange={e => setNewAsset({ ...newAsset, purchase_date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Expiry Date</label>
                <input type="date" value={newAsset.expiry_date} onChange={e => setNewAsset({ ...newAsset, expiry_date: e.target.value })} className={inputCls} />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Moved To (Assignment)</label>
                <input type="text" placeholder="e.g. Vehicle List, Ahmed Al-Farsi, Site A" value={newAsset.moved_to} onChange={e => setNewAsset({ ...newAsset, moved_to: e.target.value })} className={inputCls} />
                <p className="text-xs text-slate-500 mt-1">Specify who is currently using it or where it is located.</p>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Remarks</label>
                <textarea rows={3} placeholder="Any additional notes..." value={newAsset.remarks} onChange={e => setNewAsset({ ...newAsset, remarks: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all">Cancel</button>
              <button onClick={handleAdd} disabled={!newAsset.description.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5">
                <Plus className="w-4 h-4" /> 
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" /> Edit Asset
              </h3>
              <button onClick={() => setEditingAsset(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Asset Type</label>
                <select value={editForm.type ?? ''} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className={inputCls}>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Property">Property</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="text-rose-500">*</span></label>
                <input type="text" value={editForm.description ?? ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <select value={editForm.status ?? 'Active'} onChange={e => setEditForm({ ...editForm, status: e.target.value as any })} className={inputCls}>
                  <option value="Active">Active</option>
                  <option value="Standby">Standby</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Expiry Date</label>
                <input type="date" value={editForm.expiry_date ?? ''} onChange={e => setEditForm({ ...editForm, expiry_date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Ownership Type</label>
                <select value={editForm.ownership_type ?? ''} onChange={e => setEditForm({ ...editForm, ownership_type: e.target.value })} className={inputCls}>
                  <option value="Company Bought">Company Bought</option>
                  <option value="Transferred from Rider">Transferred from Rider</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Moved To</label>
                <input type="text" placeholder="e.g. Ahmed Al-Farsi" value={editForm.moved_to ?? ''} onChange={e => setEditForm({ ...editForm, moved_to: e.target.value })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Remarks</label>
                <textarea rows={2} value={editForm.remarks ?? ''} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} className={inputCls} />
              </div>
            </div>

            {editMsg && (
              <p className={cn('text-sm mb-4 px-3 py-2 rounded-lg', editMsg.includes('approval') ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400')}>
                {editMsg}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setEditingAsset(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all">Cancel</button>
              <button onClick={handleSaveEdit} disabled={editSaving || !editForm.description?.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                {editMsg.includes('approval') ? 'Submitted' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}
