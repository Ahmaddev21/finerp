import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  Loader2,
  Mail,
  ScanLine,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import {
  fetchCompanyInvites,
  fetchCompanyMembers,
  generateRoleInvite,
  removeMember,
  updateMemberRole,
  updateCompanyLockDate,
  type CompanyInvite,
  type UserRole,
} from '../services/auth';
import { cn } from '../lib/utils';
import { isAdminRole, isOwner, roleLabel } from '../lib/roles';

interface Member {
  id: string;
  user_id: string;
  role: UserRole;
  profiles?: {
    name?: string;
    username?: string;
    email?: string;
    avatar_url?: string;
    status?: 'online' | 'offline' | 'away';
    last_active_at?: string;
  } | null;
}

function getMemberName(member: Member) {
  return member.profiles?.name || member.profiles?.username || member.profiles?.email || 'Team Member';
}

function getMemberEmail(member: Member) {
  return member.profiles?.email || 'Email unavailable';
}

function getPresence(member: Member) {
  const lastActive = member.profiles?.last_active_at ? new Date(member.profiles.last_active_at) : null;
  if (!lastActive || Number.isNaN(lastActive.getTime())) {
    return { label: 'Offline', tone: 'bg-slate-300', sublabel: 'No recent activity' };
  }

  const minutesAgo = Math.floor((Date.now() - lastActive.getTime()) / 60000);
  if (minutesAgo <= 5) {
    return { label: 'Working now', tone: 'bg-emerald-500', sublabel: 'Active in the last 5 min' };
  }
  if (minutesAgo <= 30) {
    return { label: 'Recently active', tone: 'bg-amber-500', sublabel: `${minutesAgo} min ago` };
  }
  return { label: 'Offline', tone: 'bg-slate-300', sublabel: lastActive.toLocaleString() };
}

function AccessCodeCard({
  title,
  subtitle,
  code,
  copied,
  loading,
  allowGenerate = true,
  onCopy,
  onGenerate,
}: {
  title: string;
  subtitle: string;
  code?: string;
  copied: boolean;
  loading: boolean;
  allowGenerate?: boolean;
  onCopy: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>
        <ScanLine className="w-5 h-5 text-slate-300" />
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-5">
        <code className="block text-center text-2xl font-black tracking-[0.35em] text-blue-600 dark:text-blue-400">
          {code || '------'}
        </code>
      </div>

      <div className="mt-4 flex gap-2">
        {allowGenerate && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Generating</span> : code ? 'Regenerate' : 'Generate Code'}
          </button>
        )}
        <button
          onClick={onCopy}
          disabled={!code}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
            allowGenerate ? '' : 'flex-1'
          )}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function TeamSettings() {
  const { company, user: currentUser } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [generatingRole, setGeneratingRole] = useState<string | null>(null);
  const [lockDateStr, setLockDateStr] = useState<string>(company?.lock_date || '');

  const isAdmin = isAdminRole(currentUser?.role);
  const isOwnerUser = isOwner(currentUser?.role);

  const [selectedInviteRole, setSelectedInviteRole] = useState<UserRole>('admin');
  
  const activeInvite = useMemo(
    () => invites.find(invite => invite.role === selectedInviteRole),
    [invites, selectedInviteRole]
  );
  const activeMembers = useMemo(
    () => members.filter(member => getPresence(member).label !== 'Offline'),
    [members]
  );

  const loadAll = useCallback(async () => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [memberRows, inviteRows] = await Promise.all([
        fetchCompanyMembers(company.id),
        fetchCompanyInvites(company.id).catch(() => []),
      ]);
      setMembers(memberRows as Member[]);
      setInvites(inviteRows);
    } catch (err: any) {
      setError(err.message || 'Failed to load workspace settings.');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  // Initial load
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Realtime: re-fetch member list whenever any profile updates (heartbeat fires)
  useEffect(() => {
    if (!isSupabaseConfigured || !company?.id) return;
    const name = `presence-${company.id}-${Date.now()}`;
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => { void loadAll(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [company?.id, loadAll]);

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    if (!company?.id) return;
    setUpdatingId(userId);
    setError(null);
    try {
      await updateMemberRole(company.id, userId, newRole);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!company?.id) return;
    if (!window.confirm('Remove this teammate from the workspace?')) return;
    setUpdatingId(userId);
    setError(null);
    try {
      await removeMember(company.id, userId);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to remove teammate.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleGenerateInvite(role: UserRole) {
    if (!company?.id) return;
    setGeneratingRole(role);
    setError(null);
    try {
      const invite = await generateRoleInvite(company.id, role);
      setInvites(prev => {
        const filtered = prev.filter(item => item.role !== role);
        return [invite, ...filtered];
      });
      console.log(`Successfully generated ${role} code:`, invite.code);
    } catch (err: any) {
      const msg = err.message || `Failed to generate ${role} code.`;
      setError(msg);
      console.error('Invite generation error:', err);
      alert(msg);
    } finally {
      setGeneratingRole(null);
    }
  }

  async function copyCode(code?: string, key?: string) {
    if (!code || !key) return;
    await navigator.clipboard.writeText(code);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  async function handleUpdateLockDate() {
    if (!company?.id) return;
    setUpdatingId('lock_date');
    setError(null);
    try {
      const cleanDate = lockDateStr.trim() !== '' ? lockDateStr : null;
      await updateCompanyLockDate(company.id, cleanDate);
      useAuthStore.setState({ company: { ...company, lock_date: cleanDate || undefined } });
      alert('Accounting period lock updated securely.');
    } catch (err: any) {
      setError(err.message || 'Failed to update lock date.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading workspace settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-6 h-6 text-slate-400" /> Workspace Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage access codes, live team activity, and workspace roles.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/20">
              {company?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{company?.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                <Building2 className="w-4 h-4" />
                <span>Shared ERP Workspace</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>Created {new Date(company?.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 min-w-[250px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Currently Working</p>
            <div className="space-y-2">
              {(activeMembers.length > 0 ? activeMembers : members.slice(0, 3)).map(member => {
                const presence = getPresence(member);
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', presence.tone)} />
                      <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{getMemberName(member)}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{presence.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isOwnerUser && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Invite Team Members</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generate a secure access code to invite new members to your workspace.</p>
              </div>
              <ScanLine className="w-5 h-5 text-slate-300" />
            </div>

            <div className="mt-4 flex gap-2">
              <select
                value={selectedInviteRole}
                onChange={(e) => setSelectedInviteRole(e.target.value as UserRole)}
                className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="admin">Admin</option>
                <option value="bdm">BDM</option>
                <option value="engineer">Engineer</option>
                <option value="receptionist">Receptionist</option>
                <option value="developer">Developer</option>
                <option value="intern">Intern</option>
              </select>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-5">
              <code className="block text-center text-2xl font-black tracking-[0.35em] text-blue-600 dark:text-blue-400">
                {activeInvite?.code || '------'}
              </code>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void handleGenerateInvite(selectedInviteRole)}
                disabled={generatingRole === selectedInviteRole}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {generatingRole === selectedInviteRole ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Generating</span> : activeInvite?.code ? 'Regenerate' : 'Generate Code'}
              </button>
              <button
                onClick={() => void copyCode(activeInvite?.code, selectedInviteRole)}
                disabled={!activeInvite?.code}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                {copiedKey === selectedInviteRole ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedKey === selectedInviteRole ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
        {isOwnerUser && (
          <AccessCodeCard
            title="Legacy Join Code"
            subtitle="Shared workspace code. Use for quick general entry."
            code={company?.join_code}
            copied={copiedKey === 'general'}
            loading={false}
            allowGenerate={false}
            onCopy={() => void copyCode(company?.join_code, 'general')}
            onGenerate={() => {}}
          />
        )}
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Financial Period Lock</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Protect historical financial records. Any transactions dated on or before this date will be locked from edits, approvals, and deletion.
              </p>
              <div className="mt-4 flex items-center gap-3 max-w-sm">
                <input
                  type="date"
                  value={lockDateStr}
                  onChange={(e) => setLockDateStr(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
                <button
                  onClick={handleUpdateLockDate}
                  disabled={updatingId === 'lock_date' || lockDateStr === (company?.lock_date || '')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {updatingId === 'lock_date' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set Lock'}
                </button>
                {lockDateStr !== (company?.lock_date || '') && (
                  <button onClick={() => setLockDateStr(company?.lock_date || '')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Reset</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Team Members
            <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-full">{members.length}</span>
          </h3>
          <div className="text-xs text-slate-400">
            {activeMembers.length} active now
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {members.map(member => {
            const presence = getPresence(member);
            const name = getMemberName(member);
            const isSelf = member.user_id === currentUser?.id;
            const removable = isAdmin && !isSelf && member.role !== 'owner';

            return (
              <div key={member.id} className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold overflow-hidden border-2 border-white dark:border-gray-900 ring-1 ring-slate-100 dark:ring-slate-800">
                    {member.profiles?.avatar_url?.startsWith('https://') || member.profiles?.avatar_url?.startsWith('data:image/') ? (
                      <img src={member.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{name}</p>
                      {isSelf && (
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-tighter rounded">You</span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <span className={cn('h-2 w-2 rounded-full', presence.tone)} />
                        {presence.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3" /> {getMemberEmail(member)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{presence.sublabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Role</p>
                    {isAdmin && !isSelf ? (
                      <select
                        value={member.role}
                        disabled={updatingId === member.user_id}
                        onChange={(e) => void handleUpdateRole(member.user_id, e.target.value as UserRole)}
                        className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="bdm">BDM</option>
                        <option value="engineer">Engineer</option>
                        <option value="receptionist">Receptionist</option>
                        <option value="developer">Developer</option>
                        <option value="intern">Intern</option>
                      </select>
                    ) : (
                      <span className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5',
                        member.role === 'owner' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                        member.role === 'admin' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        member.role === 'bdm' ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400' :
                        'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {member.role === 'owner' ? <Shield className="w-3 h-3" /> : null}
                        {roleLabel(member.role)}
                      </span>
                    )}
                  </div>

                  {removable && (
                    <button
                      onClick={() => void handleRemoveMember(member.user_id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                      title="Remove teammate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          You have view access here. Ask an admin if you need new access codes or role changes.
        </div>
      )}
    </div>
  );
}
