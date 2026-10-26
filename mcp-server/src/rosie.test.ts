import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges, emptyLog, inventoryUse, prepareForSave, summarise, todayInLondon } from "./rosie.ts";

test("Tyler's example message maps onto a new day", () => {
  const log = prepareForSave(
    applyChanges(emptyLog("2026-10-22"), {
      health_score: 3,
      add_symptoms: ["Eating Grass"],
      add_walks: [{ minutes: 20 }, { minutes: 20 }],
      dins_percent: 90,
    }),
  );
  assert.deepEqual(log.symptoms, ["Eating Grass"], "No Issues is dropped once a symptom is added");
  assert.deepEqual(log.walks, [
    { hours: 0, minutes: 20, completed: true },
    { hours: 0, minutes: 20, completed: true },
  ]);
  assert.equal(log.dins_percent, 90);
  assert.equal(log.routine_type, "routine", "a Thursday defaults to routine");
  assert.match(summarise(log), /walks: 20 min \+ 20 min = 40 min/);
});

test("merging keeps everything that wasn't mentioned", () => {
  const morning = applyChanges(emptyLog("2026-10-25"), {
    add_walks: [{ minutes: 30 }],
    medications: { Medrone: { taken: true }, Probiotic: { taken: true } },
  });
  const evening = applyChanges(morning, { add_walks: [{ minutes: 75 }], notes: "Ate a twig" });
  assert.equal(evening.walks.length, 2);
  assert.deepEqual(evening.walks[1], { hours: 1, minutes: 15 });
  assert.equal(evening.medications.Medrone.dosage, "half", "usual dose is kept");
  assert.equal(evening.medications.Probiotic.taken, true);
  assert.equal(evening.routine_type, "non_routine", "a Sunday defaults to non-routine");
  const later = applyChanges(evening, { notes: "Fine by bedtime" });
  assert.equal(later.notes, "Ate a twig\nFine by bedtime");
});

test("No Issues is exclusive, and removing every symptom falls back to it", () => {
  const ill = applyChanges(emptyLog("2026-10-25"), { add_symptoms: ["Vomiting", "Lethargy"] });
  assert.deepEqual(ill.symptoms, ["Vomiting", "Lethargy"]);
  assert.deepEqual(applyChanges(ill, { add_symptoms: ["No Issues"] }).symptoms, ["No Issues"]);
  assert.deepEqual(applyChanges(ill, { remove_symptoms: ["Vomiting", "Lethargy"] }).symptoms, ["No Issues"]);
});

test("stool 'formed' (no issues) is dropped when a problem is also given", () => {
  const log = applyChanges(emptyLog("2026-10-25"), { stool_consistency: ["formed", "loose"] });
  assert.deepEqual(log.stool_consistency, ["loose"]);
});

test("a flare-up copies the day's symptoms into the flare event on save", () => {
  const log = prepareForSave(
    applyChanges(emptyLog("2026-10-25"), {
      health_score: 1,
      add_symptoms: ["Squelching"],
      flare: { had_flareup: true, start_time: "14:00", intervention_med: "Buscopan" },
    }),
  );
  assert.equal(log.flare_up, true);
  assert.deepEqual(log.flare_event, {
    had_flareup: true,
    start_time: "14:00",
    end_time: null,
    symptoms: ["Squelching"],
    intervention_med: "Buscopan",
  });
  const cleared = prepareForSave(applyChanges(log, { flare: { had_flareup: false } }));
  assert.equal(cleared.flare_up, false);
  assert.deepEqual(cleared.flare_event.symptoms, []);
});

test("holiday mode applies the app's standard values", () => {
  const log = prepareForSave(applyChanges(emptyLog("2026-10-25"), { holiday_mode: true, dins_percent: 40 }));
  assert.equal(log.health_score, 2);
  assert.equal(log.dins_percent, 100);
  assert.deepEqual(log.walks, [{ hours: 0, minutes: 30, completed: true }]);
});

test("stock use matches the app: half or whole Medrone, whole Probiotic only", () => {
  const meds = emptyLog("2026-10-25").medications;
  meds.Medrone = { taken: true, dosage: "half" };
  meds.Probiotic = { taken: true, dosage: "whole" };
  assert.deepEqual(inventoryUse(meds), { medrone: 0.5, probiotic: 1 });
});

test("today is the UK date, not UTC", () => {
  // 23:30 UTC on 25 June is 00:30 BST on 26 June.
  assert.equal(todayInLondon(new Date("2026-06-25T23:30:00Z")), "2026-06-26");
  assert.equal(todayInLondon(new Date("2026-12-25T23:30:00Z")), "2026-12-25");
});
