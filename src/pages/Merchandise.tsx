import React, { useState, useMemo } from 'react';
import {
  ShoppingBag, Search, X, Shirt, Shield, HardHat, Layers,
  AlertTriangle, User, Package, Truck, RotateCcw, BarChart2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useMerchandise, EmployeeMerchandise, MERCH_ITEMS, ReturnItem } from '../hooks/useMerchandise';
import { useMerchandiseStock, AddStockParams } from '../hooks/useMerchandiseStock';

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all';

// ── Types ─────────────────────────────────────────────────────────────────────

type AllocationForm = {
  t_shirt_qty: string;
  trouser_qty: string;
  helmet_qty: string;
  safety_gears_qty: string;
  thermal_bag_qty: string;
  gillets_qty: string;
  em_box_qty: string;
  safety_kit_qty: string;
  chest_guard_qty: string;
  winter_jacket_qty: string;
};

type ReceiveForm = {
  provider: string;
  received_date: string;
  notes: string;
  items: Record<string, string>;
};

// ── AllocationModal ───────────────────────────────────────────────────────────

interface AllocationModalProps {
  employee: EmployeeMerchandise;
  form: AllocationForm;
  setForm: React.Dispatch<React.SetStateAction<AllocationForm>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

function AllocationModal({ employee, form, setForm, saving, onClose, onSave }: AllocationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full border border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="flex justify-between items-center px-8 pt-8 pb-6 shrink-0">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Allocate Gear</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Assigning items to <span className="text-blue-600 font-bold">{employee.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* compact grid — collapses to 2-col on phone */}
        <div className="px-4 sm:px-8 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'T-Shirt',       key: 't_shirt_qty'       as const },
              { label: 'Trouser',       key: 'trouser_qty'       as const },
              { label: 'Thermal Bag',   key: 'thermal_bag_qty'   as const },
              ...(employee.category === 'Rider'
                ? [
                    { label: 'Helmet',      key: 'helmet_qty'       as const },
                    { label: 'Safety Gear', key: 'safety_gears_qty' as const },
                  ]
                : [
                    { label: 'Gillet',      key: 'gillets_qty'      as const },
                  ]
              ),
              { label: 'EM Box',        key: 'em_box_qty'        as const },
              { label: 'Safety Kit',    key: 'safety_kit_qty'    as const },
              { label: 'Chest Guard',   key: 'chest_guard_qty'   as const },
              { label: 'Winter Jacket', key: 'winter_jacket_qty' as const },
            ].map(({ label, key }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{label}</label>
                <input
                  type="number"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  min="0"
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-8 py-6 shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose} disabled={saving} className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Allocation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReceiveStockModal ─────────────────────────────────────────────────────────

interface ReceiveStockModalProps {
  form: ReceiveForm;
  setForm: React.Dispatch<React.SetStateAction<ReceiveForm>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

function ReceiveStockModal({ form, setForm, saving, onClose, onSave }: ReceiveStockModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-4 sm:p-8 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Receive Stock</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Record merchandise received from provider</p>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Provider</label>
            <input
              type="text"
              value={form.provider}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              placeholder="e.g. SNOONU"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Received Date</label>
              <input
                type="date"
                value={form.received_date}
                onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 mb-3">Quantities Received</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MERCH_ITEMS.map(item => (
              <div key={item.type} className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 px-1">{item.label}</label>
                <input
                  type="number"
                  value={form.items[item.type] ?? ''}
                  onChange={e => setForm(f => ({ ...f, items: { ...f.items, [item.type]: e.target.value } }))}
                  placeholder="0"
                  min="0"
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
            {saving ? 'Saving...' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReturnItemsModal ──────────────────────────────────────────────────────────

interface ReturnItemsModalProps {
  employee: EmployeeMerchandise;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

function ReturnItemsModal({ employee, form, setForm, notes, setNotes, saving, onClose, onSave }: ReturnItemsModalProps) {
  const m = employee.merchandise;
  const hasItems = m && MERCH_ITEMS.some(item => ((m as unknown as Record<string, number>)[item.field] ?? 0) > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-4 sm:p-8 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Record Return</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Items returned by <span className="text-amber-600 font-bold">{employee.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {!hasItems ? (
          <div className="py-12 text-center">
            <Package className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No items currently assigned to this employee.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {MERCH_ITEMS.map(item => {
              const currentQty = (m as unknown as Record<string, number>)[item.field] ?? 0;
              if (currentQty === 0) return null;
              return (
                <div key={item.type} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Assigned: <span className="font-bold text-slate-600 dark:text-slate-300">{currentQty}</span>
                    </p>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={form[item.type] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [item.type]: e.target.value }))}
                      placeholder="0"
                      min="0"
                      max={currentQty}
                      className={cn(inputCls, "text-center px-2")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasItems && (
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Remark (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. items returned in good condition"
              rows={2}
              className={cn(inputCls, "resize-none")}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving || !hasItems} className="flex-1 py-4 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50">
            {saving ? 'Saving...' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_ALLOC_FORM: AllocationForm = {
  t_shirt_qty: '', trouser_qty: '', helmet_qty: '',
  safety_gears_qty: '', thermal_bag_qty: '', gillets_qty: '',
  em_box_qty: '', safety_kit_qty: '', chest_guard_qty: '', winter_jacket_qty: '',
};

const makeReceiveForm = (): ReceiveForm => ({
  provider: 'SNOONU',
  received_date: new Date().toISOString().split('T')[0],
  notes: '',
  items: {},
});

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Merchandise() {
  const {
    data, loading: allocLoading, error: allocError,
    updateMerchandise, recordReturn,
  } = useMerchandise();

  const {
    stockBatches, returnHistory, loading: stockLoading, error: stockError,
    addStockBatch,
  } = useMerchandiseStock();

  const [activeTab, setActiveTab] = useState<'overview' | 'allocations' | 'returns'>('allocations');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Rider' | 'Driver'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Allocation modal state
  const [allocEmployee, setAllocEmployee] = useState<EmployeeMerchandise | null>(null);
  const [allocForm, setAllocForm] = useState<AllocationForm>(EMPTY_ALLOC_FORM);

  // Receive stock modal state
  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(makeReceiveForm());

  // Return items modal state
  const [returnEmployee, setReturnEmployee] = useState<EmployeeMerchandise | null>(null);
  const [returnForm, setReturnForm] = useState<Record<string, string>>({});
  const [returnNotes, setReturnNotes] = useState('');

  // ── Derived state ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => data.filter(d => {
    const q = searchQuery.trim().toLowerCase();
    const matchCat = categoryFilter === 'All' || d.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.emp_number.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [data, categoryFilter, searchQuery]);

  const stockSummary = useMemo(() => MERCH_ITEMS.map(item => {
    const received = stockBatches
      .filter(b => b.item_type === item.type)
      .reduce((s, b) => s + b.received_qty, 0);
    const assigned = data
      .filter(d => d.merchandise)
      .reduce((s, d) => s + (((d.merchandise as unknown) as Record<string, number>)[item.field] ?? 0), 0);
    return { ...item, received, assigned, available: Math.max(0, received - assigned) };
  }), [stockBatches, data]);

  const loading = allocLoading || stockLoading;
  const error = allocError || stockError;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openAllocModal = (emp: EmployeeMerchandise) => {
    const m = emp.merchandise;
    setAllocForm({
      t_shirt_qty:       m?.t_shirt_qty       ? String(m.t_shirt_qty)       : '',
      trouser_qty:       m?.trouser_qty       ? String(m.trouser_qty)       : '',
      helmet_qty:        m?.helmet_qty        ? String(m.helmet_qty)        : '',
      safety_gears_qty:  m?.safety_gears_qty  ? String(m.safety_gears_qty)  : '',
      thermal_bag_qty:   m?.thermal_bag_qty   ? String(m.thermal_bag_qty)   : '',
      gillets_qty:       m?.gillets_qty       ? String(m.gillets_qty)       : '',
      em_box_qty:        m?.em_box_qty        ? String(m.em_box_qty)        : '',
      safety_kit_qty:    m?.safety_kit_qty    ? String(m.safety_kit_qty)    : '',
      chest_guard_qty:   m?.chest_guard_qty   ? String(m.chest_guard_qty)   : '',
      winter_jacket_qty: m?.winter_jacket_qty ? String(m.winter_jacket_qty) : '',
    });
    setAllocEmployee(emp);
  };

  const handleSaveAlloc = async () => {
    if (!allocEmployee) return;
    setSaving(true);
    const ok = await updateMerchandise(allocEmployee.id, {
      t_shirt_qty:       parseInt(allocForm.t_shirt_qty)       || 0,
      trouser_qty:       parseInt(allocForm.trouser_qty)       || 0,
      helmet_qty:        parseInt(allocForm.helmet_qty)        || 0,
      safety_gears_qty:  parseInt(allocForm.safety_gears_qty)  || 0,
      thermal_bag_qty:   parseInt(allocForm.thermal_bag_qty)   || 0,
      gillets_qty:       parseInt(allocForm.gillets_qty)       || 0,
      em_box_qty:        parseInt(allocForm.em_box_qty)        || 0,
      safety_kit_qty:    parseInt(allocForm.safety_kit_qty)    || 0,
      chest_guard_qty:   parseInt(allocForm.chest_guard_qty)   || 0,
      winter_jacket_qty: parseInt(allocForm.winter_jacket_qty) || 0,
    });
    setSaving(false);
    if (ok) setAllocEmployee(null);
  };

  const openReceiveModal = () => {
    setReceiveForm(makeReceiveForm());
    setShowReceive(true);
  };

  const handleSaveReceive = async () => {
    const params: AddStockParams = {
      provider:      receiveForm.provider,
      received_date: receiveForm.received_date,
      notes:         receiveForm.notes,
      items: MERCH_ITEMS.flatMap(item => {
        const qty = parseInt(receiveForm.items[item.type] ?? '') || 0;
        return qty > 0 ? [{ item_type: item.type, item_name: item.label, qty }] : [];
      }),
    };
    setSaving(true);
    const ok = await addStockBatch(params);
    setSaving(false);
    if (ok) setShowReceive(false);
  };

  const openReturnModal = (emp: EmployeeMerchandise) => {
    setReturnForm({});
    setReturnNotes('');
    setReturnEmployee(emp);
  };

  const handleSaveReturn = async () => {
    if (!returnEmployee) return;
    const returns: ReturnItem[] = MERCH_ITEMS.flatMap(item => {
      const qty = parseInt(returnForm[item.type] ?? '') || 0;
      return qty > 0 ? [{ item_type: item.type, item_name: item.label, qty }] : [];
    });
    if (!returns.length) return;
    setSaving(true);
    const ok = await recordReturn(returnEmployee.id, returnEmployee.name, returns, returnNotes);
    setSaving(false);
    if (ok) setReturnEmployee(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" /> Merchandise
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Track stock levels, allocations, and returns.
            </p>
          </div>
          {activeTab === 'overview' && (
            <button
              onClick={openReceiveModal}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Truck className="w-4 h-4" />
              Receive Stock
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 self-start flex-wrap gap-1">
          {([
            { id: 'overview',    label: 'Stock Overview',       Icon: BarChart2  },
            { id: 'allocations', label: 'Employee Allocations',  Icon: User       },
            { id: 'returns',     label: 'Return History',        Icon: RotateCcw  },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-md scale-105"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category + search (allocations tab only) */}
        {activeTab === 'allocations' && (
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
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* ── Tab: Stock Overview ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Received</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {stockSummary.reduce((s, i) => s + i.received, 0)}
              </p>
              <p className="text-xs text-slate-400 mt-1">items across all types</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Assigned</p>
              <p className="text-3xl font-black text-blue-600">
                {stockSummary.reduce((s, i) => s + i.assigned, 0)}
              </p>
              <p className="text-xs text-slate-400 mt-1">currently with employees</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Available Stock</p>
              <p className="text-3xl font-black text-emerald-600">
                {stockSummary.reduce((s, i) => s + i.available, 0)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ready to allocate</p>
            </div>
          </div>

          {/* Item breakdown table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Item Breakdown</h2>
            </div>
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-slate-400 text-sm font-medium">Loading stock data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left px-6 py-4">Item</th>
                      <th className="text-right px-6 py-4">Received</th>
                      <th className="text-right px-6 py-4">Assigned</th>
                      <th className="text-right px-6 py-4">Available</th>
                      <th className="text-right px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {stockSummary.map(item => (
                      <tr key={item.type} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.label}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600 dark:text-slate-300">{item.received}</td>
                        <td className="px-6 py-4 text-right font-bold text-blue-600">{item.assigned}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">{item.available}</td>
                        <td className="px-6 py-4 text-right">
                          {item.received === 0 ? (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400">No Stock</span>
                          ) : item.available === 0 ? (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-600">Out of Stock</span>
                          ) : item.available <= 5 ? (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-600">Low Stock</span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-600">In Stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent receipts */}
          {stockBatches.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Receipts</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left px-6 py-4">Item</th>
                      <th className="text-left px-6 py-4">Provider</th>
                      <th className="text-right px-6 py-4">Qty</th>
                      <th className="text-left px-6 py-4">Date</th>
                      <th className="text-left px-6 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {stockBatches.slice(0, 10).map(b => (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{b.item_name}</td>
                        <td className="px-6 py-4 text-slate-500">{b.provider}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">+{b.received_qty}</td>
                        <td className="px-6 py-4 text-slate-500">{b.received_date}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{b.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Employee Allocations ────────────────────────────────────────── */}
      {activeTab === 'allocations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-500 font-medium">Syncing merchandise data...</p>
            </div>
          ) : filtered.map(employee => (
            <div key={employee.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />

              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                    employee.category === 'Rider'
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-600"
                      : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
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

              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { label: 'T-Shirt',       icon: <Shirt className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.t_shirt_qty },
                  { label: 'Trouser',       icon: <Layers className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.trouser_qty },
                  { label: 'Thermal Bag',   icon: <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.thermal_bag_qty },
                  employee.category === 'Rider'
                    ? { label: 'Helmet',    icon: <HardHat className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.helmet_qty }
                    : { label: 'Gillet',    icon: <Shirt className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.gillets_qty },
                  { label: 'EM Box',        icon: <Package className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.em_box_qty },
                  { label: 'Safety Kit',    icon: <Shield className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.safety_kit_qty },
                  { label: 'Chest Guard',   icon: <Shield className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.chest_guard_qty },
                  { label: 'Winter Jacket', icon: <Shirt className="w-3.5 h-3.5 text-slate-400" />, qty: employee.merchandise?.winter_jacket_qty },
                ].map(({ label, icon, qty }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{label}</p>
                    <div className="flex items-center gap-1.5">
                      {icon}
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{qty || 0}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openAllocModal(employee)}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  Update
                </button>
                <button
                  onClick={() => openReturnModal(employee)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-sm font-bold hover:bg-amber-200 dark:hover:bg-amber-900 active:scale-95 transition-all"
                >
                  Return
                </button>
              </div>
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
      )}

      {/* ── Tab: Return History ──────────────────────────────────────────────── */}
      {activeTab === 'returns' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Return History</h2>
            <p className="text-sm text-slate-400 mt-1">{returnHistory.length} return record{returnHistory.length !== 1 ? 's' : ''}</p>
          </div>
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-400 text-sm font-medium">Loading return history...</p>
            </div>
          ) : returnHistory.length === 0 ? (
            <div className="py-40 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <RotateCcw className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No returns recorded</h3>
              <p className="text-slate-500 mt-2">Employee returns will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-6 py-4">Employee</th>
                    <th className="text-left px-6 py-4">Item</th>
                    <th className="text-right px-6 py-4">Qty Returned</th>
                    <th className="text-left px-6 py-4">Date</th>
                    <th className="text-left px-6 py-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {returnHistory.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{r.employee_name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{r.item_name}</td>
                      <td className="px-6 py-4 text-right font-black text-amber-600">{r.returned_qty}</td>
                      <td className="px-6 py-4 text-slate-500">{r.return_date}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {allocEmployee && (
        <AllocationModal
          employee={allocEmployee}
          form={allocForm}
          setForm={setAllocForm}
          saving={saving}
          onClose={() => setAllocEmployee(null)}
          onSave={handleSaveAlloc}
        />
      )}
      {showReceive && (
        <ReceiveStockModal
          form={receiveForm}
          setForm={setReceiveForm}
          saving={saving}
          onClose={() => setShowReceive(false)}
          onSave={handleSaveReceive}
        />
      )}
      {returnEmployee && (
        <ReturnItemsModal
          employee={returnEmployee}
          form={returnForm}
          setForm={setReturnForm}
          notes={returnNotes}
          setNotes={setReturnNotes}
          saving={saving}
          onClose={() => setReturnEmployee(null)}
          onSave={handleSaveReturn}
        />
      )}
    </div>
  );
}
