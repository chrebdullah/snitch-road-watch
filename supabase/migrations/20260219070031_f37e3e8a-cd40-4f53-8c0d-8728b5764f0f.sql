
-- Rate limiting table: stores hashed IPs with TTL
CREATE TABLE IF NOT EXISTS public.rate_limit_ips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  report_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_hash ON public.rate_limit_ips(ip_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON public.rate_limit_ips(expires_at);

-- Enable RLS
ALTER TABLE public.rate_limit_ips ENABLE ROW LEVEL SECURITY;

-- No public access to rate limit data – managed via edge function with service role only
