# Lifetime Achievements Feature

A permanent, multi-year gamification layer with 28 achievements across 6 categories, a global notification queue, a dedicated /profile/achievements screen, and a server-side persistence schema. This plan completely removes the walk_early_20 and paparazzi_50 achievements to avoid modifying the Walk data model or introducing an extra app_counters table.

### 1. Database Schema (Migration)

Create public.lifetime_achievements:

 * id: uuid (Primary Key)

 * user_id: uuid not null (References auth.uid())

 * achievement_id: text not null (e.g., log_str_30)

 * unlocked_at: timestamptz not null default now()

 * progress: jsonb default '{}' (For partial-progress snapshots, optional)

 * **Constraints**: UNIQUE (user_id, achievement_id)

**Row-Level Security (RLS)**: Per-user select/insert/delete via auth.uid() = user_id. Standard GRANTs assigned to authenticated and service_role.

### 2. Achievement Evaluation Engine

New module src/lib/achievements.ts:

 * Exports the ACHIEVEMENTS master list (id, name, description, category, icon name from lucide, criteria function, progress function returning {current, target}).

 * Exports evaluateAchievements(logs: DailyLog[], existingUnlocks: Set<string>, opts) → string[] containing newly-unlocked IDs. This is a pure function operating over logs and metadata.

 * Includes helpers for consecutive-day streaks, cumulative counts, walk-time targets, etc.

Triggered from src/routes/app.tsx (and any other save paths) after upsertLog succeeds:

 * Re-fetches all logs (already cached) + existing unlocks.

 * Computes new unlocks.

 * Inserts new rows into public.lifetime_achievements.

 * Enqueues a notification per new unlock via the global queue.

**Special Triggers**:

 * time_night: Checks the submission timestamp client-side at the exact moment of saving.

 * update_diligent: Detects when updated_at - created_at > 3h by comparing against the known initial creation timestamp.

### 3. Global Notification Queue

New component src/components/NotificationQueueProvider.tsx:

 * React context exposing enqueue(payload) with a FIFO (First-In, First-Out) array state logic.

  *Renders* *only the first blocking item** in the array queue as a fixed, centred modal (z-50, blurred backdrop) featuring a canvas-confetti burst on mount, the achievement icon, headline text ("Achievement Unlocked!"), name, and description.

 * Provides two navigation buttons:

   1. **Primary Action**: "View Achievements Screen" (navigates to /profile/achievements then dismisses the modal).

   2. **Secondary Action**: "Dismiss" (closes the active modal and shifts the queue).

 * Non-blocking toast banners pass straight through to sonner (existing implementation).

 * Mounted directly in src/routes/__root.tsx wrapping the <Outlet/> component to ensure persistence across active route changes.

### 4. Profile Screen Entry Point

Modifications to src/routes/profile.tsx:

  *Add a minimal, rounded square button containing a trophy icon located* *immediately to the left** of Rosie's circular profile photo.

 * Tapping this button cleanly routes the user to the new sub-route: /profile/achievements.

### 5. Achievements Screen Layout

New route file src/routes/profile.achievements.tsx (URL: /profile/achievements):

 * Header layout featuring a back chevron navigation link + "Achievements" title text.

  *Achievements are categorised into 6 text headings (*Consistency, Walking, Health Management, Nutrition, Routine, Surprise Milestones*).

  *Each category renders a single,* *horizontally scrollable row** (overflow-x-auto, snap-x) displaying approximately 3 cards across the screen width with a partial preview clipping dynamically on the right margin to indicate swipe/drag availability.

 * **Card States**:

   * *Locked State*: Completely greyscale desaturated icon, small padlock icon overlay, and a horizontal progress bar (current / target) positioned directly below the card title.

   * *Unlocked State*: Full-colour rendered icon displaying a clear "Unlocked DD MMM YYYY" timestamp label.

 * **Interaction**: Tapping any individual achievement card surfaces a clean bottom Sheet drawer component (shadcn/ui) displaying the comprehensive description and the exact criteria rules required to earn it.

### 6. Files Touched

**New Files**:

 * supabase/migrations/<timestamp>_lifetime_achievements.sql

 * src/lib/achievements.ts

 * src/components/NotificationQueueProvider.tsx

 * src/components/AchievementUnlockModal.tsx

 * src/routes/profile.achievements.tsx

**Edited Files**:

 * src/routes/__root.tsx — Wrap the primary <Outlet/> inside the new NotificationQueueProvider.

 * src/routes/profile.tsx — Add the trophy icon button directly to the left of the profile photo.

 * src/routes/app.tsx — Post-processing logic block inside upsertLog to run the evaluation engine and enqueue unlocks.

### 7. Technical Notes & Rules

 * **Canvas Confetti**: Reuse the existing canvas-confetti package currently employed by the MilestoneCelebration module.

 * **Navigation**: Strictly utilise @tanstack/react-router primitives (Link / useNavigate).

 * **Performance**: All milestone calculations are pure JavaScript operations executed over the pre-fetched DailyLog[] array. No complex server-side edge computations or remote queries are required during evaluation. Inserts map directly via the client-side Supabase browser wrapper restricted by RLS.

 * **Time Formatting**: Streak calculations parse standard log_date strings structured as YYYY-MM-DD.

 * **Weekend Warrior Metric**: The weekend_warrior achievement will compute purely on data-presence checks for consecutive Saturday and Sunday pairs containing completed walk entries, completely bypassing the need for an explicit start_time field or schema change inside the Walk data model.

 * **Medication Metric**: med_streak_30 tracks days where a medication scheduled threshold was checked. It infers tracking conditions only for entries where a medication has ever been verified with taken === true in the user dataset.

 * **Styling**: All UI implementations must map directly to your existing design layout using your active system semantic Tailwind tokens. Do not inject hardcoded or rogue hex colour values.

&nbsp;