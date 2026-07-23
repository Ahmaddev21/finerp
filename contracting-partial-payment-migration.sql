-- ═══════════════════════════════════════════════════════════════════
-- Contracting Partial Payment — running balance on contracting_projects
--
-- Adds amount_paid to contracting_projects and a trigger that maintains
-- it automatically whenever a payment is recorded via the existing
-- useContractingPayments.recordPayment() (table: contracting_payments).
-- Only 'in' (client → company) payments count toward amount_paid —
-- 'out' (company → subcontractor) payments are unrelated to how much
-- of the CONTRACT VALUE the client has paid.
--
-- The trigger function deliberately does NOT use SECURITY DEFINER: it
-- runs as the inserting user, and the existing "Company members can
-- update contracting_projects" RLS policy already permits that same
-- user to update their own company's project row, so no elevated
-- privilege is needed (same reasoning as the member_profiles fix
-- earlier — don't grant more access than the operation requires).
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.contracting_projects
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_contracting_payment_to_project()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_value numeric(14,2);
  v_paid  numeric(14,2);
BEGIN
  IF NEW.direction = 'in' AND NEW.project_id IS NOT NULL THEN
    SELECT value, amount_paid INTO v_value, v_paid
    FROM public.contracting_projects
    WHERE id = NEW.project_id
    FOR UPDATE;

    IF v_value IS NOT NULL THEN
      IF v_paid + NEW.amount > v_value THEN
        RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE: payment % exceeds remaining balance %', NEW.amount, (v_value - v_paid);
      END IF;

      UPDATE public.contracting_projects
      SET amount_paid = v_paid + NEW.amount
      WHERE id = NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracting_payments_apply_to_project ON public.contracting_payments;
CREATE TRIGGER contracting_payments_apply_to_project
  AFTER INSERT ON public.contracting_payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_contracting_payment_to_project();

-- ─────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contracting_projects' AND column_name = 'amount_paid';

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'contracting_payments';
