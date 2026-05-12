import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
  last_active_at?: string;
}

export interface Company {
  id: string;
  name: string;
  currency: string;
  industry?: string;
  join_code?: string;
  lock_date?: string;
  created_at?: string;
}

export type UserRole = 'owner' | 'admin' | 'bdm' | 'engineer' | 'receptionist' | 'developer' | 'intern';

export interface AuthResult {
  token: string;
  user: any;
  profile: UserProfile;
  company?: Company;
  role: UserRole | null;
}

// ── Login ──────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const user = data.user!;
  const token = data.session?.access_token ?? '';

  // Fetch profile
  const profile = await fetchProfile(user.id);

  // Fetch company + role
  const { company, role } = await fetchCompanyAndRole(user.id);

  return { token, user, profile, company, role };
}

// ── Signup ─────────────────────────────────────────
export async function signup(
  username: string,
  email: string,
  password: string,
  companyName?: string,
  currency?: string,
  joinCode?: string
): Promise<AuthResult> {
  // 1. Create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { 
      data: { username },
      emailRedirectTo: window.location.origin
    },
  });
  if (error) throw error;

  const user = data.user!;
  const token = data.session?.access_token ?? '';

  // 2. Wait a moment for the trigger to create the profile
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Create company OR join existing
  let company: Company | undefined;
  let role: UserRole = 'intern';

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      if (companyName) {
        // Create new company (user becomes owner)
        const { data: result, error: rpcError } = await supabase.rpc('create_company_with_admin', {
          p_name: companyName,
          p_currency: currency || 'QR',
          p_user_id: user.id,
        });
        if (rpcError) throw rpcError;
        company = result as Company;
        role = 'owner';
      } else if (joinCode) {
        const result = await joinCompanyFromCode(joinCode, user.id);
        company = {
          id: result.id,
          name: result.name,
          currency: result.currency,
          industry: result.industry,
          join_code: result.join_code,
        };
        role = result.role;
      }
      break; // Success
    } catch (err: any) {
      attempt++;
      // If it's a foreign key violation (error code 23503), wait and retry
      if ((err.code === '23503' || err.message?.includes('violates foreign key constraint')) && attempt < MAX_RETRIES) {
        console.warn(`Signup race condition detected (FK violation). Retry attempt ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw err; // Real error or too many retries
    }
  }

  const profile = await fetchProfile(user.id);

  return { token, user, profile, company, role };
}

// ── Logout ─────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
}

// ── Get Current User ───────────────────────────────
export async function getMe() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchProfile(user.id);
  const { company, role } = await fetchCompanyAndRole(user.id);

  return { user, profile, company, role };
}

// ── Helpers ────────────────────────────────────────
async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return data ?? { id: userId, username: 'User' };
}

async function fetchCompanyAndRole(userId: string): Promise<{ company?: Company; role: UserRole | null }> {
  // Step 1: Get membership
  const { data: membership, error: memErr } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (memErr || !membership) {
    console.warn('No company membership found for user:', userId);
    // Fallback: check if they created a company directly
    const { data: createdCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (createdCompany) {
      console.info('Owner Fallback: user is company creator.');
      return {
        company: {
          id: createdCompany.id,
          name: createdCompany.name,
          currency: createdCompany.currency,
          industry: createdCompany.industry,
          join_code: createdCompany.join_code,
          lock_date: createdCompany.lock_date,
        },
        role: 'owner',
      };
    }
    return { company: undefined, role: null };
  }

  // Step 2: Fetch the company separately
  const { data: companyData, error: compErr } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single();

  if (compErr || !companyData) {
    console.error('Failed to fetch company:', compErr?.message);
    return { company: undefined, role: membership.role as UserRole };
  }

  return {
    company: {
      id: companyData.id,
      name: companyData.name,
      currency: companyData.currency,
      industry: companyData.industry,
      join_code: companyData.join_code,
      lock_date: companyData.lock_date,
    },
    role: membership.role as UserRole,
  };
}

// ── Company Management ─────────────────────────────
export async function fetchCompanyMembers(companyId: string) {
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('company_id', companyId);

  if (error) throw error;
  
  // Transform to match the structure the UI expects
  return (data ?? []).map(row => ({
    ...row,
    profiles: {
      username:      row.username,
      avatar_url:    row.avatar_url,
      email:         row.email,
      status:        row.status,
      last_active_at: row.last_active_at,
    }
  }));
}

export async function regenerateJoinCode(companyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_join_code', {
    p_company_id: companyId,
  });
  if (error) throw error;
  return data as string;
}

export async function updateMemberRole(companyId: string, userId: string, newRole: UserRole) {
  const { error } = await supabase
    .from('company_users')
    .update({ role: newRole })
    .match({ company_id: companyId, user_id: userId });

  if (error) throw error;
}

export async function removeMember(companyId: string, userId: string) {
  const { error } = await supabase
    .from('company_users')
    .delete()
    .match({ company_id: companyId, user_id: userId });

  if (error) throw error;
}

// ── Upload Attachment ──────────────────────────────
export async function uploadAttachment(
  file: File,
  recordType: string,
  recordId: string,
  companyId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${companyId}/${recordType}/${recordId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('finance_attachments')
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return path;
}

export async function getSignedAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('finance_attachments')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function updateProfile(userId: string, updates: { username?: string; avatar_url?: string }): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `avatars/${userId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('finance_attachments')
    .upload(path, file, { upsert: true });

  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage
    .from('finance_attachments')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export interface JoinCodeResult {
  id: string;
  name: string;
  currency: string;
  industry?: string;
  join_code?: string;
  role: UserRole;
}

export interface CompanyInvite {
  id: string;
  company_id: string;
  code: string;
  role: UserRole;
  created_at: string;
  expires_at?: string;
}

export async function generateRoleInvite(
  companyId: string,
  role: UserRole
): Promise<CompanyInvite> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('generate_company_invite', {
    p_company_id: companyId,
    p_role: role,
    p_max_uses: 1,
  });
  if (!rpcError && rpcData) return rpcData as CompanyInvite;

  const { data, error } = await supabase
    .from('company_invites')
    .insert({
      company_id: companyId,
      code: generateLocalJoinCode(),
      role,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as CompanyInvite;
}

export async function fetchCompanyInvites(companyId: string): Promise<CompanyInvite[]> {
  const { data, error } = await supabase
    .from('company_invites')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    const missingTable =
      error.message?.includes('relation "public.company_invites" does not exist') ||
      error.message?.includes('Could not find the table');
    if (missingTable) return [];
    throw error;
  }

  return (data ?? []) as CompanyInvite[];
}

async function joinCompanyFromCode(code: string, userId?: string): Promise<JoinCodeResult> {
  const normalizedCode = code.replace(/\s+/g, '').toUpperCase();
  console.log('[joinCompanyFromCode] Attempting with code:', normalizedCode, 'userId:', userId);

  // Attempt 1: Role-based invite (company_invites table)
  const inviteAttempt = await supabase.rpc('join_company_by_invite', {
    p_code: normalizedCode,
    p_user_id: userId,
  });

  if (!inviteAttempt.error && inviteAttempt.data) {
    console.log('[joinCompanyFromCode] ✅ Joined via invite code');
    await supabase.auth.refreshSession();
    return inviteAttempt.data as JoinCodeResult;
  }

  // Attempt 2: Legacy company join_code (companies.join_code column)
  console.log('[joinCompanyFromCode] Invite failed, trying legacy join_code...');
  const legacyAttempt = await supabase.rpc('join_company_by_code', {
    p_code:    normalizedCode,
    p_user_id: userId ?? null,
  });

  if (legacyAttempt.error) {
    const realError = inviteAttempt.error?.message || legacyAttempt.error?.message || 'Invalid or expired invite code';
    console.error('[joinCompanyFromCode] ❌ BOTH attempts failed:', realError);
    throw new Error(realError);
  }

  console.log('[joinCompanyFromCode] ✅ Joined via legacy company code');
  await supabase.auth.refreshSession();
  const legacyData = legacyAttempt.data as Partial<JoinCodeResult>;
  return {
    role: (legacyData.role ?? 'intern') as UserRole,
    id:       legacyData.id       ?? '',
    name:     legacyData.name     ?? '',
    currency: legacyData.currency ?? 'QR',
    industry: legacyData.industry,
    join_code: legacyData.join_code,
  };
}

function generateLocalJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function updateCompanyLockDate(companyId: string, lockDate: string | null) {
  const { error } = await supabase
    .from('companies')
    .update({ lock_date: lockDate })
    .eq('id', companyId);
  if (error) throw error;
}
