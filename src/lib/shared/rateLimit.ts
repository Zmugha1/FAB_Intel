// Staff PIN lockout. Five wrong PINs from one device in 15 minutes locks that device out.
export const PIN_WINDOW_MINUTES = 15
export const PIN_MAX_FAILURES = 5

export function isLockedOut(recentFailures: number): boolean {
  return recentFailures >= PIN_MAX_FAILURES
}

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - PIN_WINDOW_MINUTES * 60_000)
}
