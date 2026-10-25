'use client'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, color: '#12263a' }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page. If you were paying, check your bookings before paying again.</p>
        {error.digest && <p style={{ color: '#46586b' }}>Reference: {error.digest}</p>}
      </body>
    </html>
  )
}
