-- ═══════════════════════════════════════════════════════════════════
-- FinERP — Add QID expiry date to company_entity_employees
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.company_entity_employees
  ADD COLUMN IF NOT EXISTS id_expiry_date date;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'company_entity_employees'
ORDER BY ordinal_position;
