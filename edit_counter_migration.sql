DO $$ 
BEGIN
  -- Transactions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='edit_count') THEN
    ALTER TABLE public.transactions ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Projects
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='edit_count') THEN
    ALTER TABLE public.projects ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Contracts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='edit_count') THEN
    ALTER TABLE public.contracts ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Contracting Projects
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracting_projects' AND column_name='edit_count') THEN
    ALTER TABLE public.contracting_projects ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Contracting Invoices Out
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracting_invoices_out' AND column_name='edit_count') THEN
    ALTER TABLE public.contracting_invoices_out ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Contracting Invoices In
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracting_invoices_in' AND column_name='edit_count') THEN
    ALTER TABLE public.contracting_invoices_in ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

  -- Contracting Payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracting_payments' AND column_name='edit_count') THEN
    ALTER TABLE public.contracting_payments ADD COLUMN edit_count INT DEFAULT 0;
  END IF;

END $$;
