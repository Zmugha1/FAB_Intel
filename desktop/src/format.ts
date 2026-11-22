export const BUSINESSES: [string, string][] = [["FB", "F&B Merch"], ["WH", "WurkHub"], ["WM", "WiscoMary"]];
export const bizName = (k: string) => BUSINESSES.find(([c]) => c === k)?.[1] ?? k;

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "Not set";
  const sign = cents < 0 ? "-" : "";
  const c = Math.abs(cents);
  return `${sign}$${Math.floor(c / 100).toLocaleString("en-US")}.${String(c % 100).padStart(2, "0")}`;
}

export function pct(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "Not set";
  return bp % 100 === 0 ? `${bp / 100}%` : `${(bp / 100).toFixed(1)}%`;
}

/** Parses "12.50" or "$1,200" into cents. Returns null when it is not a number. */
export function toCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (clean === "" || !/^\d*\.?\d{0,2}$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Today's date on this computer, YYYY-MM-DD. */
export function today(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return today(new Date(y, m - 1, d + days));
}

export function when(unix: number | null): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "mute"],
  waiting_approval: ["Waiting for owner", "hold"],
  approved: ["Approved", ""],
  sent: ["Sent", ""],
  won: ["Won", "ok"],
  lost: ["Lost", "mute"],
  paid: ["Paid", "ok"],
  void: ["Void", "mute"],
};
