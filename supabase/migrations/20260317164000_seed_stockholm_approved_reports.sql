WITH seed_reports (reg_number, masked_reg, latitude, longitude, city, address, comment, created_at) AS (
  VALUES
    ('KLD391', 'KL***91', 59.3145, 18.0747, 'Stockholm', 'Götgatan 44, Södermalm', 'Stod i cykelfältet med varningsblinkers.', now() - interval '6 days 3 hours'),
    ('RPT682', 'RP***82', 59.3187, 18.0602, 'Stockholm', 'Hornsgatan 122, Södermalm', 'Blockerade övergångsstället i rusningstid.', now() - interval '5 days 19 hours'),
    ('SVX904', 'SV***04', 59.3141, 18.0828, 'Stockholm', 'Folkungagatan 98, Södermalm', 'Stod på trottoaren utanför butik.', now() - interval '5 days 2 hours'),
    ('MNB247', 'MN***47', 59.3355, 18.0798, 'Stockholm', 'Strandvägen 17, Östermalm', 'Parkerad i busszon i cirka 10 minuter.', now() - interval '4 days 6 hours'),
    ('QWE518', 'QW***18', 59.3432, 18.0777, 'Stockholm', 'Karlavägen 63, Östermalm', 'Körde upp på gångbanan för avlämning.', now() - interval '3 days 21 hours'),
    ('HJT763', 'HJ***63', 59.3469, 18.0474, 'Stockholm', 'Odengatan 52, Vasastan', 'Stod dubbelparkerad vid hållplats.', now() - interval '3 days 1 hour'),
    ('PLM140', 'PL***40', 59.3338, 18.0329, 'Stockholm', 'Sankt Eriksgatan 31, Kungsholmen', 'Stod i lastzon trots tydlig skyltning.', now() - interval '2 days 14 hours'),
    ('CBV329', 'CB***29', 59.3294, 18.0406, 'Stockholm', 'Hantverkargatan 29, Kungsholmen', 'Tomgång på gångfartsområde.', now() - interval '1 day 23 hours'),
    ('YTR856', 'YT***56', 59.3257, 18.0700, 'Stockholm', 'Västerlånggatan 12, Gamla Stan', 'Felparkerad vid leveranszon.', now() - interval '1 day 8 hours'),
    ('DFA275', 'DF***75', 59.3377, 18.0665, 'Stockholm', 'Birger Jarlsgatan 57, Norrmalm', 'Stannade i cykelbox vid rödljus.', now() - interval '12 hours')
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
  is_public,
  approved,
  source
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
  true,
  true,
  'web'
FROM seed_reports s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reports r
  WHERE r.reg_number = s.reg_number
);
