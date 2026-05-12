-- Daily Visitors Table
CREATE TABLE IF NOT EXISTS public.daily_visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    visitor_name TEXT,
    visit_date_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    purpose TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_visitors ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their company's visitors" ON public.daily_visitors;
CREATE POLICY "Users can view their company's visitors"
    ON public.daily_visitors FOR SELECT
    USING (company_id IN (
        SELECT cu.company_id FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'admin', 'receptionist', 'bdm')
    ));

DROP POLICY IF EXISTS "Users can insert their company's visitors" ON public.daily_visitors;
CREATE POLICY "Users can insert their company's visitors"
    ON public.daily_visitors FOR INSERT
    WITH CHECK (company_id IN (
        SELECT cu.company_id FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'admin', 'receptionist', 'bdm')
    ));

DROP POLICY IF EXISTS "Users can delete their company's visitors" ON public.daily_visitors;
CREATE POLICY "Users can delete their company's visitors"
    ON public.daily_visitors FOR DELETE
    USING (company_id IN (
        SELECT cu.company_id FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'admin', 'receptionist')
    ));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_visitors_company ON public.daily_visitors(company_id);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON public.daily_visitors(visit_date_time);

-- Inform PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
