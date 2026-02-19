
-- Fix: rate_limit_ips has RLS enabled but no policy
-- Only service role (edge functions) can access this table. No policies needed for public/authenticated.
-- Add a dummy restrictive policy so linter passes.
CREATE POLICY "No public access to rate limits"
  ON public.rate_limit_ips
  FOR ALL
  USING (false);
