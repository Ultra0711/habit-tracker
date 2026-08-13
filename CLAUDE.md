# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal habit tracker. Originally a single self-contained `index.html` file with everything inline; it has since been restructured into a **Vite-bundled app backed by Supabase** (Postgres + Auth), so habit data syncs across devices instead of living only in `localStorage`. `index.html` is now just Vite's entry point (markup + modal templates) — all styling lives in `src/style.css` and all logic lives under `src/`, loaded via `src/main.js`.

There is no test suite or linter. `src/lib/db.smoketest.js` is a manual CRUD/streak smoke test against a real Supabase project (see "Smoke testing" below), not an automated suite. Changes are otherwise verified by running the dev server and exercising the UI manually.

## Commands

```
npm install       # install dependencies
npm run dev        # start Vite dev server (default port 5173; auto-picks another if taken)
npm run build       # production build to dist/
npm run preview      # serve the production build locally
```

Requires a `.env.local` (git-ignored; copy from `.env.example`) with:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The anon key is safe to expose client-side — access control is enforced by Postgres Row Level Security policies (see `supabase/migrations/`), not by keeping this key secret. **Never** put the Supabase service-role key in frontend code. If these env vars are missing, `supabaseConfigured` (in `src/lib/supabaseClient.js`) is `false` and the app shows a config-needed message instead of the sign-in gate — check that flag before "fixing" auth bugs that are actually just a missing `.env.local`.

### Smoke testing against Supabase

`smoketest.html` exercises `src/lib/db.js` directly (insert/fetch/update habit, upsert/delete completions, streak calc, cascade delete) against whatever Supabase project `.env.local` points at. Run `npm run dev` and visit `/smoketest.html`. Useful after schema or `db.js` changes to confirm the DB round-trip still works before testing through the full UI.

## Architecture

### Data flow: domain state → db.js → Supabase

- `src/domain/habits.js` and `src/domain/dates.js` are pure functions with no I/O — habit shape helpers, streak/consistency calculation, date math. `src/domain/achievements.js` builds on top of these.
- `src/lib/db.js` is the **only** module that talks to Supabase tables. It translates between the app's in-memory camelCase habit shape (`{ id, name, description, priority, timeOfDay, frequency, targetPerPeriod, scheduledDays, minimumVersion, archived, createdAt, completions[], longestStreakCache }`) and the snake_case Supabase row shape (`rowToHabit` / `habitToRow`). UI/domain code never queries Supabase directly.
- `src/main.js` holds the in-memory `state` object and a `persist` wrapper around `db.js` calls: every mutation updates `state` optimistically, re-renders, *then* persists — a failed write shows a toast rather than rolling back the UI or failing silently.
- **Completion history is the source of truth**, not cached stats. Streaks, longest-streak-ever, completion percentages, weekly progress, achievements, and the consistency score are all *derived* from each habit's `completions[]` on every render (`src/domain/habits.js`). The one stored exception, `habit.longestStreakCache`, is never used to display a streak — it only exists to detect the *moment* a new personal best happens (for the confetti/toast trigger) and is recomputed from real data each time it's checked.
- `recovery` completions are a distinct status from `done`: they keep a streak alive (don't reset `current` to 0) but don't count toward `totalCompletions`. Only habits with a non-empty `minimumVersion` expose the recovery option in the completion-cycling UI (`cycleCompletion` in `src/ui/modals.js`).

### Auth (Supabase email + password, not magic links)

`src/lib/auth.js` wraps `supabase.auth` (sign up, password sign-in, sign-out, password reset/update). Magic-link OTP sign-in was deliberately **not** used — Supabase's free-tier email rate limit makes it impractical for a personal app hit repeatedly during dev/testing.

`src/ui/authGate.js` gates the whole app behind a session and handles three flows in one gate: normal login/signup, "forgot password" (send reset email), and the password-recovery landing (clicking the reset-email link signs the user into a temporary session and fires a `PASSWORD_RECOVERY` auth event — this is intercepted and routed to a "choose a new password" form instead of being treated as a normal login, so a stale/forgotten password isn't silently left in place).

**Auth state must be driven only by `supabase.auth.onAuthStateChange`, never combined with a separate `getSession()` call feeding the same handler.** Both resolve asynchronously and can race — e.g. `onAuthStateChange` fires first from local session storage (app loads correctly), then a slightly-delayed `getSession()` resolves with a stale/null result and stomps it, snapping the UI back to the sign-in gate even though the user is actually signed in. `onAuthChange` in `auth.js` exists specifically to keep this to one source of truth; don't reintroduce a second listener.

Row Level Security is the actual access boundary, not the UI gate: `supabase/migrations/0001_init.sql` created the schema with temporary permissive policies (no auth existed yet), and `0002_auth_rls.sql` replaced them with `auth.uid() = user_id` (habits) / EXISTS-subquery-scoped (completions) policies. Every `db.js` write that creates or reassigns a habit passes the current `userId` through explicitly (see `habitToRow`).

### Migrating pre-Supabase local data

`src/lib/migrateLocalData.js` handles the one-time import of habit data from the old pure-`localStorage` version of the app (key `habitTrackerData`, read via `src/state/store.js`) into a signed-in user's Supabase account. This runs automatically after sign-in if unmigrated local data is found (`hasUnmigratedLocalData`), gated by a per-user `habitTrackerMigratedTo_<userId>` localStorage flag so it only prompts once per account. It always mints fresh `crypto.randomUUID()` ids for imported habits — the old local id format (`Date.now().toString(36) + random`) predates the UUID requirement and won't satisfy the `habits.id uuid` column — and refuses to run if the target account already has any habits, to avoid duplicate imports. It copies rather than deletes local data, so a failed or unwanted import never loses anything.

### Rendering model

No framework — plain DOM string templates (`innerHTML`) rebuilt from `state` on every change, split one render function per view under `src/ui/views/` (`today.js`, `habitsList.js`, `weekGrid.js`, `achievements.js`, `review.js`). `renderAll()` in `main.js` re-renders every view unconditionally after any mutation — there's no diffing, which is fine at this data scale but means renders are relatively expensive; don't call `renderAll()` in a hot loop.

Tab switching (`#view-today`, `#view-habits`, `#view-week`, `#view-achievements`, `#view-review`) is just toggling a `.active` class on pre-rendered `<section>` elements in `index.html`, not client-side routing.

### Date/schedule handling

- Internal date keys are always `YYYY-MM-DD` local-time strings via `fmtDate()` (`src/domain/dates.js`) — never store or compare `Date` objects directly in state.
- Weeks are Monday-start. `isoDow()` maps JS's Sunday-start `getDay()` to a Monday=0 index used for display/grid columns; `jsDow()` (raw `getDay()`) is used when checking a habit's `scheduledDays`, which are stored in JS's native Sunday=0 convention (matches the Postgres `scheduled_days smallint[]` column comment). Mixing these two up is the most likely source of off-by-one day bugs — check which one a function expects before touching schedule logic.
- A habit's applicable frequency modes are `daily`, `weekly` (X times per week, any days), and `scheduled` (specific weekdays via `scheduledDays`). `isScheduledOn(habit, date)` in `src/domain/habits.js` is the single gate for "does this habit apply to this date" and is used by streak calculation, completion percentage, the weekly grid, and the Today view — extend it, don't duplicate its logic elsewhere.

### Confetti / achievements

Confetti (`src/ui/confetti.js`, canvas-based, no library) fires specifically when a completion causes a habit's current streak to exceed its previously recorded longest streak — see the personal-best check around the note-save flow in `src/ui/modals.js`. Achievements (`src/domain/achievements.js`) are evaluated fresh from current completion history on every render, not stored as "unlocked" flags, so they can never desync from actual history.

### Theming

Light/dark theme is a `data-theme` attribute on `<html>`, driven entirely by CSS custom properties (`src/style.css`). Theme choice is a local UI preference stored in its own `habitTrackerTheme` localStorage key (`src/ui/theme.js`) — deliberately **not** round-tripped through Supabase, unlike habit data.

### Today view ordering

The Today view sorts incomplete habits first (by priority, then name) and pushes anything already completed or logged as a recovery day to the bottom, so checking something off doesn't leave it visually stranded in the middle of the still-to-do list (`src/ui/views/today.js`).

## Supabase schema

See `supabase/migrations/` for the authoritative schema (`habits`, `completions` tables, RLS policies). Migrations are numbered and applied in order; `0001_init.sql` is Stage 2 (schema + permissive RLS, no auth), `0002_auth_rls.sql` is Stage 3 (tightens `user_id` to `not null` + FK, replaces permissive policies with `auth.uid()`-scoped ones). When the data model changes, add a new numbered migration rather than editing an already-applied one.
