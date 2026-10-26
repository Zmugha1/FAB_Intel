import { HttpError } from './http.ts'
import { serviceClient } from './supabase.ts'

export type BarRecord = {
  id: string
  slug: string
  name: string
  reward_goal: number
  reward_label: string
  staff_pin_hash: string
  active: boolean
}

export async function barBySlug(slug: string): Promise<BarRecord> {
  const { data, error } = await serviceClient()
    .from('bars')
    .select('id, slug, name, reward_goal, reward_label, staff_pin_hash, active')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !data.active) throw new HttpError(404, 'This venue is not taking sign-ups right now.')
  return data as BarRecord
}

export async function logDecision(
  barId: string | null,
  actor: string | null,
  kind: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await serviceClient().from('decision_log').insert({ bar_id: barId, actor, kind, detail })
  if (error) throw new Error(error.message)
}
