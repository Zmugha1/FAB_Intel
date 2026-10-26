import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isCardCodeShape, newCardCode, normalizeCardCode } from '../src/lib/shared/cardCode.ts'
import { toCsv } from '../src/lib/shared/csv.ts'
import { isLockedOut } from '../src/lib/shared/rateLimit.ts'
import { cleanName, isValidPin, isValidSlug, normalizeEmail, normalizePhone, slugify } from '../src/lib/shared/validate.ts'

test('email and phone normalize or reject', () => {
  assert.equal(normalizeEmail('  Dana@Example.COM '), 'dana@example.com')
  assert.equal(normalizeEmail('not-an-email'), null)
  assert.equal(normalizePhone('(262) 555-0134'), '2625550134')
  assert.equal(normalizePhone('+1 262 555 0134'), '2625550134')
  assert.equal(normalizePhone('555-0134'), null)
})

test('names, slugs and PINs', () => {
  assert.equal(cleanName('  Dana   R. '), 'Dana R.')
  assert.equal(cleanName('   '), null)
  assert.equal(slugify('Maple & Main Taproom!'), 'maple-and-main-taproom')
  assert.equal(isValidSlug('maple-and-main-taproom'), true)
  assert.equal(isValidSlug('ab'), false)
  assert.equal(isValidPin('1234'), true)
  assert.equal(isValidPin('12a4'), false)
  assert.equal(isValidPin('123'), false)
})

test('card codes are 8 readable characters', () => {
  for (let i = 0; i < 200; i++) {
    const c = newCardCode()
    assert.equal(isCardCodeShape(c), true, c)
    assert.doesNotMatch(c, /[01OIL]/)
  }
  assert.equal(normalizeCardCode(' ab2c-3d4e '), 'AB2C3D4E')
})

test('csv escapes quotes and blocks formulas', () => {
  const csv = toCsv(['Name', 'Note'], [['Dana "D"', '=HYPERLINK("x")'], ['A, B', null]])
  assert.equal(csv, 'Name,Note\r\n"Dana ""D""","\'=HYPERLINK(""x"")"\r\n"A, B",\r\n')
})

test('pin lockout at five failures', () => {
  assert.equal(isLockedOut(4), false)
  assert.equal(isLockedOut(5), true)
})
