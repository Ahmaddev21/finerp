-- ─────────────────────────────────────────────────────────────────────────────
-- Employee Banking Details — Secure Payroll Module
-- Access: owner + admin ONLY (enforced at DB level via RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper function: returns true only for owner/admin of a given company
CREATE OR REPLACE FUNCTION public.is_payroll_admin(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.user_id    = auth.uid()
      AND cu.role       IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Core table
CREATE TABLE IF NOT EXISTS public.employee_bank_details (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           uuid        REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  employee_name        text        NOT NULL,
  employee_role        text,
  bank_name            text,
  account_number       text,
  iban                 text,
  card_number          text,
  branch_name          text,
  account_holder_name  text,
  payment_method       text        DEFAULT 'bank_transfer'
                                   CHECK (payment_method IN ('bank_transfer','cash','cheque','other')),
  notes                text,
  created_by           uuid        REFERENCES auth.users,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- 3. Enable RLS — no row is visible without a matching policy
ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies: owner/admin only, all operations
DROP POLICY IF EXISTS "Payroll admins can select bank details"  ON public.employee_bank_details;
DROP POLICY IF EXISTS "Payroll admins can insert bank details"  ON public.employee_bank_details;
DROP POLICY IF EXISTS "Payroll admins can update bank details"  ON public.employee_bank_details;
DROP POLICY IF EXISTS "Payroll admins can delete bank details"  ON public.employee_bank_details;

CREATE POLICY "Payroll admins can select bank details"
  ON public.employee_bank_details FOR SELECT
  USING (public.is_payroll_admin(company_id));

CREATE POLICY "Payroll admins can insert bank details"
  ON public.employee_bank_details FOR INSERT
  WITH CHECK (public.is_payroll_admin(company_id));

CREATE POLICY "Payroll admins can update bank details"
  ON public.employee_bank_details FOR UPDATE
  USING  (public.is_payroll_admin(company_id))
  WITH CHECK (public.is_payroll_admin(company_id));

CREATE POLICY "Payroll admins can delete bank details"
  ON public.employee_bank_details FOR DELETE
  USING (public.is_payroll_admin(company_id));

-- 5. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bank_details_updated_at ON public.employee_bank_details;
CREATE TRIGGER trg_bank_details_updated_at
  BEFORE UPDATE ON public.employee_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Performance index
CREATE INDEX IF NOT EXISTS idx_bank_details_company
  ON public.employee_bank_details (company_id);
