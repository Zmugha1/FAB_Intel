import { useEffect, useState, type FormEvent } from 'react'
import { Shell } from '../components/Shell.tsx'
import { api } from '../lib/api.ts'
import { CONSENT_TEXT } from '../lib/shared/validate.ts'
import { writeLocal } from '../lib/storage.ts'

type BarInfo = { name: string; rewardGoal: number; rewardLabel: string }

export default function JoinPage({ slug }: { slug: string }) {
  const [bar, setBar] = useState<BarInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<BarInfo>(`public-bar?slug=${encodeURIComponent(slug)}`)
      .then(setBar)
      .catch((e: Error) => setLoadError(e.message))
  }, [slug])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api<{ cardCode: string | null }>('join', {
        method: 'POST',
        body: { slug, name, email, phone, consent, website },
      })
      if (res.cardCode) {
        writeLocal(`fab-card-${slug}`, res.cardCode)
        window.location.href = `/card/${res.cardCode}`
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <Shell><p className="callout warn">{loadError}</p></Shell>
  if (!bar) return <Shell><p className="muted">Loading...</p></Shell>

  return (
    <Shell title={bar.name}>
      <h1>Join the {bar.name} rewards card</h1>
      <p className="lead">
        Every {bar.rewardGoal} purchases earns a {bar.rewardLabel.toLowerCase()}. Show your card code to staff each visit.
      </p>
      <form className="form" onSubmit={submit}>
        <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Or mobile phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
        <label className="hp" aria-hidden="true">Website<input tabIndex={-1} value={website} onChange={(e) => setWebsite(e.target.value)} autoComplete="off" /></label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{CONSENT_TEXT}</span>
        </label>
        {error && <p className="callout warn">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Joining...' : 'Get my card'}</button>
        <p className="note">Your details stay with {bar.name}. No payment card details are collected.</p>
      </form>
    </Shell>
  )
}
