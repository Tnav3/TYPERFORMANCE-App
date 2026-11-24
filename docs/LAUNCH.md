# Programming module: test, then launch

## 1. Test version (safe, nothing live changes)
The test database **TYPERFORMANCE Test** (Supabase, Sydney) has every migration loaded.

**Point Vercel's preview links at the test database** (once):
1. Vercel → project → **Settings → Environment Variables**.
2. Add these for the **Preview** environment only (leave Production as it is):
   - `NEXT_PUBLIC_SUPABASE_URL` = test project URL (in Supabase: TYPERFORMANCE Test → Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = test project anon/publishable key
3. Vercel → **Deployments** → the latest `programming-v2` deployment → **Redeploy**.
4. Open that deployment's link on your phone. Sign up, then make yourself coach in the **test** project's SQL editor:
   `update profiles set role = 'coach', status = 'active' where email = 'YOUR EMAIL';`
5. Sign up a second email as a test client and run through: build a program → assign → log on the phone → finish → summary → feed.

Test-project login settings: **Authentication → Sign In / Providers → Email**: Confirm email **off**. **URL Configuration**: add the preview link to Redirect URLs.

## 2. GHL payments → app access
1. Vercel → Environment Variables (**Production** and **Preview**):
   - `GHL_WEBHOOK_SECRET` = a long random string (e.g. from a password manager)
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API → `service_role` key. **Server only. Never put it anywhere else.**
2. GHL → Automation → Workflows → new workflow per trigger:
   - Trigger **Payment Received** (or Order Submitted / Invoice Paid) → action **Webhook** (or Custom Webhook)
   - Trigger **Subscription Cancelled** / **Payment Failed** → action **Webhook**
3. Webhook settings: Method **POST**, URL `https://<your app>/api/ghl/payments`, header `x-typ-secret: <GHL_WEBHOOK_SECRET>`.
   Body (JSON): `{"event": "payment_received", "email": "{{contact.email}}", "plan": "{{product.name}}"}`
   (use `subscription_cancelled` or `payment_failed` as the event for the other workflows).
   If your GHL plan can't add headers, add `?secret=<GHL_WEBHOOK_SECRET>` to the URL instead.
4. Plans: a product name containing "premium", "elite" or "VIP" turns on the meal plan builder; anything else is basic.
5. Check results at **Dashboard → Invites & Payments → Recent payment events**.

What happens: paid → account active (or an invite is created if they haven't signed up yet, so they skip the approval queue). Cancelled/failed → account inactive (their data is kept; paying again reactivates it).

## 3. Moving clients off Trainerize
1. Rebuild your main programs as **master templates** (Programs → More → Save as master).
2. Dashboard → **Invites & Payments** → paste client emails (basic or premium).
3. Send them the app link and "sign up with this email" from GHL.
4. Assign programs from a start date (one week at a time if you prefer).
5. Run both systems for one full block. Cancel Trainerize after that.

## 4. Going live
1. Load migrations `029`–`041` into the **live** Supabase project (SQL editor, in order). They only add things; nothing existing is removed.
2. In Supabase (live) check **Database → Extensions → pg_cron** is enabled (needed for scheduled messages), then run:
   `select cron.schedule('send-due-messages', '* * * * *', 'select public.send_due_messages()');`
3. **Database → Publications → supabase_realtime**: make sure `messages` is included (live chat).
4. Merge `programming-v2` into `main` on GitHub. Vercel deploys production automatically.
5. Custom SMTP (Authentication → Emails → SMTP) if not done yet, so password resets reach clients.
