import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import rosieLogo from "@/assets/rosie-icon.png";
import {
  Copy, Phone, ChevronDown, ChevronUp, Check, Trash2, Stethoscope,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea,
} from "recharts";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Profile" },
      { name: "description", content: "Rosie's profile, weight history, and key clinical details." },
    ],
  }),
});

// DOB fixed for Rosie
const DOB = new Date(2021, 0, 31); // 31 Jan 2021

interface DogProfile {
  microchip_number: string;
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_renewal_date: string | null;
  emergency_vet_phone: string;
}

const EMPTY_PROFILE: DogProfile = {
  microchip_number: "",
  insurance_provider: "",
  insurance_policy_number: "",
  insurance_renewal_date: null,
  emergency_vet_phone: "",
};

interface WeightEntry {
  id: string;
  logged_date: string;
  weight_kg: number;
  is_vet_visit: boolean;
  visit_notes: string;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatAge(dob: Date): string {
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return `${years} ${years === 1 ? "year" : "years"} and ${months} ${months === 1 ? "month" : "months"}`;
}

function ProfilePage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<DogProfile>(EMPTY_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [newVetVisit, setNewVetVisit] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartView, setChartView] = useState<"12m" | "all">("12m");

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    Promise.all([
      supabase.from("dog_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("dog_weight_history").select("*").eq("user_id", user.id).order("logged_date", { ascending: true }),
    ])
      .then(([p, w]) => {
        if (p.data) {
          setProfile({
            microchip_number: p.data.microchip_number ?? "",
            insurance_provider: p.data.insurance_provider ?? "",
            insurance_policy_number: p.data.insurance_policy_number ?? "",
            insurance_renewal_date: p.data.insurance_renewal_date,
            emergency_vet_phone: p.data.emergency_vet_phone ?? "",
          });
        }
        if (w.data) {
          setWeights(w.data.map((r: any) => ({
            id: r.id,
            logged_date: r.logged_date,
            weight_kg: Number(r.weight_kg),
            is_vet_visit: !!r.is_vet_visit,
            visit_notes: r.visit_notes ?? "",
          })));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  const age = useMemo(() => formatAge(DOB), []);
  const latestWeight = weights.length ? weights[weights.length - 1] : null;

  const copy = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const saveProfile = async (next: DogProfile) => {
    if (!user) return;
    setProfile(next);
    setProfileSaving(true);
    const { error } = await supabase
      .from("dog_profile")
      .upsert([{ user_id: user.id, ...next }], { onConflict: "user_id" });
    setProfileSaving(false);
    if (error) toast.error("Save failed", { description: error.message });
  };

  const updateProfile = <K extends keyof DogProfile>(key: K, value: DogProfile[K]) => {
    saveProfile({ ...profile, [key]: value });
  };

  const addWeight = async () => {
    if (!user) return;
    const kg = Number(newWeight);
    if (!Number.isFinite(kg) || kg <= 0) {
      toast.error("Enter a valid weight in kg");
      return;
    }
    setSavingWeight(true);
    const { data, error } = await supabase
      .from("dog_weight_history")
      .insert([{
        user_id: user.id,
        logged_date: newDate,
        weight_kg: kg,
        is_vet_visit: newVetVisit,
        visit_notes: newNote.trim(),
      }])
      .select()
      .single();
    setSavingWeight(false);
    if (error || !data) {
      toast.error("Save failed", { description: error?.message });
      return;
    }
    const entry: WeightEntry = {
      id: data.id,
      logged_date: data.logged_date,
      weight_kg: Number(data.weight_kg),
      is_vet_visit: !!data.is_vet_visit,
      visit_notes: data.visit_notes ?? "",
    };
    setWeights((prev) => [...prev, entry].sort((a, b) => a.logged_date.localeCompare(b.logged_date)));
    setNewWeight("");
    setNewNote("");
    setNewVetVisit(false);
    setNewDate(todayISO());
    toast.success("Weight logged");
  };

  const removeWeight = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("dog_weight_history").delete().eq("id", id);
    if (error) { toast.error("Delete failed", { description: error.message }); return; }
    setWeights((prev) => prev.filter((w) => w.id !== id));
  };

  // ── Chart data ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (weights.length === 0) return [] as Array<{ label: string; weight: number }>;
    if (chartView === "12m") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 11);
      cutoff.setDate(1);
      const buckets: Record<string, number[]> = {};
      for (const w of weights) {
        const [y, m] = w.logged_date.split("-").map(Number);
        const d = new Date(y, m - 1, 1);
        if (d < cutoff) continue;
        const key = `${y}-${String(m).padStart(2, "0")}`;
        (buckets[key] ||= []).push(w.weight_kg);
      }
      // Build 12 ordered months from cutoff
      const out: Array<{ label: string; weight: number | null }> = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(cutoff.getFullYear(), cutoff.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const arr = buckets[key];
        const label = d.toLocaleDateString("en-GB", { month: "short" });
        out.push({
          label,
          weight: arr && arr.length
            ? Number((arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(2))
            : null,
        });
      }
      // Filter out leading/trailing nulls? Keep nulls so X-axis stays anchored.
      return out.filter((p) => p.weight != null) as Array<{ label: string; weight: number }>;
    }
    // All time → quarter buckets
    const buckets: Record<string, number[]> = {};
    for (const w of weights) {
      const [y, m] = w.logged_date.split("-").map(Number);
      const q = Math.floor((m - 1) / 3) + 1;
      const key = `${y} Q${q}`;
      (buckets[key] ||= []).push(w.weight_kg);
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, arr]) => ({
        label,
        weight: Number((arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(2)),
      }));
  }, [weights, chartView]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
        {/* Header — text left, larger avatar right */}
        <div className="flex items-start justify-between gap-4 animate-fade-up-blur">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Profile
            </p>
            <h1 className="text-3xl font-semibold text-foreground mt-1 tracking-tight">
              Rosie
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Cavapoochon</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Born 31/01/2021
            </p>
            <p className="text-sm font-medium text-foreground mt-1">{age}</p>
          </div>
          <img
            src={rosieLogo}
            alt="Rosie"
            className="h-20 w-20 rounded-full object-cover shadow-sm shrink-0"
          />
        </div>

        <div className="mt-6 space-y-4">
          {/* Microchip */}
          <Card>
            <CardHeader label="Microchip" />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={profile.microchip_number}
                onChange={(e) => setProfile({ ...profile, microchip_number: e.target.value })}
                onBlur={() => saveProfile(profile)}
                maxLength={32}
                placeholder="e.g. 985112004123456"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <CopyBtn
                onClick={() => copy("Microchip number", profile.microchip_number)}
              />
            </div>
          </Card>

          {/* Insurance */}
          <Card>
            <CardHeader label="Insurance" />
            <div className="space-y-3">
              <Field label="Provider">
                <input
                  type="text"
                  value={profile.insurance_provider}
                  onChange={(e) => setProfile({ ...profile, insurance_provider: e.target.value })}
                  onBlur={() => saveProfile(profile)}
                  maxLength={120}
                  placeholder="e.g. Petplan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
              <Field label="Policy number">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.insurance_policy_number}
                    onChange={(e) => setProfile({ ...profile, insurance_policy_number: e.target.value })}
                    onBlur={() => saveProfile(profile)}
                    maxLength={64}
                    placeholder="Policy #"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <CopyBtn
                    onClick={() => copy("Policy number", profile.insurance_policy_number)}
                  />
                </div>
              </Field>
              <Field label="Renewal date">
                <input
                  type="date"
                  value={profile.insurance_renewal_date ?? ""}
                  onChange={(e) => updateProfile("insurance_renewal_date", e.target.value || null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
              <Field label="Emergency vet phone">
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={profile.emergency_vet_phone}
                    onChange={(e) => setProfile({ ...profile, emergency_vet_phone: e.target.value })}
                    onBlur={() => saveProfile(profile)}
                    maxLength={32}
                    placeholder="e.g. +44 20 7123 4567"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <a
                    href={profile.emergency_vet_phone ? `tel:${profile.emergency_vet_phone.replace(/\s+/g, "")}` : undefined}
                    aria-disabled={!profile.emergency_vet_phone}
                    className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border border-border bg-muted text-foreground active:scale-95 ${
                      profile.emergency_vet_phone ? "hover:border-primary/40" : "opacity-40 pointer-events-none"
                    }`}
                    aria-label="Call emergency vet"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </Field>
            </div>
            {profileSaving && (
              <p className="text-[10px] text-muted-foreground mt-2">Saving…</p>
            )}
          </Card>

          {/* Weight */}
          <Card>
            <CardHeader label="Weight" />
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-semibold text-foreground tabular-nums">
                  {latestWeight ? latestWeight.weight_kg.toFixed(2) : "—"}
                </span>
                <span className="text-sm text-muted-foreground ml-1">kg</span>
                {latestWeight && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Logged {latestWeight.logged_date}
                    {latestWeight.is_vet_visit && " · vet visit"}
                  </p>
                )}
              </div>
              <button
                onClick={() => setChartOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {chartOpen ? "Hide history" : "Show history"}
                {chartOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {chartOpen && (
              <div className="mt-4 animate-fade-up-blur">
                <div className="flex gap-2 bg-muted rounded-full p-1 mb-3">
                  {(["12m", "all"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-full transition-colors ${
                        chartView === v
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {v === "12m" ? "Last 12 Months" : "All Time"}
                    </button>
                  ))}
                </div>
                {chartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    Not enough data yet for this view.
                  </p>
                ) : (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 80)" />
                        <ReferenceArea
                          y1={8.5}
                          y2={10}
                          fill="rgba(34, 197, 94, 0.12)"
                          stroke="none"
                          ifOverflow="extendDomain"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "oklch(0.55 0.02 80)" }}
                          interval="preserveStartEnd"
                          minTickGap={20}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tick={{ fontSize: 10, fill: "oklch(0.55 0.02 80)" }}
                          width={32}
                          tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(v: any) => [`${v} kg`, "Weight"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="oklch(0.55 0.18 340)"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Shaded green band = healthy zone (8.5–10.0 kg)
                </p>
              </div>
            )}

            {/* New entry form */}
            <div className="mt-5 pt-4 border-t border-border space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Log new weight
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Weight (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="9.55"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    max={todayISO()}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newVetVisit}
                  onChange={(e) => setNewVetVisit(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground inline-flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" /> Was this a vet visit?
                </span>
              </label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                maxLength={200}
                placeholder="Optional note (e.g. Annual boosters)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={addWeight}
                disabled={savingWeight || !newWeight}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.99] disabled:opacity-50"
              >
                {savingWeight ? "Saving…" : "Add weight entry"}
              </button>
            </div>

            {weights.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Recent entries
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border bg-muted/30">
                  {[...weights].reverse().slice(0, 6).map((w) => (
                    <li key={w.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-mono tabular-nums text-foreground w-14">{w.weight_kg.toFixed(2)}kg</span>
                      <span className="text-muted-foreground text-xs">{w.logged_date}</span>
                      {w.is_vet_visit && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[oklch(0.93_0.07_145)] text-[oklch(0.4_0.12_145)] font-semibold">
                          <Check className="w-3 h-3" /> Vet
                        </span>
                      )}
                      {w.visit_notes && (
                        <span className="text-xs text-muted-foreground truncate flex-1">{w.visit_notes}</span>
                      )}
                      <button
                        onClick={() => removeWeight(w.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive p-1 rounded"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 animate-fade-up-blur">
      {children}
    </div>
  );
}

function CardHeader({ label }: { label: string }) {
  return (
    <h2 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">
      {label}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 active:scale-95"
      aria-label="Copy to clipboard"
    >
      <Copy className="w-4 h-4" />
    </button>
  );
}