-- 1. is_staff: explicit role check
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'operator'::app_role)
  )
$$;

-- 2. tickets: remove public read (PII) and public insert
DROP POLICY IF EXISTS "Public can read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public can insert tickets" ON public.tickets;

CREATE POLICY "Staff can read tickets"
ON public.tickets FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

REVOKE INSERT ON public.tickets FROM anon, authenticated;

-- Public, PII-free queue view for the kiosk/TV display
CREATE OR REPLACE VIEW public.public_queue
WITH (security_invoker = off) AS
SELECT id, category, number, ticket_number, status, window_id, created_at
FROM public.tickets;

GRANT SELECT ON public.public_queue TO anon, authenticated;
GRANT ALL ON public.public_queue TO service_role;

-- 3. Storage: display-assets writes admin-only, no public listing
DROP POLICY IF EXISTS "Anyone can upload display assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete display assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read display assets" ON storage.objects;

CREATE POLICY "Admins can read display assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'display-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload display assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'display-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update display assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'display-assets' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'display-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete display assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'display-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. SECURITY DEFINER functions: internal auth checks + restricted EXECUTE
CREATE OR REPLACE FUNCTION public.call_next_ticket(p_window_id integer)
RETURNS TABLE(ticket_id uuid, ticket_label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_category TEXT;
  v_ticket_id UUID;
  v_label TEXT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

CREATE OR REPLACE FUNCTION public.done_ticket(p_window_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE tickets SET status = 'done' WHERE window_id = p_window_id AND status = 'serving';
END;
$$;

CREATE OR REPLACE FUNCTION public.skip_ticket(p_window_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE tickets SET status = 'skipped' WHERE window_id = p_window_id AND status = 'serving';
END;
$$;

CREATE OR REPLACE FUNCTION public.recall_ticket(p_window_id integer)
RETURNS TABLE(ticket_id uuid, ticket_label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id, t.ticket_number FROM tickets t
  WHERE t.window_id = p_window_id AND t.status = 'serving' LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_last_call(p_window_id integer)
RETURNS TABLE(restored_ticket text, reverted_ticket text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_serving_id uuid;
  v_current_serving_label text;
  v_current_serving_category text;
  v_last_done_id uuid;
  v_last_done_label text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, ticket_number, category INTO v_current_serving_id, v_current_serving_label, v_current_serving_category
  FROM tickets
  WHERE window_id = p_window_id AND status = 'serving'
  LIMIT 1;

  IF v_current_serving_id IS NOT NULL THEN
    UPDATE tickets SET status = 'waiting' WHERE id = v_current_serving_id;
  END IF;

  SELECT id, ticket_number INTO v_last_done_id, v_last_done_label
  FROM tickets
  WHERE window_id = p_window_id
    AND status IN ('done', 'skipped')
    AND created_at::date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_done_id IS NOT NULL THEN
    UPDATE tickets SET status = 'serving', window_id = p_window_id WHERE id = v_last_done_id;
  END IF;

  RETURN QUERY SELECT v_last_done_label, v_current_serving_label;
END;
$$;

-- Restrict EXECUTE
REVOKE ALL ON FUNCTION public.call_next_ticket(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.done_ticket(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.skip_ticket(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recall_ticket(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_last_call(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_next_ticket(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.done_ticket(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.skip_ticket(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recall_ticket(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_last_call(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Kiosk ticket issuing stays public but is the only insert path
REVOKE ALL ON FUNCTION public.get_next_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_ticket(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_next_ticket(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_ticket(text, text) TO anon, authenticated, service_role;