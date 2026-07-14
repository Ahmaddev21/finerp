export type AppRole =
  | 'owner'
  | 'admin'
  | 'bdm'
  | 'engineer'
  | 'receptionist'
  | 'developer'
  | 'intern';

const ADMIN_ROLES: AppRole[] = ['owner', 'admin'];

export function isOwner(role?: string | null): boolean {
  return role === 'owner';
}

export function isAdminRole(role?: string | null): boolean {
  return (ADMIN_ROLES as string[]).includes(role ?? '');
}

export function isBdmRole(role?: string | null): boolean {
  return role === 'bdm';
}

export function isEngineerRole(role?: string | null): boolean {
  return role === 'engineer';
}

export function isReceptionistRole(role?: string | null): boolean {
  return role === 'receptionist';
}

export function isDeveloperRole(role?: string | null): boolean {
  return role === 'developer';
}

export function isInternRole(role?: string | null): boolean {
  return role === 'intern';
}

export function canAccessAccounting(role?: string | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canAccessDashboard(role?: string | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'bdm': return 'BDM';
    case 'engineer': return 'Engineer';
    case 'receptionist': return 'Receptionist';
    case 'developer': return 'Developer';
    case 'intern': return 'Intern';
    default: return 'User';
  }
}
