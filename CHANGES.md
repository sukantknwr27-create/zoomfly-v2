# ZoomFly v2: premium marketplace redesign

Unzip over the repo root (paths are web/src/...). 11 files, no logic, database or payment changes.

New: components/TripCard.tsx, components/Icons.tsx
Changed: app/globals.css (whole design system), app/layout.tsx (fonts: Fraunces + Plus Jakarta Sans),
components/SiteHeader.tsx (sticky, mobile menu, Trips now links to /trips), components/SiteFooter.tsx,
app/page.tsx (hero, overlapping search bar, trust row, leaving soon, destination tiles, trip cards, seller band),
app/trips/page.tsx (filter bar + card grid), app/trips/[slug]/page.tsx (facts row, sticky booking card,
mobile book bar), app/destinations/page.tsx (photo tiles), app/destinations/[slug]/page.tsx (hero + cards)

Honesty rules kept: photos only from real listings, ratings only when real reviews exist, seat counts and dates
straight from the database, no fake urgency. With no listings the home hero shows an "Opening for bookings soon" card.

Not touched, but they pick up the new look through shared classes: seller area, admin, booking, account, legal pages.
Checked: tsc --noEmit passes; pages rendered at desktop and 390px mobile.
