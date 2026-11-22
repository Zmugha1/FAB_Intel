import { describe, expect, it } from "vitest";
import { addDays, money, pct, toCents, today } from "./format";

describe("format", () => {
  it("formats money and percent like the backend", () => {
    expect(money(392000)).toBe("$3,920.00");
    expect(money(5)).toBe("$0.05");
    expect(money(null)).toBe("Not set");
    expect(pct(3500)).toBe("35%");
    expect(pct(3584)).toBe("35.8%");
  });
  it("parses typed dollars into cents and refuses words", () => {
    expect(toCents("$1,200.50")).toBe(120050);
    expect(toCents("17")).toBe(1700);
    expect(toCents("abc")).toBeNull();
    expect(toCents("1.234")).toBeNull();
  });
  it("moves dates across month ends", () => {
    expect(today(new Date(2026, 11, 3))).toBe("2026-12-03");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
