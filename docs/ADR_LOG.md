# FAB Intel ADR log

Add only. Never delete or renumber.

ADR-1
Date: 2026-10-26
Decision: FAB Intel lives in its own repo, Zmugha1/FAB_Intel, not in a hub client folder.
Layer: Repo
Context: The hub plan from October 2026 is one hub repo with client folders. FAB Intel is a public facing Netlify app that bars use every day, with its own Supabase project and its own deploys.
Consequence: Patterns were ported from the private cloud build (Netlify functions, service role writes, bearer token auth, 1000 row paging, node test runner) and rewritten for this data model. No code or data from another client was copied.
Never do: Paste another client's code, names, domains or Supabase project into this repo.

ADR-2
Date: 2026-10-26
Decision: Netlify hosts the app and functions. Supabase holds the data, in a new project used only by FAB Intel.
Layer: Deployment
Context: Matches the private cloud build and the $199 a month data maintenance costed on Supabase Pro.
Consequence: Two env groups. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the browser. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for functions only.
Never do: Put the service role key in a VITE_ variable or anywhere the browser can load it.

ADR-3
Date: 2026-10-26
Decision: One app, many venues. Each venue's guests, visits and rewards are walled off by row level security.
Layer: Data
Context: Mary Jane will run the program at several bars. A bar owner must never see another bar's guests.
Consequence: Signed in users read only venues in bar_members, or all venues if they are in app_admins. All writes go through functions. Tested on local Postgres with two venues, two owners and an admin.
Never do: Add a policy that lets anon read any table, or one that drops the venue filter.

ADR-4
Date: 2026-10-26
Decision: Staff confirm purchases with a venue PIN checked on the server. Five wrong PINs from one device in 15 minutes locks that device out.
Layer: Security
Context: Without a staff step, guests could punch their own cards.
Consequence: The PIN is stored as a salted scrypt hash. The PIN stays in page memory only. Attempts are logged per venue with a hashed device key, never a raw IP address.
Never do: Store the PIN in plain text, in local storage, or in a column the browser can select.

ADR-5
Date: 2026-10-26
Decision: Guests agree to join at sign up. The consent text and time are stored with each guest. No payment data is collected.
Layer: Data
Context: The guest list belongs to the venue and is used for offers. The venue needs a record that each guest agreed.
Consequence: Sign up fails without the consent box. One guest per venue per email or phone. A repeat sign up returns the same card.
Never do: Add a guest without a consent time, or collect card numbers.

ADR-6
Date: 2026-10-26
Decision: The Decision Intel demo runs on sample data only, on its own route, labeled Sample data.
Layer: Product
Context: Mary Jane shows the demo to prospects. A real venue's data must never appear in it.
Consequence: Demo figures live in src/demo/data.ts with an invented venue. The demo makes no API calls.
Never do: Load real venue data into /demo.

ADR-7
Date: 2026-10-26
Decision: The AI Transformation Roadmap is computed from records. Generative opens at 90 days of data and 20 decisions. Predictive at 180 days and 10 outcomes per model factor, counting the rarer outcome. Agentic needs validated predictions, 300 approved actions in a row and a signed written limit.
Layer: Decision Science
Context: Data first, decisions second, AI third. Stages must open on evidence, not on a sales date.
Consequence: computeReadiness is pure and tested. Decisions counted: venue created, reward rule changed, venue paused or resumed, reward redeemed. Return outcome: a guest came back within 30 days of a first visit. The loyalty model uses three factors.
Never do: Switch a stage on by hand, or count PIN resets and exports as decisions.

ADR-8
Date: 2026-10-26
Decision: The app uses the venue brand palette. No mascot. Text credit only.
Layer: Brand
Context: Mary Jane sells this under her brand to bars.
Consequence: Navy, red, orange and cream. Footer reads Built by Dr. Data Decision Intelligence.
Never do: Add the Dr. Data mascot image to this app.

ADR-9
Date: 2026-10-26
Decision: Every page footer shows the version, from src/lib/shared/version.ts.
Layer: Product
Context: Upgrades get confusing without a visible version.
Consequence: Version 0.1.0 at launch.
Never do: Ship a release without bumping the version.
