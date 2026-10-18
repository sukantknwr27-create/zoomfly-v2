import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { createPackage } from '../actions'

export const metadata: Metadata = { title: 'Add a trip' }
export const dynamic = 'force-dynamic'

export default async function NewPackage({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser('/seller/packages/new')
  const supabase = createClient()
  const { data: seller } = await supabase.from('sellers').select('status').maybeSingle()
  if (!seller || seller.status !== 'approved') redirect('/seller')
  const { data: dests } = await supabase.from('destinations').select('id, name, state').eq('is_active', true).order('name')

  return (
    <div className="wrap page">
      <p className="small"><Link href="/seller/packages">Your trips</Link></p>
      <div className="page__head">
        <h1>Add a trip</h1>
        <p className="muted">Start with a title and a destination. You will add the rest on the next page, and nothing is visible to travellers until we approve it.</p>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      <form className="form" action={createPackage}>
        <div className="field">
          <label htmlFor="title">Trip title</label>
          <input id="title" name="title" minLength={5} maxLength={90} required placeholder="Manali and Kasol, 5 nights from Delhi" />
          <span className="field__hint">Say where it goes and how long it is. Avoid words like “best” or “cheapest”.</span>
        </div>
        <div className="field">
          <label htmlFor="destination_id">Main destination</label>
          <select id="destination_id" name="destination_id" defaultValue="">
            <option value="">Choose one</option>
            {(dests ?? []).map((d: { id: string; name: string; state: string | null }) => (
              <option key={d.id} value={d.id}>{d.name}{d.state ? `, ${d.state}` : ''}</option>
            ))}
          </select>
          <span className="field__hint">Your destination is not listed? Write to us and we will add it.</span>
        </div>
        <div className="actions"><button className="btn btn--primary" type="submit">Create draft</button></div>
      </form>
    </div>
  )
}
