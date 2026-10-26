# FAB Intel session log

## 2026-10-26, v0.1.0, branch feature/loyalty-qr
Shipped: loyalty QR app (join, card, staff confirm and redeem, admin venues, QR poster, guest list export),
AI Transformation Roadmap computed from records, ROI page, Knowledge Wiki, version footer,
Decision Intel demo for bars on sample data.
Checks: 16 unit tests pass. Type check, lint and build clean. No server names in the browser bundle.
Migration applied on local Postgres with Supabase default grants simulated. RLS: owner sees only their venue,
admin sees all, anon sees nothing, staff_pin_hash not readable by signed in users.
Pending: Supabase project, Netlify site and env, first venue. See RUNBOOK. Open items in TECH_DEBT.
