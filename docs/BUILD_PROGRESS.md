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
| Test database loaded | Not started |

## Backlog from Tyrell (add when able)
- Notifications centre
- Group options (beyond membership)
- Announcements (in-app, to all / group)
- Referral offers
- Form builder (e.g. general check-in form)
- Scheduled + recurring chat messages are IN-APP only (not email)
- Launch-first priority suggested: logging, chat, coach dashboard, payments; announcements/referrals/forms in phase 2
- Later: review Tyrell's Trainerize account (read-only, via his Chrome) for features to match, esp. Settings → Auto Messages & Events onboarding sequences
- Also done: per-exercise fields/units, faded prescribed values, master templates, exercise swap, program instructions, one-week-at-a-time, block labels, timers
