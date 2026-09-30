import { createServerFn } from "@tanstack/react-start";

export const GUEST_EMAIL = "guest@rosie-demo.app";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildDemoLogs(userId: string) {
  const treats = ["Cheese", "Crompch", "Yak Chews"];
  const locations = ["Home", "Home", "Home", "Home", "Carol's", "Jenna's"];
  const rows = [];
  const today = new Date();
  for (let i = 1; i <= 95; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const r = (n: number) => Math.abs(Math.sin(i * 12.9898 + n) * 43758.5453) % 1;
    const flare = r(1) < 0.08;
    const score = flare ? 1 : r(2) < 0.2 ? 2 : 3;
    const halfMedrone = i % 3 === 0;
    rows.push({
      user_id: userId,
      log_date: dateKey(d),
      health_score: score,
      flare_up: flare,
      flare_event: {
        had_flareup: flare,
        start_time: flare ? "14:00" : null,
        end_time: flare ? "16:30" : null,
        symptoms: flare ? ["Squelching", "Lethargy"] : [],
        intervention_med: flare ? "Buscopan" : null,
      },
      stool_consistency: [score === 3 ? "formed" : score === 2 ? "soft" : "liquid"],
      symptoms: score === 3 ? ["No Issues"] : ["Squelching"],
      medications: {
        Medrone: { taken: true, dosage: halfMedrone ? "half" : "whole" },
        Probiotic: { taken: true, dosage: "whole" },
        ...(flare ? { Buscopan: { taken: true, dosage: "whole", is_rescue: true } } : {}),
      },
      location: locations[Math.floor(r(3) * locations.length)],
      routine_type: r(4) < 0.85 ? "routine" : "non_routine",
      dins_percent: Math.round((60 + r(5) * 60) / 5) * 5,
      dins_prompting: r(6) < 0.2,
      treats: r(7) < 0.6 ? [treats[Math.floor(r(8) * treats.length)]] : [],
      scavenged: r(9) < 0.15 ? ["Twigs"] : [],
      walks: [
        { hours: 0, minutes: 20 + Math.round(r(10) * 4) * 5, completed: true },
        { hours: 0, minutes: 20, completed: r(11) < 0.8 },
      ],
      notes: i % 9 === 0 ? "Sample note — a lovely sunny walk in the park." : "",
      holiday_mode: false,
    });
  }
  return rows;
}

export const startGuestSession = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createClient } = await import("@supabase/supabase-js");

  // Ensure the guest user exists
  let userId: string | undefined;
  const created = await supabaseAdmin.auth.admin.createUser({
    email: GUEST_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (created.data.user) userId = created.data.user.id;

  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: GUEST_EMAIL });
  if (link.error || !link.data.properties?.hashed_token) {
    throw new Error("Could not start guest session");
  }
  userId = userId ?? link.data.user?.id;
  if (!userId) throw new Error("Could not start guest session");

  // Seed demo data once
  const { count } = await supabaseAdmin
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count) {
    await supabaseAdmin.from("daily_logs").insert(buildDemoLogs(userId));
    await supabaseAdmin.from("dog_profile").upsert(
      {
        user_id: userId,
        emergency_vet_phone: "01234 567890",
        insurance_provider: "Demo Pet Insurance",
        insurance_policy_number: "DEMO-0001",
        microchip_number: "000000000000000",
        medrone_stock: 24,
        probiotic_stock: 6,
      },
      { onConflict: "user_id" },
    );
    const weights = [0, 30, 60, 90].map((daysAgo, idx) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - daysAgo);
      return { user_id: userId!, logged_date: dateKey(d), weight_kg: 12.4 - idx * 0.2 };
    });
    await supabaseAdmin.from("dog_weight_history").insert(weights);
  }

  const pub = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await pub.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) throw new Error("Could not start guest session");
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
});
