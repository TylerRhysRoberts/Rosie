-- Dog profile (long-term admin/clinical metadata)
CREATE TABLE public.dog_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  microchip_number TEXT NOT NULL DEFAULT '',
  insurance_provider TEXT NOT NULL DEFAULT '',
  insurance_policy_number TEXT NOT NULL DEFAULT '',
  insurance_renewal_date DATE,
  emergency_vet_phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_profile TO authenticated;
GRANT ALL ON public.dog_profile TO service_role;

ALTER TABLE public.dog_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dog profile" ON public.dog_profile
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own dog profile" ON public.dog_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dog profile" ON public.dog_profile
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own dog profile" ON public.dog_profile
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER touch_dog_profile_updated_at
  BEFORE UPDATE ON public.dog_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Weight history
CREATE TABLE public.dog_weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  is_vet_visit BOOLEAN NOT NULL DEFAULT false,
  visit_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_weight_history TO authenticated;
GRANT ALL ON public.dog_weight_history TO service_role;

ALTER TABLE public.dog_weight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own weight" ON public.dog_weight_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own weight" ON public.dog_weight_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own weight" ON public.dog_weight_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own weight" ON public.dog_weight_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER touch_dog_weight_history_updated_at
  BEFORE UPDATE ON public.dog_weight_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_dog_weight_history_user_date
  ON public.dog_weight_history(user_id, logged_date DESC);