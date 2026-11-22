import { invoke } from "@tauri-apps/api/core";

/** Calls the FAB Intel backend. Errors come back as plain sentences. */
export async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    const message = typeof e === "string" ? e : e instanceof Error ? e.message : "Something went wrong.";
    // The session ended (15 minutes idle, or signed out elsewhere). The shell goes back to sign-in.
    if (message.startsWith("Sign in to use FAB Intel")) window.dispatchEvent(new Event("fab-signed-out"));
    throw new Error(message);
  }
}

export type User = { id: string; name: string; role: "owner" | "staff"; businesses: string[]; has_password: boolean; active: boolean };
export type Status = { needs_setup: boolean; user: User | null; users: { id: string; name: string }[]; sample: boolean; version: string; commit: string };
export type Contact = { id: number; name: string; company: string; email: string; phone: string; businesses: string[]; source: string; notes: string; sample: boolean };
export type Line = { item: string; vendor: string; decoration: string; qty: number; unit_cost_cents: number; unit_price_cents: number; taxable: boolean };
export type Totals = { subtotal_cents: number; cost_cents: number; tax_cents: number | null; total_cents: number; margin_bp: number | null };
export type Quote = {
  id: number; number: string; contact_id: number; contact: string; business: string; status: string;
  lines: Line[]; checklist: Record<string, boolean>; open_checklist: string[]; notes: string; totals: Totals;
  needs_owner: string[]; created_by: string; approved_by: string | null; requested_at: number | null; sent_at: number | null; created_at: number; sample: boolean; costs_hidden: boolean;
};
export type Invoice = {
  id: number; number: string; contact_id: number; contact: string; quote_id: number | null; business: string; amount_cents: number;
  status: string; repeat: string; due_date: string; pay_via: string; notes: string; overdue_days: number; sample: boolean;
};
export type Project = {
  id: number; name: string; contact_id: number; contact: string; quote_id: number | null; business: string; art_link: string; art_ok: boolean;
  proof: string; revisions: number; in_hands: string; status: string; notes: string; sample: boolean;
};
export type BriefItem = { level: "act" | "watch" | "gap"; title: string; detail: string; view: string; business: string };
export type RoiRow = { key: string; label: string; unit: string; baseline: number | null; note: string; now: number | null; how: string };
export type Rules = { margin_floor_bp: number; approve_over_cents: number; staff_quotes_need_owner: boolean; tax_rate_bp: number | null; quote_valid_days: number; follow_up_days: number; staff_see_costs: boolean | null };
export type LogRow = { at: number; user: string; action: string; entity: string; entity_id: number | null; detail: string };
