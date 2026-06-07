CREATE TABLE public.lifetime_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifetime_achievements TO authenticated;
GRANT ALL ON public.lifetime_achievements TO service_role;

ALTER TABLE public.lifetime_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own achievements" ON public.lifetime_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.lifetime_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own achievements" ON public.lifetime_achievements
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_lifetime_achievements_user ON public.lifetime_achievements(user_id);