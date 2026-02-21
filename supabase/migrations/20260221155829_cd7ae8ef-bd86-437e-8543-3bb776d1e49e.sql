
-- 1. Create a public view that excludes sensitive columns
CREATE VIEW public.reports_public
WITH (security_invoker = on) AS
SELECT id, created_at, masked_reg, city, latitude, longitude, happened_on, source
FROM public.reports
WHERE approved = true AND is_public = true;

-- 2. Drop the old permissive public SELECT policy
DROP POLICY "Public can view approved reports" ON public.reports;

-- 3. Create a new public SELECT policy that only allows admins to read the base table directly
CREATE POLICY "Public cannot directly select reports"
ON public.reports FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
