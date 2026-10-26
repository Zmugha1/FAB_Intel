import type { Handler } from '@netlify/functions'
import { isValidPin, isValidSlug, slugify } from '../../src/lib/shared/validate.ts'
import { requireAdmin } from '../lib/auth.ts'
import { logDecision } from '../lib/bars.ts'
import { HttpError, handleError, json, parseBody, str } from '../lib/http.ts'
import { hashPin } from '../lib/pin.ts'
import { serviceClient } from '../lib/supabase.ts'

// Admin only. Create a venue, or change its reward rule, ticket value, PIN or status.
// Reward rule and status changes are written to the decision log. PIN resets are not decisions.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
    const user = await requireAdmin(event)
    const body = parseBody(event)
    const db = serviceClient()

    const name = str(body.name).replace(/\s+/g, ' ').trim()
    const goal = Number(body.rewardGoal)
    const label = str(body.rewardLabel).trim()
    const pin = str(body.pin)
    const ticketRaw = body.avgTicket
    const avgTicket =
      ticketRaw === null || ticketRaw === '' || ticketRaw === undefined ? null : Number(ticketRaw)

    if (avgTicket !== null && (!Number.isFinite(avgTicket) || avgTicket < 0 || avgTicket > 10000))
      throw new HttpError(400, 'Average ticket must be a dollar amount.')
    if (!Number.isInteger(goal) || goal < 2 || goal > 50) throw new HttpError(400, 'Punches per reward must be 2 to 50.')
    if (label.length < 2 || label.length > 60) throw new HttpError(400, 'Describe the reward in 2 to 60 characters.')

    const id = str(body.id)
    if (!id) {
      if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Enter the venue name.')
      const slug = str(body.slug) ? str(body.slug).toLowerCase() : slugify(name)
      if (!isValidSlug(slug)) throw new HttpError(400, 'Link name must be 3 to 48 lowercase letters, numbers or dashes.')
      if (!isValidPin(pin)) throw new HttpError(400, 'Staff PIN must be 4 to 8 digits.')
      const { data, error } = await db
        .from('bars')
        .insert({ name, slug, reward_goal: goal, reward_label: label, avg_ticket: avgTicket, staff_pin_hash: hashPin(pin) })
        .select('id, slug')
        .single()
      if (error?.code === '23505') throw new HttpError(409, 'That link name is taken. Choose another.')
      if (error) throw new Error(error.message)
      await logDecision(data.id, user.id, 'venue_created', { reward_goal: goal, reward_label: label })
      return json(200, { id: data.id, slug: data.slug })
    }

    const update: Record<string, unknown> = { reward_goal: goal, reward_label: label, avg_ticket: avgTicket }
    if (name) update.name = name
    if (typeof body.active === 'boolean') update.active = body.active
    if (pin) {
      if (!isValidPin(pin)) throw new HttpError(400, 'Staff PIN must be 4 to 8 digits.')
      update.staff_pin_hash = hashPin(pin)
    }
    const { data: before, error: bError } = await db
      .from('bars')
      .select('reward_goal, reward_label, active')
      .eq('id', id)
      .maybeSingle()
    if (bError) throw new Error(bError.message)
    if (!before) throw new HttpError(404, 'Venue not found.')
    const { error } = await db.from('bars').update(update).eq('id', id)
    if (error) throw new Error(error.message)
    if (before.reward_goal !== goal || before.reward_label !== label)
      await logDecision(id, user.id, 'reward_rule_changed', { from: before, to: { reward_goal: goal, reward_label: label } })
    if (typeof body.active === 'boolean' && body.active !== before.active)
      await logDecision(id, user.id, body.active ? 'venue_resumed' : 'venue_paused')
    return json(200, { id })
  } catch (err) {
    return handleError(err)
  }
}
