import Link from 'next/link'
import { toggleSaved } from '@/app/saved/actions'
import type { SavedInfo } from '@/lib/saved'

const Heart = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true" style={filled ? { fill: '#e5352b', stroke: '#e5352b' } : undefined}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" />
  </svg>
)

// Heart button. Signed-out visitors are sent to sign in and come straight back.
export function SaveButton({ packageId, saved, here, variant = 'card' }: { packageId: string; saved: SavedInfo; here: string; variant?: 'card' | 'row' | 'inline' }) {
  const on = saved.ids.has(packageId)
  const label = on ? 'Remove from saved trips' : 'Save this trip'
  const cls = `savebtn savebtn--${variant}`
  if (!saved.signedIn) {
    return <Link className={cls} href={`/login?next=${encodeURIComponent(here)}`} aria-label={label}><Heart filled={false} />{variant === 'inline' && <span>Save</span>}</Link>
  }
  return (
    <form action={toggleSaved} className={`savebtn-form savebtn-form--${variant}`}>
      <input type="hidden" name="package_id" value={packageId} />
      <input type="hidden" name="next" value={here} />
      <button className={cls} type="submit" aria-label={label} aria-pressed={on}><Heart filled={on} />{variant === 'inline' && <span>{on ? 'Saved' : 'Save'}</span>}</button>
    </form>
  )
}
