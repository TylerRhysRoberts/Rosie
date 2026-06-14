ALTER TABLE public.dog_profile
  ADD COLUMN medrone_stock numeric NOT NULL DEFAULT 0.0,
  ADD COLUMN probiotic_stock numeric NOT NULL DEFAULT 0.0,
  ADD COLUMN low_stock_threshold numeric NOT NULL DEFAULT 7.0;

COMMENT ON COLUMN public.dog_profile.medrone_stock IS 'Current Medrone tablet stock; supports fractional tablet quantities.';
COMMENT ON COLUMN public.dog_profile.probiotic_stock IS 'Current probiotic tablet stock.';
COMMENT ON COLUMN public.dog_profile.low_stock_threshold IS 'Baseline stock level at or below which a low-stock warning may be shown.';