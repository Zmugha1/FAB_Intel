import type { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createHash } from 'node:crypto'

export function json(status: number, body: unknown): HandlerResponse {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function parseBody(event: HandlerEvent): Record<string, unknown> {
  if (!event.body) return {}
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON')
  }
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// A per-device key for PIN rate limits. The raw IP is never stored.
export function clientKey(event: HandlerEvent): string {
  const ip =
    event.headers['x-nf-client-connection-ip'] ??
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    'unknown'
  const ua = event.headers['user-agent'] ?? ''
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32)
}

export function handleError(err: unknown): HandlerResponse {
  if (err instanceof HttpError) return json(err.status, { error: err.message })
  console.error(err)
  return json(500, { error: 'Something went wrong. Please try again.' })
}
