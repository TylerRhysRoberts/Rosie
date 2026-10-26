import { McpServer } from "@modelcontextprotocol/server";
import { getMcpAuthContext } from "agents/mcp/server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import type { GrantProps } from "./auth";
import {
  DEFAULT_SCAVENGED,
  DEFAULT_TREATS,
  DOSAGE_OPTIONS,
  HEALTH_SCORES,
  LOCATION_OPTIONS,
  MEDICATION_NAMES,
  STOOL_OPTIONS,
  STOOL_VALUES,
  SYMPTOM_OPTIONS,
  applyChanges,
  emptyLog,
  inventoryUse,
  prepareForSave,
  rowToLog,
  summarise,
  todayInLondon,
  totalWalkMinutes,
  type DailyLog,
  type LogChanges,
  type StoolConsistency,
} from "./rosie";
import { userClient, type UserClient } from "./supabase";

const INSTRUCTIONS = `Rosie is Tyler's dog (a Cavapoochon) with a sensitive gut. This server reads and writes her daily health log in the Rosie Health app.

When the user describes Rosie's day in plain language, call log_day once with every detail you can map, then read back the saved summary in a sentence. Call get_logging_options first if you are unsure which values exist. "Dins" means dinner. Dates are UK dates; omit date for today. Only change what the user mentioned: log_day merges into the existing day. If the user hasn't said whether her usual medication was given, ask rather than guessing.`;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("UK date as YYYY-MM-DD. Omit for today.");

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });

function session(): { props: GrantProps; db: UserClient } {
  const props = getMcpAuthContext()?.props as GrantProps | undefined;
  if (!props?.sbAccessToken) throw new Error("Not signed in. Reconnect the Rosie connector in Claude.");
  return { props, db: userClient(env, props.sbAccessToken) };
}

async function fetchDay(db: UserClient, userId: string, date: string): Promise<DailyLog | null> {
  const { data, error } = await db
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLog(data) : null;
}

async function fetchPreviousDay(db: UserClient, userId: string, before: string): Promise<DailyLog | null> {
  const { data, error } = await db
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .lt("log_date", before)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLog(data) : null;
}

/** Mirrors the app: deduct only the extra tablets this save adds compared with what was stored before. */
async function deductStock(db: UserClient, userId: string, next: DailyLog, previous: DailyLog | null) {
  const now = inventoryUse(next.medications);
  const before = previous ? inventoryUse(previous.medications) : { medrone: 0, probiotic: 0 };
  const medrone = Math.max(0, now.medrone - before.medrone);
  const probiotic = Math.max(0, now.probiotic - before.probiotic);
  if (!medrone && !probiotic) return null;

  const { data, error } = await db
    .from("dog_profile")
    .select("medrone_stock, probiotic_stock, medrone_threshold, probiotic_threshold")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const stock = {
    medrone: Math.max(0, Number(data.medrone_stock) - medrone),
    probiotic: Math.max(0, Number(data.probiotic_stock) - probiotic),
  };
  const { error: updateError } = await db
    .from("dog_profile")
    .update({ medrone_stock: stock.medrone, probiotic_stock: stock.probiotic })
    .eq("user_id", userId);
  if (updateError) throw updateError;
  const low = [
    stock.medrone <= Number(data.medrone_threshold) ? `Medrone (${stock.medrone} left)` : null,
    stock.probiotic <= Number(data.probiotic_threshold) ? `Probiotic (${stock.probiotic} left)` : null,
  ].filter(Boolean);
  return low.length ? `Low stock: ${low.join(", ")}.` : null;
}

export function createServer() {
  const server = new McpServer({ name: "rosie", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_logging_options",
    {
      title: "Get logging options",
      description:
        "Lists the values the Rosie app uses for health score, symptoms, stool, medications, dosages, locations, treats and scavenged items. Use these exact spellings in log_day.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      text(
        JSON.stringify(
          {
            health_score: HEALTH_SCORES,
            symptoms: SYMPTOM_OPTIONS,
            stool_consistency: STOOL_OPTIONS,
            medications: MEDICATION_NAMES,
            dosages: DOSAGE_OPTIONS,
            locations: LOCATION_OPTIONS,
            common_treats: DEFAULT_TREATS,
            common_scavenged: DEFAULT_SCAVENGED,
            notes: [
              "Symptoms, treats and scavenged items also accept custom values; prefer the listed ones.",
              "'No Issues' cannot be combined with other symptoms; adding a symptom removes it.",
              "Medrone and Probiotic doses reduce tablet stock in the app automatically.",
              "routine_type: 'routine' (normal weekday) or 'non_routine' (weekend, visitors, travel).",
            ],
          },
          null,
          2,
        ),
      ),
  );

  server.registerTool(
    "get_day",
    {
      title: "Get one day's log",
      description: "Reads Rosie's log for a single day.",
      inputSchema: z.object({ date: dateSchema.optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ date }) => {
      const { props, db } = session();
      const day = date ?? todayInLondon();
      const log = await fetchDay(db, props.userId, day);
      return text(log ? summarise(log) : `Nothing logged for ${day} yet.`);
    },
  );

  server.registerTool(
    "get_logs",
    {
      title: "Get logs for a period",
      description:
        "Reads Rosie's logs for a date range, newest first, with a short summary (average score, flare-ups, walking, dins). Defaults to the last 7 days. Use it for questions like 'how has she been this week?'.",
      inputSchema: z.object({
        start_date: dateSchema.optional().describe("First day, YYYY-MM-DD. Defaults to 6 days before end_date."),
        end_date: dateSchema.optional().describe("Last day, YYYY-MM-DD. Defaults to today."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ start_date, end_date }) => {
      const { props, db } = session();
      const end = end_date ?? todayInLondon();
      const start =
        start_date ?? new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
      if (start > end) return fail("start_date must be on or before end_date.");
      const { data, error } = await db
        .from("daily_logs")
        .select("*")
        .eq("user_id", props.userId)
        .gte("log_date", start)
        .lte("log_date", end)
        .order("log_date", { ascending: false })
        .limit(400);
      if (error) throw error;
      const logs = (data ?? []).map(rowToLog);
      if (!logs.length) return text(`Nothing logged between ${start} and ${end}.`);

      const avg = logs.reduce((s, l) => s + l.health_score, 0) / logs.length;
      const dins = logs.filter((l) => l.dins_percent != null);
      const summary = [
        `${logs.length} day(s) logged between ${start} and ${end}.`,
        `Average health score ${avg.toFixed(2)}/3 (good ${logs.filter((l) => l.health_score === 3).length}, neutral ${logs.filter((l) => l.health_score === 2).length}, poor ${logs.filter((l) => l.health_score === 1).length}).`,
        `Flare-ups: ${logs.filter((l) => l.flare_up).length}.`,
        `Average walking ${Math.round(logs.reduce((s, l) => s + totalWalkMinutes(l.walks), 0) / logs.length)} min/day.`,
        dins.length
          ? `Average dins eaten ${Math.round(dins.reduce((s, l) => s + (l.dins_percent ?? 0), 0) / dins.length)}%.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      return text(`${summary}\n\n${logs.map(summarise).join("\n")}`);
    },
  );

  const medicationSchema = z.object({
    taken: z.boolean(),
    dosage: z.enum(DOSAGE_OPTIONS as [string, ...string[]]).optional().describe("Defaults to her usual dose."),
    is_rescue: z.boolean().optional().describe("True when given in response to a flare-up rather than routinely."),
  });

  server.registerTool(
    "log_day",
    {
      title: "Log Rosie's day",
      description: `Adds to or corrects Rosie's log for one day. Only the fields you pass change; everything else is kept. If the day has no log yet, it starts from the app's defaults (Good, No Issues, normal stool, Cheese, Home).

Map plain language to fields, for example "Rosie has been good today, she did eat grass, two 20 minute walks, ate 90% of her dins" ->
{ health_score: 3, add_symptoms: ["Eating Grass"], add_walks: [{minutes: 20}, {minutes: 20}], dins_percent: 90 }.

Health score: 3 Good, 2 Neutral (off-colour, mild symptoms), 1 Poor (flare-up or clearly unwell).`,
      inputSchema: z.object({
        date: dateSchema.optional(),
        health_score: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        add_symptoms: z.array(z.string()).optional().describe("Symptoms to add, e.g. 'Eating Grass'. Adding 'No Issues' clears the others."),
        remove_symptoms: z.array(z.string()).optional(),
        stool_consistency: z
          .array(z.enum(STOOL_VALUES as [StoolConsistency, ...StoolConsistency[]]))
          .optional()
          .describe("Replaces the day's stool list. 'formed' = no issues, 'soft' = soft or loose (not solid or perfectly formed), 'loose' = MUCUS (despite the name), 'liquid' = diarrhoea, 'blood' = blood present. Map the word 'loose' to 'soft', never to 'loose'."),
        add_walks: z
          .array(z.object({ minutes: z.number().int().min(1).max(600) }))
          .optional()
          .describe("One entry per walk."),
        replace_walks: z.boolean().optional().describe("True to replace the day's walks with add_walks instead of adding to them."),
        dins_percent: z.number().int().min(0).max(100).nullable().optional().describe("How much of dinner she ate, 0-100. null = not logged."),
        dins_prompting: z.boolean().optional().describe("True if she needed coaxing to eat her dinner."),
        add_treats: z.array(z.string()).optional(),
        remove_treats: z.array(z.string()).optional(),
        add_scavenged: z.array(z.string()).optional().describe("Things she ate that she shouldn't have, e.g. 'Twigs', 'Floor Food'."),
        remove_scavenged: z.array(z.string()).optional(),
        medications: z
          .record(z.string(), medicationSchema)
          .optional()
          .describe("Keyed by medication name, e.g. { Medrone: { taken: true, dosage: 'half' }, Probiotic: { taken: true } }."),
        copy_medications_from_previous_day: z
          .boolean()
          .optional()
          .describe("For a new day: start from the medications on the most recent earlier log. Use when the user says 'usual meds'."),
        location: z.string().optional().describe("Where she spent the day, e.g. Home, Carol's."),
        routine_type: z.enum(["routine", "non_routine"]).optional(),
        flare: z
          .object({
            had_flareup: z.boolean(),
            start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe("HH:MM, 24-hour"),
            end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe("HH:MM, 24-hour"),
            intervention_med: z.string().nullable().optional().describe("Medication given to settle it, e.g. Buscopan."),
          })
          .optional(),
        notes: z.string().max(2000).optional().describe("Free text worth keeping that doesn't fit a field."),
        notes_mode: z.enum(["append", "replace"]).optional().describe("Default append."),
        holiday_mode: z.boolean().optional().describe("Rosie is away with a sitter; the app fills in standard values."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ date, copy_medications_from_previous_day, ...changes }) => {
      const { props, db } = session();
      const day = date ?? todayInLondon();
      if (day > todayInLondon()) return fail(`${day} is in the future.`);

      const existing = await fetchDay(db, props.userId, day);
      let base = existing ?? emptyLog(day);
      if (!existing && copy_medications_from_previous_day) {
        const previous = await fetchPreviousDay(db, props.userId, day);
        if (previous) base = { ...base, medications: previous.medications };
      }
      const next = prepareForSave(applyChanges(base, changes as LogChanges));

      const { data, error } = await db
        .from("daily_logs")
        .upsert(
          [
            {
              user_id: props.userId,
              log_date: next.log_date,
              health_score: next.health_score,
              flare_up: next.flare_up,
              flare_event: next.flare_event,
              stool_consistency: next.stool_consistency,
              symptoms: next.symptoms,
              medications: next.medications,
              location: next.location,
              routine_type: next.routine_type,
              dins_percent: next.dins_percent,
              dins_prompting: next.dins_prompting,
              treats: next.treats,
              scavenged: next.scavenged,
              walks: next.walks,
              notes: next.notes,
              holiday_mode: next.holiday_mode,
            },
          ],
          { onConflict: "user_id,log_date" },
        )
        .select()
        .single();
      if (error) throw error;
      const saved = rowToLog(data);
      const stockNote = await deductStock(db, props.userId, saved, existing);

      return text(
        [`${existing ? "Updated" : "Created"} the log for ${day}.`, summarise(saved), stockNote]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "log_weight",
    {
      title: "Log Rosie's weight",
      description: "Records a weigh-in, optionally from a vet visit.",
      inputSchema: z.object({
        weight_kg: z.number().min(1).max(60),
        date: dateSchema.optional(),
        is_vet_visit: z.boolean().optional(),
        visit_notes: z.string().max(2000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ weight_kg, date, is_vet_visit, visit_notes }) => {
      const { props, db } = session();
      const day = date ?? todayInLondon();
      const { error } = await db.from("dog_weight_history").insert({
        user_id: props.userId,
        logged_date: day,
        weight_kg,
        is_vet_visit: is_vet_visit ?? false,
        visit_notes: visit_notes ?? "",
      });
      if (error) throw error;
      return text(`Logged ${weight_kg} kg on ${day}${is_vet_visit ? " (vet visit)" : ""}.`);
    },
  );

  server.registerTool(
    "get_weight_history",
    {
      title: "Get weight history",
      description: "Lists Rosie's recorded weights, newest first.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional().describe("Default 10.") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      const { props, db } = session();
      const { data, error } = await db
        .from("dog_weight_history")
        .select("logged_date, weight_kg, is_vet_visit, visit_notes")
        .eq("user_id", props.userId)
        .order("logged_date", { ascending: false })
        .limit(limit ?? 10);
      if (error) throw error;
      if (!data?.length) return text("No weights recorded yet.");
      return text(
        data
          .map((w) => `${w.logged_date}: ${w.weight_kg} kg${w.is_vet_visit ? " (vet)" : ""}${w.visit_notes ? ` – ${w.visit_notes}` : ""}`)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "get_medication_stock",
    {
      title: "Get medication stock",
      description: "Shows how many Medrone and Probiotic tablets are left and whether either is running low.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { props, db } = session();
      const { data, error } = await db
        .from("dog_profile")
        .select("medrone_stock, probiotic_stock, medrone_threshold, probiotic_threshold")
        .eq("user_id", props.userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return text("No medication stock has been set up in the app yet.");
      const line = (name: string, stock: number, threshold: number) =>
        `${name}: ${stock} tablet(s)${stock <= 0 ? " – OUT OF STOCK" : stock <= threshold ? ` – low (warning at ${threshold})` : ""}`;
      return text(
        [
          line("Medrone", Number(data.medrone_stock), Number(data.medrone_threshold)),
          line("Probiotic", Number(data.probiotic_stock), Number(data.probiotic_threshold)),
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "add_medication_stock",
    {
      title: "Add medication stock",
      description: "Adds tablets to stock after a new supply arrives, e.g. 'picked up 30 Medrone'.",
      inputSchema: z.object({
        medication: z.enum(["Medrone", "Probiotic"]),
        tablets: z.number().positive().max(1000),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ medication, tablets }) => {
      const { props, db } = session();
      const column = medication === "Medrone" ? "medrone_stock" : "probiotic_stock";
      const { data, error } = await db.from("dog_profile").select(column).eq("user_id", props.userId).maybeSingle();
      if (error) throw error;
      if (!data) return fail("No dog profile exists yet. Open the app's profile page once, then try again.");
      const next = Number((data as Record<string, unknown>)[column]) + tablets;
      const { error: updateError } = await db.from("dog_profile").update({ [column]: next }).eq("user_id", props.userId);
      if (updateError) throw updateError;
      return text(`${medication} stock is now ${next} tablet(s).`);
    },
  );

  return server;
}
