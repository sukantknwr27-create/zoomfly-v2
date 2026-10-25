'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { allow, clientIp, clientKey } from '@/lib/ratelimit'
import { verifyTurnstile } from '@/lib/turnstile'
import { TERMS_VERSION } from '@/lib/site'

function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === 'string' ? raw : ''
  // only same-site paths; blocks open redirects like //evil.com or https://evil.com
  return v.startsWith('/') && !v.startsWith('//') ? v : '/'
}

function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  return `${h.get('x-forwarded-proto') ?? 'http'}://${host}`
}

const tooMany = 'Too many attempts. Please wait a few minutes and try again.'
const turnstileToken = (fd: FormData) => String(fd.get('cf-turnstile-response') ?? '') || null

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get('next'))
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const bad = (msg: string) => redirect(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`)
  if (!email || !password) bad('Enter your email and password.')
  if (!(await allow(`login:${clientKey()}`, 30, 600))) bad(tooMany)
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) bad(/confirm/i.test(error.message) ? 'Confirm your email first: we sent you a link when you signed up.' : 'That email and password do not match.')
  redirect(next)
}

export async function signUp(formData: FormData) {
  const next = safeNext(formData.get('next'))
  const full_name = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const back = (msg: string) => redirect(`/signup?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`)
  // hidden field only bots fill in: pretend it worked, create nothing
  if (String(formData.get('website') ?? '') !== '') redirect('/login?notice=' + encodeURIComponent('Account created. Check your email and click the link to confirm, then sign in.'))
  if (!full_name) back('Enter your full name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) back('Enter a valid email address.')
  if (password.length < 8) back('Use a password of at least 8 characters.')
  if (formData.get('terms') !== 'on') back('Please tick the box to accept the Terms of Use and Privacy Policy.')
  if (!(await allow(`signup:${clientKey()}`, 10, 3600))) back(tooMany)
  if (!(await verifyTurnstile(turnstileToken(formData), clientIp()))) back('We could not confirm you are not a robot. Please try again.')
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name, terms_accepted: 'true', terms_version: TERMS_VERSION }, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) back(error.message)
  if (data.session) redirect(next) // email confirmation switched off: signed in at once
  redirect('/login?notice=' + encodeURIComponent('Account created. Check your email and click the link to confirm, then sign in.') + `&next=${encodeURIComponent(next)}`)
}

// Always answers the same way, whether or not the address has an account, so nobody can use this to find out who is registered.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const sent = () => redirect('/forgot-password?sent=1')
  if (String(formData.get('website') ?? '') !== '') sent()
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect('/forgot-password?error=' + encodeURIComponent('Enter a valid email address.'))
  if (!(await allow(`reset-ip:${clientKey()}`, 5, 3600)) || !(await allow(`reset-mail:${email}`, 3, 3600))) redirect('/forgot-password?error=' + encodeURIComponent(tooMany))
  if (!(await verifyTurnstile(turnstileToken(formData), clientIp()))) redirect('/forgot-password?error=' + encodeURIComponent('We could not confirm you are not a robot. Please try again.'))
  const supabase = createClient()
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/reset-password')}` })
  sent()
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const to = String(formData.get('return') ?? '') === 'account' ? '/account' : '/reset-password'
  const back = (msg: string) => redirect(`${to}?error=${encodeURIComponent(msg)}`)
  if (password.length < 8) back('Use a password of at least 8 characters.')
  if (password !== confirm) back('The two passwords do not match.')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=' + encodeURIComponent(to))
  const { error } = await supabase.auth.updateUser({ password })
  if (error) back(/same|different/i.test(error.message) ? 'Choose a password you have not used before.' : 'Could not change the password. Try again.')
  redirect('/account?ok=' + encodeURIComponent('Your password was changed.'))
}
