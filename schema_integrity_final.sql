-- SCHEMA_INTEGRITY_FINAL: The "Force Link" Script
-- Run this in your Supabase SQL Editor

-- 1. Ensure Profiles are fully readable by all authenticated members
-- This is necessary for the sidebar and audit logs to show names instead of IDs.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by members" ON public.profiles;
CREATE POLICY "Profiles are viewable by members" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');

-- 2. Force apply the Foreign Keys with guaranteed names
-- This forces the Supabase API (PostgREST) to recognize the joining relationship (.select('*, profiles(*)'))
-- and fixes the "Could not find a relationship" errors.

-- Reconnect Membership to Profiles
ALTER TABLE public.company_users 
DROP CONSTRAINT IF EXISTS company_users_profiles_link;

ALTER TABLE public.company_users
ADD CONSTRAINT company_users_profiles_link 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Reconnect Audit Logs to Profiles
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_profiles_link;

ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_profiles_link 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 3. FINAL SIGNAL: Reload the API cache
-- This tells the Supabase API to rebuild its connection map immediately.
NOTIFY pgrst, 'reload schema';
