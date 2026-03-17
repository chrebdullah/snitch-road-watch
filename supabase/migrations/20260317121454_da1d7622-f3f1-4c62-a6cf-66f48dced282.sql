
-- Add new columns to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'car';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS comment text;

-- Add indexes for map performance
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_lat_lng ON public.reports (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- Update the public view to include vehicle_type
DROP VIEW IF EXISTS public.reports_public;
CREATE VIEW public.reports_public AS
  SELECT id, created_at, latitude, longitude, happened_on, source, masked_reg, city, vehicle_type
  FROM public.reports
  WHERE approved = true AND is_public = false;
