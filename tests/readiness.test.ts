import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeReadiness, returnOutcome, type ReadinessInput } from '../src/lib/shared/readiness.ts'

const now = new Date('2027-03-01T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const base: ReadinessInput = {
  firstActivityAt: daysAgo(10),
  now,
  decisionCount: 3,
  outcomesReturned: 0,
  outcomesNotReturned: 0,
  factorCount: 3,
  approvedActionStreak: 0,
  predictiveValidatedAt: null,
  agentLimitSignedAt: null,
}

test('day one: foundation live, generative building, rest locked', () => {
  const s = computeReadiness({ ...base, firstActivityAt: null, decisionCount: 0 })
  assert.deepEqual(s.map((x) => x.status), ['live', 'building', 'locked', 'locked'])
  assert.equal(s[1].progress, 0)
})

test('generative needs both 90 days and 20 decisions', () => {
  assert.equal(computeReadiness({ ...base, firstActivityAt: daysAgo(120), decisionCount: 19 })[1].status, 'building')
  assert.equal(computeReadiness({ ...base, firstActivityAt: daysAgo(89), decisionCount: 50 })[1].status, 'building')
  const ok = computeReadiness({ ...base, firstActivityAt: daysAgo(90), decisionCount: 20 })
  assert.equal(ok[1].status, 'ready')
  assert.equal(ok[2].status, 'building')
})

test('predictive counts the rarer outcome against 10 per factor', () => {
  const i = { ...base, firstActivityAt: daysAgo(200), decisionCount: 40 }
  assert.equal(computeReadiness({ ...i, outcomesReturned: 100, outcomesNotReturned: 29 })[2].status, 'building')
  assert.equal(computeReadiness({ ...i, outcomesReturned: 100, outcomesNotReturned: 30 })[2].status, 'ready')
})

test('agentic needs validation, a 300 streak and a signed limit', () => {
  const i = { ...base, firstActivityAt: daysAgo(400), decisionCount: 400, outcomesReturned: 80, outcomesNotReturned: 60 }
  assert.equal(computeReadiness({ ...i, approvedActionStreak: 300 })[3].status, 'building')
  const all = computeReadiness({ ...i, approvedActionStreak: 300, predictiveValidatedAt: now, agentLimitSignedAt: now })
  assert.deepEqual(all.map((x) => x.status), ['live', 'ready', 'ready', 'ready'])
})

test('return outcome waits 30 days before calling a no', () => {
  assert.equal(returnOutcome([daysAgo(10)], now), 'pending')
  assert.equal(returnOutcome([daysAgo(40)], now), 'not_returned')
  assert.equal(returnOutcome([daysAgo(40), daysAgo(20)], now), 'returned')
  assert.equal(returnOutcome([daysAgo(80), daysAgo(20)], now), 'not_returned')
})
