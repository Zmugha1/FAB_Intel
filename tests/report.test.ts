import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReport } from '../src/lib/shared/report.ts'

const now = new Date('2027-03-01T12:00:00Z')
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()

test('report counts from fake rows', () => {
  const r = buildReport({
    now,
    patrons: [
      { id: 'a', display_name: 'Guest A', created_at: iso(50) },
      { id: 'b', display_name: 'Guest B', created_at: iso(5) },
      { id: 'c', display_name: 'Guest C', created_at: iso(2) },
    ],
    visits: [
      { patron_id: 'a', confirmed_at: iso(50), voided_at: null },
      { patron_id: 'a', confirmed_at: iso(40), voided_at: null },
      { patron_id: 'a', confirmed_at: iso(3), voided_at: null },
      { patron_id: 'b', confirmed_at: iso(5), voided_at: null },
      { patron_id: 'b', confirmed_at: iso(4), voided_at: iso(4) },
    ],
    rewards: [{ patron_id: 'a', earned_at: iso(3), redeemed_at: null }],
    decisions: [{ created_at: iso(60) }, { created_at: iso(1) }],
    predictiveValidatedAt: null,
    agentLimitSignedAt: null,
  })
  assert.equal(r.patrons, 3)
  assert.equal(r.newPatrons30, 2)
  assert.equal(r.visits, 4) // voided visit excluded
  assert.equal(r.visits30, 2)
  assert.equal(r.repeatPatrons, 1)
  assert.equal(r.repeatVisits, 2)
  assert.equal(r.repeatRate, 0.5)
  assert.equal(r.rewardsEarned, 1)
  assert.equal(r.rewardsRedeemed, 0)
  assert.equal(r.decisions, 2)
  assert.equal(r.firstActivityAt, iso(60))
  assert.equal(r.recentSignups[0].name, 'Guest C')
  assert.equal(r.readiness[0].status, 'live')
})

test('empty venue has no repeat rate instead of a fake zero', () => {
  const r = buildReport({ now, patrons: [], visits: [], rewards: [], decisions: [], predictiveValidatedAt: null, agentLimitSignedAt: null })
  assert.equal(r.repeatRate, null)
  assert.equal(r.firstActivityAt, null)
})
