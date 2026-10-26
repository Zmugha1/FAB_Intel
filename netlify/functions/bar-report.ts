import type { Handler } from '@netlify/functions'
import { buildReport, type DecisionRow, type PatronRow, type RewardRow, type VisitRow } from '../../src/lib/shared/report.ts'
import { requireBarMember } from '../lib/auth.ts'
import { HttpError, handleError, json } from '../lib/http.ts'
import { fetchAll, serviceClient } from '../lib/supabase.ts'

// Signed in, venue members only. Every figure comes from rows, paged 1000 at a time.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
    const barId = event.queryStringParameters?.barId ?? ''
    if (!/^[0-9a-f-]{36}$/.test(barId)) throw new HttpError(400, 'Missing venue.')
    await requireBarMember(event, barId)
    const db = serviceClient()
    const { data: bar, error } = await db
      .from('bars')
      .select('id, name, avg_ticket, predictive_validated_at, agent_limit_signed_at')
      .eq('id', barId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!bar) throw new HttpError(404, 'Venue not found.')

    const [patrons, visits, rewards, decisions] = await Promise.all([
      fetchAll<PatronRow>((f, t) =>
        db.from('patrons').select('id, display_name, created_at').eq('bar_id', barId).order('id').range(f, t)),
      fetchAll<VisitRow>((f, t) =>
        db.from('visits').select('patron_id, confirmed_at, voided_at').eq('bar_id', barId).order('id').range(f, t)),
      fetchAll<RewardRow>((f, t) =>
        db.from('rewards').select('patron_id, earned_at, redeemed_at').eq('bar_id', barId).order('id').range(f, t)),
      fetchAll<DecisionRow>((f, t) =>
        db.from('decision_log').select('created_at').eq('bar_id', barId).order('id').range(f, t)),
    ])

    const report = buildReport({
      patrons,
      visits,
      rewards,
      decisions,
      now: new Date(),
      predictiveValidatedAt: bar.predictive_validated_at,
      agentLimitSignedAt: bar.agent_limit_signed_at,
    })
    return json(200, { venue: bar.name, avgTicket: bar.avg_ticket, report })
  } catch (err) {
    return handleError(err)
  }
}
