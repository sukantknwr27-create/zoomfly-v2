import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How ZoomFly works',
  description: 'How ZoomFly checks sellers, shows real seats, takes your payment and protects your booking.',
  alternates: { canonical: '/how-it-works' },
}

export default function HowItWorks() {
  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>How ZoomFly works</h1>
        <p className="hero__lead">ZoomFly is a marketplace for tour packages. The trips come from independent operators. We check them, show the real inventory, and stand between you and the seller until the trip is done.</p>
      </div>
      <div className="lists" style={{ gap: 40, alignItems: 'start' }}>
        <section>
          <h2>Sellers we have checked</h2>
          <p>Every seller must show a valid GSTIN and PAN, a bank account, a business address and an owner ID. We verify them before the seller&rsquo;s first trip can go live. We review every trip, and we look again when a seller changes the plan of a live one.</p>
          <h2>Real dates and real seats</h2>
          <p>A trip appears only when the seller has published departure dates with seats. The seat count you see is the number really left, and it goes down as people book. We never invent urgency.</p>
          <h2>Prices you can compare</h2>
          <p>The price is per person, for the basis stated on the trip. It is either all-in or clearly marked as taxes extra, and every trip lists what is and is not included.</p>
        </section>
        <section>
          <h2>How you pay</h2>
          <p>You pay ZoomFly, not the seller. You pay a small advance to confirm your seats, and the balance later, before the trip. Payments run through Razorpay. The seller is paid in stages as the trip approaches and after it ends.</p>
          <h2>Your details stay private</h2>
          <p>You can message a seller before booking. Phone numbers, emails and links are hidden in chat. After you have paid in full, you and the seller can see each other&rsquo;s contact details so you can sort out pickup.</p>
          <h2>If something goes wrong</h2>
          <p>If a seller cancels, you get a full refund. If you cancel, your refund follows the trip&rsquo;s policy, which is shown before you book. If the trip is not as listed, report it from your booking and we step in. We aim to answer within 2 days and settle within 7.</p>
        </section>
      </div>
      <h2 className="section">Common questions</h2>
      <dl className="kv" style={{ gridTemplateColumns: '1fr', gap: 4 }}>
        <dt style={{ color: 'var(--ink)' }}>Can I talk to the seller before I book?</dt>
        <dd style={{ marginBottom: 14 }}>Yes. Use &ldquo;Ask the seller a question&rdquo; on any trip. You must be signed in.</dd>
        <dt style={{ color: 'var(--ink)' }}>Why can&rsquo;t I see the seller&rsquo;s phone number?</dt>
        <dd style={{ marginBottom: 14 }}>Keeping contact details private until you have paid in full protects both sides from pressure to pay outside the platform, where our protection would not apply.</dd>
        <dt style={{ color: 'var(--ink)' }}>What if the seats run out while I am paying?</dt>
        <dd style={{ marginBottom: 14 }}>Your seats are held for a short time while you pay. If the hold ends before you pay, the seats go back on sale and you can book again if any are left.</dd>
        <dt style={{ color: 'var(--ink)' }}>Do you list trips outside India?</dt>
        <dd style={{ marginBottom: 14 }}>Not yet. We start with domestic trips.</dd>
        <dt style={{ color: 'var(--ink)' }}>I run tours. How do I sell here?</dt>
        <dd style={{ marginBottom: 14 }}>Registration is free and we earn a commission only when you get a booking. <Link href="/become-a-seller">See what we need</Link>.</dd>
      </dl>
      <p className="muted small" style={{ marginTop: 24 }}>Read the full <Link href="/terms">Terms of Use</Link>, <Link href="/cancellation-and-refunds">Cancellation and refunds</Link> and <Link href="/marketplace-rules">Marketplace rules</Link>.</p>
    </div>
  )
}
