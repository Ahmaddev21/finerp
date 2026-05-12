-- FinERP v4 - Hardening & Bypass Prevention
-- Run after `schema_migration_v3_roles.sql`

-- 1. Create a function to enforce "Moderator Restriction" at the database level
CREATE OR REPLACE FUNCTION public.enforce_transaction_mod_rules()
RETURNS trigger AS $$
DECLARE
    v_role text;
BEGIN
    -- Only check if the user is authenticated (not a system/service role)
    IF auth.role() != 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Get the current user's role in this company
    SELECT role INTO v_role
    FROM public.company_users
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND user_id = auth.uid()
    LIMIT 1;

    -- RULES FOR MODERATORS
    IF v_role = 'moderator' THEN
        -- Rule A: Prevent Deletion
        IF (TG_OP = 'DELETE') THEN
            RAISE EXCEPTION 'Moderators are not permitted to delete transactions. Please contact an Administrator.';
        END IF;

        -- Rule B: Prevent direct modification of sensitive financial fields
        IF (TG_OP = 'UPDATE') THEN
            IF (
                NEW.amount IS DISTINCT FROM OLD.amount OR
                NEW.date IS DISTINCT FROM OLD.date OR
                NEW.type IS DISTINCT FROM OLD.type OR
                NEW.project IS DISTINCT FROM OLD.project
            ) THEN
                RAISE EXCEPTION 'Sensitive field modification blocked for Moderators. Please submit a Change Request for approval.';
            END IF;
        END IF;
    END IF;

    -- RULES FOR BDM/MEMBER/BD (Even stricter)
    IF v_role IN ('bdm', 'member', 'bd') THEN
         IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
             -- Only allow updates to their own metadata if absolutely necessary, 
             -- but for now, block all financial edits for these low-privilege roles.
             RAISE EXCEPTION 'Access Denied: Your role does not have permission to modify transaction data.';
         END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply the trigger
DROP TRIGGER IF EXISTS trg_enforce_transaction_mod_rules ON public.transactions;
CREATE TRIGGER trg_enforce_transaction_mod_rules
    BEFORE UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_transaction_mod_rules();

-- 3. Document the hardening in the audit system
COMMENT ON TRIGGER trg_enforce_transaction_mod_rules ON public.transactions IS 'Enforces bypass-proof restrictions on Moderator/Member roles for financial integrity.';
