-- ───────────────────────────────────────────────────────────────────
-- MIGRATION 04: Copy Employee Bank Details into per-entity WPS records
-- Bank Details records are not tied to a specific company entity
-- (Shareup / RAA Trading / RAA Consultancy), while WPS records are.
-- Per decision: duplicate each bank record into all 3 entities' WPS
-- lists. The Bank Details page/nav/hook has been removed from the
-- app; the source table is left intact here — drop it manually (see
-- bottom) once you've verified the copied data in the WPS tabs.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.company_entity_wps (entity, company_id, employee_name, bank_name, account_number, status)
SELECT ent.entity, ebd.company_id, ebd.employee_name, NULLIF(ebd.bank_name, ''), NULLIF(ebd.account_number, ''), 'pending'
FROM public.employee_bank_details ebd
CROSS JOIN (VALUES ('shareup'), ('trading'), ('consultancy')) AS ent(entity)
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_entity_wps w
  WHERE w.entity = ent.entity
    AND w.company_id = ebd.company_id
    AND w.employee_name = ebd.employee_name
);

COMMIT;

-- ───────────────────────────────────────────────────────────────────
-- Once you've verified the copied records look correct in the WPS
-- tabs (Shareup / RAA Trading / RAA Consultancy), uncomment and run
-- this to remove the now-redundant source table:
--
-- DROP TABLE public.employee_bank_details;
-- ───────────────────────────────────────────────────────────────────
