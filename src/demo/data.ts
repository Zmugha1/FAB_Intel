// Sample data for the Decision Intel demo. Invented venue, invented guests. Not a client.
export const DEMO_VENUE = 'Maple and Main Taproom'

export const brief = {
  date: 'Thursday',
  items: [
    { tone: 'ok', title: '14 new loyalty sign-ups yesterday', detail: 'Trivia night brought 9 of them.' },
    { tone: 'hold', title: '22 guests have not been back in 30 days', detail: 'A Friday fish fry post could bring them back.' },
    { tone: 'warn', title: 'Wing cost up 13% from your supplier', detail: 'Wing margin fell from 68% to 63% at the current price.' },
    { tone: 'ok', title: 'Game night tonight: 38 RSVPs', detail: 'Last game night: 41 RSVPs, 33 came.' },
    { tone: 'hold', title: 'Pint glasses due for reorder', detail: 'Last order 44 days ago. Usual cycle is 45 days.' },
  ],
}

export const loyalty = {
  guests: 412,
  new30: 61,
  repeatRate: 0.46,
  rewardsEarned: 37,
  rewardsRedeemed: 29,
  regulars: [
    { name: 'Dana R.', visits: 14, last: '2 days ago' },
    { name: 'Marcus T.', visits: 12, last: 'Yesterday' },
    { name: 'Priya S.', visits: 11, last: '4 days ago' },
    { name: 'Joe K.', visits: 10, last: 'Today' },
    { name: 'Alyssa M.', visits: 9, last: '6 days ago' },
  ],
  lapsed: [
    { name: 'Chris B.', visits: 6, last: '41 days ago' },
    { name: 'Tanya W.', visits: 5, last: '36 days ago' },
    { name: 'Eli G.', visits: 4, last: '33 days ago' },
  ],
}

export const specials = [
  {
    key: 'taco',
    name: 'Taco Tuesday',
    post: 'Taco Tuesday is on. $2 tacos and $4 margaritas from 4 to 9. Scan the QR at the bar and every 10th drink is on us.',
    email: 'Subject: Taco Tuesday is back\n\nTwo dollar tacos and four dollar margaritas, 4 to 9 tonight. Bring a friend. Your rewards card counts every drink.',
  },
  {
    key: 'wings',
    name: 'Wing Wednesday',
    post: 'Wing Wednesday: 60 cent wings all night. Pick your sauce, grab a pint, and get your card punched.',
    email: 'Subject: Wings are 60 cents tonight\n\nWing Wednesday runs all night. Your next punch is one pint away.',
  },
  {
    key: 'fishfry',
    name: 'Friday Fish Fry',
    post: 'Friday Fish Fry from 4 to 9. Cod, rye bread, coleslaw and potato pancakes. Old fashioneds on special.',
    email: 'Subject: We saved you a seat for fish fry\n\nIt has been a while. Fish fry is on this Friday, and your rewards card is waiting.',
  },
]

export const events = [
  { name: 'Trivia night', when: 'Tue 7 pm', rsvps: 26, last: '24 came last week' },
  { name: 'Game night watch party', when: 'Thu 6 pm', rsvps: 38, last: '33 of 41 came last time' },
  { name: 'Live acoustic set', when: 'Sat 8 pm', rsvps: 19, last: 'New this month' },
]

export const menu = [
  { item: 'Wings, 10 piece', price: 12.0, cost: 4.4 },
  { item: 'Fish fry, cod', price: 16.0, cost: 6.1 },
  { item: 'Smash burger', price: 14.0, cost: 4.9 },
  { item: 'Draft pint', price: 6.5, cost: 1.4 },
  { item: 'Old fashioned', price: 9.0, cost: 2.1 },
  { item: 'Cheese curds', price: 9.0, cost: 2.6 },
]

export const reorder = [
  { item: 'Branded pint glasses', lastOrder: '44 days ago', cycle: '45 days', due: true },
  { item: 'Staff shirts', lastOrder: '80 days ago', cycle: '120 days', due: false },
  { item: 'Koozies for game nights', lastOrder: '28 days ago', cycle: '30 days', due: true },
  { item: 'Table tents for specials', lastOrder: '15 days ago', cycle: '60 days', due: false },
]

export const qa = [
  {
    q: 'Who are my top regulars this month?',
    a: 'Joe K. (4 visits), Marcus T. (4) and Dana R. (3) lead this month. Dana has the most visits all time with 14.',
    src: 'Loyalty visits, last 30 days, 412 guests',
  },
  {
    q: 'Which special brought the most sign-ups?',
    a: 'Trivia night: 23 sign-ups over the last 4 weeks. Taco Tuesday brought 11 and Wing Wednesday 9.',
    src: 'Sign-up times matched to the event calendar',
  },
  {
    q: 'Which menu item lost the most margin?',
    a: 'Wings. Supplier cost went from $3.90 to $4.40 per order. Margin fell from 68% to 63% at the current price.',
    src: 'Supplier invoices and menu prices',
  },
]

export const roi = [
  { label: 'Guest contacts the venue now owns', value: '412' },
  { label: 'Repeat visits confirmed, 90 days', value: '689' },
  { label: 'Rewards redeemed', value: '29' },
  { label: 'Hours a week saved on specials posts', value: '3' },
]

// Roadmap inputs for the demo venue: 64 days in, 14 decisions recorded.
export const roadmapInput = {
  daysAgo: 64,
  decisionCount: 14,
  outcomesReturned: 18,
  outcomesNotReturned: 9,
  approvedActionStreak: 212,
}
