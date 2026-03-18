-- Ensure anonymous users can insert reports directly from the frontend
DROP POLICY IF EXISTS "Anyone can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.reports;

CREATE POLICY "Anyone can insert reports"
ON public.reports
FOR INSERT
TO anon
WITH CHECK (true);
