// Card codes patrons show at the bar. No 0, O, 1, I or L, so staff can read them aloud.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function newCardCode(length = 8): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

export function normalizeCardCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isCardCodeShape(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{8}$`).test(code)
}
