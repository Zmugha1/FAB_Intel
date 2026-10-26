import type { Handler } from '@netlify/functions'
import { newCardCode } from '../../src/lib/shared/cardCode.ts'
import { CONSENT_TEXT, cleanName, normalizeEmail, normalizePhone } from '../../src/lib/shared/validate.ts'
import { barBySlug } from '../lib/bars.ts'
import { HttpError, handleError, json, parseBody, str } from '../lib/http.ts'
import { serviceClient } from '../lib/supabase.ts'

// Public. A patron joins one venue's program. Returns their card code.
// A repeat sign-up with the same email or phone returns the existing card, never a second patron.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
    const body = parseBody(event)
    if (str(body.website)) return json(200, { cardCode: null }) // honeypot field, bots only

    const bar = await barBySlug(str(body.slug).toLowerCase())
    const name = cleanName(str(body.name))
    const email = normalizeEmail(str(body.email))
    const phone = normalizePhone(str(body.phone))
    if (!name) throw new HttpError(400, 'Please enter your name.')
    if (!email && !phone) throw new HttpError(400, 'Please enter a valid email or a 10 digit phone number.')
    if (body.consent !== true) throw new HttpError(400, 'Please tick the box to agree to join.')

    const db = serviceClient()
    // Dedupe: one patron per venue per email or phone.
    for (const [col, val] of [['email', email], ['phone', phone]] as const) {
      if (!val) continue
      const { data, error } = await db
        .from('patrons')
        .select('card_code')
        .eq('bar_id', bar.id)
        .eq(col, val)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (data) return json(200, { cardCode: data.card_code, existing: true })
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const cardCode = newCardCode()
      const { error } = await db.from('patrons').insert({
        bar_id: bar.id,
        display_name: name,
        email,
        phone,
        card_code: cardCode,
        consent_at: new Date().toISOString(),
        consent_text: CONSENT_TEXT,
      })
      if (!error) return json(200, { cardCode, existing: false })
      if (error.code === '23505' && error.message.includes('card_code')) continue
      if (error.code === '23505') throw new HttpError(409, 'You are already in this program. Use the same email or phone.')
      throw new Error(error.message)
    }
    throw new Error('Could not create a unique card code')
  } catch (err) {
    return handleError(err)
  }
}
