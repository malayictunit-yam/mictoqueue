ALTER TABLE public.ads DROP CONSTRAINT ads_type_check;
ALTER TABLE public.ads ADD CONSTRAINT ads_type_check CHECK (type IN ('image', 'video', 'website'));