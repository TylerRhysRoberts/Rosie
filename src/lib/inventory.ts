import { supabase } from "@/integrations/supabase/client";
import type { DailyLog } from "@/lib/daily-logs";

export interface InventoryProfile {
  medrone_stock: number;
  probiotic_stock: number;
  low_stock_threshold: number;
  medrone_threshold: number;
  probiotic_threshold: number;
}

export const EMPTY_INVENTORY: InventoryProfile = {
  medrone_stock: 0,
  probiotic_stock: 0,
  low_stock_threshold: 7,
  medrone_threshold: 7,
  probiotic_threshold: 7,
};

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export function getStockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return "Out of Stock";
  if (stock <= threshold) return "Low Stock";
  return "In Stock";
}

export function isInventoryLow(inv: InventoryProfile): boolean {
  return (
    inv.medrone_stock <= inv.medrone_threshold ||
    inv.probiotic_stock <= inv.probiotic_threshold
  );
}

export async function fetchInventory(userId: string): Promise<InventoryProfile> {
  const { data, error } = await supabase
    .from("dog_profile")
    .select("medrone_stock, probiotic_stock, low_stock_threshold, medrone_threshold, probiotic_threshold")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_INVENTORY };
  const fallback = Number((data as Record<string, unknown>).low_stock_threshold ?? 7);
  return {
    medrone_stock: Number(data.medrone_stock ?? 0),
    probiotic_stock: Number(data.probiotic_stock ?? 0),
    low_stock_threshold: fallback,
    medrone_threshold: Number((data as Record<string, unknown>).medrone_threshold ?? fallback),
    probiotic_threshold: Number((data as Record<string, unknown>).probiotic_threshold ?? fallback),
  };
}

function dosageTablets(dosage: string): number {
  if (dosage === "whole") return 1;
  if (dosage === "half") return 0.5;
  if (dosage === "third") return 1 / 3;
  if (dosage === "quarter") return 0.25;
  if (dosage === "eighth") return 0.125;
  return 0;
}

/**
 * Average daily tablet use for the named medication across the
 * most recent `lookbackDays` log entries (counts ONLY days actually logged).
 */
export function averageDailyTablets(
  logs: DailyLog[],
  medicationName: string,
  lookbackDays = 30,
): number {
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date));
  const slice = sorted.slice(0, lookbackDays);
  if (slice.length === 0) return 0;
  let total = 0;
  for (const log of slice) {
    const med = log.medications?.[medicationName];
    if (med?.taken) total += dosageTablets(med.dosage);
  }
  return total / slice.length;
}