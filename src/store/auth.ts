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
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
  loginAs: (role: Role) => void; // Kept for demo/offline mode
  logout: () => void;
}

// Mock users for offline/demo mode
const mockUsers: Record<string, User> = {
  owner: { id: '1', email: 'owner@example.com', role: 'owner', name: 'Owner User' },
  admin: { id: '2', email: 'admin@example.com', role: 'admin', name: 'Admin User' },
  bdm: { id: '3', email: 'bdm@example.com', role: 'bdm', name: 'BDM User' },
  engineer: { id: '4', email: 'engineer@example.com', role: 'engineer', name: 'Engineer User' },
  receptionist: { id: '5', email: 'reception@example.com', role: 'receptionist', name: 'Receptionist User' },
  developer: { id: '6', email: 'dev@example.com', role: 'developer', name: 'Developer User' },
  intern: { id: '7', email: 'intern@example.com', role: 'intern', name: 'Intern User' },
};

export const useAuthStore = create<AuthState>((set) => ({
  // Default: auto-login as owner in demo mode, null in live mode
  user: isSupabaseConfigured ? null : mockUsers.owner,
  profile: isSupabaseConfigured ? null : { id: '1', username: 'Owner User' },
  company: isSupabaseConfigured ? null : { id: 'demo', name: 'Demo Company', currency: 'QR', join_code: 'DEMO01' },
  isLoading: isSupabaseConfigured, // Start loading only in live mode
  isInitialized: !isSupabaseConfigured, // Already initialized in demo mode

  setUser: (user) => set({ user, isInitialized: true, isLoading: false }),
  setAuth: (user, profile, company) => set({ user, profile, company, isInitialized: true, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: () => set({ isInitialized: true, isLoading: false }),
  loginAs: (role) => set({
    user: mockUsers[role] ?? mockUsers.owner,
    profile: { id: mockUsers[role]?.id ?? '1', username: mockUsers[role]?.name ?? 'User' },
    company: { id: 'demo', name: 'Demo Company', currency: 'QR', join_code: 'DEMO01' },
  }),
  logout: () => set({ user: null, profile: null, company: null }),
}));
