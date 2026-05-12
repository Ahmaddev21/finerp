import React, { useState } from 'react';
import { ShoppingBag, Search, Plus, X, Shirt, Shield, HardHat, Layers, Filter, Download, AlertTriangle, User, Package } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMerchandise, EmployeeMerchandise } from '../hooks/useMerchandise';

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all';

export default function Merchandise() {
  const { data, loading, error, updateMerchandise } = useMerchandise();
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Rider' | 'Driver'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeMerchandise | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    t_shirt_qty: 0,
    trouser_qty: 0,
    helmet_qty: 0,
    safety_gears_qty: 0,
    thermal_bag_qty: 0,
    gillets_qty: 0
  });

  const filtered = data
    .filter(d => {
      const q = searchQuery.trim().toLowerCase();
      const matchesCategory = categoryFilter === 'All' || d.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesSearch = !q || 
                           d.name.toLowerCase().includes(q) || 
                           d.emp_number.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

  const handleOpenModal = (employee: EmployeeMerchandise) => {
    setSelectedEmployee(employee);
    setForm({
      t_shirt_qty: employee.merchandise?.t_shirt_qty || 0,
      trouser_qty: employee.merchandise?.trouser_qty || 0,
      helmet_qty: employee.merchandise?.helmet_qty || 0,
      safety_gears_qty: employee.merchandise?.safety_gears_qty || 0,
      thermal_bag_qty: employee.merchandise?.thermal_bag_qty || 0,
      gillets_qty: employee.merchandise?.gillets_qty || 0
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    const success = await updateMerchandise(selectedEmployee.id, form);
    if (success) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" /> Merchandise Allocation
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage gear and equipment for Riders and Drivers.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            {(['All', 'Rider', 'Driver'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                  categoryFilter === cat 
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-md scale-105" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Name or EMP Number..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn(inputCls, "pl-12 py-3 bg-slate-50 dark:bg-slate-800/50")}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-400 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-500 font-medium">Syncing merchandise data...</p>
          </div>
        ) : filtered.map(employee => (
          <div key={employee.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
            
            <div className="flex items-start justify-between mb-6 relative">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                  employee.category === 'Rider' ? "bg-blue-50 dark:bg-blue-950 text-blue-600" : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                )}>
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">{employee.name}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{employee.emp_number}</p>
                </div>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm",
                employee.category === 'Rider' ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"
              )}>
                {employee.category}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">T-Shirts</p>
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{employee.merchandise?.t_shirt_qty || 0}</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Trousers</p>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{employee.merchandise?.trouser_qty || 0}</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Thermal Bag</p>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{employee.merchandise?.thermal_bag_qty || 0}</span>
                </div>
              </div>
              {employee.category === 'Rider' ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Helmet</p>
                  <div className="flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{employee.merchandise?.helmet_qty || 0}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gillets</p>
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{employee.merchandise?.gillets_qty || 0}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleOpenModal(employee)}
              className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              Update Inventory
            </button>
          </div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-40 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No employees found</h3>
            <p className="text-slate-500 mt-2">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>

      {/* Update Modal */}
      {isModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Allocate Gear</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Assigning items to <span className="text-blue-600 font-bold">{selectedEmployee.name}</span></p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">T-Shirt Qty</label>
                <div className="relative">
                  <Shirt className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    value={form.t_shirt_qty}
                    onChange={e => setForm({ ...form, t_shirt_qty: parseInt(e.target.value) || 0 })}
                    className={cn(inputCls, "pl-12")} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Trouser Qty</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    value={form.trouser_qty}
                    onChange={e => setForm({ ...form, trouser_qty: parseInt(e.target.value) || 0 })}
                    className={cn(inputCls, "pl-12")} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Thermal Bag</label>
                <div className="relative">
                  <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    value={form.thermal_bag_qty}
                    onChange={e => setForm({ ...form, thermal_bag_qty: parseInt(e.target.value) || 0 })}
                    className={cn(inputCls, "pl-12")} 
                  />
                </div>
              </div>

              {selectedEmployee.category === 'Rider' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Helmet Qty</label>
                    <div className="relative">
                      <HardHat className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={form.helmet_qty}
                        onChange={e => setForm({ ...form, helmet_qty: parseInt(e.target.value) || 0 })}
                        className={cn(inputCls, "pl-12")} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Safety Gears Qty</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={form.safety_gears_qty}
                        onChange={e => setForm({ ...form, safety_gears_qty: parseInt(e.target.value) || 0 })}
                        className={cn(inputCls, "pl-12")} 
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Gillets Qty</label>
                  <div className="relative">
                    <Shirt className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number" 
                      value={form.gillets_qty}
                      onChange={e => setForm({ ...form, gillets_qty: parseInt(e.target.value) || 0 })}
                      className={cn(inputCls, "pl-12")} 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
                Save Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
