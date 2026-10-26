import type { Handler } from '@netlify/functions'
import { isCardCodeShape, normalizeCardCode } from '../../src/lib/shared/cardCode.ts'
import { cardState } from '../../src/lib/shared/loyalty.ts'
import { HttpError, handleError, json } from '../lib/http.ts'
import { serviceClient } from '../lib/supabase.ts'

// Public. A patron's own card: first name, venue, punches and rewards. No contact details.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
    const code = normalizeCardCode(event.queryStringParameters?.code ?? '')
    if (!isCardCodeShape(code)) throw new HttpError(404, 'Card not found.')
    const db = serviceClient()
    const { data: patron, error } = await db
      .from('patrons')
      .select('id, display_name, bars ( name, reward_goal, reward_label, active )')
      .eq('card_code', code)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!patron) throw new HttpError(404, 'Card not found.')
    const bar = (Array.isArray(patron.bars) ? patron.bars[0] : patron.bars) as
      | { name: string; reward_goal: number; reward_label: string; active: boolean }
      | null
    if (!bar) throw new HttpError(404, 'Card not found.')

    const [visits, earned, redeemed] = await Promise.all([
      db.from('visits').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id).is('voided_at', null),
      db.from('rewards').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id),
      db.from('rewards').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id).not('redeemed_at', 'is', null),
    ])
    for (const r of [visits, earned, redeemed]) if (r.error) throw new Error(r.error.message)
    const state = cardState(visits.count ?? 0, earned.count ?? 0, redeemed.count ?? 0, bar.reward_goal)
    return json(200, {
      firstName: patron.display_name.split(' ')[0],
      venue: bar.name,
      rewardLabel: bar.reward_label,
      ...state,
    })
  } catch (err) {
    return handleError(err)
  }
}
