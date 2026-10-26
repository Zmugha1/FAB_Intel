export const fmtInt = (n: number) => n.toLocaleString('en-US')
export const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const fmtPct = (n: number | null) => (n === null ? 'No visits yet' : `${Math.round(n * 100)}%`)
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
