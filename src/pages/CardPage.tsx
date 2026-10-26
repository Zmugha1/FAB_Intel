import { useEffect, useState } from 'react'
import { PunchCard } from '../components/PunchCard.tsx'
import { Shell } from '../components/Shell.tsx'
import { api } from '../lib/api.ts'

type Card = { firstName: string; venue: string; rewardLabel: string; punches: number; goal: number; rewardsAvailable: number }

export default function CardPage({ code }: { code: string }) {
  const [card, setCard] = useState<Card | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Card>(`card?code=${encodeURIComponent(code)}`).then(setCard).catch((e: Error) => setError(e.message))
  }, [code])

  if (error) return <Shell><p className="callout warn">{error}</p></Shell>
  if (!card) return <Shell><p className="muted">Loading your card...</p></Shell>

  return (
    <Shell title={card.venue}>
      <h1>Hi {card.firstName}</h1>
      <p className="lead">Show this code to staff with each purchase.</p>
      <div className="code" aria-label="Your card code">{code.toUpperCase()}</div>
      <PunchCard punches={card.punches} goal={card.goal} />
      <p className="lead">{card.punches} of {card.goal} toward a {card.rewardLabel.toLowerCase()}.</p>
      {card.rewardsAvailable > 0 && (
        <p className="callout ok">You have {card.rewardsAvailable} {card.rewardLabel.toLowerCase()} ready. Ask staff to redeem it.</p>
      )}
      <p className="note">Bookmark this page to see your card any time.</p>
    </Shell>
  )
}
