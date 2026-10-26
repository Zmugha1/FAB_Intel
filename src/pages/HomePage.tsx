import { Shell } from '../components/Shell.tsx'

export default function HomePage() {
  return (
    <Shell>
      <section className="hero">
        <p className="eyebrow">Food and Beverage Merch</p>
        <h1>Every scan is a guest you keep.</h1>
        <p className="lead">
          FAB Intel Loyalty turns a QR code behind the bar into a guest list the venue owns. Staff confirm each purchase.
          Rewards track themselves.
        </p>
        <div className="row">
          <a className="btn" href="/demo">See the Decision Intel demo</a>
          <a className="btn ghost" href="/admin">Sign in</a>
        </div>
      </section>
    </Shell>
  )
}
