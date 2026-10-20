import { expandTokens, isDraft } from '@/lib/legal'
import { renderMarkdown } from '@/lib/markdown'

export async function LegalPage({ body }: { body: string }) {
  const md = await expandTokens(body)
  return (
    <div className="wrap page">
      {isDraft(body) && (
        <p className="notice notice--wait" role="note">
          <strong>Draft for legal review.</strong> This text is not final. Items in [square brackets] must be completed by ZoomFly&rsquo;s lawyer before launch.
        </p>
      )}
      <article style={{ maxWidth: '72ch' }} className="legal">{renderMarkdown(md)}</article>
    </div>
  )
}
