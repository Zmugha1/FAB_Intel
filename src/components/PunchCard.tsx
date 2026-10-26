export function PunchCard({ punches, goal }: { punches: number; goal: number }) {
  return (
    <div className="punch" role="img" aria-label={`${punches} of ${goal} punches`}>
      {Array.from({ length: goal }, (_, i) => (
        <span key={i} className={i < punches ? 'dot on' : 'dot'}>{i + 1}</span>
      ))}
    </div>
  )
}
