import type { Handler } from '@netlify/functions'
import { isAdmin, requireUser } from '../lib/auth.ts'
import { handleError, json } from '../lib/http.ts'
import { serviceClient } from '../lib/supabase.ts'

const COLS = 'id, slug, name, reward_goal, reward_label, avg_ticket, active, created_at'

// Signed in. Admins see every venue. Owners and managers see their own.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
    const user = await requireUser(event)
    const db = serviceClient()
    const admin = await isAdmin(user.id)
    if (admin) {
      const { data, error } = await db.from('bars').select(COLS).order('name')
      if (error) throw new Error(error.message)
      return json(200, { admin, email: user.email, bars: data ?? [] })
    }
    const { data: links, error: lError } = await db.from('bar_members').select('bar_id').eq('user_id', user.id)
    if (lError) throw new Error(lError.message)
    const ids = (links ?? []).map((l) => l.bar_id as string)
    if (ids.length === 0) return json(200, { admin, email: user.email, bars: [] })
    const { data, error } = await db.from('bars').select(COLS).in('id', ids).order('name')
    if (error) throw new Error(error.message)
    return json(200, { admin, email: user.email, bars: data ?? [] })
  } catch (err) {
    return handleError(err)
  }
}
