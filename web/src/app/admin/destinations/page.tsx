import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { saveDestination, toggleDestination } from './actions'

export const metadata: Metadata = { title: 'Destinations' }
export const dynamic = 'force-dynamic'

export default async function AdminDestinations({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  await requireAdmin('/admin/destinations')
  const supabase = createClient()
  const { data } = await supabase.from('destinations').select('id, name, state, slug, is_active').order('name')
  const rows = (data ?? []) as { id: string; name: string; state: string | null; slug: string; is_active: boolean }[]
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Destinations</h1><p className="muted">Sellers pick from this list. A destination appears on the public site only once a live trip goes there.</p></div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      <form className="form form--wide" action={saveDestination} style={{ marginBottom: 32 }}>
        <div className="form__grid">
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="state">State</label><input id="state" name="state" /></div>
          <div className="field"><label htmlFor="slug">Web address</label><input id="slug" name="slug" placeholder="manali" /><span className="field__hint">Lowercase letters and hyphens. Leave empty to use the name.</span></div>
        </div>
        <div className="actions"><button className="btn btn--primary" type="submit">Add destination</button></div>
      </form>
      <table className="table">
        <thead><tr><th>Name</th><th>State</th><th>Web address</th><th>Sellers can pick it</th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td><td>{d.state}</td><td>/?destination={d.slug}</td>
              <td>
                <form action={toggleDestination}>
                  <input type="hidden" name="id" value={d.id} /><input type="hidden" name="to" value={d.is_active ? 'off' : 'on'} />
                  <button className="btn" type="submit" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>{d.is_active ? 'Yes. Turn off' : 'No. Turn on'}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
