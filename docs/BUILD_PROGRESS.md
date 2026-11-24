# Programming module build progress

Branch: `programming-v2` · Test Supabase project: `mxlktumrlszfrmggswgr` (TYPERFORMANCE Test) · Live project `vplgfxykeykidlihdfxa`: do not touch.

Migrations for this module start at `029_`. They are tested locally with PGlite (`npm test`) and loaded into the test project when segments are complete.

| Segment | Status |
|---|---|
| Spec | Done (docs/PROGRAMMING_SPEC.md) |
| A Exercise library | Done |
| B Program builder | Done |
| C Groups, assignment, calendar | Done (incl. needs-a-program panel) |
| D Workout logging + comments | Done: tap-to-save logger, rest timer, progress bar, in-app video, e1RM loads, coach feed + log review |
| E Progress tracking | Done |
| F Chat | Done: live chat, inbox, unread badges, announcements |
| G Habits, macros, photos | Done (+ meal plan builder, premium toggle; nutrition in compliance card) |
| H GHL payments | Done: /api/ghl/payments webhook, payment event log |
| I Trainerize move | Done: bulk invites (skip approval), docs/LAUNCH.md |
| J Periodisation | Done: seasons, phase timeline, load:deload bars, fights, assigned-vs-planned, client phase banner |
| L Readiness, session summary, rewards | Done |
| K Coach overview dashboard | Done: 9 cards, show/hide, follow-ups on client page |
| Scheduled/recurring messages (part of F) | Done (in-app, pg_cron every minute) |
| Test database loaded | Done: migrations 001–043 + pg_cron + pg_net (app_url still to set) |

## Backlog from Tyrell (add when able)
- Notifications centre — DONE (inbox + bell, migration 051)
- Group options (beyond membership)
- Announcements (in-app, to all / group) — DONE via Announcements & scheduled (send now/later to everyone, a group or one client)
- Referral offers — DONE (migration 050)
- Form builder (e.g. general check-in form) — DONE (migration 049)
- Scheduled + recurring chat messages are IN-APP only (not email)
- Launch-first priority suggested: logging, chat, coach dashboard, payments; announcements/referrals/forms in phase 2
- Later: review Tyrell's Trainerize account (read-only, via his Chrome) for features to match, esp. Settings → Auto Messages & Events onboarding sequences
- Also done: per-exercise fields/units, faded prescribed values, master templates, exercise swap, program instructions, one-week-at-a-time, block labels, timers
| M Push notifications | Done: web push, outbox, reminders, prefs page |
- Habit gamification done (streaks, perfect days, weekly score, badges)
- VBT done (m/s targets, velocity metric, per-line metric overrides)
| N Onboarding sequences | Done |

## 2026-11-25 – usability pass
- Speed fields default to m/s (km/h, mph still selectable); "Velocity" renamed "Bar speed (VBT)". Migration 046.
- Coach: desktop side panel + phone bottom bar/More sheet (`CoachNav`, `coach/layout.tsx`); new `/coach/clients` list with search.
- Dashboard: attention list shows only non-empty items; compact client rows.
- Client pages share one tabbed header (`ClientTabs`): Calendar · Overview · Progress · Habits & food · Testing · Mobility · Fights · Profile.
- Planner (`PlanCalendar`): week view with exercises per day, month view, "+" to build a workout on any day, drag to move (Alt-drag copies), drag a program onto a day to start it (tap-then-tap on phones), confirm before assigning.
- Client home: big Start workout button + icon tiles.

## 2026-11-25 overnight
- Programming: tick-to-superset builder, sets/reps boxes, drag reorder, duplicate, quick-add exercise, Enter-to-add; apply line to later weeks with progression; exercise default prescriptions; saved blocks; detailed program grid; shift assigned block; copy week forward (047).
- Library: category chips, tags (048), no-video filter, bulk move/tag/archive.
- Client exercise pop-up (video, how-to, e1RM, best set, last 5 sessions).
- Logger redesigned TrainHeroic-style: one exercise/superset per screen, progress dots, totals, Back/Timer/Next, timers (rest, stopwatch, EMOM, Tabata), wrap-up screen; "See all" list view kept.
- Forms (049), referrals (050), notifications inbox (051).
- Trainerize import DONE: 2,357 custom exercises (2,341 new + 16 merged), 2,284 with video, 1,274 with instructions. Import endpoint disabled (returns 410) and helper locked; `public.import_trainerize_svc` + `private.import_trainerize` can be dropped from TEST.
