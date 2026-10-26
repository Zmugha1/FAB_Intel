import { useState, type FormEvent } from 'react'
import { PunchCard } from '../components/PunchCard.tsx'
import { Shell } from '../components/Shell.tsx'
import { api } from '../lib/api.ts'

type Result = {
  firstName: string
  rewardLabel: string
  punches: number
  goal: number
  rewardsAvailable: number
  rewardEarned?: boolean
  redeemed?: boolean
}

// The PIN lives in memory only. Closing or locking the page clears it.
export default function StaffPage({ slug }: { slug: string }) {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function unlock(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api<{ venue: string }>('staff-action', { method: 'POST', body: { slug, pin, action: 'check' } })
      setUnlocked(res.venue)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function act(action: 'punch' | 'redeem') {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const res = await api<Result>('staff-action', { method: 'POST', body: { slug, pin, action, code } })
      setResult(res)
      setCode('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!unlocked) {
    return (
      <Shell title="Staff">
        <h1>Staff sign in</h1>
        <form className="form" onSubmit={unlock}>
          <label>Staff PIN<input inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" /></label>
          {error && <p className="callout warn">{error}</p>}
          <button className="btn" disabled={busy || pin.length < 4}>Unlock</button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell title={unlocked}>
      <h1>Confirm a purchase</h1>
      <div className="form">
        <label>Guest card code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8 letters and numbers" autoCapitalize="characters" />
        </label>
        <div className="row">
          <button className="btn" disabled={busy || code.length < 8} onClick={() => act('punch')}>Confirm purchase</button>
          <button className="btn ghost" disabled={busy || code.length < 8} onClick={() => act('redeem')}>Redeem reward</button>
        </div>
        {error && <p className="callout warn">{error}</p>}
        {result && (
          <div className="callout ok">
            <p>
              <b>{result.firstName}</b>:{' '}
              {result.redeemed
                ? `${result.rewardLabel} redeemed.`
                : result.rewardEarned
                  ? `card complete. ${result.rewardLabel} earned.`
                  : `${result.punches} of ${result.goal}.`}
            </p>
            <PunchCard punches={result.punches} goal={result.goal} />
            {result.rewardsAvailable > 0 && <p>{result.rewardsAvailable} reward ready to redeem.</p>}
          </div>
        )}
        <button className="btn ghost small" onClick={() => { setPin(''); setUnlocked(null); setResult(null) }}>Lock</button>
      </div>
    </Shell>
  )
}
