import type { ReactNode } from 'react'
import { APP_VERSION } from '../lib/shared/version.ts'

export function Shell({ children, wide = false, title = 'FAB Intel' }: { children: ReactNode; wide?: boolean; title?: string }) {
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href="/">{title}</a>
      </header>
      <main className={wide ? 'page wide' : 'page'}>{children}</main>
      <Footer />
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span>FAB Intel v{APP_VERSION}</span>
      <span>Built by Dr. Data Decision Intelligence</span>
    </footer>
  )
}
