CREATE OR REPLACE FUNCTION public.is_guest()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = 'guest@rosie-demo.app'
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_logs','dog_profile','dog_weight_history','lifetime_achievements'] LOOP
    EXECUTE format('CREATE POLICY "Guest cannot insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_guest())', t);
    EXECUTE format('CREATE POLICY "Guest cannot update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_guest())', t);
    EXECUTE format('CREATE POLICY "Guest cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_guest())', t);
  END LOOP;
END $$;