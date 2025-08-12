DROP FUNCTION IF EXISTS public.next_mcq(text, uuid, text, integer, integer);
CREATE OR REPLACE FUNCTION public.next_mcq(
  p_difficulty text,
  p_user_id uuid,
  p_topic text DEFAULT NULL,
  p_exclude_recent integer DEFAULT 10,
  p_recent_days integer DEFAULT 7
)
RETURNS public.mcqs
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
  v_mcq public.mcqs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_mcq
  FROM public.mcqs m
  WHERE m.difficulty = p_difficulty
    AND (p_topic IS NULL OR m.topic = p_topic)
    AND m.id NOT IN (
      SELECT ua.mcq_id
      FROM public.user_answers ua
      WHERE ua.user_id = p_user_id
      ORDER BY ua.answered_at DESC
      LIMIT p_exclude_recent
    )
    AND m.id NOT IN (
      SELECT ua2.mcq_id
      FROM public.user_answers ua2
      WHERE ua2.user_id = p_user_id
        AND ua2.answered_at > now() - (p_recent_days || ' days')::interval
    )
  ORDER BY m.last_served_at ASC NULLS FIRST, m.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_mcq.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.mcqs
  SET last_served_at = now()
  WHERE id = v_mcq.id
  RETURNING * INTO v_mcq;

  RETURN v_mcq;
END;
;
