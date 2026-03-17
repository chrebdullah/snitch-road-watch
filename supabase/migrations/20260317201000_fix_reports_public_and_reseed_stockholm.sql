DROP VIEW IF EXISTS public.reports_public;

CREATE VIEW public.reports_public AS
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
  vehicle_type,
  approved
FROM public.reports
WHERE approved = true
  AND is_public = true;

GRANT SELECT ON public.reports_public TO anon, authenticated;

WITH seed_reports (reg_number, masked_reg, latitude, longitude, city, address, comment, created_at) AS (
  VALUES
    ('ABF123', 'AB***23', 59.3326, 18.0649, 'Stockholm', 'Drottninggatan 85, Norrmalm', 'Stod i cykelfältet vid rusningstrafik.', now() - interval '6 days 18 hours'),
    ('CDG456', 'CD***56', 59.3189, 18.0703, 'Stockholm', 'Ringvägen 101, Södermalm', 'Stod på trottoaren utanför butik.', now() - interval '6 days 2 hours'),
    ('EHK789', 'EH***89', 59.3392, 18.0902, 'Stockholm', 'Nybrogatan 46, Östermalm', 'Dubbelparkerad nära övergångsställe.', now() - interval '5 days 9 hours'),
    ('FLM234', 'FL***34', 59.3350, 18.0414, 'Stockholm', 'Kungsholmsgatan 21, Kungsholmen', 'Stod i lastzon trots skyltning.', now() - interval '4 days 20 hours'),
    ('GNP567', 'GN***67', 59.3460, 18.0495, 'Stockholm', 'Odengatan 70, Vasastan', 'Blockerade bussfil i flera minuter.', now() - interval '4 days 1 hour'),
    ('HQR890', 'HQ***90', 59.3250, 18.0721, 'Stockholm', 'Skeppsbron 24, Gamla Stan', 'Körde in i gångfartsområde och stannade.', now() - interval '3 days 6 hours'),
    ('JST345', 'JS***45', 59.3039, 18.0921, 'Stockholm', 'Hammarby Allé 93, Hammarby Sjöstad', 'Stannade i cykelbox vid rödljus.', now() - interval '2 days 15 hours'),
    ('KUV678', 'KU***78', 59.3418, 18.0566, 'Stockholm', 'Upplandsgatan 58, Vasastan', 'Felparkerad vid skolzon.', now() - interval '1 day 22 hours'),
    ('LWX901', 'LW***01', 59.3268, 18.0476, 'Stockholm', 'Fleminggatan 67, Kungsholmen', 'Tomgång på gångbana under leverans.', now() - interval '1 day 5 hours'),
    ('MZY112', 'MZ***12', 59.3299, 18.0605, 'Stockholm', 'Vasagatan 39, Norrmalm', 'Parkerad i busszon vid Centralen.', now() - interval '8 hours')
)
INSERT INTO public.reports (
  reg_number,
  masked_reg,
  latitude,
  longitude,
  city,
  address,
  comment,
  created_at,
  happened_on,
  is_public,
  approved,
  source,
  vehicle_type
)
SELECT
  s.reg_number,
  s.masked_reg,
  s.latitude,
  s.longitude,
  s.city,
  s.address,
  s.comment,
  s.created_at,
  s.created_at::date,
  true,
  true,
  'web',
  'car'
FROM seed_reports s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reports r
  WHERE r.reg_number = s.reg_number
);
