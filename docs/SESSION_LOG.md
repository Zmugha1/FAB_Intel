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

## 2026-11-22, desktop v0.1.0, branch desktop
Started the FAB Intel desktop app in `desktop/`, built from MVP Hub patterns. Phase 1 modules 1.1 to 1.7 run on a local
SQLite database with owner and staff sign-in. Phase 2 shows greyed out. Her systems are listed as Planned.
Rules from the signed agreement and the STZ interview: 35% floor, $2,500 limit, owner approves every staff quote, quote checklist.
Checks: core tests, frontend types and tests, production build, desktop shell compiled and run on Linux.
Not run: Windows build and installer. Pending: imports, Stripe and Square, browser access for staff, two-step sign-in.
