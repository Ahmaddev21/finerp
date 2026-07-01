import { create } from 'zustand';
import { isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, Company, UserRole } from '../services/auth';

export type Role = 'owner' | 'admin' | 'bdm' | 'engineer' | 'receptionist' | 'developer' | 'intern';

interface User {
  id: string;
  email: string;
  role: Role | null;
  name: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setAuth: (user: User | null, profile: UserProfile | null, company: Company | null) => void;
  setCompany: (company: Company) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
  loginAs: (role: Role) => void;
  logout: () => void;
}

// ── Auth cache (localStorage) ──────────────────────────────────────────────
// We persist user/profile/company so the app renders instantly on refresh.
// Background re-validation in App.tsx then confirms the session is still valid.

const CACHE_KEY = 'finerp-auth-v1';

interface AuthCache {
  user: User;
  profile: UserProfile;
  company: Company | null;
}

function readCache(): AuthCache | null {
  if (!isSupabaseConfigured) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthCache) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User | null, profile: UserProfile | null, company: Company | null) {
  if (!isSupabaseConfigured) return;
  if (user && profile) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, profile, company }));
  } else {
    localStorage.removeItem(CACHE_KEY);
  }
}

// Read synchronously at module load — before any React render
const cached = readCache();

// ── Mock users for offline/demo mode ──────────────────────────────────────
const mockUsers: Record<string, User> = {
  owner:        { id: '1', email: 'owner@example.com',     role: 'owner',        name: 'Owner User' },
  admin:        { id: '2', email: 'admin@example.com',     role: 'admin',        name: 'Admin User' },
  bdm:          { id: '3', email: 'bdm@example.com',       role: 'bdm',          name: 'BDM User' },
  engineer:     { id: '4', email: 'engineer@example.com',  role: 'engineer',     name: 'Engineer User' },
  receptionist: { id: '5', email: 'reception@example.com', role: 'receptionist', name: 'Receptionist User' },
  developer:    { id: '6', email: 'dev@example.com',       role: 'developer',    name: 'Developer User' },
  intern:       { id: '7', email: 'intern@example.com',    role: 'intern',       name: 'Intern User' },
};

export const useAuthStore = create<AuthState>((set) => ({
  // Initialise directly from localStorage cache so the very first render
  // already has user/profile/company — no loading screen for returning users.
  user:    isSupabaseConfigured ? (cached?.user    ?? null) : mockUsers.owner,
  profile: isSupabaseConfigured ? (cached?.profile ?? null) : { id: '1', username: 'Owner User' },
  company: isSupabaseConfigured ? (cached?.company ?? null) : { id: 'demo', name: 'Demo Company', currency: 'QR', join_code: 'DEMO01' },
  isLoading:     isSupabaseConfigured ? !cached : false,
  isInitialized: isSupabaseConfigured ?  !!cached : true,

  setUser: (user) => set({ user, isInitialized: true, isLoading: false }),

  setAuth: (user, profile, company) => {
    writeCache(user, profile, company);
    set({ user, profile, company, isInitialized: true, isLoading: false });
  },

  setCompany: (company) => set({ company }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: () => set({ isInitialized: true, isLoading: false }),

  loginAs: (role) => set({
    user:    mockUsers[role] ?? mockUsers.owner,
    profile: { id: mockUsers[role]?.id ?? '1', username: mockUsers[role]?.name ?? 'User' },
    company: { id: 'demo', name: 'Demo Company', currency: 'QR', join_code: 'DEMO01' },
  }),

  logout: () => {
    writeCache(null, null, null);
    set({ user: null, profile: null, company: null });
  },
}));
