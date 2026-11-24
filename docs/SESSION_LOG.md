# FAB Intel session log

## 2026-10-26, v0.1.0, branch feature/loyalty-qr
Shipped: loyalty QR app (join, card, staff confirm and redeem, admin venues, QR poster, guest list export),
AI Transformation Roadmap computed from records, ROI page, Knowledge Wiki, version footer,
Decision Intel demo for bars on sample data.
Checks: 16 unit tests pass. Type check, lint and build clean. No server names in the browser bundle.
Migration applied on local Postgres with Supabase default grants simulated. RLS: owner sees only their venue,
admin sees all, anon sees nothing, staff_pin_hash not readable by signed in users.
Pending: Supabase project, Netlify site and env, first venue. See RUNBOOK. Open items in TECH_DEBT.

## 2026-10-27 v0.1.1
Tomato favicon (public/favicon.svg) linked from index.html. Version bumped to 0.1.1.
Sign-in: real error text shown, and an Email me a sign-in link button (magic link, existing users only).

## 2026-11-24 hub-client 0.2.0, branch hub-client
FAB Intel rebuilt on the Dr. Data Hub (Build Rules 2.1, 2.2) in hub-client/. The Hub is pinned in
hub.lock (0.17.2). The setup is compiled by the Hub's STZ compiler from the owner's answers file
(hub-validate stz-answers), which stays on her machine, never in this repo. Zones: sales, onboarding,
quotes, invoices, ordering Inside; artwork and research Oscillating; staff role Above.
Client part ext.pricing: Quote check with her 25% floor, 35% approval line, holds, alerts, discount
flag and tax by destination. Hub steps R31b to R31d merged for it (decide later, recompile fix,
first person, client builds without Hub screens).
Checks: 9 client Rust tests, tsc and vite build in hub-client, release build compiles. Root: 16 unit
tests, tsc -b, lint and build clean. Root lint ignores hub-client.
Pending: Zubia's test on Windows. The desktop branch (0.1.1) is the earlier app and is left as is.
