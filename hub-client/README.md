# FAB Intel on the Dr. Data Hub

The Hub is the app. This folder is the client repo part of it (Build Rules 2.1 and 2.2): FAB Intel's name and icon, its own pages and commands, and how its setup is built. No Hub code is copied or edited here.

## 1. What is here

| Path | What it is |
|---|---|
| `hub.lock` | The Hub release this app is built on: repo, commit, version. |
| `.hub/` | The Hub at that commit, checked out by the script. Not committed. |
| `src-tauri/` | The FAB Intel binary. `main.rs` starts the Hub with FAB's extension. |
| `src-tauri/src/pricing.rs` | The quote check: the owner's margin floor and approval line, holds, alerts, discount flag and sales tax by destination. Her numbers, nothing invented. |
| `src/` | `main.tsx` mounts the Hub screens with FAB's pages. `QuoteCheck.tsx` is the Quote check page. |
| `pack/extensions.toml` | FAB's part and page, copied into the setup before it compiles. |
| `scripts/fab-hub.ps1` | Builds the setup from the answers file and opens the app. |

## 2. How the setup is built

The owner's STZ answers live in one answers file, the My FAB Intel page. It is client data and stays on the owner's machine, never in this repo. The script runs the pinned Hub's compiler on it:

```
hub-validate stz-answers <setup> --answers <file> --scope <file> --pack pack
```

That fills Sheets A, B and C from the file, compiles, and validates. Answers marked decide later or learn from logs stay open and do not block. Run it again whenever answers change.

## 3. Run it on Windows

```
cd C:\Users\zumah\Documents\FAB_Intel
git fetch origin
git switch hub-client
git pull --ff-only origin hub-client
cd hub-client
powershell -ExecutionPolicy Bypass -File .\scripts\fab-hub.ps1 -Answers <path>\fab_intel_answers.toml -Scope <path>\fab_scope.toml -Fresh
```

On first open, add the first person (the owner, admin role) and set the first password. Then open Your business, Quote check.

## 4. Zones

Set by Zubia on November 24, 2026, and recorded in the answers file:

| Task | Zone |
|---|---|
| Sales, onboarding, quotes, invoices, ordering | Inside |
| Artwork and product research | Oscillating |
| Staff role (being onboarded) | Above, moving Inside as they improve |

Inside tasks get a candidate agent. Oscillating tasks get none until they settle.

## 5. Known limits

1. Onboarding uses the Hub's one template, electrical (Hub DEBT-079).
2. The open answers are printed by the script, not yet shown in the app (Hub DEBT-080).
3. No synthetic example of FAB's answers yet. Tests use synthetic lines only.
