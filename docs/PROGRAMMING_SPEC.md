# TYPERFORMANCE Programming Module: Spec (v1, 24 Nov 2026)

Goal: replace Trainerize. A TrainHeroic-style coach workflow (build once, assign in three taps, review a feed) inside the existing TYPERFORMANCE app, for fighters and general-population clients. Everything is built on branch `programming-v2` and tested against the **TYPERFORMANCE Test** Supabase project. Nothing reaches live clients until Tyrell merges.

Principles
- Simple on screen: each client only sees what their feature toggles switch on.
- Reuse what exists: lifts and e1RMs (calculator), session-RPE load (weekly check-in), bodyweight, feature toggles, coach approval.
- Security in the database: every new table has row-level security, tested in `tests/db`.
- Each segment is checked against this spec and has tests before the next starts.

## New feature toggles (coach-controlled, per client)
| Toggle | Default | Gives the client |
|---|---|---|
| `feat_program` | on | Today's workout, calendar, logging, exercise history |
| `feat_chat` | on | Chat with the coach |
| `feat_leaderboard` | off | Leaderboards in their groups (opt-in: shows their name) |
| `feat_habits` | off | Daily habit checklist |
| `feat_macros` | off | Macro targets and daily totals |
| `feat_photos` | off | Progress photos |
| `feat_bodyweight` | on | Bodyweight log and trend |

## Segment A: Exercise library
- `exercises`: name (unique), category (strength, power, plyometric, conditioning, mobility, core, accessory), optional link to a calculator lift (`lift_key`) so %1RM can auto-load, video URL (YouTube/Vimeo), coaching cues, measure (`load`, `bodyweight`, `time`, `distance`, `calories`), active flag.
- Seeded with every calculator lift plus common accessories.
- Coach screen `/coach/library`: search, filter by category, add/edit, archive (hidden from pickers, old workouts keep it).
- Clients can read active exercises (to show video and cues).

## Segment B: Program builder
- `programs`: name, description, tag (e.g. "Fight camp", "Fat loss"), number of weeks, archived.
- `program_days`: week number, day number (1 = start day, 7 = six days later), title, notes. Empty days are rest days.
- `program_items` (ordered within a day): either an **exercise** or a **text block** (warm-up, ESD conditioning, finisher).
  - Exercise fields: block label (A, B, C) + slot (A1, A2 = superset), sets, reps (text: `5`, `8-10`, `AMRAP`, `30s`), load type (`percent`, `rpe`, `kg`, `bodyweight`, `none`), percent, RPE, kg, tempo, rest (seconds), notes.
- **One-line entry**: typing `4x5 @ 80%`, `3x8 RPE 7`, `3x10 @ 40kg`, `3x8-10`, `3xAMRAP`, `5x3 @ 80% tempo 30X1 rest 3m` fills the fields. Unparseable text is kept as notes (never lost).
- Tools: copy a day, copy a week to another week, **progress a week** (+2.5% / +5%, +1 set, +0.5 RPE) into the next week, duplicate a whole program.
- Coach screens: `/coach/programs` (list), `/coach/programs/[id]` (week grid → day editor).

## Segment C: Groups, assignment and calendar
- `groups` + `group_members` (e.g. "Pro MMA camp", "Fat loss").
- **Assign**: program → one client or a group → start date. Days are copied into dated **workouts** (`workouts` + `workout_items`), so later edits to the template don't silently change live training.
- A workout belongs to **either** a client **or** a group. Group workouts show for every member. Edit once and everyone gets it.
- **Override**: the coach can customise a group workout for one client. This makes a personal copy that replaces the group one for that client only.
- Coach can also add a one-off workout on any date without a program.
- Calendar: coach sees month/week per client or group, with completion dots (done, partial, missed), and can move a workout to another date or delete it. Removing an assignment deletes its future, unlogged workouts.

- **"Needs a program" panel** on the coach dashboard: every active client and group whose last scheduled workout is within 7 days (red) or 14 days (amber), or who has nothing scheduled, sorted by most urgent. Group workouts count for their members.

## Segment D: Client workout view, logging and comments
- Home shows **Today**: the workout(s) for today plus the next 6 days.
- Each exercise shows the prescription, cues, an **in-app video player** (YouTube/Vimeo links play embedded, privacy-enhanced mode; other links open in a new tab), and the **calculated load**: percent × the client's latest e1RM for the linked lift, rounded to 2.5 kg (shown as "~kg"; editable).
- Logging per set: reps, kg, done tick (pre-filled from the prescription, one tap to confirm). Text blocks get a done tick.
- **Comments**: one on the whole workout, plus one per exercise.
- Finish: session RPE (1–10) + duration. If the client has Weekly Check-In on, this also logs an S&C session automatically, so training load charts stay correct with no double entry.
- Logs are editable for 4 weeks (same lock as weekly logging).
- Coach **review feed** `/coach/feed`: latest completed workouts, prescribed vs actual, comments, PRs highlighted, a reply box (goes into chat).

## Segment E: Progress tracking
- **Exercise history**: every logged set per exercise, best e1RM per session (same formula as the calculator), trend chart, PR list (heaviest load per rep count, best e1RM).
- New e1RM PRs can be saved to the calculator's maxes in one tap, so future %1RM loads update.
- **Bodyweight**: daily log (`body_metrics`: date, kg, optional waist cm), trend chart with a 7-day average. The weekly check-in bodyweight still appears on the chart.
- **Leaderboards**: per group and exercise, best e1RM or best reps; only clients with `feat_leaderboard` appear.

## Segment F: Chat
- One thread per client with the coach (`messages`). Text only in v1, 2,000 characters.
- Unread badge for both sides; coach inbox sorted by latest message.
- Live updates via Supabase Realtime, with a refresh fallback.
- **Scheduled messages**: write now, send at a set date and time (Sydney).
- **Recurring messages**: weekly (pick weekdays + time) or every N days, to one client, a group, or everyone. Pause/resume/delete. Sent by Supabase's scheduler (pg_cron) every minute, so they arrive within ~1 minute.
- Notifications: v1 = unread badge + optional email digest via GHL. Web push (home-screen install required on iPhone) is a later add-on.

## Segment K: Coach overview dashboard
Cards (each can be shown/hidden by the coach; choice saved on the coach's profile):
- **Needs attention: incomplete setup**: pending approval, consent/profile not finished, never assigned a program, or prescribed % loads with no 1RM saved.
- **Missed check-ins**: no weekly check-in for last week (existing data).
- **Inactive clients**: not opened the app for 7+ days.
- **Follow-ups due**: coach sets "follow up on <date>" + note per client; shows due/overdue; tick to clear.
- **New personal bests**: last 7 days, from logged sets (best e1RM per exercise beaten).
- **Programs expiring ≤ 7 days** and **programs expired** (no future workouts but had some in the last 28 days).
- **Compliance** (toggle): workouts completed ÷ scheduled and nutrition days logged ÷ 7, for 7 or 30 days, per client and average.
- **Average sign-in** (toggle): app opens are recorded per client per day (`app_opens`); shows the % of clients active in the last 7 days and average active days per client per week.

## Logging experience (TrainHeroic-style)
- Each set saves the moment it's ticked (no Save button to forget); offline-safe retry.
- Tap a set to complete it with the pre-filled reps/kg; edit inline.
- Rest timer starts automatically after a set when the line has a rest time.
- Big, thumb-friendly layout; superset blocks clearly grouped; progress bar for the session.

## Segment J: Periodisation (season planner)
- Per client or group: a **season** with phases on a timeline (e.g. GPP → Max Strength → Power → Peak → Taper → Deload).
- Each phase: name, start/end dates, goal, emphasis (strength, power, hypertrophy, conditioning, skill, recovery), weekly targets (sessions, sets per week, intensity range %1RM, conditioning minutes), notes.
- Fight dates from the competition tracker appear on the timeline automatically, with weeks-out markers.
- Each phase can link to the program assigned for it; the timeline shows assigned vs planned so gaps are obvious.
- Mesocycle week pattern per phase (e.g. 3:1 load:deload), shown as weekly bars.

## Segment G: General-population tools
- **Habits**: coach sets habits per client (e.g. "8k steps", "3 L water"); client ticks daily; coach sees a 4-week grid.
- **Macros**: coach sets protein/carb/fat/calorie targets; client logs a daily total in about 10 seconds; weekly adherence shown. No food database.
- **Progress photos**: private storage bucket, folder per client, front/side/back with date; only the client and coach can view.

## Segment H: GHL payments → access
- Endpoint `POST /api/ghl/webhook` with a shared secret header.
- Payment received → matching client (by email) set to active. Subscription cancelled or payment failed → set to inactive (data kept).
- Needs in Vercel: `GHL_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- Every webhook call is recorded in `payment_events` for auditing.

## Segment I: Moving off Trainerize
- Bulk invite: paste a list of emails → creates pending invites the coach can approve on signup.
- Programs are rebuilt as templates (Trainerize exports are limited); the one-line entry makes this fast.
- Launch checklist in `docs/LAUNCH.md`.

## Out of scope (v1)
Marketplace and program sales, food-by-food logging, wearable sync, native App Store apps, video uploads for exercises (links only).

## Segment L: Readiness, session summary, rewards
- **Readiness check** (before starting a workout, once per day, skippable): sleep quality, energy, soreness, stress, motivation on 1–5 taps, plus hours slept. Gives a 0–100 readiness score with a traffic light. Coach sees it on the feed, the log and the client's page. Low readiness (< 50) shows the client a note to keep loads at the low end / drop a set, as the coach chooses.
- **Session summary** (after Finish): duration, sets done vs prescribed, total volume (kg), new PBs this session, comparison with the last time each exercise was done, streak.
- **Rewards**: celebration screen with PB badges; milestones for 1st, 10th, 25th, 50th, 100th… workouts, weekly streaks (all prescribed workouts done in a week) and PB counts. Badges shown on the client's progress page; the coach gets them on the overview "New personal bests" card.
