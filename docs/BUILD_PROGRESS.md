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
| E Progress tracking | Not started |
| F Chat | Not started |
| G Habits, macros, photos | Not started |
| H GHL payments | Not started |
| I Trainerize move | Not started |
| J Periodisation | Not started |
| Scheduled/recurring messages (part of F) | Not started |
| Test database loaded | Not started |

## Backlog from Tyrell (add when able)
- K Coach overview dashboard (spec Segment K): incomplete setups, missed check-ins, inactive, follow-ups due, new PBs, programs expiring ≤7d / expired, compliance (toggle), average sign-in (toggle)
- Notifications centre
- Group options (beyond membership)
- Announcements (in-app, to all / group)
- Referral offers
- Form builder (e.g. general check-in form)
- Scheduled + recurring chat messages are IN-APP only (not email)
- Launch-first priority suggested: logging, chat, coach dashboard, payments; announcements/referrals/forms in phase 2
