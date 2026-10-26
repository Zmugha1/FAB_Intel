import { useCallback, useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { Roadmap } from '../components/Roadmap.tsx'
import { Shell } from '../components/Shell.tsx'
import { Wiki } from '../components/Wiki.tsx'
import { api, downloadCsv } from '../lib/api.ts'
import { fmtDate, fmtInt, fmtMoney, fmtPct } from '../lib/format.ts'
import type { BarReport } from '../lib/shared/report.ts'
import { slugify } from '../lib/shared/validate.ts'
import { getSupabase } from '../lib/supabase.ts'

type Bar = {
  id: string
  slug: string
  name: string
  reward_goal: number
  reward_label: string
  avg_ticket: number | null
  active: boolean
  created_at: string
}
type MyBars = { admin: boolean; email: string; bars: Bar[] }
type Tab = 'report' | 'qr' | 'roadmap' | 'roi' | 'settings' | 'wiki'

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const sb = getSupabase()
      sb.auth.getSession().then(({ data }) => {
        setSignedIn(Boolean(data.session))
        setReady(true)
      })
      const { data } = sb.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)))
      return () => data.subscription.unsubscribe()
    } catch (err) {
      setConfigError((err as Error).message)
      setReady(true)
    }
  }, [])

  if (!ready) return <Shell><p className="muted">Loading...</p></Shell>
  if (configError) return <Shell><p className="callout warn">Setup needed: {configError}</p></Shell>
  return signedIn ? <Dashboard /> : <SignIn />
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password })
    if (err) setError('Email or password is not right.')
    setBusy(false)
  }

  return (
    <Shell>
      <h1>Sign in</h1>
      <form className="form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <p className="callout warn">{error}</p>}
        <button className="btn" disabled={busy}>Sign in</button>
      </form>
    </Shell>
  )
}

function Dashboard() {
  const [me, setMe] = useState<MyBars | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    api<MyBars>('my-bars', { auth: true })
      .then((m) => {
        setMe(m)
        setSelected((cur) => cur ?? m.bars[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const bar = me?.bars.find((b) => b.id === selected) ?? null

  return (
    <Shell wide>
      <div className="admin">
        <aside className="side">
          <p className="eyebrow">Venues</p>
          {me?.bars.map((b) => (
            <button key={b.id} className={b.id === selected && !creating ? 'nav on' : 'nav'} onClick={() => { setSelected(b.id); setCreating(false) }}>
              {b.name}{!b.active && ' (paused)'}
            </button>
          ))}
          {me?.admin && <button className="btn small" onClick={() => setCreating(true)}>Add a venue</button>}
          <div className="side-foot">
            <span className="muted">{me?.email}</span>
            <button className="btn ghost small" onClick={() => getSupabase().auth.signOut()}>Sign out</button>
          </div>
        </aside>
        <section className="content">
          {error && <p className="callout warn">{error}</p>}
          {!me && !error && <p className="muted">Loading...</p>}
          {me && me.bars.length === 0 && !creating && (
            <p className="muted">{me.admin ? 'No venues yet. Add the first one.' : 'No venues are linked to your account yet.'}</p>
          )}
          {creating && me?.admin && <VenueForm onSaved={(id) => { setCreating(false); setSelected(id); load() }} />}
          {!creating && bar && <VenueView key={bar.id} bar={bar} admin={Boolean(me?.admin)} onChanged={load} />}
        </section>
      </div>
    </Shell>
  )
}

function VenueView({ bar, admin, onChanged }: { bar: Bar; admin: boolean; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('report')
  const [data, setData] = useState<{ avgTicket: number | null; report: BarReport } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ avgTicket: number | null; report: BarReport }>(`bar-report?barId=${bar.id}`, { auth: true })
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [bar.id])

  const tabs: [Tab, string][] = [
    ['report', 'Guests and visits'],
    ['qr', 'QR poster'],
    ['roadmap', 'AI Transformation Roadmap'],
    ['roi', 'ROI'],
    ...(admin ? ([['settings', 'Settings']] as [Tab, string][]) : []),
    ['wiki', 'Knowledge Wiki'],
  ]

  return (
    <div>
      <h1>{bar.name}</h1>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {error && <p className="callout warn">{error}</p>}
      {tab === 'report' && (data ? <ReportView bar={bar} r={data.report} /> : !error && <p className="muted">Loading figures...</p>)}
      {tab === 'qr' && <QrPoster bar={bar} />}
      {tab === 'roadmap' && (data ? <Roadmap stages={data.report.readiness} /> : <p className="muted">Loading...</p>)}
      {tab === 'roi' && (data ? <RoiView r={data.report} avgTicket={data.avgTicket} /> : <p className="muted">Loading...</p>)}
      {tab === 'settings' && admin && <VenueForm bar={bar} onSaved={() => onChanged()} />}
      {tab === 'wiki' && <Wiki />}
    </div>
  )
}

function Kpi({ v, l }: { v: string; l: string }) {
  return <div className="kpi"><b>{v}</b><span>{l}</span></div>
}

function ReportView({ bar, r }: { bar: Bar; r: BarReport }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi v={fmtInt(r.patrons)} l="Guests on the list" />
        <Kpi v={fmtInt(r.newPatrons30)} l="New in the last 30 days" />
        <Kpi v={fmtInt(r.visits30)} l="Confirmed purchases, 30 days" />
        <Kpi v={fmtPct(r.repeatRate)} l="Guests who came back" />
        <Kpi v={`${fmtInt(r.rewardsEarned)} / ${fmtInt(r.rewardsRedeemed)}`} l="Rewards earned / redeemed" />
      </div>
      <div className="card">
        <div className="row between">
          <h2>Newest guests</h2>
          <button className="btn small" onClick={() => downloadCsv(`export-patrons?barId=${bar.id}`, `${bar.slug}-guest-list.csv`).catch((e: Error) => setErr(e.message))}>
            Download guest list
          </button>
        </div>
        {err && <p className="callout warn">{err}</p>}
        {r.recentSignups.length === 0 ? (
          <p className="muted">No sign-ups yet. Put the QR poster up and they will appear here.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Joined</th></tr></thead>
            <tbody>{r.recentSignups.map((s) => <tr key={s.joined + s.name}><td>{s.name}</td><td>{fmtDate(s.joined)}</td></tr>)}</tbody>
          </table>
        )}
        <p className="note">The guest list belongs to {bar.name}. Every guest agreed to join when they signed up.</p>
      </div>
    </div>
  )
}

function QrPoster({ bar }: { bar: Bar }) {
  const joinUrl = `${window.location.origin}/join/${bar.slug}`
  const staffUrl = `${window.location.origin}/staff/${bar.slug}`
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 640, margin: 1, color: { dark: '#1E2A4A', light: '#FFFFFF' } }).then(setSrc)
  }, [joinUrl])
  return (
    <div className="stack">
      <div className="poster">
        <p className="eyebrow">{bar.name}</p>
        <h2>Scan to join our rewards card</h2>
        {src && <img src={src} alt={`QR code for ${joinUrl}`} width={320} height={320} />}
        <p>Every {bar.reward_goal} purchases earns a {bar.reward_label.toLowerCase()}.</p>
      </div>
      <div className="row no-print">
        <button className="btn" onClick={() => window.print()}>Print poster</button>
      </div>
      <div className="card no-print">
        <p><b>Guest sign-up link:</b> <a href={joinUrl}>{joinUrl}</a></p>
        <p><b>Staff link (keep behind the bar):</b> <a href={staffUrl}>{staffUrl}</a></p>
        <p className="note">Staff open the staff link on the bar tablet or phone and unlock it with the venue PIN.</p>
      </div>
    </div>
  )
}

function RoiView({ r, avgTicket }: { r: BarReport; avgTicket: number | null }) {
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi v={fmtInt(r.patrons)} l="Guest contacts the venue now owns" />
        <Kpi v={fmtInt(r.repeatVisits)} l="Repeat visits confirmed" />
        <Kpi v={fmtInt(r.rewardsRedeemed)} l="Rewards redeemed" />
        <Kpi v={avgTicket === null ? 'Not set' : fmtMoney(r.repeatVisits * avgTicket)} l="Repeat visits × average ticket" />
      </div>
      <div className="card">
        <h2>How these numbers are measured</h2>
        <ul>
          <li>Every figure counts confirmed records. Nothing is estimated except the last tile.</li>
          <li>The last tile multiplies repeat visits by the average ticket the venue entered in Settings. {avgTicket === null && 'Enter one to see it.'}</li>
          <li>Reward cost is not subtracted yet. Compare redeemed rewards above with the reward value.</li>
        </ul>
      </div>
    </div>
  )
}

function VenueForm({ bar, onSaved }: { bar?: Bar; onSaved: (id: string) => void }) {
  const [name, setName] = useState(bar?.name ?? '')
  const [slug, setSlug] = useState(bar?.slug ?? '')
  const [goal, setGoal] = useState(String(bar?.reward_goal ?? 10))
  const [label, setLabel] = useState(bar?.reward_label ?? 'Free drink')
  const [ticket, setTicket] = useState(bar?.avg_ticket === null || bar?.avg_ticket === undefined ? '' : String(bar.avg_ticket))
  const [pin, setPin] = useState('')
  const [active, setActive] = useState(bar?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await api<{ id: string }>('save-bar', {
        method: 'POST',
        auth: true,
        body: {
          id: bar?.id,
          name,
          slug: bar ? undefined : slug || slugify(name),
          rewardGoal: Number(goal),
          rewardLabel: label,
          avgTicket: ticket === '' ? null : Number(ticket),
          pin: pin || undefined,
          active,
        },
      })
      setPin('')
      setMsg({ ok: true, text: 'Saved.' })
      onSaved(res.id)
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <h2>{bar ? 'Venue settings' : 'Add a venue'}</h2>
      <label>Venue name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      {!bar && (
        <label>Link name<input value={slug} placeholder={slugify(name) || 'venue-name'} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          <span className="note">Guests join at /join/{slug || slugify(name) || 'venue-name'}</span>
        </label>
      )}
      <label>Purchases per reward<input type="number" min={2} max={50} value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
      <label>Reward<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label>Average ticket, dollars (optional)<input type="number" min={0} step="0.01" value={ticket} onChange={(e) => setTicket(e.target.value)} /></label>
      <label>{bar ? 'New staff PIN (leave blank to keep)' : 'Staff PIN, 4 to 8 digits'}
        <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required={!bar} />
      </label>
      {bar && (
        <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>Taking sign-ups</span></label>
      )}
      {msg && <p className={msg.ok ? 'callout ok' : 'callout warn'}>{msg.text}</p>}
      <button className="btn" disabled={busy}>{bar ? 'Save changes' : 'Create venue'}</button>
    </form>
  )
}
