# FAB Intel

Private loyalty and decision intelligence for Food and Beverage Merch and the venues it serves.
Built by Dr. Data Decision Intelligence LLC. Version 0.1.0.

## What ships in 0.1.0

| Path | Who | What |
|---|---|---|
| `/join/<venue>` | Guests | Scan the QR, join the rewards card, agree to join |
| `/card/<code>` | Guests | Their card: code, punches, rewards ready |
| `/staff/<venue>` | Bar staff | Unlock with the venue PIN, confirm a purchase, redeem a reward |
| `/admin` | Mary Jane, venue owners | Venues, QR poster, guest list, AI Transformation Roadmap, ROI, Knowledge Wiki |
| `/demo` | Prospects | Decision Intel demo for bars and restaurants, sample data only |

## Stack

Vite, React and TypeScript in the browser. Netlify functions on the server. Supabase Postgres for data.
Every write goes through a Netlify function with the service role key. The browser only reads, and only
the venues the signed-in user belongs to.

## Commands

```
npm install
npm test        # unit tests, fake data only
npx tsc -b      # type check
npm run lint
npm run build
```

## Setup

See `docs/RUNBOOK.md`. Rules for working in this repo are in `CLAUDE.md`. Decisions are in `docs/ADR_LOG.md`.
