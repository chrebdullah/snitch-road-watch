-- Track email delivery status per report in production.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_recipient text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
