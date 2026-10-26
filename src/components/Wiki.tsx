const ENTRIES: { q: string; a: string }[] = [
  {
    q: 'How does a guest join?',
    a: 'They scan the QR poster, enter a name and an email or mobile number, and tick the box agreeing to join. They get a card code and a card page they can bookmark.',
  },
  {
    q: 'How does staff confirm a purchase?',
    a: 'Staff open the staff link behind the bar and unlock it with the venue PIN. The guest shows their card code. Staff type it and press Confirm purchase. A guest cannot punch their own card.',
  },
  {
    q: 'What happens when a card is full?',
    a: 'The purchase that completes the card earns the reward. Staff press Redeem reward when the guest uses it. Every redemption is recorded as a decision.',
  },
  {
    q: 'Who owns the guest list?',
    a: 'The venue. Each venue sees only its own guests. Guests agreed to join when they signed up, and the date they agreed is stored with their record. No payment card details are collected.',
  },
  {
    q: 'What if someone guesses the PIN?',
    a: 'Five wrong PINs from one device in 15 minutes locks that device out for 15 minutes. Change the PIN in Settings if staff changes.',
  },
  {
    q: 'What is the AI Transformation Roadmap?',
    a: 'Data first, decisions second, AI third. The first 90 days build clean records and a decision log. With 90 days of data and 20 recorded decisions the venue is ready for generative AI. After six months of clean data with enough outcomes it is ready for predictive AI. Agentic AI comes last, only after predictions are validated and the owner signs a written limit.',
  },
  {
    q: 'What counts as a decision?',
    a: 'Creating a venue, changing the reward rule, pausing or resuming sign-ups, and redeeming a reward. Each is written to the decision log with the time it happened.',
  },
]

export function Wiki() {
  return (
    <div className="stack">
      {ENTRIES.map((e) => (
        <div key={e.q} className="card">
          <h3>{e.q}</h3>
          <p>{e.a}</p>
        </div>
      ))}
    </div>
  )
}
