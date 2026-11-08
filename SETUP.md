# TYPERFORMANCE App: Setup Guide (Segment 1)

About 30 to 40 minutes, one time. Both services are free to start.

## 1. Create the database (Supabase)
1. Go to supabase.com, then sign up and click **New project**.
2. Name: `typerformance`. Region: **Sydney (ap-southeast-2)**. This keeps athlete health data in Australia.
3. Save the database password somewhere safe.

## 2. Load the app's tables
1. In Supabase, open **SQL Editor**, then **New query**.
2. Open `supabase/migrations/001_segment1_auth_profiles.sql`, copy all of it, paste, and click **Run**.
3. You should see "Success". Under **Table Editor** you'll now have `profiles`, `disciplines` (7 rows) and `session_types` (23 rows).

## 3. Login settings
**Authentication → Sign In / Providers → Email**
- Email: **on**
- **Confirm email: OFF** (recommended). You approve every athlete yourself, so email confirmation only adds a step where athletes get stuck. Anyone who signs up just waits in your approval list.

**Authentication → URL Configuration** (do this after step 5, once you have your web address)
- Site URL: `https://YOUR-APP.vercel.app`
- Redirect URLs: add `https://YOUR-APP.vercel.app/**`

## 4. Password reset email (SKIP FOR NOW, do before athletes launch)
New free Supabase projects can't edit email templates until you connect your own email sender (custom SMTP). Supabase's built-in sender also only emails your own team's addresses, at 2 per hour. So athletes won't get reset emails until custom SMTP is set up. Nothing else in Segment 1 needs email, so carry on to step 5.

Once custom SMTP is on (Authentication → Emails → SMTP Settings), go to **Authentication → Emails → Reset Password** and replace the link with:
```
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset your password</a>
```
Why: the default link fails if an athlete opens the email in a different browser (for example the Gmail app). This version works anywhere.

If you leave "Confirm email" ON, also edit **Confirm signup** to:
```
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

> Supabase's built-in email sender only allows a few emails per hour. That's fine for testing. Before launch, add your own sender under **Authentication → Emails → SMTP**. We'll sort this out in Segment 6 with GHL.

## 5. Put the app online (Vercel)
1. Supabase, then **Project Settings → API**. Copy the **Project URL** and the **anon / publishable key**.
2. Create a private repo on github.com and upload this folder (drag and drop works).
3. On vercel.com, click **Add New → Project**, then import that repo.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**. When it finishes, you get `https://something.vercel.app`. Go back and finish step 3's URL settings.

## 6. Make yourself the coach
1. Open your app and **sign up** with your own email.
2. In Supabase **SQL Editor**, run (with your email):
```sql
update public.profiles set role = 'coach', status = 'active' where email = 'tyrell.n3@gmail.com';
```
3. Refresh the app. You'll land on the **Athletes** screen.

## 7. Test it like an athlete
1. On your phone (in a private tab or a second email), sign up as a test athlete.
2. Go through consent and profile. You'll see "You're in the queue".
3. On your coach screen, approve them. They now land on their home screen.
4. Then Safari: Share → **Add to Home Screen**. Android Chrome: ⋮ → **Add to Home screen**.

## Segment 2 (weekly logging)
Run `supabase/migrations/002_segment2_weekly_logging.sql` in the SQL Editor once (already done for the live project on 8 Nov 2026).

## Changing the consent wording later
Edit `src/lib/consent.ts` and change `CONSENT_VERSION`. Every athlete will be asked to accept the new wording the next time they open the app.

## For developers
```
npm install
npm test          # 33 tests: database security rules + logic
npm run dev       # needs .env.local with the two variables above
```
