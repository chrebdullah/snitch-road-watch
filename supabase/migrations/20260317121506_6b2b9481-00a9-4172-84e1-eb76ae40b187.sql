
-- Fix: Use security invoker (default) for the public view
DROP VIEW IF EXISTS public.reports_public;
CREATE VIEW public.reports_public WITH (security_invoker = true) AS
  SELECT id, created_at, latitude, longitude, happened_on, source, masked_reg, city, vehicle_type
  FROM public.reports
  WHERE approved = true;

-- Grant select on the view to anon and authenticated
GRANT SELECT ON public.reports_public TO anon, authenticated;
