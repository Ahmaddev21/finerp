-- SCHEMA_CONSOLIDATION v3: The "Indestructible" Cleanup
-- Run this in your Supabase SQL Editor

-- 1. DYNAMIC CLEANUP FOR 'company_users'
-- This block finds EVERY foreign key on the user_id column, no matter what it's named, and drops it.
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'company_users' 
        AND column_name = 'user_id' 
        AND table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.company_users
ADD CONSTRAINT company_users_profiles_link 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. DYNAMIC CLEANUP FOR 'audit_logs'
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'user_id' 
        AND table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_profiles_link 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 3. FINAL SIGNAL: Reload the API cache
NOTIFY pgrst, 'reload schema';
