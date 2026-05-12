-- Update deliveries table to support Rider/Driver management
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS emp_number TEXT,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS snoonu_id TEXT,
ADD COLUMN IF NOT EXISTS snoonu_email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS qid TEXT,
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS car_number TEXT,
ADD COLUMN IF NOT EXISTS bike_number TEXT,
ADD COLUMN IF NOT EXISTS mobile_number TEXT,
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('Rider', 'Driver'));

-- Update status constraint if needed, or just allow flexible status
-- The existing constraint is: check (status in ('In Transit','Scheduled','Delivered','Issue Reported'))
-- We'll add 'Active' and 'Inactive' to it.
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_status_check CHECK (status IN ('In Transit', 'Scheduled', 'Delivered', 'Issue Reported', 'Active', 'Inactive'));
