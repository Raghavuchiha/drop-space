import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key && !url.includes('YOUR_PROJECT_REF')
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null

export const BUCKET = 'drop-space'
export const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Clean only this app's cached Supabase session when Auth says it no longer exists.
 * Never clear unrelated localStorage keys or sessions from other projects. */
export function clearLocalAuthSession() {
  if (typeof window === 'undefined' || !url) return
  try {
    const projectRef = new URL(url).hostname.split('.')[0]
    window.localStorage.removeItem(`sb-${projectRef}-auth-token`)
  } catch {
    // Browser storage may be disabled; no other sessions are affected.
  }
}

export function isInvalidSessionError(error) {
  if (!error) return false
  const code = String(error.code || '').toLowerCase()
  const message = String(error.message || '').toLowerCase()
  return ['session_not_found', 'refresh_token_not_found', 'invalid_refresh_token', 'refresh_token_already_used'].includes(code)
    || message.includes('session not found')
    || message.includes('refresh token not found')
    || message.includes('invalid refresh token')
    || message.includes('auth session missing')
}
