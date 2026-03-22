
-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('WP', 'BP', 'SP', 'ATO')),
  number INTEGER NOT NULL,
  ticket_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'done', 'skipped')),
  window_id INTEGER NOT NULL CHECK (window_id BETWEEN 1 AND 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create counters table for daily numbering
CREATE TABLE public.counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE CHECK (category IN ('WP', 'BP', 'SP', 'ATO')),
  current_number INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Seed counters
INSERT INTO public.counters (category, current_number) VALUES
  ('WP', 0), ('BP', 0), ('SP', 0), ('ATO', 0);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- Public access policies (public kiosk system)
CREATE POLICY "Anyone can read tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Anyone can read counters" ON public.counters FOR SELECT USING (true);
CREATE POLICY "Anyone can update counters" ON public.counters FOR UPDATE USING (true);

-- Function to get next ticket number (atomic)
CREATE OR REPLACE FUNCTION public.get_next_ticket(p_category TEXT)
RETURNS TABLE(ticket_num INTEGER, ticket_label TEXT, window_num INTEGER)
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
  
  INSERT INTO tickets (category, number, ticket_number, status, window_id)
  VALUES (p_category, v_number, v_label, 'waiting', v_window);
  
  ticket_num := v_number;
  ticket_label := v_label;
  window_num := v_window;
  RETURN NEXT;
END;
$$;

-- Function to call next ticket for a window
CREATE OR REPLACE FUNCTION public.call_next_ticket(p_window_id INTEGER)
RETURNS TABLE(ticket_id UUID, ticket_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_ticket_id UUID;
  v_label TEXT;
BEGIN
  v_category := CASE p_window_id
    WHEN 1 THEN 'WP' WHEN 2 THEN 'BP' WHEN 3 THEN 'SP' WHEN 4 THEN 'ATO'
  END;
  
  UPDATE tickets SET status = 'done' WHERE window_id = p_window_id AND status = 'serving';
  
  SELECT t.id, t.ticket_number INTO v_ticket_id, v_label
  FROM tickets t
  WHERE t.category = v_category AND t.status = 'waiting'
  ORDER BY t.number ASC LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_ticket_id IS NOT NULL THEN
    UPDATE tickets SET status = 'serving' WHERE id = v_ticket_id;
  END IF;
  
  ticket_id := v_ticket_id;
  ticket_label := v_label;
  RETURN NEXT;
END;
$$;

-- Function to recall current ticket
CREATE OR REPLACE FUNCTION public.recall_ticket(p_window_id INTEGER)
RETURNS TABLE(ticket_id UUID, ticket_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.ticket_number FROM tickets t
  WHERE t.window_id = p_window_id AND t.status = 'serving' LIMIT 1;
END;
$$;

-- Function to skip current ticket
CREATE OR REPLACE FUNCTION public.skip_ticket(p_window_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tickets SET status = 'skipped' WHERE window_id = p_window_id AND status = 'serving';
END;
$$;

-- Function to mark current as done
CREATE OR REPLACE FUNCTION public.done_ticket(p_window_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tickets SET status = 'done' WHERE window_id = p_window_id AND status = 'serving';
END;
$$;

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
