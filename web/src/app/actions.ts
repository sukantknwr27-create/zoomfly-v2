'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get('next'))
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) redirect(`/login?error=${encodeURIComponent('Enter your email and password.')}&next=${encodeURIComponent(next)}`)
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = /confirm/i.test(error.message) ? 'Confirm your email first: we sent you a link when you signed up.' : 'That email and password do not match.'
    redirect(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`)
  }
  redirect(next)
}

export async function signUp(formData: FormData) {
  const next = safeNext(formData.get('next'))
  const full_name = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const back = (msg: string) => redirect(`/signup?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`)
  if (!full_name) back('Enter your full name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) back('Enter a valid email address.')
  if (password.length < 8) back('Use a password of at least 8 characters.')
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name }, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) back(error.message)
  if (data.session) redirect(next) // email confirmation switched off: signed in at once
  redirect('/login?notice=' + encodeURIComponent('Account created. Check your email and click the link to confirm, then sign in.') + `&next=${encodeURIComponent(next)}`)
}
