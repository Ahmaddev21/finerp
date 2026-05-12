import React from 'react';
import { FileText, Truck, Users, Loader2, Building2, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { useContracts } from '../hooks/useContracts';
import { useDeliveries } from '../hooks/useDeliveries';
import { useEngagements } from '../hooks/useEngagements';
import { useQuotations } from '../hooks/useQuotations';
import { useMerchandise } from '../hooks/useMerchandise';

export default function ERP() {
  const { contracts, loading: cLoad } = useContracts();
  const { deliveries, loading: dLoad } = useDeliveries();
  const { engagements, loading: eLoad } = useEngagements();
  const { quotations, loading: qLoad } = useQuotations();
  const { data: merchandiseData, loading: mLoad } = useMerchandise();

  // Live computed stats
  const activeContracts = contracts.filter(c => c.status === 'Active').length;
  const pendingSigs = contracts.filter(c => c.status === 'Pending Signature').length;
  const expiringSoon = contracts.filter(c => c.status === 'Expiring Soon').length;

  const pendingQuotations = quotations.filter(q => q.status === 'pending').length;
  const totalQuotValue = quotations.reduce((s, q) => s + q.amount, 0);

  const activeRiders = deliveries.filter(d => d.category === 'Rider' && d.status === 'Active').length;
  const activeDrivers = deliveries.filter(d => d.category === 'Driver' && d.status === 'Active').length;
  const inactiveFleet = deliveries.filter(d => d.status === 'Inactive').length;

  const activeEngagements = engagements.filter(e => e.status === 'Active').length;
  const totalHoursMTD = engagements.reduce((s, e) => s + e.hoursBilled, 0);
  const mtdBilledValue = engagements.reduce((s, e) => s + (e.hoursBilled * e.hourlyRate), 0);

  const totalItemsAllocated = merchandiseData.reduce((s, e) => {
    const m = e.merchandise;
    if (!m) return s;
    return s + m.t_shirt_qty + m.trouser_qty + m.helmet_qty + m.safety_gears_qty + m.thermal_bag_qty + m.gillets_qty;
  }, 0);
  const personnelWithGear = merchandiseData.filter(e => e.merchandise).length;

  const isLoading = cLoad || dLoad || eLoad || qLoad || mLoad;

  function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
        {isLoading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
          : <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', color)}>{value}</span>
        }
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ERP Modules</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select a module to manage operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
        {/* Contracting */}
        <Link
          to="/erp/contracting"
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-6 card-hover group block"
        >
          <div className="flex justify-between items-start mb-5">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Pipeline</p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">{formatCurrency(totalQuotValue)}</p>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Contracting</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Manage client contracts and agreements.</p>
          <div className="space-y-2.5">
            <Stat label="Active Contracts" value={activeContracts} color="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" />
            <Stat label="Pending Quotes" value={pendingQuotations} color="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" />
            <Stat label="Pending Signatures" value={pendingSigs} color="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" />
            <Stat label="Expiring Soon" value={expiringSoon} color="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300" />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500">View Contracts →</span>
          </div>
        </Link>

        {/* Delivery */}
        <Link
          to="/erp/delivery"
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-6 card-hover group block"
        >
          <div className="flex justify-between items-start mb-5">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Fleet</p>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400">{activeRiders + activeDrivers} Personnel</p>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Fleet Management</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Manage riders, drivers and vehicle data.</p>
          <div className="space-y-2.5">
            <Stat label="Active Riders" value={activeRiders} color="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" />
            <Stat label="Active Drivers" value={activeDrivers} color="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" />
            <Stat label="Inactive / On Hold" value={inactiveFleet} color="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300" />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-indigo-500">Manage Fleet →</span>
          </div>
        </Link>

        {/* Consultation */}
        <Link
          to="/erp/consultation"
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 rounded-2xl p-6 card-hover group block"
        >
          <div className="flex justify-between items-start mb-5">
            <div className="p-3 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MTD Billed</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(mtdBilledValue)}</p>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Consultation</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Advisory and consulting services.</p>
          <div className="space-y-2.5">
            <Stat label="Active Engagements" value={activeEngagements} color="bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300" />
            <Stat label="Hours Billed" value={`${totalHoursMTD}h`} color="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" />
            <Stat label="Consultants" value={new Set(engagements.map(e => e.consultant)).size} color="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 group-hover:text-violet-500">View Consultations →</span>
          </div>
        </Link>

        {/* Merchandise */}
        <Link
          to="/erp/merchandise"
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl p-6 card-hover group block"
        >
          <div className="flex justify-between items-start mb-5">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Allocated</p>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400">{totalItemsAllocated} Items</p>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Merchandise</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Manage gear allocation for fleet personnel.</p>
          <div className="space-y-2.5">
            <Stat label="Personnel with Gear" value={personnelWithGear} color="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" />
            <Stat label="Total Fleet" value={deliveries.length} color="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-500">Manage Merchandise →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
