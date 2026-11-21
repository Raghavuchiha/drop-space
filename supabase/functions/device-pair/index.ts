import { createClient } from 'npm:@supabase/supabase-js@2.57.0'

const url = Deno.env.get('SUPABASE_URL')!
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const encoder = new TextEncoder()
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const validOrigins = new Set(['https://shareprivate.netlify.app', 'http://localhost:5173', 'http://127.0.0.1:5173'])

function response(body: Record<string, unknown>, status = 200, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': validOrigins.has(origin) ? origin : 'https://shareprivate.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin'
  } })
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function randomCode() {
  const values = crypto.getRandomValues(new Uint8Array(10))
  return [...values].map(x => chars[x % chars.length]).join('')
}
async function authUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const client = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  return error ? null : data.user
}
function bad(message: string, origin: string, status = 400) { return response({ error: message }, status, origin) }
const invalidMessage = 'That code is invalid, expired, or no longer available.'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') return response({}, 204, origin)
  if (req.method !== 'POST') return bad('Method not allowed.', origin, 405)
  if (!validOrigins.has(origin)) return bad('Origin not allowed.', origin, 403)
  try {
    const { action, code, pairingId, claimSecret, label } = await req.json()
    if (action === 'create') {
      const user = await authUser(req)
      if (!user) return bad('Sign in first.', origin, 401)
      await admin.from('device_pairings').delete().eq('owner_id', user.id).in('status', ['ready', 'pending'])
      for (let i = 0; i < 3; i++) {
        const value = randomCode()
        const { data, error } = await admin.from('device_pairings').insert({
          owner_id: user.id, code_hash: await hash(value)
        }).select('id, expires_at').single()
        if (!error) return response({ pairingId: data.id, code: value, expiresAt: data.expires_at }, 200, origin)
        if (error.code !== '23505') throw error
      }
      return bad('Could not generate a code.', origin, 500)
    }

    if (action === 'join') {
      if (typeof code !== 'string' || !/^[A-HJ-NP-Z2-9]{10}$/.test(code.toUpperCase()) ||
          typeof claimSecret !== 'string' || !/^[a-f0-9-]{36}$/i.test(claimSecret)) {
        return bad(invalidMessage, origin)
      }
      // Bounded attempts per address. Code entropy is ~50 bits; this is defense in depth.
      const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim()
      const ipHash = await hash('device-pair-attempt:' + ip)
      const { data: attempt } = await admin.from('device_pair_attempts').select('*').eq('ip_hash', ipHash).maybeSingle()
      const fresh = !attempt || Date.now() - Date.parse(attempt.window_start) > 120000
      if (!fresh && attempt.attempts >= 5) return bad('Too many attempts. Try again in two minutes.', origin, 429)
      await admin.from('device_pair_attempts').upsert({
        ip_hash: ipHash, attempts: fresh ? 1 : attempt.attempts + 1,
        window_start: fresh ? new Date().toISOString() : attempt.window_start
      })
      const { data: matched } = await admin.from('device_pairings').select('id')
        .eq('code_hash', await hash(code.toUpperCase())).eq('status', 'ready')
        .gt('expires_at', new Date().toISOString()).maybeSingle()
      if (!matched) return bad(invalidMessage, origin)
      const { data, error } = await admin.from('device_pairings')
        .update({ status: 'pending', claim_hash: await hash(claimSecret), requester_label: String(label || 'New device').slice(0, 64) })
        .eq('id', matched.id).eq('status', 'ready').select('id,expires_at').maybeSingle()
      if (error) throw error
      return data ? response({ pairingId: data.id, expiresAt: data.expires_at }, 200, origin) : bad(invalidMessage, origin)
    }

    if (action === 'owner-status' || action === 'approve' || action === 'deny' || action === 'cancel') {
      const user = await authUser(req)
      if (!user) return bad('Sign in first.', origin, 401)
      if (typeof pairingId !== 'string') return bad('Invalid request.', origin)
      const { data: pairing } = await admin.from('device_pairings')
        .select('id,status,requester_label,expires_at').eq('id', pairingId).eq('owner_id', user.id).maybeSingle()
      if (!pairing) return bad('Pairing not found.', origin, 404)
      if (Date.parse(pairing.expires_at) < Date.now()) return response({ status: 'expired' }, 200, origin)
      if (action === 'owner-status') return response({ status: pairing.status, label: pairing.requester_label }, 200, origin)
      const target = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'cancelled'
      const allowed = action === 'approve' || action === 'deny' ? 'pending' : 'ready'
      const { data, error } = await admin.from('device_pairings').update({ status: target })
        .eq('id', pairingId).eq('owner_id', user.id).eq('status', allowed).select('status').maybeSingle()
      if (error) throw error
      return data ? response({ status: target }, 200, origin) : bad('Pairing request has changed. Refresh its status.', origin, 409)
    }

    if (action === 'claim-status' || action === 'redeem') {
      if (typeof pairingId !== 'string' || typeof claimSecret !== 'string') return bad(invalidMessage, origin)
      const { data: pairing } = await admin.from('device_pairings')
        .select('id,owner_id,claim_hash,status,expires_at').eq('id', pairingId)
        .eq('claim_hash', await hash(claimSecret)).maybeSingle()
      if (!pairing) return bad(invalidMessage, origin)
      if (Date.parse(pairing.expires_at) < Date.now()) return response({ status: 'expired' }, 200, origin)
      if (action === 'claim-status') return response({ status: pairing.status }, 200, origin)
      if (pairing.status !== 'approved') return bad('Approval is required.', origin, 403)
      const { data: claimed, error: claimError } = await admin.from('device_pairings')
        .update({ status: 'redeemed' }).eq('id', pairing.id).eq('status', 'approved').select('id').maybeSingle()
      if (claimError) throw claimError
      if (!claimed) return bad('Already claimed.', origin, 409)
      const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(pairing.owner_id)
      if (ownerError || !owner.user?.email) return bad('Account unavailable.', origin, 500)
      // Generate a fresh one-time Supabase Auth token. Never copy an existing device's tokens.
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink', email: owner.user.email
      })
      const tokenHash = link?.properties?.hashed_token
      if (linkError || !tokenHash) return bad('Could not complete sign in. Generate a new pairing code.', origin, 500)
      return response({ tokenHash }, 200, origin)
    }
    return bad('Unknown action.', origin)
  } catch (error) {
    console.error('device-pair error', error)
    return bad('Unable to process pairing right now.', origin, 500)
  }
})
