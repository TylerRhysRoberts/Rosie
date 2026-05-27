ALTER TABLE public.daily_logs
  ALTER COLUMN stool_consistency DROP DEFAULT,
  ALTER COLUMN stool_consistency TYPE text[] USING (
    CASE
      WHEN stool_consistency IS NULL OR stool_consistency = '' THEN ARRAY[]::text[]
      ELSE ARRAY[stool_consistency]
    END
  ),
  ALTER COLUMN stool_consistency SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN stool_consistency SET NOT NULL;