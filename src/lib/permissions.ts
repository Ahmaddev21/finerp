export type ModulePermissions = Record<string, string[]>;

export interface ModuleDef {
  key: string;
  label: string;
  description: string;
}

// Only owner is permanently locked — admin is now configurable per-module by the owner
export const ALWAYS_ALLOWED = ['owner'];

export const CONFIGURABLE_ROLES = [
  { key: 'bdm',          label: 'BDM' },
  { key: 'engineer',     label: 'Engineer' },
  { key: 'receptionist', label: 'Receptionist' },
  { key: 'developer',    label: 'Developer' },
  { key: 'intern',       label: 'Intern' },
] as const;

export const MODULES: ModuleDef[] = [
  { key: 'projects',         label: 'Projects',          description: 'Project tracking & P&L' },
  { key: 'accounting',       label: 'Accounting',         description: 'Financial records & reports' },
  { key: 'erp',              label: 'ERP Dashboard',      description: 'Operations overview' },
  { key: 'contracting',      label: 'Contracting',        description: 'Contracts, invoices & payments' },
  { key: 'consultation',     label: 'Consultation',       description: 'Consultation billing' },
  { key: 'delivery',         label: 'Delivery',           description: 'Riders & drivers management' },
  { key: 'merchandise',      label: 'Merchandise',        description: 'Inventory management' },
  { key: 'assets',           label: 'Assets',             description: 'Asset tracking' },
  { key: 'time-keeping',     label: 'Time Keeping',       description: 'Attendance & time records' },
  { key: 'finance-workflow', label: 'Finance Workflow',   description: 'Approval workflows' },
  { key: 'visitors',         label: 'Visitors',           description: 'Daily visitor log' },
  { key: 'bank-details',     label: 'Bank Details',       description: 'Banking information' },
  { key: 'audit-logs',       label: 'Audit Logs',         description: 'System activity logs' },
];

// Admin is on by default for every module — owner can remove it per-module
export const DEFAULT_PERMISSIONS: ModulePermissions = {
  projects:          ['owner', 'admin'],
  accounting:        ['owner', 'admin'],
  erp:               ['owner', 'admin', 'bdm', 'engineer'],
  contracting:       ['owner', 'admin', 'bdm', 'engineer'],
  consultation:      ['owner', 'admin', 'bdm'],
  delivery:          ['owner', 'admin'],
  merchandise:       ['owner', 'admin'],
  assets:            ['owner', 'admin'],
  'time-keeping':    ['owner', 'admin'],
  'finance-workflow':['owner', 'admin'],
  visitors:          ['owner', 'admin', 'receptionist'],
  'bank-details':    ['owner', 'admin'],
  'audit-logs':      ['owner', 'admin'],
};

/** Returns the roles allowed for a module. Owner is always included; admin is now configurable. */
export function getModuleRoles(
  moduleKey: string,
  stored: ModulePermissions | null | undefined
): string[] {
  if (!stored || stored[moduleKey] === undefined) {
    return DEFAULT_PERMISSIONS[moduleKey] ?? [...ALWAYS_ALLOWED];
  }
  // Only owner is hardcoded; everything else (including admin) comes from stored
  return [...new Set(['owner', ...stored[moduleKey]])];
}

/** Returns true if the given role can access the module. */
export function canAccess(
  moduleKey: string,
  role: string | null | undefined,
  stored: ModulePermissions | null | undefined
): boolean {
  if (!role) return false;
  return getModuleRoles(moduleKey, stored).includes(role);
}
