// Punch card arithmetic. Pure, so it is tested without a database.

export type CardState = {
  punches: number // toward the next reward
  goal: number
  rewardsAvailable: number
}

export function cardState(
  confirmedVisits: number,
  rewardsEarned: number,
  rewardsRedeemed: number,
  goal: number,
): CardState {
  const safeGoal = Math.max(1, Math.floor(goal))
  const used = rewardsEarned * safeGoal
  const punches = Math.max(0, confirmedVisits - used)
  return {
    punches,
    goal: safeGoal,
    rewardsAvailable: Math.max(0, rewardsEarned - rewardsRedeemed),
  }
}

// After a visit is confirmed: does this visit complete a card?
export function earnsReward(confirmedVisitsAfter: number, rewardsEarnedBefore: number, goal: number): boolean {
  const safeGoal = Math.max(1, Math.floor(goal))
  return confirmedVisitsAfter - rewardsEarnedBefore * safeGoal >= safeGoal
}
