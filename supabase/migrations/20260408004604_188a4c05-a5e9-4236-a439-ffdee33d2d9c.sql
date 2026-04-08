
CREATE OR REPLACE FUNCTION public.undo_last_call(p_window_id integer)
RETURNS TABLE(restored_ticket text, reverted_ticket text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_serving_id uuid;
  v_current_serving_label text;
  v_last_done_id uuid;
  v_last_done_label text;
BEGIN
  -- Find the currently serving ticket for this window
  SELECT id, ticket_number INTO v_current_serving_id, v_current_serving_label
  FROM tickets
  WHERE window_id = p_window_id AND status = 'serving'
  LIMIT 1;

  -- Put current serving ticket back to waiting
  IF v_current_serving_id IS NOT NULL THEN
    UPDATE tickets SET status = 'waiting', window_id = 0
    WHERE id = v_current_serving_id;
  END IF;

  -- Find the most recently served/skipped ticket for this window (last one changed today)
  SELECT id, ticket_number INTO v_last_done_id, v_last_done_label
  FROM tickets
  WHERE window_id = p_window_id
    AND status IN ('done', 'skipped')
    AND created_at::date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  -- Restore it back to serving
  IF v_last_done_id IS NOT NULL THEN
    UPDATE tickets SET status = 'serving', window_id = p_window_id
    WHERE id = v_last_done_id;
  END IF;

  RETURN QUERY SELECT v_last_done_label, v_current_serving_label;
END;
$$;
