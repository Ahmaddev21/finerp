-- AUDIT LOG & SCHEMA REPAIR: FINAL STABILITY PATCH
-- Run this in your Supabase SQL Editor

-- 1. Add the missing user_id column to audit_logs
-- This was the cause of the previous "Column does not exist" error.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Backfill existing records (matches email to ID)
-- This ensures your existing audit history remains connected to your profile.
UPDATE public.audit_logs
SET user_id = u.id
FROM auth.users u
WHERE public.audit_logs.user_email = u.email
AND public.audit_logs.user_id IS NULL;

-- 3. Establish explicit links for the API (Reconnecting Membership & Profiles)
-- This unblocks the "White Screen" hydration on the Accounting page.
ALTER TABLE public.company_users 
DROP CONSTRAINT IF EXISTS company_users_profiles_fkey;

ALTER TABLE public.company_users
ADD CONSTRAINT company_users_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 4. Establish explicit links for the API (Reconnecting Audit Logs & Profiles)
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_profiles_fkey;

ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 5. Signal Supabase to refresh the schema cache immediately
NOTIFY pgrst, 'reload schema';
