// AI Transformation Roadmap. Each stage opens on measured records, never by hand.
// Foundation: live from day one.
// Generative: 90 days of data and at least 20 recorded decisions.
// Predictive: 180 days of data and at least 10 outcomes per model factor, counting the rarer outcome.
// Agentic: predictive validated, 300 approved actions in a row, and a signed written limit.

export const GENERATIVE_DAYS = 90
export const GENERATIVE_DECISIONS = 20
export const PREDICTIVE_DAYS = 180
export const OUTCOMES_PER_FACTOR = 10
export const AGENTIC_STREAK = 300
// Loyalty return model factors: visit frequency, day of week, reward status.
export const LOYALTY_MODEL_FACTORS = 3

export type StageKey = 'foundation' | 'generative' | 'predictive' | 'agentic'
export type StageStatus = 'live' | 'ready' | 'building' | 'locked'

export type Stage = {
  key: StageKey
  title: string
  gives: string
  status: StageStatus
  progress: number // 0 to 1
  needs: string[] // unmet requirements, plain language with counts
}

export type ReadinessInput = {
  firstActivityAt: Date | null
  now: Date
  decisionCount: number
  outcomesReturned: number
  outcomesNotReturned: number
  factorCount: number
  approvedActionStreak: number
  predictiveValidatedAt: Date | null
  agentLimitSignedAt: Date | null
}

const ratio = (have: number, need: number) => (need <= 0 ? 1 : Math.max(0, Math.min(1, have / need)))

export function daysOfData(first: Date | null, now: Date): number {
  if (!first) return 0
  return Math.max(0, Math.floor((now.getTime() - first.getTime()) / 86_400_000))
}

export function computeReadiness(i: ReadinessInput): Stage[] {
  const days = daysOfData(i.firstActivityAt, i.now)
  const minority = Math.min(i.outcomesReturned, i.outcomesNotReturned)
  const outcomeNeed = OUTCOMES_PER_FACTOR * Math.max(1, i.factorCount)

  const genNeeds: string[] = []
  if (days < GENERATIVE_DAYS) genNeeds.push(`${days} of ${GENERATIVE_DAYS} days of data`)
  if (i.decisionCount < GENERATIVE_DECISIONS) genNeeds.push(`${i.decisionCount} of ${GENERATIVE_DECISIONS} decisions recorded`)
  const genMet = genNeeds.length === 0

  const predNeeds: string[] = []
  if (days < PREDICTIVE_DAYS) predNeeds.push(`${days} of ${PREDICTIVE_DAYS} days of data`)
  if (minority < outcomeNeed) predNeeds.push(`${minority} of ${outcomeNeed} outcomes on the rarer side`)
  const predMet = genMet && predNeeds.length === 0

  const agentNeeds: string[] = []
  if (!i.predictiveValidatedAt) agentNeeds.push('Predictions not yet validated against past data')
  if (i.approvedActionStreak < AGENTIC_STREAK) agentNeeds.push(`${i.approvedActionStreak} of ${AGENTIC_STREAK} approved actions in a row`)
  if (!i.agentLimitSignedAt) agentNeeds.push('Written limit not yet signed by the decision owner')
  const agentMet = predMet && agentNeeds.length === 0

  const status = (met: boolean, prevMet: boolean): StageStatus => (met ? 'ready' : prevMet ? 'building' : 'locked')

  return [
    {
      key: 'foundation',
      title: 'Data foundation',
      gives: 'Clean, connected records, a decision log and a weekly data health check.',
      status: 'live',
      progress: 1,
      needs: [],
    },
    {
      key: 'generative',
      title: 'Generative AI',
      gives: 'Strategy chat, knowledge wiki answers and drafts written from your own data, with sources.',
      status: status(genMet, true),
      progress: Math.min(ratio(days, GENERATIVE_DAYS), ratio(i.decisionCount, GENERATIVE_DECISIONS)),
      needs: genNeeds,
    },
    {
      key: 'predictive',
      title: 'Predictive AI',
      gives: 'Forecasts and risk flags with their reasons, such as which guests are about to stop coming.',
      status: status(predMet, genMet),
      progress: Math.min(ratio(days, PREDICTIVE_DAYS), ratio(minority, outcomeNeed)),
      needs: predNeeds,
    },
    {
      key: 'agentic',
      title: 'Agentic AI',
      gives: 'Agents that act within written limits. A person can stop them at any time.',
      status: status(agentMet, predMet),
      progress: Math.min(
        i.predictiveValidatedAt ? 1 : 0,
        ratio(i.approvedActionStreak, AGENTIC_STREAK),
        i.agentLimitSignedAt ? 1 : 0,
      ),
      needs: agentNeeds,
    },
  ]
}

// Return outcome for one patron: did they come back within 30 days of their first visit?
// Only counted once 30 days have passed.
export const RETURN_WINDOW_DAYS = 30

export function returnOutcome(visitTimes: Date[], now: Date): 'returned' | 'not_returned' | 'pending' {
  if (visitTimes.length === 0) return 'pending'
  const sorted = [...visitTimes].sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0].getTime()
  const limit = first + RETURN_WINDOW_DAYS * 86_400_000
  if (sorted.some((t, idx) => idx > 0 && t.getTime() <= limit)) return 'returned'
  return now.getTime() > limit ? 'not_returned' : 'pending'
}
