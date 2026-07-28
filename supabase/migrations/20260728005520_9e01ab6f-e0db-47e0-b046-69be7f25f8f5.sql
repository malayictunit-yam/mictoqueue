DROP VIEW IF EXISTS public.public_queue;

DROP POLICY IF EXISTS "Staff can read tickets" ON public.tickets;

CREATE POLICY "Public can read queue tickets"
ON public.tickets FOR SELECT
TO anon, authenticated
USING (true);

REVOKE SELECT ON public.tickets FROM anon, authenticated;
GRANT SELECT (id, category, number, ticket_number, status, window_id, created_at) ON public.tickets TO anon;
GRANT SELECT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;