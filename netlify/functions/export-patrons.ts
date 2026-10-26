import type { Handler } from '@netlify/functions'
import { toCsv } from '../../src/lib/shared/csv.ts'
import { requireBarMember } from '../lib/auth.ts'
import { HttpError, handleError, json } from '../lib/http.ts'
import { fetchAll, serviceClient } from '../lib/supabase.ts'

type Row = { display_name: string; email: string | null; phone: string | null; consent_at: string; created_at: string }

// Signed in, venue members only. The venue's own guest list with consent dates.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
    const barId = event.queryStringParameters?.barId ?? ''
    if (!/^[0-9a-f-]{36}$/.test(barId)) throw new HttpError(400, 'Missing venue.')
    await requireBarMember(event, barId)
    const db = serviceClient()
    const rows = await fetchAll<Row>((f, t) =>
      db.from('patrons').select('display_name, email, phone, consent_at, created_at').eq('bar_id', barId).order('id').range(f, t))
    const csv = toCsv(
      ['Name', 'Email', 'Phone', 'Consented at', 'Joined at'],
      rows.map((r) => [r.display_name, r.email, r.phone, r.consent_at, r.created_at]),
    )
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="guest-list.csv"',
        'cache-control': 'no-store',
      },
      body: csv,
    }
  } catch (err) {
    return handleError(err)
  }
}
