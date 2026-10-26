import type { Handler } from '@netlify/functions'
import { isCardCodeShape, normalizeCardCode } from '../../src/lib/shared/cardCode.ts'
import { cardState, earnsReward } from '../../src/lib/shared/loyalty.ts'
import { isLockedOut, windowStart } from '../../src/lib/shared/rateLimit.ts'
import { isValidPin } from '../../src/lib/shared/validate.ts'
import { barBySlug, logDecision } from '../lib/bars.ts'
import { HttpError, clientKey, handleError, json, parseBody, str } from '../lib/http.ts'
import { verifyPin } from '../lib/pin.ts'
import { serviceClient } from '../lib/supabase.ts'

// Public, PIN protected. Staff confirm a purchase (punch) or redeem a reward.
// Five wrong PINs from one device in 15 minutes locks that device out for the window.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
    const body = parseBody(event)
    const action = str(body.action)
    if (action !== 'check' && action !== 'punch' && action !== 'redeem') throw new HttpError(400, 'Unknown action.')
    const bar = await barBySlug(str(body.slug).toLowerCase())
    const db = serviceClient()
    const key = clientKey(event)
    const now = new Date()

    const { count: failures, error: rlError } = await db
      .from('pin_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('bar_id', bar.id)
      .eq('client_key', key)
      .eq('success', false)
      .gte('attempted_at', windowStart(now).toISOString())
    if (rlError) throw new Error(rlError.message)
    if (isLockedOut(failures ?? 0)) throw new HttpError(429, 'Too many wrong PINs. Try again in 15 minutes.')

    const pin = str(body.pin)
    const ok = isValidPin(pin) && verifyPin(pin, bar.staff_pin_hash)
    const { error: aError } = await db.from('pin_attempts').insert({ bar_id: bar.id, client_key: key, success: ok })
    if (aError) throw new Error(aError.message)
    if (!ok) throw new HttpError(401, 'Wrong staff PIN.')
    if (action === 'check') return json(200, { ok: true, venue: bar.name })

    const code = normalizeCardCode(str(body.code))
    if (!isCardCodeShape(code)) throw new HttpError(400, 'That card code is not valid. Codes are 8 letters and numbers.')
    const { data: patron, error: pError } = await db
      .from('patrons')
      .select('id, display_name')
      .eq('bar_id', bar.id)
      .eq('card_code', code)
      .maybeSingle()
    if (pError) throw new Error(pError.message)
    if (!patron) throw new HttpError(404, 'No card with that code at this venue.')

    const counts = async () => {
      const [v, e, r] = await Promise.all([
        db.from('visits').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id).is('voided_at', null),
        db.from('rewards').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id),
        db.from('rewards').select('id', { count: 'exact', head: true }).eq('patron_id', patron.id).not('redeemed_at', 'is', null),
      ])
      for (const x of [v, e, r]) if (x.error) throw new Error(x.error.message)
      return { visits: v.count ?? 0, earned: e.count ?? 0, redeemed: r.count ?? 0 }
    }

    if (action === 'punch') {
      const before = await counts()
      const { error: vError } = await db.from('visits').insert({ bar_id: bar.id, patron_id: patron.id })
      if (vError) throw new Error(vError.message)
      let rewardEarned = false
      if (earnsReward(before.visits + 1, before.earned, bar.reward_goal)) {
        const { error: rError } = await db.from('rewards').insert({ bar_id: bar.id, patron_id: patron.id })
        if (rError) throw new Error(rError.message)
        rewardEarned = true
      }
      const after = await counts()
      return json(200, {
        firstName: patron.display_name.split(' ')[0],
        rewardEarned,
        rewardLabel: bar.reward_label,
        ...cardState(after.visits, after.earned, after.redeemed, bar.reward_goal),
      })
    }

    // redeem: oldest unredeemed reward
    const { data: reward, error: fError } = await db
      .from('rewards')
      .select('id')
      .eq('patron_id', patron.id)
      .is('redeemed_at', null)
      .order('earned_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (fError) throw new Error(fError.message)
    if (!reward) throw new HttpError(409, 'This card has no reward to redeem yet.')
    const { error: uError } = await db
      .from('rewards')
      .update({ redeemed_at: now.toISOString() })
      .eq('id', reward.id)
      .is('redeemed_at', null)
    if (uError) throw new Error(uError.message)
    await logDecision(bar.id, null, 'reward_redeemed', { reward_id: reward.id, by: 'staff_pin' })
    const after = await counts()
    return json(200, {
      firstName: patron.display_name.split(' ')[0],
      redeemed: true,
      rewardLabel: bar.reward_label,
      ...cardState(after.visits, after.earned, after.redeemed, bar.reward_goal),
    })
  } catch (err) {
    return handleError(err)
  }
}
