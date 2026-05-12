-- Add expiry date columns to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS qid_expiry DATE,
ADD COLUMN IF NOT EXISTS passport_expiry DATE;
