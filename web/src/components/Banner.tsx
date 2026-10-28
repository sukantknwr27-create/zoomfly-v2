import type { ReactNode } from 'react'

// Decorative mountain scene drawn in SVG. It is artwork, not a photo, so it never pretends to be a real place.
export function BannerArt() {
  return (
    <svg className="banner__art" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="bsky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0a2a6c" /><stop offset="1" stopColor="#2a74e6" /></linearGradient>
      </defs>
      <rect width="1200" height="320" fill="url(#bsky)" opacity="0.0" />
      <circle cx="960" cy="86" r="46" fill="#ffffff" opacity="0.14" />
      <path d="M0 250 L170 120 L270 200 L430 70 L600 210 L720 130 L880 230 L1040 110 L1200 210 V320 H0Z" fill="#ffffff" opacity="0.08" />
      <path d="M0 290 L140 190 L260 260 L420 160 L560 270 L700 190 L860 280 L1010 200 L1200 285 V320 H0Z" fill="#ffffff" opacity="0.1" />
      <path d="M170 120 L205 155 L185 150 L170 168 L155 148 L140 152Z M430 70 L470 118 L445 112 L430 134 L412 108 L392 114Z" fill="#ffffff" opacity="0.28" />
    </svg>
  )
}

export function Banner({ title, sub, crumbs, side, children, photo, tall }: {
  title: ReactNode; sub?: ReactNode; crumbs?: ReactNode; side?: ReactNode; children?: ReactNode; photo?: string; tall?: boolean
}) {
  return (
    <section className={`banner${tall ? ' banner--tall' : ''}${photo ? ' banner--photo' : ''}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="banner__photo" src={photo} alt="" />
      ) : (
        <BannerArt />
      )}
      <div className="wrap banner__inner">
        <div style={{ minWidth: 0, flex: 1 }}>
          {crumbs && <div className="banner__crumbs">{crumbs}</div>}
          <h1>{title}</h1>
          {sub && <p className="banner__sub">{sub}</p>}
          {children}
        </div>
        {side && <aside className="banner__side">{side}</aside>}
      </div>
    </section>
  )
}
