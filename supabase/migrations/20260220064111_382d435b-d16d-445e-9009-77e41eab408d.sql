
-- Add happened_on and source columns to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS happened_on date;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';
