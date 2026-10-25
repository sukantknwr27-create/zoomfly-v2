export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zoomfly.in').replace(/\/$/, '')
export const SITE_NAME = 'ZoomFly'
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || ''
// Staging and Vercel preview deployments set NEXT_PUBLIC_NOINDEX=1 so search engines never index them.
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === '1'
// Legal pages show a "draft" banner and stay out of search results until this is set to 'final'.
export const LEGAL_FINAL = process.env.NEXT_PUBLIC_LEGAL_STATUS === 'final'
export const abs = (path: string) => `${SITE_URL}${path}`
// Bump these when the legal text changes in a way people must re-accept. Stored with every acceptance.
export const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION || '2026-10-draft'
