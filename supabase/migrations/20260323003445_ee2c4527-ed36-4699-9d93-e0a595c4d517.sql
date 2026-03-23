
-- Display settings table
CREATE TABLE public.display_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name text NOT NULL DEFAULT 'Government Services Department',
  logo_url text,
  ticker_text text NOT NULL DEFAULT 'Welcome! Please take a ticket at the kiosk. For inquiries, call (02) 8888-1234.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.display_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read display_settings" ON public.display_settings FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update display_settings" ON public.display_settings FOR UPDATE TO public USING (true);

-- Insert default row
INSERT INTO public.display_settings (department_name) VALUES ('Government Services Department');

-- Window labels table
CREATE TABLE public.window_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id integer NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL
);

ALTER TABLE public.window_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read window_labels" ON public.window_labels FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update window_labels" ON public.window_labels FOR UPDATE TO public USING (true);

INSERT INTO public.window_labels (window_id, label, category) VALUES
  (1, 'Window 1', 'WP'),
  (2, 'Window 2', 'BP'),
  (3, 'Window 3', 'SP'),
  (4, 'Window 4', 'ATO');

-- Ads table
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
  file_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ads" ON public.ads FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert ads" ON public.ads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update ads" ON public.ads FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete ads" ON public.ads FOR DELETE TO public USING (true);

-- Storage bucket for display assets
INSERT INTO storage.buckets (id, name, public) VALUES ('display-assets', 'display-assets', true);

CREATE POLICY "Anyone can upload display assets" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'display-assets');
CREATE POLICY "Anyone can read display assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'display-assets');
CREATE POLICY "Anyone can delete display assets" ON storage.objects FOR DELETE TO public USING (bucket_id = 'display-assets');
