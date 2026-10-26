import type { Handler } from '@netlify/functions'
import { barBySlug } from '../lib/bars.ts'
import { handleError, json } from '../lib/http.ts'

// Public. Name and reward rule for the join and staff pages. No other fields.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })
    const slug = (event.queryStringParameters?.slug ?? '').toLowerCase()
    const bar = await barBySlug(slug)
    return json(200, { name: bar.name, rewardGoal: bar.reward_goal, rewardLabel: bar.reward_label })
  } catch (err) {
    return handleError(err)
  }
}
