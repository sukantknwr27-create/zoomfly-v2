import type { Metadata } from 'next'
import { isDraft } from '@/lib/legal'
import { LegalPage } from '@/components/LegalPage'
import body from '@/content/legal/marketplace-rules'

// Draft pages (switch not set to "final", or a [placeholder] still in the text) are kept out of search results.
export const metadata: Metadata = { title: 'Marketplace Rules', ...(isDraft(body) ? { robots: { index: false } } : {}) }
export const dynamic = 'force-dynamic'

export default function Page() {
  return <LegalPage body={body} />
}
