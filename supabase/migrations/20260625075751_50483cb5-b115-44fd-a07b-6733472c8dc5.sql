ALTER TABLE public.dog_profile
  ADD COLUMN IF NOT EXISTS medrone_threshold numeric NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS probiotic_threshold numeric NOT NULL DEFAULT 7;

UPDATE public.dog_profile
  SET medrone_threshold = COALESCE(low_stock_threshold, 7),
      probiotic_threshold = COALESCE(low_stock_threshold, 7)
  WHERE TRUE;