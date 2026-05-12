-- Create merchandise table linked to deliveries
CREATE TABLE IF NOT EXISTS public.merchandise (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id TEXT REFERENCES public.deliveries(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    t_shirt_qty INTEGER DEFAULT 0,
    trouser_qty INTEGER DEFAULT 0,
    helmet_qty INTEGER DEFAULT 0,
    safety_gears_qty INTEGER DEFAULT 0,
    thermal_bag_qty INTEGER DEFAULT 0,
    gillets_qty INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(delivery_id) -- One merchandise record per employee
);

-- Enable RLS
ALTER TABLE public.merchandise ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Company members can view merchandise" 
ON public.merchandise FOR SELECT 
USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert merchandise" 
ON public.merchandise FOR INSERT 
WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update merchandise" 
ON public.merchandise FOR UPDATE 
USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete merchandise" 
ON public.merchandise FOR DELETE 
USING (public.is_company_member(company_id));

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE merchandise; EXCEPTION WHEN OTHERS THEN NULL; END $$;
