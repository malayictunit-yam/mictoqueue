ALTER TABLE public.window_labels ADD COLUMN IF NOT EXISTS sub_label text NOT NULL DEFAULT '';

UPDATE public.window_labels SET sub_label = CASE category
  WHEN 'WP' THEN 'Employment & work authorization'
  WHEN 'BP' THEN 'Business registration & licensing'
  WHEN 'SP' THEN 'Special permits & exemptions'
  WHEN 'ATO' THEN 'Operational authority & compliance'
  ELSE ''
END WHERE sub_label = '';