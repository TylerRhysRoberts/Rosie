-- Daily health log table for Rosie Health Hub
CREATE TABLE public.daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 1 AND 3),
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  medications JSONB NOT NULL DEFAULT '{}'::jsonb,
  location TEXT,
  routine_type TEXT CHECK (routine_type IN ('routine','non_routine')),
  walks JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own daily logs"
  ON public.daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create their own daily logs"
  ON public.daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own daily logs"
  ON public.daily_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own daily logs"
  ON public.daily_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_daily_logs_user_date ON public.daily_logs (user_id, log_date DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER daily_logs_touch_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();