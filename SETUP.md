# ZoomFly v2: setup, step by step

## 1. Database (new Supabase project)
Run the five files in `supabase/migrations/` in order (SQL editor, or `supabase db push`). Details: `supabase/README.md`.

## 2. Make yourself the admin
Sign up on the site first, then in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');
```
The "Seller reviews" link then appears in the header. Admin pages return 404 for everyone else.

## 3. Supabase auth settings (Authentication → URL configuration)
- Site URL: `https://zoomfly.in` (and `http://localhost:3000` while developing)
- Redirect URLs: `https://zoomfly.in/auth/callback`, `http://localhost:3000/auth/callback`
- Keep "Confirm email" ON for production.

## 4. Environment variables (`web/.env.local`, and in Vercel → Settings → Environment Variables)
Copy `web/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is not used yet; it is for bookings/payments and must never be exposed to the browser.

## 5. Run
```bash
cd web && npm install && npm run dev      # http://localhost:3000
```

## 6. Deploy
Push `web/` to the `zoomfly-v2` GitHub repo, import it in Vercel (root directory `web`), add the env vars, deploy. Keep zoomfly.in pointing at the OLD site until the new one is ready; test on the Vercel preview URL.

## 7. Try the flow
1. Create an account, open "Sell on ZoomFly", send an application.
2. Sign in as admin → Seller reviews → open it → tick the checks → Approve.
3. The seller area shows "Approved" and the checklist.
4. The home page stays honestly empty until a verified seller publishes dates with seats (trip builder is the next feature).
