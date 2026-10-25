import Script from 'next/script'

// Renders the bot-check box only when a site key is configured. The widget adds its own hidden field to the form.
export function Turnstile() {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!key) return null
  return (
    <>
      <div className="cf-turnstile" data-sitekey={key} />
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
    </>
  )
}
