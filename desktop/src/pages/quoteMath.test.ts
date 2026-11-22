import { describe, expect, it } from "vitest";
import { liveTotals } from "./quoteMath";

const rules = { margin_floor_bp: 3500, approve_over_cents: 250000, staff_quotes_need_owner: true, tax_rate_bp: 550, quote_valid_days: 14, follow_up_days: 3 };

describe("liveTotals", () => {
  it("matches the backend test case to the cent", () => {
    const t = liveTotals([{ qty: "100", cost: "17", price: "26", taxable: true }, { qty: "1", cost: "0", price: "50", taxable: false }], rules, false);
    expect(t.subtotal).toBe(265000);
    expect(t.tax).toBe(14300);
    expect(t.total).toBe(279300);
    expect(t.margin).toBe(3584);
    expect(t.reasons.some((r) => r.includes("limit"))).toBe(true);
  });
  it("leaves tax unset when the owner has not set a rate", () => {
    expect(liveTotals([{ qty: "1", cost: "1", price: "2", taxable: true }], { ...rules, tax_rate_bp: null }, false).tax).toBeNull();
  });
  it("sends staff quotes to the owner", () => {
    expect(liveTotals([{ qty: "10", cost: "1", price: "2", taxable: true }], rules, true).reasons[0]).toContain("staff");
  });
});
