# TYPERFORMANCE app: beta testing, releases and updates

## 1. Two copies of the app

| | Test (beta) | Live |
|---|---|---|
| Code branch | `programming-v2` | `main` |
| Web address | Vercel preview link for `programming-v2` | typerformance-app.vercel.app |
| Database | Test Supabase project (`mxlk…`) | Live Supabase project (`vplg…`) |
| Who uses it | You + beta testers | All clients |

Rule: nothing reaches Live until it has run on Test first.

## 2. Beta testing (now → launch)

1. Pick 5 to 10 clients who train often and will tell you when something's off. Mix iPhone and Android, fighters and general clients.
2. Add them on the Test app, then tick **Beta tester** on their Profile tab.
3. They install it like an app: open the link in Safari (iPhone) or Chrome (Android), then **Share › Add to Home Screen**.
4. They report problems from **More › Report a problem or idea**. The page they were on, app version and phone type are attached automatically.
5. You triage in **Coach › Beta feedback** (New / Planned / Fixed / Won't fix). Mark "Fixed" when it ships so you can tell them.
6. Run the beta for at least 3 to 4 weeks so every feature gets a real week of use (check-ins, automations, program rollover).

What to ask beta testers to try each week: log 3 workouts (one with a swap), send a video in chat, fill the check-in, move a workout, book a call.

## 3. Going live (first launch)

1. Back up the live database (Supabase › Database › Backups).
2. Run the migrations listed in `LAUNCH.md` on Live, **in number order**, before the new code goes up. Every migration only adds things, so the old app keeps working while you do it.
3. Merge `programming-v2` into `main`. Vercel deploys Live automatically.
4. Smoke test on your own phone: sign in, open a client, log a set, send a message.
5. If anything is badly wrong: Vercel › Deployments › previous deployment › **Instant rollback**. Database changes stay (they're additive), so rollback is safe.

## 4. App stores (later)

The app already installs from the browser (a "PWA"), so you don't need the stores to launch.

When you want App Store / Google Play listings (needed for Apple Health / Health Connect, Garmin, etc.):
- Wrap the same code with **Capacitor** (one codebase for web, iPhone and Android).
- iPhone beta: **TestFlight**. Android beta: **Google Play internal testing**. Both need developer accounts (Apple charges a yearly fee, Google a one-off fee; check current prices when you sign up).
- Risk: Apple can reject apps that are "just a website". Native features (push notifications, Health data) are what get it through review, so the store build should ship with the health hub, not before it.

## 5. Shipping updates after launch

- **Most updates need no store release.** Web code updates the moment Vercel deploys, including inside the installed app. Store builds are only needed when native parts change (health, push setup, app icon).
- **Every release:**
  1. Build and test on `programming-v2` (Test).
  2. Add a short entry at the top of `src/lib/changelog.ts`. Clients see it under **More › What's new**.
  3. Bump `version` in `package.json` (0.9 → 0.10 for features, 0.9.1 for fixes).
  4. Run any new migrations on Live, then merge to `main`.
- **Risky features go to beta testers first.** Gate them on `profile.beta` in the code, watch feedback for a week, then switch on for everyone.
- **Database changes are always "add first, remove later".** Add new columns/tables first, ship code that uses them, and only remove old ones in a later release. That keeps rollback safe.

## 6. Costs to expect (only when you need them)

- Supabase: the free tier pauses after a week of inactivity and has little storage. Move Live to Pro before launch.
- Vercel: the free Hobby plan is for non-commercial use. A paid business needs Pro.
- AI features (meal plans, reports, assistant): pay-per-use Anthropic API key, added in Vercel when you're ready.
- App store developer accounts: only when you build the store versions.
