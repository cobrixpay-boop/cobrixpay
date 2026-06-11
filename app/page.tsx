import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect root to the landing page so the site root shows the intended app
  redirect('/landing')
}
