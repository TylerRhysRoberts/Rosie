import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  InventoryProfile,
  getStockStatus,
} from "@/lib/inventory";

const numField = z.number().finite().min(0).max(100000);
const inventorySchema = z.object({
  medrone_stock: numField,
  probiotic_stock: numField,
  low_stock_threshold: numField,
  medrone_threshold: numField,
  probiotic_threshold: numField,
});

interface Props {
  userId: string;
  inventory: InventoryProfile;
  onChange: (next: InventoryProfile) => void;
}

export function InventoryConfig({ userId, inventory, onChange }: Props) {
  const [saving, setSaving] = useState(false);

  const save = async (next: InventoryProfile) => {
    const parsed = inventorySchema.safeParse(next);
    if (!parsed.success) {
      toast.error("Enter a valid stock level", {
        description: "Stock values must be between 0 and 100,000.",
      });
      return;
    }
    onChange(next);
    setSaving(true);
    const { error } = await supabase
      .from("dog_profile")
      .upsert(
        [{ user_id: userId, ...next } as never],
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error("Save failed", { description: error.message });
  };

  return (
    <div className="space-y-4">
      <InventoryField
        label="Medrone"
        value={inventory.medrone_stock}
        step={0.5}
        threshold={inventory.medrone_threshold}
        onLocalChange={(v) => onChange({ ...inventory, medrone_stock: v })}
        onCommit={(v) => save({ ...inventory, medrone_stock: v })}
        onThresholdLocalChange={(v) => onChange({ ...inventory, medrone_threshold: v })}
        onThresholdCommit={(v) => save({ ...inventory, medrone_threshold: v })}
      />
      <InventoryField
        label="Probiotic"
        value={inventory.probiotic_stock}
        step={1}
        threshold={inventory.probiotic_threshold}
        onLocalChange={(v) => onChange({ ...inventory, probiotic_stock: v })}
        onCommit={(v) => save({ ...inventory, probiotic_stock: v })}
        onThresholdLocalChange={(v) => onChange({ ...inventory, probiotic_threshold: v })}
        onThresholdCommit={(v) => save({ ...inventory, probiotic_threshold: v })}
      />
      {saving && (
        <p className="text-[10px] text-muted-foreground">Saving…</p>
      )}
    </div>
  );
}

function InventoryField({
  label, value, step, threshold, onLocalChange, onCommit, onThresholdLocalChange, onThresholdCommit,
}: {
  label: string;
  value: number;
  step: number;
  threshold: number;
  onLocalChange: (v: number) => void;
  onCommit: (v: number) => void;
  onThresholdLocalChange: (v: number) => void;
  onThresholdCommit: (v: number) => void;
}) {
  const status = getStockStatus(value, threshold);
  const statusClass = status === "In Stock"
    ? "border-border bg-muted text-foreground"
    : status === "Low Stock"
      ? "border-warning/40 bg-warning/15 text-warning"
      : "border-destructive/40 bg-destructive/15 text-destructive";
  const id = `inventory-${label.toLowerCase()}`;
  const thresholdId = `${id}-threshold`;
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
        <Badge variant="outline" className={statusClass}>{status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={id} className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">In stock</label>
          <InventoryNumberInput
            id={id}
            value={value}
            step={step}
            ariaLabel={`${label} stock in tablets`}
            onLocalChange={onLocalChange}
            onCommit={onCommit}
          />
        </div>
        <div>
          <label htmlFor={thresholdId} className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Low alert at</label>
          <InventoryNumberInput
            id={thresholdId}
            value={threshold}
            step={1}
            ariaLabel={`${label} low stock threshold in tablets`}
            onLocalChange={onThresholdLocalChange}
            onCommit={onThresholdCommit}
          />
        </div>
      </div>
    </div>
  );
}

function InventoryNumberInput({
  id, value, step, ariaLabel, onLocalChange, onCommit,
}: {
  id?: string;
  value: number;
  step: number;
  ariaLabel: string;
  onLocalChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        max="100000"
        step={step}
        value={draft}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          setDraft(raw);
          if (raw === "") return;
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) onLocalChange(parsed);
        }}
        onBlur={() => {
          const parsed = draft === "" ? 0 : Number(draft);
          const nextValue = Number.isFinite(parsed) ? parsed : value;
          setDraft(String(nextValue));
          onCommit(nextValue);
        }}
        aria-label={ariaLabel}
        className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 pr-20 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        tablets
      </span>
    </div>
  );
}