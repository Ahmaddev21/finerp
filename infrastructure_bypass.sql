-- INFRASTRUCTURE BYPASS: Pre-joined Secure Views
-- Run this in your Supabase SQL Editor

-- 1. Create a secure view for Members
-- This bypasses the "Missing Relationship" API error.
CREATE OR REPLACE VIEW public.member_profiles AS
SELECT 
    cu.id,
    cu.company_id,
    cu.user_id,
    cu.role,
    p.username,
    p.avatar_url
FROM public.company_users cu
LEFT JOIN public.profiles p ON cu.user_id = p.id;

-- 2. Create a secure view for Audit Logs
CREATE OR REPLACE VIEW public.audit_logs_with_profiles AS
SELECT 
    al.*,
    p.username as user_name
FROM public.audit_logs al
LEFT JOIN public.profiles p ON al.user_id = p.id;

-- 3. Grant permissions to the system
GRANT SELECT ON public.member_profiles TO authenticated;
GRANT SELECT ON public.audit_logs_with_profiles TO authenticated;

-- 4. Signal Supabase to refresh the cache
NOTIFY pgrst, 'reload schema';
