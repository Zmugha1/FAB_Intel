import { Rules } from "../ipc";
import { money, pct, toCents } from "../format";

type LineText = { qty: string; cost: string; price: string; taxable: boolean };

/**
 * Live totals while typing. Same math as fab-core quote.rs; the backend recomputes on save.
 * When costs are hidden from staff, cost counts as zero and margin is not shown or judged here.
 */
export function liveTotals(lines: LineText[], rules: Rules, staff: boolean, costsHidden = false) {
  let subtotal = 0, cost = 0, taxable = 0;
  for (const l of lines) {
    const q = Number(l.qty), c = costsHidden ? 0 : toCents(l.cost), p = toCents(l.price);
    if (!Number.isInteger(q) || q <= 0 || c === null || p === null) continue;
    subtotal += q * p;
    cost += q * c;
    if (l.taxable) taxable += q * p;
  }
  const tax = rules.tax_rate_bp === null ? null : Math.floor((taxable * rules.tax_rate_bp + 5000) / 10000);
  const total = subtotal + (tax ?? 0);
  const margin = costsHidden ? null : subtotal > 0 ? Math.trunc(((subtotal - cost) * 10000) / subtotal) : null;
  const reasons: string[] = [];
  if (staff && rules.staff_quotes_need_owner) reasons.push("Drafted by staff. The owner approves every staff quote.");
  if (margin !== null && margin < rules.margin_floor_bp) reasons.push(`Margin ${pct(margin)} is under the ${pct(rules.margin_floor_bp)} floor.`);
  if (total > rules.approve_over_cents) reasons.push(`Total ${money(total)} is over the ${money(rules.approve_over_cents)} limit.`);
  return { subtotal, cost, tax, total, margin, reasons };
}
