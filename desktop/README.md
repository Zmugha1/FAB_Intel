# FAB Intel desktop

The private FAB Intel app for WurkHub. It runs on the owner's Windows computer and keeps all data in one SQLite file there.
The web app at the repo root stays as it is: it is the Loyalty QR marketing demo.

## What is in Phase 1

| Module | Screen | Status |
|---|---|---|
| 1.1 Platform | Sign-in, owner and staff roles, rules, decision log | Live |
| 1.2 Contacts | One list, tagged by business, duplicate warning | Live. Imports from 17hats and Google Contacts are Planned |
| 1.3 Quotes | Live margin and tax, the STZ checklist, the approval gate | Live |
| 1.4 Invoices | From a won quote or by hand, repeats, overdue days | Live. Stripe and Square status is Planned |
| 1.5 Projects and artwork | Proof board, revisions, art link and check | Live |
| 1.6 Morning Brief | Built by code from the records | Live |
| 1.7 ROI | Owner's starting numbers next to measured ones | Live |

Phase 2 modules show in the menu, greyed out, until they are delivered.

## Rules carried from the agreement and the STZ interview

- Margin floor 35%. Owner approves quotes over $2,500.
- The owner approves every quote staff drafts.
- A quote cannot go for approval until the checklist is complete: shipping, less-than-minimum, color changes, setup fees, in-hands date, art.
- Sales tax stays empty until the owner sets it. Starting numbers stay empty until the owner enters them.
- Staff see only the businesses ticked for them. ROI is owner only.

## Built from the MVP Hub

Sign-in is the Hub's design (DD-ADR-073): Argon2 hashes, lock after five wrong tries, sign-out after 15 minutes idle.
Also from the Hub: one decision log, rules in code, an ROI page, Live or Planned labels, the version footer, the Tauri 2 shell and icons.
Multi-user browser access for staff on other computers comes from the Hub's browser server (DD-ADR-055) in a later step.

## Layout

- `core/`: Rust crate with the database, sign-in, quote math, brief and ROI. No UI. All tests live here.
- `src-tauri/`: the desktop shell. Each command checks the signed-in user and calls `core`.
- `src/`: React screens.

## Commands

```
npm install
cargo test -p fab-core        # core tests
npx tsc --noEmit && npm test  # frontend types and tests
npm run tauri dev             # run on this computer
npm run tauri build           # Windows installer (.msi and .exe), run on Windows
```

The database file is in the app data folder: `%APPDATA%\com.drdata.fabintel\fab-intel.db` on Windows.

Version: keep `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `core/Cargo.toml`, `package.json` and `src/version.ts` in step.
