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
