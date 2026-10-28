import { IconStar } from '@/components/Icons'

// Shows a real rating out of 5. Callers must only render it when a real rating exists.
export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <IconStar key={n} className={value >= n - 0.25 ? 'on' : undefined} />)}
    </span>
  )
}
