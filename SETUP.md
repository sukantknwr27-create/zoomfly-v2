# ZoomFly v2: setup, step by step

## 1. Database (new, empty Supabase project)
Run the five files in `supabase/migrations/` in order (SQL editor, or `supabase db push`). Details: `supabase/README.md`.
If you already ran the earlier version of file 01, reset the empty project and run all five again: file 01 changed (storage limits and a stricter server check).

## 2. Make yourself the admin
Sign up on the site first, then in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');
```
The admin links (Seller reviews, Trip reviews, Destinations) then appear in the header. Admin pages return 404 for everyone else.

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

## 7. Try the whole flow once
1. As admin: Destinations → add Manali (sellers pick from this list).
2. Create a second account, "Sell on ZoomFly", send an application (documents upload straight to Supabase Storage).
3. As admin: Seller reviews → open it → tick the five checks → Approve.
4. As the seller: Your trips → Add a trip → fill the details, add 3+ real photos and a departure with seats → "Save and send for review".
5. As admin: Trip reviews → open it → choose the commission category → Publish.
6. The trip now appears on the home page with its real seats and dates.
