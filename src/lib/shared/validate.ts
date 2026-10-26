// Input checks shared by the browser and the Netlify functions.

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return null
  // Plain shape check. The mail server is the real test.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 254) return null
  return v
}

// US numbers only for now. Returns 10 digits or null.
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.length === 10 ? d : null
}

export function cleanName(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (v.length < 1 || v.length > 80) return null
  return v
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,48}$/.test(slug)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

export const CONSENT_TEXT =
  'I agree to join this loyalty program. The venue may contact me about rewards and offers. I can ask to be removed at any time.'
