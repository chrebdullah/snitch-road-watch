-- Ensure report-media storage bucket exists for report image uploads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-media', 'report-media', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can upload report media'
  ) THEN
    CREATE POLICY "Anyone can upload report media"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'report-media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can view report media'
  ) THEN
    CREATE POLICY "Admins can view report media"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'report-media' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
