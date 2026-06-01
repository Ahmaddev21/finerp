import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useThemeStore } from './store/theme';
import { useAuthStore } from './store/auth';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { getMe } from './services/auth';
import Layout from './components/Layout';
import AuthPage from './components/AuthPage';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import ERP from './pages/ERP';
import AuditLogs from './pages/AuditLogs';
import Assets from './pages/Assets';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Tasks from './pages/Tasks';
import Contracting from './pages/Contracting';
import Delivery from './pages/Delivery';
import TeamSettings from './components/TeamSettings'; 
import DailyVisitors from './pages/DailyVisitors';
import Consultation from './pages/Consultation';
import Merchandise from './pages/Merchandise';
import TimeKeeping from './pages/TimeKeeping';
import FinanceWorkflow from './pages/FinanceWorkflow';
import BankDetails from './pages/BankDetails';

/* ── Role-based route guard ──────────────────────────── */
function roleDefaultPath(role: string | null) {
  if (role === 'receptionist') return '/visitors';
  if (role === 'developer')    return '/tasks';
  if (role === 'intern')       return '/tasks';
  if (role === 'engineer')     return '/erp/contracting';
  if (role === 'bdm')          return '/erp/contracting';
  return '/'; // owner and admin go to dashboard
}

function RoleGuard({ allowed }: { allowed: string[] }) {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  if (!allowed.includes(role)) {
    return <Navigate to={roleDefaultPath(role)} replace />;
  }
  return <Outlet />;
}

function DemoLogin() {
  const { loginAs } = useAuthStore();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl opacity-30 bg-indigo-600 rounded-full scale-150" />
        <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl shadow-2xl w-96 text-center">
          <div className="mb-2">
            <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-xs font-bold mb-4">DEMO MODE</span>
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">FinERP</h1>
            <p className="text-slate-300 text-sm">Financial & Operations Platform</p>
            <p className="text-slate-500 text-xs mt-2">Supabase not configured — running offline</p>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <button
              onClick={() => loginAs('owner')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Login as Owner
            </button>
            <button
              onClick={() => loginAs('admin')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as Admin
            </button>
            <button
              onClick={() => loginAs('bdm')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as BDM
            </button>
            <button
              onClick={() => loginAs('engineer')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as Engineer
            </button>
            <button
              onClick={() => loginAs('receptionist')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as Receptionist
            </button>
            <button
              onClick={() => loginAs('developer')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as Tech Developer
            </button>
            <button
              onClick={() => loginAs('intern')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2.5 rounded-xl font-bold transition-all hover:-translate-y-0.5"
            >
              Login as Intern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isDark } = useThemeStore();
  const { user, isLoading, isInitialized, setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Restore session on mount and react to auth state changes (live mode only)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const hydrateFromSession = async () => {
      try {
        const me = await getMe();
        if (me) {
          // Guard: if the signup flow already set valid auth state while this
          // async call was in flight, don't overwrite it with potentially stale
          // data (company_users row may not have been written yet at read time).
          if (useAuthStore.getState().user) return;
          setAuth(
            {
              id: me.user.id,
              email: me.user.email ?? '',
              role: me.role as any,
              name: me.profile.username,
            },
            me.profile,
            me.company ?? null
          );
        } else {
          setInitialized();
        }
      } catch {
        setInitialized();
      }
    };

    // Initial load
    hydrateFromSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setAuth(null, null, null);
      } else if (event === 'SIGNED_IN') {
        // Re-hydrate when a session is established in another tab or after token
        // confirmation — only if we don't already have user state from the
        // initial hydrateFromSession() call above
        const { user } = useAuthStore.getState();
        if (!user) {
          await hydrateFromSession();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setAuth, setInitialized]);

  // Loading state (only in live mode)
  if (isSupabaseConfigured && (isLoading || !isInitialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Initializing FinERP…</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return isSupabaseConfigured ? <AuthPage /> : <DemoLogin />;
  }

  // Authenticated but role not resolved yet (transient race during signup —
  // company_users row may not be readable until the RPC completes)
  if (isSupabaseConfigured && !user.role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Setting up your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Layout />}>
          {/* Dashboard — owner and admin only */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route index element={<Dashboard />} />
          </Route>

          {/* Projects & Accounting — owner, admin only */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="accounting" element={<Accounting />} />
          </Route>

          {/* ERP — role-guarded per sub-route */}
          <Route path="erp">
            <Route index element={<ERP />} />
            <Route element={<RoleGuard allowed={['owner','admin','bdm','engineer']} />}>
              <Route path="contracting" element={<Contracting />} />
            </Route>
            <Route element={<RoleGuard allowed={['owner','admin','bdm']} />}>
              <Route path="consultation" element={<Consultation />} />
            </Route>
            <Route element={<RoleGuard allowed={['owner','admin']} />}>
              <Route path="delivery" element={<Delivery />} />
              <Route path="merchandise" element={<Merchandise />} />
            </Route>
          </Route>

          {/* Tasks — all roles */}
          <Route path="tasks" element={<Tasks />} />

          {/* Assets — owner, admin */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="assets" element={<Assets />} />
          </Route>

          {/* Time Keeping — owner, admin only */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="time-keeping" element={<TimeKeeping />} />
          </Route>

          {/* Finance Workflow — owner, admin only */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="finance-workflow" element={<FinanceWorkflow />} />
          </Route>

          {/* Daily Visitors — owner, admin, receptionist */}
          <Route element={<RoleGuard allowed={['owner','admin','receptionist']} />}>
            <Route path="visitors" element={<DailyVisitors />} />
          </Route>

          {/* Bank Details — owner, admin only */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="bank-details" element={<BankDetails />} />
          </Route>

          {/* Audit Logs — owner, admin */}
          <Route element={<RoleGuard allowed={['owner','admin']} />}>
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>

          {/* Workspace Settings — owner only */}
          <Route element={<RoleGuard allowed={['owner']} />}>
            <Route path="settings" element={<TeamSettings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
