import { getSupabase } from './supabase.ts'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authHeader(withAuth: boolean): Promise<Record<string, string>> {
  if (!withAuth) return {}
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

export async function api<T>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(await authHeader(Boolean(opts.auth))),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api/${path}`, { headers: await authHeader(true) })
  if (!res.ok) throw new ApiError(res.status, 'Could not download the list.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
