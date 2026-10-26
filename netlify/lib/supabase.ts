import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function url(): string {
  const u = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  if (!u) throw new Error('Missing SUPABASE_URL')
  return u
}

// Server only. The service role key never reaches the browser bundle.
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function anonClient(): SupabaseClient {
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!key) throw new Error('Missing VITE_SUPABASE_ANON_KEY')
  return createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Supabase returns at most 1000 rows per request. Page through, ordered by a stable key.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}
