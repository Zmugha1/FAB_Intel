import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPin, verifyPin } from '../netlify/lib/pin.ts'

test('pin hashes verify and never store the pin', () => {
  const h = hashPin('4821')
  assert.doesNotMatch(h, /4821/)
  assert.equal(verifyPin('4821', h), true)
  assert.equal(verifyPin('4822', h), false)
  assert.equal(verifyPin('4821', 'garbage'), false)
  assert.notEqual(hashPin('4821'), h) // salted
})
