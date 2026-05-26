ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS flare_up boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stool_consistency text,
  ADD COLUMN IF NOT EXISTS dins_percent integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS treats jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scavenged jsonb NOT NULL DEFAULT '[]'::jsonb;