// Small dependency-free charts drawn in SVG. They only draw what they are given.
export function BarChart({ labels, values, format, label }: { labels: string[]; values: number[]; format?: (n: number) => string; label: string }) {
  const max = Math.max(1, ...values)
  const W = 420, H = 190, top = 22, bottom = 28, gap = 14
  const bw = (W - gap * (values.length + 1)) / values.length
  const f = format ?? ((n: number) => String(n))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line-strong)" />
      {values.map((v, i) => {
        const h = Math.round(((H - top - bottom) * v) / max)
        const x = gap + i * (bw + gap)
        return (
          <g key={i}>
            <rect x={x} y={H - bottom - h} width={bw} height={Math.max(h, v > 0 ? 2 : 0)} rx="5" fill="var(--blue)" opacity={v > 0 ? 1 : 0.25} />
            <text x={x + bw / 2} y={H - bottom - h - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--blue-deep)">{v > 0 ? f(v) : ''}</text>
            <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function HBars({ rows, format }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const f = format ?? ((n: number) => String(n))
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: '0.92rem' }}>
          <span style={{ fontWeight: 600 }}>{r.label}</span><span className="muted">{f(r.value)}</span>
          <i style={{ gridColumn: '1 / -1', display: 'block', height: 8, borderRadius: 99, background: '#e7edf8', overflow: 'hidden' }}><b style={{ display: 'block', height: '100%', width: `${Math.max(3, Math.round((r.value / max) * 100))}%`, background: 'var(--blue)', borderRadius: 99 }} /></i>
        </div>
      ))}
    </div>
  )
}
