# Architecture

Snapshot as of October 2026 (157 commits; 149 by Lovable, 8 manual). Anything marked *unverified* was inferred from the code and could not be confirmed from the accounts available during the audit.

## The big picture

```
 Browser / installed PWA
   │  React 19 + TanStack Router (client-rendered after first load)
   │
   ├──► Cloudflare Worker "rosie"
   │      TanStack Start SSR + one server function (guest login)
   │
   └──► Supabase (Lovable Cloud) ── Postgres + Auth
          browser talks to it directly with the publishable key;
          Row Level Security is the only thing protecting the data
```

Almost all logic runs in the browser. The Worker serves the app and runs a single server function; every read and write of health data goes straight from the browser to Supabase.

## Stack

- **Framework:** TanStack Start 1.162 (React 19, file-based TanStack Router, Vite 7).
- **Styling:** Tailwind CSS v4, shadcn/ui ("new-york" style) on Radix primitives, Inter from Google Fonts, lucide icons.
- **Charts:** Recharts 2.
- **Data:** `@supabase/supabase-js` 2, generated types in `src/integrations/supabase/types.ts`.
- **Hosting:** Cloudflare Workers via `@cloudflare/vite-plugin` (only enabled for `vite build`).
- **Package manager:** Bun (`bun.lockb`, binary lockfile).

## Hosting and deployment

- Deployment is Cloudflare Workers Builds, connected to this repo: every push is built, `main` is the production branch, and the Cloudflare bot comments on pull requests with the build status. `wrangler.jsonc` names the Worker `tanstack-start-app`, but the live Worker is `rosie`, so the name is overridden in the Cloudflare build settings.
- There is no GitHub Actions workflow, no tests and no preview environment.
- `public/sw.js` is a do-nothing service worker that exists only to satisfy PWA install criteria; there is no offline support. `vite-plugin-pwa` is installed but not used.
- Lovable still hosts its own copy (preview and `*.lovable.app`), and Lovable commits straight to `main`.

## Database (Supabase, owned by Lovable Cloud)

**Ownership is the most important fact in this document.** Project `uzdwydyaqqkyrgpxutgf` is not in your Supabase account (the Supabase connector lists no projects). Lovable Cloud provisions and owns it, which per [Supabase's own guidance](https://supabase.com/docs/guides/troubleshooting/cant-access-supabase-project-lovable-cloud.md) means no Supabase dashboard, no SQL editor, no direct connection string and no service role key from Supabase, and no automated way to transfer it. Moving off it is a manual export and re-import ([Lovable self-hosting guide](https://docs.lovable.dev/tips-tricks/self-hosting)). Your 100+ days of data currently sit somewhere you cannot back up directly.

### Tables (all in `public`, all with RLS: owner-only via `auth.uid() = user_id`)

**`daily_logs`** — one row per user per day (`UNIQUE (user_id, log_date)`). The core of the app.
- `health_score` smallint 1–3 (Poor / Neutral / Good)
- `flare_up` boolean, plus `flare_event` jsonb `{had_flareup, start_time, end_time, symptoms[], intervention_med}`
- `stool_consistency` text[] (was text until May 2026; migrated in place). Values: `formed` (No Issues), `soft`, `loose`, `liquid`, `blood`, `constipation`. Until October 2026 `loose` was mislabelled "Mucus" in the UI; the stored value was always meant as loose stool.
- `symptoms` text[]
- `medications` jsonb keyed by drug name: `{"Medrone": {"taken": true, "dosage": "half", "is_rescue": false}, …}`
- `walks` jsonb array `[{hours, minutes, completed}]`
- `dins_percent` integer, nullable (how much dinner she ate); `dins_prompting` boolean
- `treats`, `scavenged` jsonb arrays of strings
- `location` text, `routine_type` (`routine` / `non_routine`), `holiday_mode` boolean, `notes` text
- `created_at`, `updated_at` (trigger-maintained)

**`dog_profile`** — one row per user. Mixes three unrelated concerns:
- admin: microchip, insurance provider, policy number, renewal date, emergency vet phone
- medication stock: `medrone_stock`, `probiotic_stock`, `medrone_threshold`, `probiotic_threshold`, and the superseded `low_stock_threshold`
- `unlocked_milestones` text[] for annual walking-distance milestones, written by the `claim_annual_milestone()` RPC

**`dog_weight_history`** — dated weights, optional vet-visit flag and notes.

**`lifetime_achievements`** — one row per unlocked achievement (`UNIQUE (user_id, achievement_id)`).

### Functions and policies
- `touch_updated_at()` trigger on `daily_logs`, `dog_profile`, `dog_weight_history`.
- `claim_annual_milestone(text)` — idempotent append to `dog_profile.unlocked_milestones`.
- `is_guest()` plus restrictive policies on all four tables, so the guest account can read but not write.

### Migration history worth knowing
- March–April 2026 migrations create `habits`, `habit_logs` and `profiles` from the habit-tracker template Lovable started from ("Continuum"); they were dropped in June. The data never mattered, but the files remain.
- Migration filenames are Lovable's `timestamp_uuid.sql` with no descriptive names.

## Authentication

- Email and password through Supabase Auth, and sign-up is open to anyone who finds the URL. RLS keeps each account's data separate, so this is a privacy-of-the-app issue rather than a data leak.
- Google sign-in goes through Lovable's OAuth broker (`src/integrations/lovable`), not Supabase directly. Whether this works on the Cloudflare domain depends on Lovable allowing that redirect. *Unverified.*
- Guest mode (`src/lib/guest.functions.ts`) is a server function that uses the service role key to create `guest@rosie-demo.app`, seed 95 days of fake data, and mint a session. It needs `SUPABASE_SERVICE_ROLE_KEY` on the Worker; since Lovable Cloud does not expose that key, guest mode may only work on Lovable's hosting. *Unverified.*
- Every route checks auth itself with `useAuth()` in a `useEffect` and redirects to `/login`; there is no shared route guard.

## Front end

### Screens (`src/routes`)
- `/` splash, redirects to `/app` or `/login`
- `/login` email, Google, guest
- `/app` **Log Today** — the daily form (1,400 lines). On save it also: derives walk completion, deducts medication stock, evaluates achievements, checks walking milestones, and fires celebrations.
- `/history` list and calendar with filters, CSV export, delete
- `/medications` stock, 14-day dose tracks, dose-trend chart
- `/insights` charts and stats over the last 120 days
- `/profile/` Rosie's details, admin info, weight history
- `/achievements` lifetime achievements (32 definitions in `lib/achievements.ts`)
- `/distance-covered` "Where has Rosie been?" walking-distance travel log

### Domain logic
- `lib/daily-logs.ts` — types, option lists (symptoms, medications, locations, treats), Supabase CRUD, CSV export.
- `lib/inventory.ts`, `lib/achievements.ts`, `lib/achievements-meta.ts` (localStorage counters), `lib/milestones.ts`.
- **Business rules live in the UI.** Stock deduction, walk-completion derivation, flare-symptom mirroring and achievement checks run inside the `/app` save handler. Anything else that writes a log (a future MCP connector, a script, a different screen) would skip them unless they are extracted first.

### Theming
- Tokens are defined in `src/styles.css` with a pink (`#F48FB1`) and cream (`#FDFBF7`) light palette and a warm-charcoal dark palette.
- Dark mode already exists but only follows the OS (`@custom-variant dark` is bound to `prefers-color-scheme`). `hooks/use-theme.ts` implements a manual toggle using a `.dark` class, but nothing uses it and the CSS ignores the class. About 150 hard-coded colour values in routes and `lib/achievements.ts` will not adapt to dark mode.

## Lovable artefacts

Kept because the app depends on them today:
- `src/integrations/supabase/*` (auto-generated clients and middleware; `previewAuthStorage.ts` only matters inside the Lovable editor)
- `src/integrations/lovable` and `@lovable.dev/cloud-auth-js` (Google sign-in)

Safe to remove once you stop editing in Lovable:
- `lovable-tagger` and the `componentTagger()` call in `vite.config.ts`
- the two dev-only error-forwarding plugins in `vite.config.ts` (they feed Lovable's editor)
- `playwright.config.ts` and `playwright-fixture.ts` (depend on `lovable-agent-playwright-config`, which is not installed; there are no tests)
- `.lovable/plan.md` (the achievements spec)
- `src/assets/hero-bg-v2.png.asset.json` (points at Lovable's asset CDN), `hero-bg.jpg`, `shadow-bg.jpg`, `public/placeholder.svg` — none are referenced
- the `og:image` hosted on Lovable's storage bucket in `__root.tsx`

Naming leftovers: package name `tanstack_start_ts`, Worker name `tanstack-start-app`, theme key `continuum_theme`.

## Code health

- `tsc --noEmit` passes. `vite build` passes, with a ~960 kB server router chunk.
- `eslint` reports 37 errors and 9 warnings, almost all `any`.
- 33 of the 46 shadcn/ui components are unused.
- Duplicated helpers across routes: `formatDate`, `pickLocation`, `HealthDotTick`, date-key functions.
- Three route files exceed 600 lines (`app` 1,400, `insights` 1,074, `medications` 724).
- Rosie's date of birth and medication names are hard-coded.
- Most screens fetch a fixed window (30, 120, 180 or 4,000 days) on every visit, with no caching, even though TanStack Query is installed.
