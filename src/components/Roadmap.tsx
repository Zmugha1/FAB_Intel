import type { Stage } from '../lib/shared/readiness.ts'

const LABEL: Record<Stage['status'], string> = {
  live: 'Live',
  ready: 'Ready to propose',
  building: 'Building',
  locked: 'Opens after the stage before',
}

export function Roadmap({ stages }: { stages: Stage[] }) {
  return (
    <div className="roadmap">
      {stages.map((s, idx) => (
        <section key={s.key} className={`stage ${s.status}`}>
          <div className="stage-head">
            <span className="stage-num">{idx + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p className="muted">{s.gives}</p>
            </div>
            <span className={`pill ${s.status}`}>{LABEL[s.status]}</span>
          </div>
          <div className="bar" aria-label={`${Math.round(s.progress * 100)} percent`}>
            <i style={{ width: `${Math.round(s.progress * 100)}%` }} />
          </div>
          {s.needs.length > 0 && (
            <ul className="needs">
              {s.needs.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </section>
      ))}
      <p className="note">
        Each stage opens on measured records: days of data, decisions recorded, and outcomes. Nothing is switched on by
        hand. If accuracy drops, a decision steps back a stage and you are told that week.
      </p>
    </div>
  )
}
