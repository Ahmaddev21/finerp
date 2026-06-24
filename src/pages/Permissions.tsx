import React, { useState } from 'react';
import { Check, Lock, Save, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { updateModulePermissions } from '../services/auth';
import {
  MODULES,
  CONFIGURABLE_ROLES,
  ALWAYS_ALLOWED,
  DEFAULT_PERMISSIONS,
  ModulePermissions,
} from '../lib/permissions';
import { cn } from '../lib/utils';

function buildInitialState(stored: ModulePermissions | null | undefined): ModulePermissions {
  const result: ModulePermissions = {};
  for (const m of MODULES) {
    if (stored && stored[m.key] !== undefined) {
      result[m.key] = stored[m.key];
    } else {
      result[m.key] = DEFAULT_PERMISSIONS[m.key] ?? [...ALWAYS_ALLOWED];
    }
  }
  return result;
}

export default function Permissions() {
  const { user, company, setCompany } = useAuthStore();
  const canEdit = user?.role === 'owner' || user?.role === 'admin';

  const [perms, setPerms] = useState<ModulePermissions>(() =>
    buildInitialState(company?.module_permissions)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const toggle = (moduleKey: string, roleKey: string) => {
    if (!canEdit) return;
    setPerms(prev => {
      const current = prev[moduleKey] ?? [];
      const has = current.includes(roleKey);
      return {
        ...prev,
        [moduleKey]: has
          ? current.filter(r => r !== roleKey)
          : [...current, roleKey],
      };
    });
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!company?.id || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      await updateModulePermissions(company.id, perms);
      setCompany({ ...company, module_permissions: perms });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('column') || msg.includes('does not exist')) {
        setError('migration_needed');
      } else {
        setError(msg || 'Failed to save permissions.');
      }
    }
    setSaving(false);
  };

  const SQL = `ALTER TABLE companies\n  ADD COLUMN IF NOT EXISTS module_permissions JSONB;`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Module Permissions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Control which roles can access each section. Owner and Admin always have full access.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-300" /> Saved</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        )}
      </div>

      {/* Migration error */}
      {error === 'migration_needed' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Database migration required</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                Run the SQL below in your Supabase SQL Editor, then save again.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSql(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
          >
            {showSql ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showSql ? 'Hide SQL' : 'Show SQL'}
          </button>
          {showSql && (
            <pre className="bg-slate-900 text-emerald-400 text-xs rounded-xl p-4 overflow-x-auto font-mono">{SQL}</pre>
          )}
        </div>
      )}
      {error && error !== 'migration_needed' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Permissions matrix */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-56">
                  Module
                </th>
                {/* Locked columns */}
                {ALWAYS_ALLOWED.map(r => (
                  <th key={r} className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-28">
                    <span className="capitalize">{r}</span>
                    <Lock className="w-3 h-3 inline ml-1 opacity-50" />
                  </th>
                ))}
                {/* Configurable columns */}
                {CONFIGURABLE_ROLES.map(r => (
                  <th key={r.key} className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 w-28">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {MODULES.map(m => (
                <tr key={m.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{m.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{m.description}</p>
                  </td>
                  {/* Always-allowed (locked) */}
                  {ALWAYS_ALLOWED.map(r => (
                    <td key={r} className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 dark:bg-emerald-950/40 rounded-full">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </span>
                    </td>
                  ))}
                  {/* Configurable toggles */}
                  {CONFIGURABLE_ROLES.map(r => {
                    const checked = (perms[m.key] ?? []).includes(r.key);
                    return (
                      <td key={r.key} className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(m.key, r.key)}
                          disabled={!canEdit}
                          className={cn(
                            'inline-flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all',
                            checked
                              ? 'bg-indigo-600 border-indigo-600 hover:bg-indigo-500 hover:border-indigo-500'
                              : 'bg-transparent border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500',
                            !canEdit && 'cursor-not-allowed opacity-50'
                          )}
                        >
                          {checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Changes take effect immediately after saving. Users currently logged in will see the new permissions on their next page load.
      </p>
    </div>
  );
}
