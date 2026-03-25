
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create user_roles table (roles in separate table per security requirements)
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is staff (admin or operator)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- 4. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Add client_name to tickets
ALTER TABLE public.tickets ADD COLUMN client_name text NOT NULL DEFAULT '';

-- 6. Profiles RLS
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 7. User roles RLS
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 8. Update tickets RLS: drop old open policies, add proper ones
DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON public.tickets;

CREATE POLICY "Public can insert tickets" ON public.tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read tickets" ON public.tickets
  FOR SELECT USING (true);

CREATE POLICY "Staff can update tickets" ON public.tickets
  FOR UPDATE USING (public.is_staff(auth.uid()));

-- 9. Update ads RLS: tighten to admin-only write, public read active
DROP POLICY IF EXISTS "Anyone can delete ads" ON public.ads;
DROP POLICY IF EXISTS "Anyone can insert ads" ON public.ads;
DROP POLICY IF EXISTS "Anyone can read ads" ON public.ads;
DROP POLICY IF EXISTS "Anyone can update ads" ON public.ads;

CREATE POLICY "Public can read active ads" ON public.ads
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage ads" ON public.ads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 10. Update display_settings RLS
DROP POLICY IF EXISTS "Anyone can read display_settings" ON public.display_settings;
DROP POLICY IF EXISTS "Anyone can update display_settings" ON public.display_settings;

CREATE POLICY "Public can read display_settings" ON public.display_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin can update display_settings" ON public.display_settings
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 11. Update window_labels RLS
DROP POLICY IF EXISTS "Anyone can read window_labels" ON public.window_labels;
DROP POLICY IF EXISTS "Anyone can update window_labels" ON public.window_labels;

CREATE POLICY "Public can read window_labels" ON public.window_labels
  FOR SELECT USING (true);

CREATE POLICY "Admin can update window_labels" ON public.window_labels
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 12. Update counters RLS
DROP POLICY IF EXISTS "Anyone can read counters" ON public.counters;
DROP POLICY IF EXISTS "Anyone can update counters" ON public.counters;

CREATE POLICY "Public can read counters" ON public.counters
  FOR SELECT USING (true);

CREATE POLICY "Admin can update counters" ON public.counters
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 13. Update get_next_ticket function to accept client name
CREATE OR REPLACE FUNCTION public.get_next_ticket(p_category text, p_client_name text DEFAULT '')
RETURNS TABLE(ticket_num integer, ticket_label text, window_num integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number INTEGER;
  v_window INTEGER;
  v_label TEXT;
BEGIN
  UPDATE counters SET current_number = 0, last_reset_date = CURRENT_DATE 
  WHERE category = p_category AND last_reset_date < CURRENT_DATE;
  
  UPDATE counters SET current_number = current_number + 1 
  WHERE category = p_category 
  RETURNING current_number INTO v_number;
  
  v_window := CASE p_category
    WHEN 'WP' THEN 1 WHEN 'BP' THEN 2 WHEN 'SP' THEN 3 WHEN 'ATO' THEN 4
  END;
  
  v_label := p_category || '-' || LPAD(v_number::TEXT, 3, '0');
  
  INSERT INTO tickets (category, number, ticket_number, status, window_id, client_name)
  VALUES (p_category, v_number, v_label, 'waiting', v_window, COALESCE(p_client_name, ''));
  
  ticket_num := v_number;
  ticket_label := v_label;
  window_num := v_window;
  RETURN NEXT;
END;
$$;
