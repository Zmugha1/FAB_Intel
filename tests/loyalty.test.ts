import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cardState, earnsReward } from '../src/lib/shared/loyalty.ts'

test('card fills and resets after each reward', () => {
  assert.deepEqual(cardState(0, 0, 0, 10), { punches: 0, goal: 10, rewardsAvailable: 0 })
  assert.deepEqual(cardState(9, 0, 0, 10), { punches: 9, goal: 10, rewardsAvailable: 0 })
  assert.deepEqual(cardState(10, 1, 0, 10), { punches: 0, goal: 10, rewardsAvailable: 1 })
  assert.deepEqual(cardState(13, 1, 1, 10), { punches: 3, goal: 10, rewardsAvailable: 0 })
})

test('the tenth purchase earns the reward, not the ninth or eleventh', () => {
  assert.equal(earnsReward(9, 0, 10), false)
  assert.equal(earnsReward(10, 0, 10), true)
  assert.equal(earnsReward(11, 1, 10), false)
  assert.equal(earnsReward(20, 1, 10), true)
})

test('bad goal values never divide by zero', () => {
  assert.equal(cardState(5, 0, 0, 0).goal, 1)
  assert.equal(earnsReward(1, 0, 0), true)
})
