# ZoomFly v3: marketplace redesign from your mockups

Unzip over the repo root (paths are web/src/...). 39 files, no database, payment or booking-logic changes.

NEW pages: /trust (Trust Centre), /reviews, /sellers, /sellers/[id] (public seller profile), /trip-planner
RESTYLED: home, /trips (filters + result rows + right rail), trip page (tabs, sticky booking card), /book (steps),
login/signup/forgot-password (split card), account/bookings/messages (sidebar + stat cards), seller area and admin
(sidebar), admin dashboard (stat cards), become-a-seller (steps + rail), header (avatar menu, bell), footer.
NEW shared: Banner, Steps, Stars, TripRow, Shell/SideNav/Shells, AuthShell, ReviewBits, lib/reviews.ts
Also: sitemap.ts lists the new public pages; layout.tsx font is now Plus Jakarta Sans only.

Kept honest: every number (ratings, review counts, seats, trips, dates) is read from the database and hides when empty.
The Trip planner is a matcher over real open departures, not AI, so it is not labelled AI.
Checked: tsc --noEmit passes; pages rendered at desktop and 390px mobile with sample data (sandbox only).
