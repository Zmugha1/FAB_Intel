// Bar report figures, computed from rows. Pure, so it is tested with fake data.
import { cardState } from './loyalty.ts'
import { LOYALTY_MODEL_FACTORS, computeReadiness, returnOutcome, type Stage } from './readiness.ts'

export type PatronRow = { id: string; display_name: string; created_at: string }
export type VisitRow = { patron_id: string; confirmed_at: string; voided_at: string | null }
export type RewardRow = { patron_id: string; earned_at: string; redeemed_at: string | null }
export type DecisionRow = { created_at: string }

export type BarReport = {
  patrons: number
  newPatrons30: number
  visits: number
  visits30: number
  repeatPatrons: number
  repeatVisits: number // visits after each guest's first
  repeatRate: number | null // null when there are no patrons with a visit
  rewardsEarned: number
  rewardsRedeemed: number
  decisions: number
  firstActivityAt: string | null
  readiness: Stage[]
  recentSignups: { name: string; joined: string }[]
}

const DAY = 86_400_000

export function buildReport(input: {
  patrons: PatronRow[]
  visits: VisitRow[]
  rewards: RewardRow[]
  decisions: DecisionRow[]
  now: Date
  predictiveValidatedAt: string | null
  agentLimitSignedAt: string | null
}): BarReport {
  const now = input.now
  const since30 = now.getTime() - 30 * DAY
  const live = input.visits.filter((v) => !v.voided_at)

  const byPatron = new Map<string, Date[]>()
  for (const v of live) {
    const list = byPatron.get(v.patron_id) ?? []
    list.push(new Date(v.confirmed_at))
    byPatron.set(v.patron_id, list)
  }
  const withVisit = byPatron.size
  const repeatPatrons = [...byPatron.values()].filter((l) => l.length >= 2).length

  let returned = 0
  let notReturned = 0
  for (const times of byPatron.values()) {
    const o = returnOutcome(times, now)
    if (o === 'returned') returned++
    else if (o === 'not_returned') notReturned++
  }

  // Approved actions in a row: confirmed visits since the most recent voided visit.
  const sortedAll = [...input.visits].sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at))
  let streak = 0
  for (const v of sortedAll) streak = v.voided_at ? 0 : streak + 1

  const times = [
    ...input.patrons.map((p) => p.created_at),
    ...input.visits.map((v) => v.confirmed_at),
    ...input.decisions.map((d) => d.created_at),
  ].sort()
  const firstActivityAt = times[0] ?? null

  const readiness = computeReadiness({
    firstActivityAt: firstActivityAt ? new Date(firstActivityAt) : null,
    now,
    decisionCount: input.decisions.length,
    outcomesReturned: returned,
    outcomesNotReturned: notReturned,
    factorCount: LOYALTY_MODEL_FACTORS,
    approvedActionStreak: streak,
    predictiveValidatedAt: input.predictiveValidatedAt ? new Date(input.predictiveValidatedAt) : null,
    agentLimitSignedAt: input.agentLimitSignedAt ? new Date(input.agentLimitSignedAt) : null,
  })

  const recentSignups = [...input.patrons]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((p) => ({ name: p.display_name, joined: p.created_at }))

  return {
    patrons: input.patrons.length,
    newPatrons30: input.patrons.filter((p) => new Date(p.created_at).getTime() >= since30).length,
    visits: live.length,
    visits30: live.filter((v) => new Date(v.confirmed_at).getTime() >= since30).length,
    repeatPatrons,
    repeatVisits: live.length - withVisit,
    repeatRate: withVisit === 0 ? null : repeatPatrons / withVisit,
    rewardsEarned: input.rewards.length,
    rewardsRedeemed: input.rewards.filter((r) => r.redeemed_at).length,
    decisions: input.decisions.length,
    firstActivityAt,
    readiness,
    recentSignups,
  }
}

export { cardState }
