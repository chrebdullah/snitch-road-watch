
-- Create app_role enum and user_roles table for admin
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reg_number TEXT NOT NULL,
  masked_reg TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  media_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  device_metadata JSONB
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Public can insert reports
CREATE POLICY "Anyone can submit reports"
ON public.reports FOR INSERT
WITH CHECK (true);

-- Public can only read approved & is_public reports
CREATE POLICY "Public can view approved reports"
ON public.reports FOR SELECT
USING (approved = true AND is_public = true);

-- Admins can do everything
CREATE POLICY "Admins can manage all reports"
ON public.reports FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for report media
INSERT INTO storage.buckets (id, name, public) VALUES ('report-media', 'report-media', false);

CREATE POLICY "Anyone can upload report media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-media');

CREATE POLICY "Admins can view report media"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-media' AND public.has_role(auth.uid(), 'admin'));

-- Seed 115 pre-seeded incidents across Sweden
INSERT INTO public.reports (reg_number, masked_reg, latitude, longitude, city, is_public, approved, created_at)
VALUES
('ABC123','AB***23',59.3293,18.0686,'Stockholm',true,true,now() - interval '2 hours'),
('XYZ789','XY***89',57.7089,11.9746,'Göteborg',true,true,now() - interval '3 hours'),
('DEF456','DE***56',55.6050,13.0038,'Malmö',true,true,now() - interval '4 hours'),
('GHI321','GH***21',59.8586,17.6389,'Uppsala',true,true,now() - interval '5 hours'),
('JKL654','JK***54',58.2853,14.2850,'Linköping',true,true,now() - interval '6 hours'),
('MNO987','MN***87',58.4108,15.6214,'Norrköping',true,true,now() - interval '7 hours'),
('PQR147','PQ***47',57.6348,11.8652,'Mölndal',true,true,now() - interval '8 hours'),
('STU258','ST***58',63.8258,20.2630,'Umeå',true,true,now() - interval '9 hours'),
('VWX369','VW***69',62.3908,17.3069,'Sundsvall',true,true,now() - interval '10 hours'),
('YZA741','YZ***41',60.7302,17.1097,'Gävle',true,true,now() - interval '11 hours'),
('BCD852','BC***52',59.6099,16.5448,'Västerås',true,true,now() - interval '12 hours'),
('EFG963','EF***63',59.3737,16.5099,'Eskilstuna',true,true,now() - interval '13 hours'),
('HIJ174','HI***74',56.8777,14.8091,'Växjö',true,true,now() - interval '14 hours'),
('KLM285','KL***85',56.6745,16.3564,'Kalmar',true,true,now() - interval '15 hours'),
('NOP396','NO***96',57.7826,14.1618,'Jönköping',true,true,now() - interval '16 hours'),
('QRS417','QR***17',59.1282,18.1086,'Nacka',true,true,now() - interval '17 hours'),
('TUV528','TU***28',59.2258,17.8265,'Södertälje',true,true,now() - interval '18 hours'),
('WXY639','WX***39',59.3800,17.9500,'Lidingö',true,true,now() - interval '19 hours'),
('ZAB741','ZA***41',57.7502,12.9350,'Borås',true,true,now() - interval '20 hours'),
('CDE852','CD***52',58.5877,16.1920,'Motala',true,true,now() - interval '21 hours'),
('FGH963','FG***63',59.3700,18.0900,'Solna',true,true,now() - interval '22 hours'),
('IJK174','IJ***74',59.3200,18.1100,'Nacka',true,true,now() - interval '23 hours'),
('LMN285','LM***85',55.5856,13.0034,'Malmö',true,true,now() - interval '24 hours'),
('OPQ396','OP***96',57.7100,12.0000,'Göteborg',true,true,now() - interval '25 hours'),
('RST417','RS***17',59.3500,18.0500,'Stockholm',true,true,now() - interval '26 hours'),
('UVW528','UV***28',60.1282,18.6385,'Norrtälje',true,true,now() - interval '27 hours'),
('XYZ639','XY***39',56.0294,12.6945,'Helsingborg',true,true,now() - interval '28 hours'),
('ABC741','AB***41',55.8740,12.4990,'Landskrona',true,true,now() - interval '29 hours'),
('DEF852','DE***52',58.7877,17.0000,'Nyköping',true,true,now() - interval '30 hours'),
('GHI963','GH***63',59.2282,15.2098,'Örebro',true,true,now() - interval '31 hours'),
('JKL174','JK***74',59.3700,13.5028,'Karlstad',true,true,now() - interval '32 hours'),
('MNO285','MN***85',64.7500,20.9500,'Skellefteå',true,true,now() - interval '33 hours'),
('PQR396','PQ***96',65.5848,22.1547,'Luleå',true,true,now() - interval '34 hours'),
('STU417','ST***17',60.6765,17.1417,'Sandviken',true,true,now() - interval '35 hours'),
('VWX528','VW***28',56.4610,15.8700,'Ronneby',true,true,now() - interval '36 hours'),
('YZA639','YZ***39',56.2612,15.2785,'Karlskrona',true,true,now() - interval '37 hours'),
('BCD741','BC***41',56.1612,14.8500,'Kristianstad',true,true,now() - interval '38 hours'),
('EFG852','EF***52',55.4341,13.8200,'Trelleborg',true,true,now() - interval '39 hours'),
('HIJ963','HI***63',55.3500,13.1600,'Ystad',true,true,now() - interval '40 hours'),
('KLM174','KL***74',56.0339,12.7031,'Höganäs',true,true,now() - interval '41 hours'),
('NOP285','NO***85',58.0200,11.9700,'Kungälv',true,true,now() - interval '42 hours'),
('QRS396','QR***96',57.6700,12.0200,'Kungsbacka',true,true,now() - interval '43 hours'),
('TUV417','TU***17',57.8000,11.8700,'Stenungsund',true,true,now() - interval '44 hours'),
('WXY528','WX***28',58.3500,12.3000,'Trollhättan',true,true,now() - interval '45 hours'),
('ZAB639','ZA***39',58.5348,13.8518,'Skövde',true,true,now() - interval '46 hours'),
('CDE741','CD***41',58.3780,14.2400,'Falköping',true,true,now() - interval '47 hours'),
('FGH852','FG***52',57.3800,15.1500,'Eksjö',true,true,now() - interval '48 hours'),
('IJK963','IJ***63',57.6500,15.8500,'Vetlanda',true,true,now() - interval '49 hours'),
('LMN174','LM***74',57.7700,16.6300,'Västervik',true,true,now() - interval '50 hours'),
('OPQ285','OP***85',58.5800,16.1900,'Motala',true,true,now() - interval '51 hours'),
('RST396','RS***96',58.7500,17.0100,'Nyköping',true,true,now() - interval '52 hours'),
('UVW417','UV***17',59.5100,17.9600,'Märsta',true,true,now() - interval '53 hours'),
('XYZ528','XY***28',59.0300,17.7400,'Södertälje',true,true,now() - interval '54 hours'),
('ABC639','AB***39',60.3600,18.7200,'Tierp',true,true,now() - interval '55 hours'),
('DEF741','DE***41',61.0100,16.7000,'Falun',true,true,now() - interval '56 hours'),
('GHI852','GH***52',60.4854,15.4326,'Borlänge',true,true,now() - interval '57 hours'),
('JKL963','JK***63',60.7200,15.1500,'Ludvika',true,true,now() - interval '58 hours'),
('MNO174','MN***74',61.2900,16.1500,'Söderhamn',true,true,now() - interval '59 hours'),
('PQR285','PQ***85',61.7300,17.1000,'Hudiksvall',true,true,now() - interval '60 hours'),
('STU396','ST***96',62.6400,17.3100,'Härnösand',true,true,now() - interval '61 hours'),
('VWX417','VW***17',63.2900,14.5100,'Östersund',true,true,now() - interval '62 hours'),
('YZA528','YZ***28',63.8258,20.2630,'Umeå',true,true,now() - interval '63 hours'),
('BCD639','BC***39',64.3500,20.5200,'Lycksele',true,true,now() - interval '64 hours'),
('EFG741','EF***41',65.3200,21.4900,'Piteå',true,true,now() - interval '65 hours'),
('HIJ852','HI***52',67.8500,20.2200,'Kiruna',true,true,now() - interval '66 hours'),
('KLM963','KL***63',66.8300,20.6600,'Gällivare',true,true,now() - interval '67 hours'),
('NOP174','NO***74',65.8400,21.6900,'Boden',true,true,now() - interval '68 hours'),
('QRS285','QR***85',63.1700,18.7000,'Kramfors',true,true,now() - interval '69 hours'),
('TUV396','TU***96',62.3900,17.3100,'Sundsvall',true,true,now() - interval '70 hours'),
('WXY417','WX***17',60.5000,15.5000,'Borlänge',true,true,now() - interval '71 hours'),
('ZAB528','ZA***28',59.7500,18.7000,'Norrtälje',true,true,now() - interval '72 hours'),
('CDE639','CD***39',59.4000,13.5000,'Karlstad',true,true,now() - interval '73 hours'),
('FGH741','FG***41',58.4000,12.3000,'Trollhättan',true,true,now() - interval '74 hours'),
('IJK852','IJ***52',57.7000,11.9500,'Göteborg',true,true,now() - interval '75 hours'),
('LMN963','LM***63',56.8700,14.8100,'Växjö',true,true,now() - interval '76 hours'),
('OPQ174','OP***74',56.6700,16.3600,'Kalmar',true,true,now() - interval '77 hours'),
('RST285','RS***85',55.6100,13.0100,'Malmö',true,true,now() - interval '78 hours'),
('UVW396','UV***96',59.3300,18.0700,'Stockholm',true,true,now() - interval '79 hours'),
('XYZ417','XY***17',57.7100,12.0000,'Göteborg',true,true,now() - interval '80 hours'),
('ABC528','AB***28',55.5900,13.0200,'Malmö',true,true,now() - interval '81 hours'),
('DEF639','DE***39',59.8600,17.6400,'Uppsala',true,true,now() - interval '82 hours'),
('GHI741','GH***41',58.2900,14.2900,'Linköping',true,true,now() - interval '83 hours'),
('JKL852','JK***52',57.6500,12.0800,'Göteborg',true,true,now() - interval '84 hours'),
('MNO963','MN***63',59.3500,16.5100,'Eskilstuna',true,true,now() - interval '85 hours'),
('PQR174','PQ***74',59.6100,16.5500,'Västerås',true,true,now() - interval '86 hours'),
('STU285','ST***85',58.4100,15.6200,'Norrköping',true,true,now() - interval '87 hours'),
('VWX396','VW***96',59.2300,15.2100,'Örebro',true,true,now() - interval '88 hours'),
('YZA417','YZ***17',59.3800,17.9600,'Lidingö',true,true,now() - interval '89 hours'),
('BCD528','BC***28',59.1300,18.1100,'Nacka',true,true,now() - interval '90 hours'),
('EFG639','EF***39',59.2300,17.8300,'Södertälje',true,true,now() - interval '91 hours'),
('HIJ741','HI***41',60.1300,18.6400,'Norrtälje',true,true,now() - interval '92 hours'),
('KLM852','KL***52',56.0300,12.7000,'Helsingborg',true,true,now() - interval '93 hours'),
('NOP963','NO***63',55.8700,12.5000,'Landskrona',true,true,now() - interval '94 hours'),
('QRS174','QR***74',55.4300,13.8300,'Trelleborg',true,true,now() - interval '95 hours'),
('TUV285','TU***85',55.3600,13.1700,'Ystad',true,true,now() - interval '96 hours'),
('WXY396','WX***96',56.1600,14.8600,'Kristianstad',true,true,now() - interval '97 hours'),
('ZAB417','ZA***17',56.2600,15.2800,'Karlskrona',true,true,now() - interval '98 hours'),
('CDE528','CD***28',56.4600,15.8800,'Ronneby',true,true,now() - interval '99 hours'),
('FGH639','FG***39',57.3900,15.1600,'Eksjö',true,true,now() - interval '100 hours'),
('IJK741','IJ***41',57.6600,15.8600,'Vetlanda',true,true,now() - interval '101 hours'),
('LMN852','LM***52',57.7800,16.6400,'Västervik',true,true,now() - interval '102 hours'),
('OPQ963','OP***63',58.3800,14.2500,'Falköping',true,true,now() - interval '103 hours'),
('RST174','RS***74',58.5400,13.8600,'Skövde',true,true,now() - interval '104 hours'),
('UVW285','UV***85',58.0300,11.9800,'Kungälv',true,true,now() - interval '105 hours'),
('XYZ396','XY***96',57.6800,12.0300,'Kungsbacka',true,true,now() - interval '106 hours'),
('ABC417','AB***17',57.8100,11.8800,'Stenungsund',true,true,now() - interval '107 hours'),
('DEF528','DE***28',64.7600,20.9600,'Skellefteå',true,true,now() - interval '108 hours'),
('GHI639','GH***39',65.5900,22.1600,'Luleå',true,true,now() - interval '109 hours'),
('JKL741','JK***41',65.3300,21.5000,'Piteå',true,true,now() - interval '110 hours'),
('MNO852','MN***52',67.8600,20.2300,'Kiruna',true,true,now() - interval '111 hours'),
('PQR963','PQ***63',66.8400,20.6700,'Gällivare',true,true,now() - interval '112 hours'),
('STU174','ST***74',65.8500,21.7000,'Boden',true,true,now() - interval '113 hours'),
('VWX285','VW***85',63.2900,14.5200,'Östersund',true,true,now() - interval '114 hours'),
('YZA396','YZ***96',61.0200,16.7100,'Falun',true,true,now() - interval '115 hours');
