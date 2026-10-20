import type { Metadata } from 'next'
import { CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } }

export default function Contact() {
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Contact ZoomFly</h1></div>
      <p>For anything about a booking, use <strong>Report a problem</strong> on your booking page. It reaches our team directly and starts the 2-day reply clock.</p>
      {CONTACT_EMAIL ? <p>For everything else, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p> : <p>[CONTACT EMAIL]</p>}
      <p className="muted small">Grievance officer and registered address are in our <a href="/privacy">Privacy policy</a>.</p>
    </div>
  )
}
