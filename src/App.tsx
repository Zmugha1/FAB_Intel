import AdminPage from './pages/AdminPage.tsx'
import CardPage from './pages/CardPage.tsx'
import DemoPage from './pages/DemoPage.tsx'
import HomePage from './pages/HomePage.tsx'
import JoinPage from './pages/JoinPage.tsx'
import StaffPage from './pages/StaffPage.tsx'

// Path routing. Netlify serves index.html for every path.
export default function App() {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const [first, second] = parts
  if (first === 'join' && second) return <JoinPage slug={decodeURIComponent(second).toLowerCase()} />
  if (first === 'card' && second) return <CardPage code={decodeURIComponent(second)} />
  if (first === 'staff' && second) return <StaffPage slug={decodeURIComponent(second).toLowerCase()} />
  if (first === 'admin') return <AdminPage />
  if (first === 'demo') return <DemoPage />
  return <HomePage />
}
