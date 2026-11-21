import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Laptop, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { supabase } from './supabase'

async function pairing(action, payload = {}, authenticated = false) {
  const headers = {}
  if (authenticated) {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) throw new Error('Please sign in again.')
    headers.Authorization = 'Bearer ' + data.session.access_token
  }
  const { data, error } = await supabase.functions.invoke('device-pair', {
    body: { action, ...payload }, headers
  })
  if (error) {
    const context = await error.context?.json?.().catch(() => null)
    throw new Error(context?.error || error.message || 'Pairing service unavailable')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function LinkDeviceModal({ onClose }) {
  const [pair, setPair] = useState(null)
  const [status, setStatus] = useState('ready')
  const [label, setLabel] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setWorking(true); setError('')
    try {
      const data = await pairing('create', {}, true)
      setPair(data); setStatus('ready'); setLabel('')
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }
  useEffect(() => { create() }, [])
  useEffect(() => {
    if (!pair || ['approved','denied','cancelled','redeemed','expired'].includes(status)) return
    let active = true
    const timer = setInterval(async () => {
      try {
        const data = await pairing('owner-status', { pairingId: pair.pairingId }, true)
        if (active) { setStatus(data.status); setLabel(data.label || '') }
      } catch (e) { if (active) setError(e.message) }
    }, 2500)
    return () => { active = false; clearInterval(timer) }
  }, [pair, status])

  async function decide(action) {
    setWorking(true); setError('')
    try {
      const data = await pairing(action, { pairingId: pair.pairingId }, true)
      setStatus(data.status)
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal pair-dialog" role="dialog" aria-modal="true" aria-label="Link new device">
      <div className="modal-top"><div className="modal-icon sky"><Laptop size={23}/></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={19}/></button></div>
      <h2>Link another device</h2>
      <p className="muted">On your other device, choose “Sign in with a code” and enter this temporary code.</p>
      {pair && status === 'ready' && <div className="pair-code" aria-live="polite">
        <span>ONE-TIME CODE</span><strong>{pair.code.slice(0,5)} {pair.code.slice(5)}</strong>
        <button className="btn btn-subtle" onClick={() => navigator.clipboard.writeText(pair.code)}><Copy size={15}/> Copy code</button>
        <small>Expires in 2 minutes. Never share a code you didn't request.</small>
      </div>}
      {status === 'pending' && <div className="pair-approval">
        <ShieldCheck size={29}/><h3>Approve sign in?</h3>
        <p>Device requesting access: <strong>{label || 'New device'}</strong></p>
        <p>Only approve if you personally entered the pairing code on your other device.</p>
        <div className="modal-actions">
          <button className="btn btn-subtle" disabled={working} onClick={() => decide('deny')}>Deny</button>
          <button className="btn btn-primary" disabled={working} onClick={() => decide('approve')}><Check size={17}/> Approve device</button>
        </div>
      </div>}
      {status === 'ready' && <p className="pair-status"><LoaderCircle className="spin" size={16}/> Waiting for your other device…</p>}
      {status === 'approved' && <p className="inline-alert good">Approved. Your other device is completing sign in.</p>}
      {status === 'redeemed' && <p className="inline-alert good">Your new device is linked successfully.</p>}
      {status === 'denied' && <p className="inline-alert error">Request denied.</p>}
      {status === 'cancelled' && <p className="inline-alert error">Pairing cancelled.</p>}
      {status === 'expired' && <p className="inline-alert error">Code expired. Generate a new one.</p>}
      {error && <p role="alert" className="inline-alert error">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-subtle" onClick={onClose}>Close</button>
        {(!pair || ['denied','cancelled','redeemed','expired'].includes(status)) &&
          <button className="btn btn-primary" disabled={working} onClick={create}>{working ? 'Generating…' : 'New code'}</button>}
      </div>
    </div>
  </div>
}

export function CodeSignIn({ onBack }) {
  const [code, setCode] = useState('')
  const [pair, setPair] = useState(null)
  const [status, setStatus] = useState('ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function join(e) {
    e.preventDefault(); setBusy(true); setError('')
    const claimSecret = crypto.randomUUID()
    try {
      const data = await pairing('join', {
        code: code.replace(/\s/g, '').toUpperCase(), claimSecret,
        label: /mobile|android|iphone/i.test(navigator.userAgent) ? 'Phone browser' : 'Desktop browser'
      })
      setPair({ pairingId: data.pairingId, claimSecret })
      setStatus('pending')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!pair || status !== 'pending') return
    let active = true
    let checking = false
    const timer = setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const data = await pairing('claim-status', pair)
        if (!active) return
        if (data.status === 'approved') {
          setStatus('signing-in')
          const result = await pairing('redeem', pair)
          const { error: authError } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: 'magiclink' })
          if (authError) throw authError
          setStatus('complete')
        } else if (data.status !== 'pending') setStatus(data.status)
      } catch (e) {
        if (active) { setError(e.message); setStatus('failed') }
      } finally { checking = false }
    }, 2500)
    return () => { active = false; clearInterval(timer) }
  }, [pair, status])
  return <div className="pair-login">
    <div className="modal-icon sky"><KeyRound size={22}/></div>
    <h2>Sign in with a code</h2>
    <p className="muted">On a device already signed in, open <b>Link device</b> to generate a temporary code.</p>
    {!pair && <form className="auth-form" onSubmit={join}>
      <label>10-character code<input autoFocus required minLength={10} maxLength={11} autoComplete="off" spellCheck={false}
        placeholder="XXXXX XXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9\s]/g, ''))}/></label>
      <button className="btn btn-primary auth-submit" type="submit" disabled={busy || code.replace(/\s/g, '').length !== 10}>
        {busy ? <LoaderCircle className="spin" size={17}/> : <KeyRound size={17}/>} Request access
      </button>
    </form>}
    {status === 'pending' && <p className="pair-status"><LoaderCircle className="spin" size={18}/> Waiting for approval on your first device…</p>}
    {status === 'signing-in' && <p className="pair-status"><LoaderCircle className="spin" size={18}/> Signing you in securely…</p>}
    {status === 'complete' && <p className="inline-alert good">Connected! Opening your space…</p>}
    {['expired','denied','cancelled','failed'].includes(status) && <button className="btn btn-subtle" onClick={() => {setPair(null);setStatus('ready');setError('')}}>Try another code</button>}
    {error && <p className="inline-alert error" role="alert">{error}</p>}
    <button type="button" className="pair-back" onClick={onBack}>Back to email sign in</button>
  </div>
}
