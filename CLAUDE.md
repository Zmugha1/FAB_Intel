# FAB Intel: rules for anyone working in this repo

Read this file, `docs/ADR_LOG.md` and the last entry of `docs/SESSION_LOG.md` before changing anything.

## Workflow
- Diagnose and report before writing code. Nothing is committed until Zubia says go.
- One feature, one branch, cut from main. Never push to main. Zubia merges and deploys.
- Report commit hashes, not descriptions.

## Before every commit
- `npm test`, `npx tsc -b`, `npm run lint` and `npm run build` all clean.
- Grep `dist/assets` for `SERVICE_ROLE`, `staff_pin_hash` and `scryptSync`. Zero matches.
- Grep the staged diff for other clients' names, towns and domains. Zero matches or no commit.

## Data
- Never invent a number. Every figure on a live screen comes from a database row. Demo figures live only in `src/demo/data.ts` and the demo is labeled Sample data.
- Supabase returns 1000 rows per request. Count by paging, ordered by id (`fetchAll`).
- Each venue's guests belong to that venue. Never show one venue's guests to another.
- No payment card data, ever.
- The staff PIN is stored only as a salted scrypt hash. Client code never selects `*` from `bars`.

## Migrations
- New table or column means a new timestamped file in `supabase/migrations`. Never edit an applied one.
- Every table gets row level security and explicit grants in the same file. Nothing to anon.
- Zubia runs migrations in the Supabase SQL Editor before deploying.

## Brand
- Venue palette: navy #1E2A4A, red #C1272D, orange #E8772E, cream #FBF4E6.
- No mascot. Credit line: Built by Dr. Data Decision Intelligence.
- No em dashes anywhere: code comments, commits, UI copy.
- Version number shows in every footer. Bump `src/lib/shared/version.ts` and `package.json` together.
