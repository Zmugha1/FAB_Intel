import type { HandlerEvent } from '@netlify/functions'
import type { User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'
import { anonClient, serviceClient } from './supabase.ts'

export async function requireUser(event: HandlerEvent): Promise<User> {
  const header = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!token) throw new HttpError(401, 'Please sign in.')
  const { data, error } = await anonClient().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Please sign in again.')
  return data.user
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await serviceClient().from('app_admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function requireAdmin(event: HandlerEvent): Promise<User> {
  const user = await requireUser(event)
  if (!(await isAdmin(user.id))) throw new HttpError(403, 'Only an administrator can do this.')
  return user
}

export async function requireBarMember(event: HandlerEvent, barId: string): Promise<User> {
  const user = await requireUser(event)
  if (await isAdmin(user.id)) return user
  const { data, error } = await serviceClient()
    .from('bar_members')
    .select('bar_id')
    .eq('bar_id', barId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new HttpError(403, 'You do not have access to this venue.')
  return user
}
