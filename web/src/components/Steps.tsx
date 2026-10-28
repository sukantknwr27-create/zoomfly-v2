const STEPS: [string, string][] = [['Select trip', 'Choose a date'], ['Traveller details', 'Who is travelling'], ['Review & pay', 'Check and pay'], ['Confirmation', 'Booking details']]

export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="steps" aria-label="Booking steps">
      {STEPS.map(([t, sub], i) => {
        const n = i + 1
        return (
          <li key={t} className={`step${n < current ? ' step--done' : ''}${n === current ? ' step--on' : ''}`} aria-current={n === current ? 'step' : undefined}>
            <span className="step__n">{n < current ? '✓' : n}</span>
            <span>{t}<small>{sub}</small></span>
          </li>
        )
      })}
    </ol>
  )
}
