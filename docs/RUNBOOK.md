# FAB Intel runbook

## 1. First deploy
1. Create a new Supabase project for FAB Intel only. Region: US.
2. Open SQL Editor. Paste `supabase/migrations/20261026120000_loyalty_core.sql`. Run.
3. Check it applied:
   `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('bars','patrons','visits','rewards','decision_log','pin_attempts','bar_members','app_admins');`
   Expect 8.
4. Authentication > Users > Add user: Mary Jane's email and a password. Repeat for Zubia.
5. Make both admins. In SQL Editor:
   `insert into public.app_admins (user_id) select id from auth.users where email in ('maryjane@wurkhub.com', 'zubiam@drdatadecisionintelligence.com');`
6. Authentication > Sign In / Providers: turn off public sign ups.
7. New Netlify site from the GitHub repo, branch main. Build `npm run build`, publish `dist`.
8. Netlify env:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from Supabase API settings.
   - `SUPABASE_URL` (same URL) and `SUPABASE_SERVICE_ROLE_KEY`. Mark the service key secret.
9. Deploy. Confirm the Published deploy hash matches the merged commit.

## 2. Add a venue
Sign in at `/admin`, press Add a venue, set the reward and a staff PIN. Open QR poster, print it.
Give staff the staff link and the PIN in person.

## 3. Give a bar owner their own view
1. Supabase > Authentication > Add user with the owner's email.
2. SQL Editor:
   `insert into public.bar_members (bar_id, user_id, role) select b.id, u.id, 'owner' from public.bars b, auth.users u where b.slug = 'venue-link-name' and u.email = 'owner@example.com';`

## 4. Staff changed
Settings > New staff PIN. Old PIN stops working at once.

## 5. Guest asks to be removed
SQL Editor: `delete from public.patrons where bar_id = (select id from public.bars where slug = 'venue-link-name') and (email = 'guest@example.com' or phone = '2625550134');`
Their visits and rewards are removed with them.
