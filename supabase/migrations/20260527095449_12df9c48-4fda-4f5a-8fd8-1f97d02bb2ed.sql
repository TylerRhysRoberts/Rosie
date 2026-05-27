ALTER TABLE public.daily_logs
ADD COLUMN IF NOT EXISTS flare_event jsonb NOT NULL DEFAULT '{}'::jsonb;