import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import {
  LayoutDashboard, Briefcase, Calculator, Layers,
  CheckSquare, ShieldAlert, LogOut, ChevronDown,
  Menu, X, Sun, Moon, FileText, Truck, Users, Settings, Loader2, Car, UserPlus, Package, Clock, FolderOpen, Lock, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import { canAccess } from '../lib/permissions';
import NotificationBell from './NotificationBell';
import { useNotifications } from '../hooks/useNotifications';
import { useTransactions } from '../hooks/useTransactions';
import { useTasks } from '../hooks/useTasks';
import { useContracts } from '../hooks/useContracts';
import { isSupabaseConfigured } from '../lib/supabase';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { canAccessAccounting, canAccessDashboard, roleLabel } from '../lib/roles';

/* ── Clock ──────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
function pad(n: number) { return String(n).padStart(2, '0'); }

/* ── Dark Mode Toggle — Classic style ──────────────── */
function DarkToggle() {
  const { isDark, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
    >
      {isDark
        ? <><Sun className="w-3.5 h-3.5" /><span className="hidden sm:inline">Light</span></>
        : <><Moon className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dark</span></>}
    </button>
  );
}

/* ── Role colors — muted ───────────────────────────── */
const roleColors: Record<string, string> = {
  owner:        'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  admin:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  bdm:          'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
  engineer:     'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  receptionist: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  developer:    'bg-slate-800 text-slate-100 dark:bg-slate-700 dark:text-slate-200',
  intern:       'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

/* ── Nav config ─────────────────────────────────────── */
const navItems = [
  { name: 'Dashboard',  path: '/',           icon: LayoutDashboard, exact: true, roles: ['owner', 'admin'] },
  { name: 'Projects',   path: '/projects',   icon: Briefcase,   module: 'projects',   roles: ['owner', 'admin'] },
  { name: 'Accounting', path: '/accounting', icon: Calculator,  module: 'accounting', roles: ['owner', 'admin'] },
  {
    name: 'ERP',
    icon: Layers,
    module: 'erp',
    roles: ['owner', 'admin', 'bdm', 'engineer'],
    subItems: [
      { name: 'Contracting',  path: '/erp/contracting',  icon: FileText, module: 'contracting',  roles: ['owner', 'admin', 'bdm', 'engineer'] },
      { name: 'Consultation', path: '/erp/consultation', icon: Users,    module: 'consultation', roles: ['owner', 'admin', 'bdm'] },
      { name: 'Delivery',     path: '/erp/delivery',     icon: Truck,    module: 'delivery',     roles: ['owner', 'admin'] },
      { name: 'Merchandise',  path: '/erp/merchandise',  icon: Package,  module: 'merchandise',  roles: ['owner', 'admin'] },
    ],
  },
  { name: 'Tasks',            path: '/tasks',            icon: CheckSquare, roles: ['owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'] },
  { name: 'Assets',           path: '/assets',           icon: Car,        module: 'assets',           roles: ['owner', 'admin'] },
  { name: 'Time Keeping',     path: '/time-keeping',     icon: Clock,      module: 'time-keeping',     roles: ['owner', 'admin'] },
  { name: 'Finance Workflow', path: '/finance-workflow', icon: FolderOpen, module: 'finance-workflow', roles: ['owner', 'admin'] },
  { name: 'Daily Visitors',   path: '/visitors',         icon: UserPlus,   module: 'visitors',         roles: ['owner', 'admin', 'receptionist'] },
  { name: 'Bank Details',     path: '/bank-details',     icon: Lock,       module: 'bank-details',     roles: ['owner', 'admin'] },
  { name: 'Audit Logs',       path: '/audit-logs',       icon: ShieldAlert,module: 'audit-logs',       roles: ['owner', 'admin'] },
  { name: 'Permissions',      path: '/permissions',      icon: ShieldAlert,roles: ['owner', 'admin'] },
  { name: 'Workspace Settings', path: '/settings',       icon: Settings,   roles: ['owner'] },
];

/* ── Sidebar Nav Item ───────────────────────────────── */
function NavItem({ item, user, erpOpen, onErpToggle, onClose, badge }: {
  item: typeof navItems[0];
  user: { role: string | null };
  erpOpen: boolean;
  onErpToggle: () => void;
  onClose: () => void;
  badge?: number;
}) {
  const location = useLocation();
  const { company } = useAuthStore();
  const role = user.role;
  const stored = company?.module_permissions;

  const hasAccess = (mod?: string, roles?: string[]) =>
    mod ? canAccess(mod, role, stored) : !!(role && roles?.includes(role));

  if (!hasAccess((item as any).module, item.roles)) return null;

  if ('subItems' in item && item.subItems) {
    const allowed = item.subItems.filter(s => hasAccess((s as any).module, s.roles));
    const isSubActive = allowed.some(s => location.pathname.startsWith(s.path));

    return (
      <div>
        {/* Group header */}
        <button
          onClick={onErpToggle}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors',
            isSubActive
              ? 'text-blue-700 dark:text-blue-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          )}
        >
          <div className="flex items-center gap-2.5">
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.name}</span>
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150 text-slate-400', erpOpen && 'rotate-180')} />
        </button>

        {erpOpen && (
          <div className="ml-4 pl-2.5 border-l-2 border-slate-200 dark:border-slate-700 mt-0.5 space-y-px">
            {allowed.map(sub => {
              const active = location.pathname === sub.path;
              return (
                <Link
                  key={sub.path}
                  to={sub.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium rounded transition-colors',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  <sub.icon className="w-3.5 h-3.5 shrink-0" />
                  {sub.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const isActive = item.exact
    ? location.pathname === item.path
    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  return (
    <Link
      to={item.path!}
      onClick={onClose}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded transition-colors',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.name}</span>
      {badge && badge > 0 ? (
        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-lg shadow-amber-500/20">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/* ── Sidebar ─────────────────────────────────────────── */
function SidebarContent({ onClose, accountingBadge }: { onClose: () => void; accountingBadge?: number }) {
  const { user, profile, loginAs, logout, setAuth, company } = useAuthStore();
  const [erpOpen, setErpOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const navigate = useNavigate();

  // Resolve storage: paths → signed URLs whenever the profile avatar changes
  useEffect(() => {
    const val = profile?.avatar_url;
    if (!val) { setResolvedAvatarUrl(null); return; }
    import('../services/auth').then(({ resolveAvatarUrl }) => {
      resolveAvatarUrl(val).then(url => setResolvedAvatarUrl(url));
    });
  }, [profile?.avatar_url]);

  if (!user) return null;

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    setProfileMsg('');
    try {
      const { updateProfile, uploadAvatar } = await import('../services/auth');
      let avatarUrl = profile?.avatar_url || undefined;

      if (avatarFile) {
        try {
          avatarUrl = await uploadAvatar(user.id, avatarFile);
        } catch (uploadErr: any) {
          console.warn('Avatar upload failed (storage may not be configured):', uploadErr.message);
          // Continue without avatar — don't block name save
        }
      }

      const updates: { username?: string; avatar_url?: string } = {};
      if (profileName.trim() && profileName.trim() !== user.name) {
        updates.username = profileName.trim();
      }
      if (avatarUrl && avatarUrl !== profile?.avatar_url) {
        updates.avatar_url = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        const updated = await updateProfile(user.id, updates);
        setAuth(
          { ...user, name: updated.username || user.name },
          { ...profile!, username: updated.username || profile!.username, avatar_url: updated.avatar_url || profile?.avatar_url },
          company ?? null
        );
        setProfileMsg('Profile updated!');
      } else {
        setProfileMsg('No changes to save.');
      }
      setAvatarFile(null);
      setTimeout(() => setProfileMsg(''), 2000);
    } catch (err: any) {
      setProfileMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo-transparent.png"
            alt="Rafi Al Aftab"
            className="h-11 w-auto object-contain shrink-0 dark:brightness-0 dark:invert"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
              Fin<span className="text-blue-600 dark:text-blue-400">ERP</span>
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate">Rafi Al Aftab</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
          Navigation
        </p>
        <div className="space-y-px">
          {navItems.map(item => (
            <React.Fragment key={item.name}>
              <NavItem
                item={item as any}
                user={user}
                erpOpen={erpOpen}
                onErpToggle={() => setErpOpen(o => !o)}
                onClose={onClose}
                badge={item.name === 'Accounting' ? accountingBadge : undefined}
              />
            </React.Fragment>
          ))}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-4 shrink-0 border-t border-slate-200 dark:border-slate-800 pt-3">

        {/* User info — clickable to open profile edit */}
        <button
          onClick={() => { setProfileOpen(true); setProfileName(user.name || ''); setAvatarPreview(resolvedAvatarUrl); }}
          className="w-full text-left px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {user?.name || user?.email || 'User'}
              </p>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block mt-0.5', roleColors[user.role || 'intern'])}>
                {roleLabel(user.role)}
              </span>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" />
          </div>
        </button>

        {/* Role Switcher — demo mode only */}
        {!isSupabaseConfigured && (
          <div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1.5">
              Switch Role (Demo)
            </p>
            <div className="grid grid-cols-2 gap-1">
              {(['owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => loginAs(role)}
                  className={cn(
                    'text-[10px] font-bold py-1.5 rounded border text-center transition-colors',
                    user.role === role
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                  )}
                >
                  {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : role === 'bdm' ? 'BDM' : role === 'engineer' ? 'Engineer' : role === 'receptionist' ? 'Recept.' : role === 'developer' ? 'Dev' : 'Intern'}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* ── Profile Edit Modal ── */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setProfileOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Edit Profile
              </h3>
              <button onClick={() => setProfileOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-200 dark:ring-slate-700" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-slate-200 dark:ring-slate-700">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-xs font-bold">Change</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-xs text-slate-400">Click photo to change</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Role</label>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold px-2 py-1 rounded', roleColors[user.role || 'intern'])}>
                    {roleLabel(user.role)}
                  </span>
                  <span className="text-xs text-slate-400">Assigned by admin</span>
                </div>
              </div>

              {/* Status message */}
              {profileMsg && (
                <p className={cn('text-sm font-semibold text-center py-1.5 rounded-lg', profileMsg.includes('Failed') ? 'text-red-600 bg-red-50 dark:bg-red-950/30' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30')}>
                  {profileMsg}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-2">
              <button
                onClick={() => setProfileOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Main Layout ─────────────────────────────────────── */
export default function Layout() {
  const { user, isInitialized, isLoading } = useAuthStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('finerp-sidebar') === 'collapsed'
  );
  const [notifKey, setNotifKey] = useState(0);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('finerp-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  };
  const now = useClock();
  usePresenceHeartbeat(!!user);

  // Notification data
  const { transactions } = useTransactions();
  const { tasks } = useTasks();
  const { contracts } = useContracts();
  const { pendingCount: pendingChangeRequests } = useChangeRequests();
  const notifications = useNotifications(
    transactions, tasks, contracts,
    user?.role ?? 'intern',
    user?.name,
    pendingChangeRequests
  );

  const pendingTransactions = (transactions || []).filter(t => t?.status === 'pending').length;
  const safeCR = Number(pendingChangeRequests) || 0;
  const accountingAlerts = (user?.role === 'admin' || user?.role === 'owner') 
    ? (pendingTransactions + safeCR)
    : 0;

  // Must be before any early returns — Rules of Hooks require stable call order every render.
  // Closing the mobile sidebar on route change is idempotent so it's safe to run even during loading.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const getTitle = () => {
    const seg = location.pathname.split('/').filter(Boolean);
    if (seg.length === 0) return 'Dashboard';
    const last = seg[seg.length - 1];
    if (/^PRJ-/.test(last)) return 'Project Details';
    return last.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  const rawH = now.getHours();
  const h = String(rawH % 12 || 12);
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const ampm = rawH >= 12 ? 'PM' : 'AM';
  const dayStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (location.pathname === '/' && user.role && !canAccessDashboard(user.role)) {
    return <Navigate to="/erp/contracting" replace />;
  }

  if (location.pathname.startsWith('/accounting') && user.role && !canAccessAccounting(user.role)) {
    return <Navigate to="/erp/contracting" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex">

      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden md:flex bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-slate-800 flex-col fixed inset-y-0 z-30 transition-all duration-200 overflow-hidden',
        sidebarCollapsed ? 'w-0' : 'w-56'
      )}>
        <SidebarContent onClose={() => {}} accountingBadge={accountingAlerts} />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-40 transform transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent onClose={() => setMobileOpen(false)} accountingBadge={accountingAlerts} />
      </aside>

      {/* Main Content */}
      <main className={cn(
        'flex-1 flex flex-col min-w-0 transition-all duration-200',
        sidebarCollapsed ? 'md:pl-0' : 'md:pl-56'
      )}>

        {/* Header — Classic toolbar style */}
        <header className="sticky top-0 z-20 h-12 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 sm:px-6 gap-4">

          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="hidden md:flex p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Page title — classic breadcrumb style */}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{getTitle()}</h2>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-xl border border-blue-200/60 dark:border-violet-400/20 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-slate-800 dark:to-slate-800 backdrop-blur-sm">
              <span className="font-mono text-base font-black tabular-nums tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 dark:from-white dark:to-blue-100 bg-clip-text text-transparent">
                {h}:{m}:{s}
              </span>
              <span className="text-xs font-black text-violet-500 dark:text-violet-300 leading-none">{ampm}</span>
              <span className="text-xs text-slate-400 dark:text-slate-400 hidden lg:inline border-l border-blue-200 dark:border-slate-600 pl-2.5">{dayStr}</span>
            </div>

            {/* Dark Mode Toggle */}
            <DarkToggle />

            {/* Notification Bell */}
            <NotificationBell
              key={notifKey}
              notifications={notifications}
              onDismiss={() => setNotifKey(k => k + 1)}
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto relative">
          <ErrorBoundary>
            <React.Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            }>
              <Outlet />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
