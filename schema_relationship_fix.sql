-- SCHEMA RELATIONSHIP RESTORATION: UNBLOCKING UI HYDRATION
-- Run this in your Supabase SQL Editor

-- 1. Restore/Establish explicit link between Members and Profiles
-- This allows (.select('*, profiles(*)')) to work in the API
ALTER TABLE public.company_users 
DROP CONSTRAINT IF EXISTS company_users_profiles_fkey;

ALTER TABLE public.company_users
ADD CONSTRAINT company_users_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Restore/Establish explicit link between Audit Logs and Profiles
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_profiles_fkey;

ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 3. Signal Supabase to refresh the schema cache immediately
NOTIFY pgrst, 'reload schema';
