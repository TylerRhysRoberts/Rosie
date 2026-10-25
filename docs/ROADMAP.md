# Tidy-up plan and roadmap

Ordered by risk and dependency, not by how interesting it is. Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the reasoning behind each item.

Ground rules for everything below:
- No schema change runs without a fresh full backup and an agreed migration script.
- Every schema change is additive first (add new column or table, backfill, switch the code, then drop the old one in a later release), so 100+ days of real data are never at risk from a single step.

## Decisions needed first

1. **Keep editing in Lovable, or not?** Lovable commits straight to `main` and regenerates files under `src/integrations`. Most of the tidy-up below fights that. Recommendation: stop using Lovable as the editor once the backup is done, and work through pull requests instead.
2. **Move the database to your own Supabase project?** Today Lovable owns it, and you have no dashboard, SQL access, backups or service role key. The MCP connector, proper backups and safe schema changes are all easier or only possible with your own project. Recommendation: yes, before building the MCP connector. It is a one-off manual export and re-import ([Lovable self-hosting guide](https://docs.lovable.dev/tips-tricks/self-hosting)), plus re-pointing the Worker's environment variables and replacing Lovable's Google sign-in with Supabase's own.

## Phase 0: protect the data (do now)

- **Full backup.** The CSV export in History only covers the last 180 days, flattens medications and flare data, and leaves out the profile, weights and achievements. Add an "Export everything (JSON)" button that dumps all four tables unaltered.
- **Fix the hidden data windows.** History, Medications and the CSV export load only the last 180 days. Logging started on 26 May 2026, so from about **22 November 2026** the oldest entries silently disappear from those screens and from the export. Insights already only looks at the last 120 days, so the first month is already excluded from it.
- **Stool value names (optional, changes data).** The labels are right ("Soft / Loose" for `soft`, "Mucus" for `loose`), but the stored value `loose` actually means mucus. Renaming it to `mucus` in the data and code would stop future analysis or MCP code misreading it. It needs a migration on `daily_logs.stool_consistency` (`array_replace(stool_consistency, 'loose', 'mucus')`), plus the `StoolConsistency` type and `STOOL_OPTIONS` in `src/lib/daily-logs.ts` and the filter list in `src/routes/history.tsx`, all shipped together. Only with agreement and after the backup.
- **Confirm whether guest mode works on the Cloudflare URL.** Google sign-in matters less, since you use email and password.

## Phase 1: tidy the codebase (low risk, no behaviour change)

1. Rename the package and the Worker config to `rosie` so the repo matches what is deployed.
2. Remove Lovable-only tooling: `lovable-tagger`, the editor error-forwarding plugins, Playwright stubs, `.lovable/`, unused assets and the Lovable-hosted `og:image`.
3. Delete the unused shadcn/ui components (about 33) and unused dependencies (`vite-plugin-pwa`, `@tanstack/react-query` unless adopted in step 6, carousel, OTP, resizable panels and so on).
4. Move shared helpers (`formatDate`, date keys, `pickLocation`, chart ticks) into `src/lib` and delete the duplicates.
5. **Extract business rules from the UI.** Move "save a day's log" (walk completion, flare mirroring, stock deduction, achievement and milestone checks) out of `routes/app.tsx` into one `lib/` function. This is the prerequisite for the MCP connector, which must apply the same rules.
6. Add a single auth guard on a layout route instead of the copy-pasted `useEffect` redirect in every screen, and adopt TanStack Query (already installed) for caching.
7. Split the three largest route files into components.
8. Fix the lint errors, mostly by typing the Supabase rows properly instead of `any`.
9. Add a GitHub Actions check (typecheck, lint, build) on pull requests, and a handful of unit tests for the pure logic (achievements, milestones, stock maths).
10. Close sign-up, or limit it to your and Courtney's email addresses.

## Phase 2: database structure (needs agreement and a backup first)

None of these is urgent. Each is a candidate, with the reason.

- **Split `dog_profile`.** It holds admin details, medication stock and milestone unlocks in one row. Move stock into a `medication_inventory` table (one row per medication) so a new tablet type does not need new columns, and drop the superseded `low_stock_threshold`.
- **Add a `dogs` table and `dog_id`.** Everything is keyed by login, not by dog, so you and Courtney cannot both log for Rosie, and her date of birth is hard-coded. Optional; only worth it if shared logging matters.
- **Constrain the JSON columns.** `medications`, `walks`, `treats`, `scavenged` and `flare_event` accept any shape. Add `CHECK` constraints (or move walks and medications into child tables) so a bug or an MCP write cannot store malformed data.
- **Store medication names, symptoms and locations as reference data** rather than hard-coded lists in `lib/daily-logs.ts`, so they can be edited without a deploy.
- **Rename and squash migrations** into one descriptive baseline after the move to your own project.

## Phase 3: product

### MCP custom connector
A remote MCP server on Cloudflare Workers (Cloudflare's `agents` / `workers-oauth-provider` packages handle the OAuth flow Claude's custom connectors expect). Tools, roughly:
- `log_day` — takes structured fields (score, walks, dinner percentage, symptoms, treats, notes); Claude does the natural-language parsing, the tool validates and calls the shared save function from Phase 1 step 5.
- `get_day`, `get_recent_summary` — so Claude can answer "how has she been this week?"
- `update_stock`, `log_weight`.

It should act as you (your Supabase session) rather than with the service role key, so RLS still applies. Depends on Phase 1 step 5, and is much simpler after decision 2.

### Dark mode
The dark palette already exists but only follows the phone's setting. Work needed: switch the CSS variant to a `.dark` class, wire up the existing `useTheme` hook with a Light / Dark / System toggle on the Profile screen, and replace the ~150 hard-coded colours with tokens so charts, score colours and achievement badges adapt.

### Better analysis
- Correlations that matter for her condition: flare-ups and stool against medication changes (especially Medrone dose changes), treats, scavenging, location and routine changes, with a lag of one to three days.
- Rolling 7- and 28-day trends instead of fixed windows, and a "since the last flare-up" counter.
- Medication timeline showing dose changes against health score.
- Weight trend with vet visits marked.
- A printable vet summary for a chosen date range.

### Branding
Keep the pink and cream palette and the Rosie face icon, and give it a proper identity: a brand book covering logo usage, a refined palette with dark-mode counterparts, a distinctive typeface pairing to replace Inter, illustration and icon style, and tone of voice. Do this before the dark-mode colour work so the tokens are only redone once.

### UI
- Shorten the daily form: collapse rarely changed sections, and default from yesterday's entry.
- Consider adding Profile to the bottom navigation, which currently has only Log Today, History, Medications and Insights.
- Offline support in the service worker so logging works on a poor signal, syncing later.
