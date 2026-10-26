import { useMemo, useState } from 'react'
import { Roadmap } from '../components/Roadmap.tsx'
import { Footer } from '../components/Shell.tsx'
import { DEMO_VENUE, brief, events, loyalty, menu, qa, reorder, roadmapInput, roi, specials } from '../demo/data.ts'
import { LOYALTY_MODEL_FACTORS, computeReadiness } from '../lib/shared/readiness.ts'

type Mod = 'brief' | 'loyalty' | 'specials' | 'events' | 'margin' | 'reorder' | 'ask' | 'roi' | 'roadmap'

const MODULES: { key: Mod; name: string; starts: string }[] = [
  { key: 'brief', name: 'Morning Brief', starts: 'Starts after Loyalty' },
  { key: 'loyalty', name: 'Loyalty and Guests', starts: 'Live today' },
  { key: 'specials', name: 'Specials Studio', starts: 'Second step' },
  { key: 'events', name: 'Events and Game Nights', starts: 'Second step' },
  { key: 'margin', name: 'Menu Margin Watch', starts: 'Third step' },
  { key: 'reorder', name: 'Supplies and Merch Reorder', starts: 'Third step' },
  { key: 'ask', name: 'Ask Your Bar', starts: 'After 90 days of data' },
  { key: 'roi', name: 'ROI', starts: 'Live today' },
  { key: 'roadmap', name: 'AI Transformation Roadmap', starts: 'Live today' },
]

export default function DemoPage() {
  const [mod, setMod] = useState<Mod>('brief')
  const current = MODULES.find((m) => m.key === mod)!
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href="/">FAB Intel</a>
        <span className="sample">Sample data</span>
      </header>
      <div className="demo">
        <nav className="side">
          <p className="eyebrow">{DEMO_VENUE}</p>
          {MODULES.map((m) => (
            <button key={m.key} className={m.key === mod ? 'nav on' : 'nav'} onClick={() => setMod(m.key)}>{m.name}</button>
          ))}
        </nav>
        <main className="content">
          <p className="eyebrow">{current.starts}</p>
          {mod === 'brief' && <Brief />}
          {mod === 'loyalty' && <Loyalty />}
          {mod === 'specials' && <Specials />}
          {mod === 'events' && <Events />}
          {mod === 'margin' && <Margin />}
          {mod === 'reorder' && <Reorder />}
          {mod === 'ask' && <Ask />}
          {mod === 'roi' && <Roi />}
          {mod === 'roadmap' && <DemoRoadmap />}
        </main>
      </div>
      <Footer />
    </div>
  )
}

function Brief() {
  return (
    <div className="stack">
      <h1>Good morning. {brief.items.length} things for {brief.date}.</h1>
      <p className="muted">Built overnight from sign-ups, the event calendar, supplier costs and reorder history.</p>
      {brief.items.map((i) => (
        <div key={i.title} className={`item ${i.tone}`}>
          <b>{i.title}</b>
          <span className="muted">{i.detail}</span>
        </div>
      ))}
    </div>
  )
}

function Loyalty() {
  return (
    <div className="stack">
      <h1>Every scan is a guest you keep.</h1>
      <div className="kpis">
        <div className="kpi"><b>{loyalty.guests}</b><span>Guests on the list</span></div>
        <div className="kpi"><b>{loyalty.new30}</b><span>New in 30 days</span></div>
        <div className="kpi"><b>{Math.round(loyalty.repeatRate * 100)}%</b><span>Came back</span></div>
        <div className="kpi"><b>{loyalty.rewardsEarned} / {loyalty.rewardsRedeemed}</b><span>Rewards earned / redeemed</span></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Top regulars</h2>
          <table className="tbl"><thead><tr><th>Guest</th><th>Visits</th><th>Last</th></tr></thead>
            <tbody>{loyalty.regulars.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.visits}</td><td>{r.last}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h2>Not back in 30 days</h2>
          <table className="tbl"><thead><tr><th>Guest</th><th>Visits</th><th>Last</th></tr></thead>
            <tbody>{loyalty.lapsed.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.visits}</td><td>{r.last}</td></tr>)}</tbody></table>
          <p className="note">Specials Studio drafts a win-back message for this list. A person sends it.</p>
        </div>
      </div>
      <p className="callout ok">This module runs live today. Guests scan a QR at the bar, staff confirm each purchase with a PIN, and the venue owns the list.</p>
    </div>
  )
}

function Specials() {
  const [key, setKey] = useState(specials[0].key)
  const [approved, setApproved] = useState<Record<string, boolean>>({})
  const s = specials.find((x) => x.key === key)!
  return (
    <div className="stack">
      <h1>Specials Studio</h1>
      <p className="muted">Drafts the post and the email in the venue's voice. Nothing posts until a person approves it.</p>
      <div className="tabs">
        {specials.map((x) => <button key={x.key} className={x.key === key ? 'tab on' : 'tab'} onClick={() => setKey(x.key)}>{x.name}</button>)}
      </div>
      <div className="grid2">
        <div className="card"><h2>Social post</h2><p className="draft">{s.post}</p></div>
        <div className="card"><h2>Email to the guest list</h2><p className="draft">{s.email}</p></div>
      </div>
      <div className="row">
        <button className="btn" onClick={() => setApproved({ ...approved, [key]: true })} disabled={approved[key]}>
          {approved[key] ? 'Approved and scheduled' : 'Approve'}
        </button>
        <span className="note">Every approval is recorded in the decision log.</span>
      </div>
    </div>
  )
}

function Events() {
  return (
    <div className="stack">
      <h1>Events and game nights</h1>
      <table className="tbl"><thead><tr><th>Event</th><th>When</th><th>RSVPs</th><th>History</th></tr></thead>
        <tbody>{events.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.when}</td><td>{e.rsvps}</td><td>{e.last}</td></tr>)}</tbody></table>
      <p className="note">RSVPs come from the same guest list, so turnout and sign-ups are measured per event.</p>
    </div>
  )
}

function Margin() {
  const [bump, setBump] = useState(0)
  const rows = useMemo(
    () =>
      menu.map((m) => {
        const cost = m.cost * (1 + bump / 100)
        const margin = (m.price - cost) / m.price
        return { ...m, cost, margin }
      }),
    [bump],
  )
  return (
    <div className="stack">
      <h1>Menu margin watch</h1>
      <label className="slider">If supplier costs rise by {bump}%
        <input type="range" min={0} max={30} value={bump} onChange={(e) => setBump(Number(e.target.value))} />
      </label>
      <table className="tbl"><thead><tr><th>Item</th><th>Price</th><th>Cost</th><th>Margin</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.item}>
            <td>{r.item}</td><td>${r.price.toFixed(2)}</td><td>${r.cost.toFixed(2)}</td><td>{Math.round(r.margin * 100)}%</td>
            <td>{r.margin < 0.6 ? <span className="pill warn">Below 60% floor</span> : <span className="pill ok">OK</span>}</td>
          </tr>
        ))}</tbody></table>
      <p className="note">The owner sets the margin floor. The system flags items under it and shows the math. The owner sets the price.</p>
    </div>
  )
}

function Reorder() {
  const [sent, setSent] = useState<Record<string, boolean>>({})
  return (
    <div className="stack">
      <h1>Supplies and merch reorder</h1>
      <table className="tbl"><thead><tr><th>Item</th><th>Last order</th><th>Usual cycle</th><th></th></tr></thead>
        <tbody>{reorder.map((r) => (
          <tr key={r.item}>
            <td>{r.item}</td><td>{r.lastOrder}</td><td>{r.cycle}</td>
            <td>{r.due ? (
              <button className="btn small" disabled={sent[r.item]} onClick={() => setSent({ ...sent, [r.item]: true })}>
                {sent[r.item] ? 'Quote requested' : 'Request a quote'}
              </button>
            ) : <span className="muted">Not due</span>}</td>
          </tr>
        ))}</tbody></table>
      <p className="note">Quote requests go to Food and Beverage Merch.</p>
    </div>
  )
}

function Ask() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="stack">
      <h1>Ask your bar</h1>
      <p className="muted">Answers come from the venue's own records, with the source shown. Code computes the numbers.</p>
      {qa.map((x, i) => (
        <div key={x.q} className="card">
          <button className="linkbtn" onClick={() => setOpen(open === i ? null : i)}>{x.q}</button>
          {open === i && (<><p>{x.a}</p><p className="note">Source: {x.src}</p></>)}
        </div>
      ))}
    </div>
  )
}

function Roi() {
  return (
    <div className="stack">
      <h1>Return on investment</h1>
      <div className="kpis">{roi.map((r) => <div key={r.label} className="kpi"><b>{r.value}</b><span>{r.label}</span></div>)}</div>
      <p className="note">In a live venue every figure comes from confirmed records, measured against the venue's own starting numbers.</p>
    </div>
  )
}

function DemoRoadmap() {
  const stages = useMemo(() => {
    const now = new Date()
    return computeReadiness({
      firstActivityAt: new Date(now.getTime() - roadmapInput.daysAgo * 86_400_000),
      now,
      decisionCount: roadmapInput.decisionCount,
      outcomesReturned: roadmapInput.outcomesReturned,
      outcomesNotReturned: roadmapInput.outcomesNotReturned,
      factorCount: LOYALTY_MODEL_FACTORS,
      approvedActionStreak: roadmapInput.approvedActionStreak,
      predictiveValidatedAt: null,
      agentLimitSignedAt: null,
    })
  }, [])
  return (
    <div className="stack">
      <h1>AI Transformation Roadmap</h1>
      <p className="muted">Data first. Decisions second. AI third. The first 90 days of clean data and recorded decisions make a venue ready for generative AI. Predictive comes after six months. Agentic comes last.</p>
      <Roadmap stages={stages} />
    </div>
  )
}
