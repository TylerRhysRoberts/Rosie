ALTER TABLE public.dog_profile
ADD COLUMN unlocked_milestones text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION public.claim_annual_milestone(_milestone_id text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _milestone_id !~ '^[0-9]{4}_milestone_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid annual milestone ID';
  END IF;

  INSERT INTO public.dog_profile (user_id, unlocked_milestones)
  VALUES (auth.uid(), ARRAY[_milestone_id])
  ON CONFLICT (user_id) DO UPDATE
    SET unlocked_milestones = array_append(
      public.dog_profile.unlocked_milestones,
      _milestone_id
    ),
    updated_at = now()
    WHERE NOT (_milestone_id = ANY(public.dog_profile.unlocked_milestones));

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_annual_milestone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_annual_milestone(text) TO authenticated;