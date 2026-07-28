CREATE OR REPLACE FUNCTION public.reset_queues(p_category text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM tickets
  WHERE status IN ('waiting', 'serving')
    AND (p_category IS NULL OR category = p_category);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE counters
  SET current_number = 0, last_reset_date = CURRENT_DATE
  WHERE p_category IS NULL OR category = p_category;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_queues(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_queues(text) TO authenticated;