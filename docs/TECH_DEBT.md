# FAB Intel tech debt

Add only. Close items by adding a closed date.

1. Owner accounts are added by SQL (runbook section 3). Add an invite screen for admins.
2. Two staff confirmations of the same card at the same instant could both count toward a reward. Move punch and reward to one database function with a row lock.
3. Voiding a mistaken punch needs SQL. Add a void button for admins, recorded as a decision.
4. predictive_validated_at and agent_limit_signed_at have no screen yet. Both stay empty until the predictive layer exists.
5. The ROI tile does not subtract reward cost.
6. Card codes are typed by staff. Add a scan of the guest's card QR.
7. No end to end test against a live Supabase project yet. Unit tests cover the logic and RLS was tested on local Postgres.
