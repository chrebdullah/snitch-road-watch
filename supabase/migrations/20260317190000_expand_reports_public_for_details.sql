DROP VIEW IF EXISTS public.reports_public;

CREATE VIEW public.reports_public WITH (security_invoker = true) AS
SELECT
  id,
  created_at,
  happened_on,
  latitude,
  longitude,
  masked_reg,
  city,
  address,
  comment,
  media_url,
  source,
  vehicle_type
FROM public.reports
WHERE approved = true;

GRANT SELECT ON public.reports_public TO anon, authenticated;
