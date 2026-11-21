import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCircle2,
  ChevronDown, Cloud, CloudUpload, Copy, File, FileArchive, FileCode2, FileImage,
  FileText, FileVideo, FolderClosed, HardDrive, LayoutGrid, Link2, List,
  LoaderCircle, LockKeyhole, LogOut, Plus, Search, ShieldCheck, Sparkles,
  Star, StickyNote, Trash2, Upload, X
} from 'lucide-react'
import { supabase, BUCKET, MAX_FILE_BYTES, clearLocalAuthSession, isInvalidSessionError } from './supabase'
import { LinkDeviceModal, CodeSignIn } from './DevicePairing'

const categories = [
  { id: 'all', label: 'All items', icon: LayoutGrid },
  { id: 'file', label: 'Files', icon: FolderClosed },
  { id: 'note', label: 'Notes', icon: StickyNote },
  { id: 'link', label: 'Links', icon: Link2 },
  { id: 'starred', label: 'Starred', icon: Star },
]

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 ** 2)).toFixed(1)} MB`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(value))
}

function isSafeUrl(input) {
  try {
    const candidate = input.includes('://') ? input.trim() : `https://${input.trim()}`
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

function iconFor(item) {
  if (item.kind === 'note') return { Icon: StickyNote, tone: 'amber' }
  if (item.kind === 'link') return { Icon: Link2, tone: 'violet' }
  if (item.mime_type?.startsWith('image/')) return { Icon: FileImage, tone: 'rose' }
  if (item.mime_type?.startsWith('video/')) return { Icon: FileVideo, tone: 'blue' }
  if (item.mime_type?.includes('pdf')) return { Icon: FileText, tone: 'red' }
  if (item.mime_type?.includes('zip') || item.mime_type?.includes('compressed')) return { Icon: FileArchive, tone: 'orange' }
  if (item.mime_type?.includes('json') || item.mime_type?.includes('javascript')) return { Icon: FileCode2, tone: 'green' }
  return { Icon: File, tone: 'blue' }
}

function Logo({ small = false }) {
  return (
    <div className={`brand ${small ? 'brand-small' : ''}`}>
      <span className="brand-mark"><Cloud size={22} strokeWidth={2.7} /><span className="brand-dot" /></span>
      <span>drop<span className="brand-accent">space</span></span>
    </div>
  )
}

function SetupScreen() {
  return (
    <main className="setup">
      <div className="setup-card">
        <Logo />
        <div className="setup-icon"><LockKeyhole size={28} /></div>
        <h1>One small setup step.</h1>
        <p>Connect a Supabase project to make your personal cloud space live.</p>
        <ol>
          <li>Run <code>supabase/setup.sql</code> in your Supabase SQL Editor.</li>
          <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
          <li>Paste your Project URL and <strong>publishable</strong> key.</li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
        <p className="setup-warning">Never place a Supabase secret/service-role key in frontend code.</p>
      </div>
    </main>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [codeMode, setCodeMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setFeedback('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) throw err
        if (!data.session) setFeedback('Account request received. Check your email for a confirmation link, then sign in.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <Logo />
        <div className="auth-hero">
          <div className="hero-mini">YOUR DIGITAL POCKET</div>
          <h1>Your things.<br />Anywhere you are.</h1>
          <p>Save the little things and the important things. Pick them up from any device, whenever you need them.</p>
          <div className="floating-card float-one"><FileImage size={20} /><span>design-preview.png</span><CheckCircle2 size={18} /></div>
          <div className="floating-card float-two"><Link2 size={20} /><span>That useful article</span><ArrowUpRight size={18} /></div>
          <div className="orb orb-a" /><div className="orb orb-b" />
        </div>
        <span className="auth-foot">Simple. Private. Always in sync.</span>
      </div>
      <div className="auth-form-panel">
        <div className="mobile-brand"><Logo /></div>
        <div className="auth-content">
          <span className="eyebrow"><span className="eyebrow-dot" /> WELCOME TO DROPSPACE</span>
          {codeMode ? <CodeSignIn onBack={() => setCodeMode(false)} /> : <><h2>{mode === 'signin' ? 'Welcome back' : 'Create your space'}</h2>
          <p className="muted">{mode === 'signin' ? 'Sign in to access everything you saved.' : 'Start saving your files, notes and links in one place.'}</p>
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setError(''); setFeedback('') }} type="button">Sign in</button>
            <button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); setFeedback('') }} type="button">Create account</button>
          </div>
          <form onSubmit={submit} className="auth-form">
            <label>Email address<input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} /></label>
            {error && <div role="alert" className="inline-alert error">{error}</div>}
            {feedback && <div role="status" className="inline-alert good">{feedback}</div>}
            <button className="btn btn-primary auth-submit" disabled={busy} type="submit">
              {busy ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}
              {mode === 'signin' ? 'Sign in to DropSpace' : 'Create my space'}
            </button>
          </form>
          <button type="button" className="pair-back pair-auth-link" onClick={() => { setCodeMode(true); setError(""); setFeedback("") }}>Sign in with a device code</button>
          <div className="auth-security"><ShieldCheck size={16} /> Protected with Supabase Auth and private storage</div></>}
        </div>
      </div>
    </div>
  )
}

function ComposerModal({ kind, onClose, onSave, busy }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const isNote = kind === 'note'
  function handleSubmit(e) {
    e.preventDefault()
    onSave({ kind, title: title.trim(), content: content.trim() })
  }
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isNote ? 'Add note' : 'Save link'}>
        <div className="modal-top">
          <div className={`modal-icon ${isNote ? 'amber' : 'violet'}`}>{isNote ? <StickyNote size={22} /> : <Link2 size={22} />}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <h2>{isNote ? 'Write a quick note' : 'Save a link'}</h2>
        <p className="muted">{isNote ? 'Ideas, snippets, reminders — keep them close.' : 'Keep that website handy on every device.'}</p>
        <form className="compose-form" onSubmit={handleSubmit}>
          <label>Title<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} autoFocus required placeholder={isNote ? 'A thought worth saving' : 'Something useful'} /></label>
          <label>{isNote ? 'Your note' : 'Website URL'}
            {isNote
              ? <textarea rows={6} value={content} onChange={e => setContent(e.target.value)} required placeholder="Type whatever you want to remember…" />
              : <input value={content} onChange={e => setContent(e.target.value)} required placeholder="https://example.com" />}
          </label>
          <div className="modal-actions">
            <button className="btn btn-subtle" type="button" disabled={busy} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !title.trim() || !content.trim()} type="submit">
              {busy && <LoaderCircle size={17} className="spin" />}
              Save {isNote ? 'note' : 'link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ItemCard({ item, onOpen, onDownload, onDelete, onStar, onCopy, view }) {
  const { Icon, tone } = iconFor(item)
  const description = item.kind === 'note' ? item.body : item.kind === 'link' ? item.url : item.mime_type || 'File'
  return (
    <article className={`item-card ${view === 'list' ? 'item-list' : ''}`}>
      <div className={`file-symbol ${tone}`}><Icon size={25} strokeWidth={1.9} /></div>
      <div className="item-info">
        <div className="item-name" title={item.title}>{item.title}</div>
        <div className="item-desc">{description}</div>
        <div className="item-meta">
          <span>{formatDate(item.created_at)}</span>
          {item.kind === 'file' && <><span className="meta-sep">•</span><span>{formatBytes(item.size_bytes)}</span></>}
        </div>
      </div>
      <div className="item-controls">
        <button className={`icon-btn ${item.starred ? 'is-starred' : ''}`} aria-label={item.starred ? 'Remove star' : 'Star item'} title={item.starred ? 'Unstar' : 'Star'} onClick={() => onStar(item)}><Star size={17} fill={item.starred ? 'currentColor' : 'none'} /></button>
        <button className="icon-btn" aria-label={item.kind === 'file' ? 'Preview' : 'Open'} title={item.kind === 'file' ? 'Preview' : 'Open'} onClick={() => onOpen(item)}><ArrowUpRight size={18} /></button>
        {item.kind === 'file'
          ? <button className="icon-btn" aria-label="Download" title="Download" onClick={() => onDownload(item)}><ArrowDownToLine size={18} /></button>
          : <button className="icon-btn" aria-label="Copy" title="Copy" onClick={() => onCopy(item)}><Copy size={17} /></button>}
        <button className="icon-btn danger" aria-label="Delete" title="Delete" onClick={() => onDelete(item)}><Trash2 size={17} /></button>
      </div>
    </article>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [items, setItems] = useState([])
  const [fetching, setFetching] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('new')
  const [compose, setCompose] = useState(null)
  const [pairModal, setPairModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState(null)
  const inputRef = useRef(null)
  const toastTimer = useRef(null)
  const logoutInProgress = useRef(false)
  const user = session?.user

  function notify(message, type = 'good') {
    setToast({ message, type })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4500)
  }

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    let active = true
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return
      if (error && isInvalidSessionError(error)) {
        clearLocalAuthSession()
        setSession(null)
        setAuthLoading(false)
        return
      }
      if (error) {
        setToast({ message: error.message, type: 'error' })
        setAuthLoading(false)
        return
      }
      // A stored JWT can outlive a revoked server-side session.
      // Verify the user before showing private workspace content.
      if (data.session) {
        const { error: userError } = await supabase.auth.getUser()
        if (!active) return
        if (isInvalidSessionError(userError)) {
          clearLocalAuthSession()
          setSession(null)
          setAuthLoading(false)
          return
        }
        if (userError) {
          setToast({ message: 'Could not verify your session. Check your connection and refresh.', type: 'error' })
          setAuthLoading(false)
          return
        }
      }
      setSession(data.session)
      setAuthLoading(false)
    }).catch(err => {
      if (active) { setAuthLoading(false); setToast({ message: err.message, type: 'error' }) }
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setAuthLoading(false)
    })
    return () => { active = false; subscription.subscription.unsubscribe(); window.clearTimeout(toastTimer.current) }
  }, [])

  const reload = useCallback(async () => {
    if (!supabase || !user?.id) return
    setFetching(true)
    const { data, error } = await supabase
      .from('drop_items')
      .select('id, kind, title, body, url, storage_path, mime_type, size_bytes, starred, created_at')
      .order('created_at', { ascending: false })
    if (error) notify(`Could not load items: ${error.message}`, 'error')
    else setItems(data || [])
    setFetching(false)
  }, [user?.id])

  useEffect(() => {
    if (user?.id) reload()
    else { setItems([]); setFetching(false) }
  }, [user?.id, reload])

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = items.filter(item => (
      (tab === 'all' || (tab === 'starred' ? item.starred : item.kind === tab)) &&
      (!term || [item.title, item.body, item.url, item.mime_type].some(v => v?.toLowerCase().includes(term)))
    ))
    return filtered.sort((a, b) => sort === 'az' ? a.title.localeCompare(b.title) : new Date(b.created_at) - new Date(a.created_at))
  }, [items, query, tab, sort])

  const usedBytes = items.reduce((sum, item) => sum + (item.kind === 'file' ? item.size_bytes || 0 : 0), 0)
  const fileCount = items.filter(item => item.kind === 'file').length

  async function uploadFiles(fileList) {
    if (!user || busy || !fileList?.length) return
    setBusy(true)
    const candidates = Array.from(fileList)
    let succeeded = 0, failed = 0
    let lastError = ''
    for (const file of candidates) {
      if (file.size > MAX_FILE_BYTES) { failed++; lastError = `${file.name} exceeds 50 MB`; continue }
      try {
        const cleanName = file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 180) || 'file'
        const path = `${user.id}/${crypto.randomUUID()}/${cleanName}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream'
        })
        if (uploadError) throw uploadError
        const { error: dbError } = await supabase.from('drop_items').insert({
          user_id: user.id, kind: 'file', title: file.name, storage_path: path,
          mime_type: file.type || 'application/octet-stream', size_bytes: file.size
        })
        if (dbError) {
          await supabase.storage.from(BUCKET).remove([path])
          throw dbError
        }
        succeeded++
      } catch (err) {
        failed++; lastError = err.message || 'Upload failed'
      }
    }
    setBusy(false)
    if (succeeded) await reload()
    notify(failed
      ? `${succeeded} uploaded, ${failed} failed. ${lastError}`
      : `${succeeded} ${succeeded === 1 ? 'item' : 'items'} uploaded successfully.`,
      failed ? 'error' : 'good')
  }

  async function saveEntry({ kind, title, content }) {
    if (busy) return
    const normalized = kind === 'link' ? isSafeUrl(content) : null
    if (kind === 'link' && !normalized) { notify('Please enter a valid http/https link.', 'error'); return }
    setBusy(true)
    const { error } = await supabase.from('drop_items').insert({
      user_id: user.id, kind, title,
      body: kind === 'note' ? content : null,
      url: kind === 'link' ? normalized : null
    })
    setBusy(false)
    if (error) { notify(error.message, 'error'); return }
    setCompose(null)
    await reload()
    notify(kind === 'note' ? 'Note saved to your space.' : 'Link saved to your space.')
  }

  async function toggleStar(item) {
    const before = item.starred
    setItems(old => old.map(i => i.id === item.id ? { ...i, starred: !before } : i))
    const { error } = await supabase.from('drop_items').update({ starred: !before }).eq('id', item.id)
    if (error) { setItems(old => old.map(i => i.id === item.id ? { ...i, starred: before } : i)); notify(error.message, 'error') }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      if (item.kind === 'file') {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.storage_path])
        if (storageError) throw storageError
      }
      const { error } = await supabase.from('drop_items').delete().eq('id', item.id)
      if (error) throw error
      setItems(old => old.filter(i => i.id !== item.id))
      notify('Item deleted.')
    } catch (err) { notify(`Delete failed: ${err.message}`, 'error') }
    finally { setBusy(false) }
  }

  async function openItem(item) {
    if (item.kind === 'note') {
      const note = window.open('', '_blank')
      if (!note) { notify('Allow pop-ups to open this note.', 'error'); return }
      note.opener = null
      note.document.title = item.title
      note.document.body.style.cssText = 'font:16px/1.65 system-ui;padding:30px;max-width:780px;margin:auto;white-space:pre-wrap;color:#203047'
      const heading = note.document.createElement('h2')
      heading.textContent = item.title
      const paragraph = note.document.createElement('div')
      paragraph.textContent = item.body || ''
      note.document.body.append(heading, paragraph)
      return
    }
    if (item.kind === 'link') {
      const safe = isSafeUrl(item.url || '')
      if (safe) window.open(safe, '_blank', 'noopener,noreferrer')
      else notify('That link is not valid.', 'error')
      return
    }
    const newTab = window.open('about:blank', '_blank')
    if (newTab) newTab.opener = null
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 60)
    if (error) { if (newTab) newTab.close(); notify(error.message, 'error'); return }
    if (newTab) newTab.location.href = data.signedUrl
    else notify('Allow pop-ups to preview this file.', 'error')
  }

  async function downloadItem(item) {
    const { data, error } = await supabase.storage.from(BUCKET).download(item.storage_path)
    if (error) { notify(error.message, 'error'); return }
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = item.title
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  async function copyItem(item) {
    try {
      await navigator.clipboard.writeText(item.kind === 'note' ? (item.body || '') : (item.url || ''))
      notify('Copied to clipboard.')
    } catch { notify('Clipboard access requires HTTPS or localhost.', 'error') }
  }

  async function logout() {
    if (logoutInProgress.current) return
    logoutInProgress.current = true
    try {
      // Don't revoke other phones and laptops. This app supports linked devices.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error && !isInvalidSessionError(error)) {
        // A network/backend error can prevent server-side revocation. Always
        // remove local credentials on explicit sign out; never keep a user
        // trapped in a broken session.
        console.warn('Local logout: remote session revocation could not be confirmed.', error)
      }
    } catch (error) {
      console.warn('Local logout: remote session revocation could not be confirmed.', error)
    } finally {
      // Fail closed on this device, even if its stored session was revoked.
      clearLocalAuthSession()
      setSession(null)
      setItems([])
      setPairModal(false)
      logoutInProgress.current = false
    }
  }

  function receiveDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  if (!supabase) return <SetupScreen />
  if (authLoading) return <div className="screen-loader"><Logo /><LoaderCircle size={26} className="spin" /></div>
  if (!user) return <AuthScreen />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><Logo /></div>
        <div className="workspace-label"><span className="workspace-dot" /> PERSONAL WORKSPACE <ChevronDown size={14} /></div>
        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-heading">LIBRARY</span>
          {categories.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={19} strokeWidth={1.9} />{label}
              {id === 'all' && <span className="nav-count">{items.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-card">
            <div className="usage-title"><HardDrive size={18} /> Your storage</div>
            <div className="usage-bar"><span style={{ width: `${Math.min(100, usedBytes / (50 * 1024 * 1024) * 100)}%` }} /></div>
            <p>{formatBytes(usedBytes)} used in {fileCount} {fileCount === 1 ? 'file' : 'files'}</p>
            <small>Per-file limit: 50 MB. Total quota depends on your Supabase plan.</small>
          </div>
          <button className="btn btn-subtle pair-sidebar-button" onClick={() => setPairModal(true)}><Link2 size={16}/> Link device</button>
          <div className="account-area">
            <span className="avatar">{user.email?.[0]?.toUpperCase() || 'U'}</span>
            <div className="account-details"><strong>My workspace</strong><span title={user.email}>{user.email}</span></div>
            <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Logo small /></div>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{categories.find(c => c.id === tab)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="secure-pill"><ShieldCheck size={15} /> Private space</span>
            <button className="btn btn-subtle pair-topbar-button" onClick={() => setPairModal(true)}><Link2 size={15}/> Link device</button>
            <button className="mobile-signout icon-btn" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={19} /></button>
            <span className="topbar-avatar">{user.email?.[0]?.toUpperCase() || 'U'}</span>
          </div>
        </header>

        <nav className="mobile-tabs" aria-label="Mobile navigation">
          {categories.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}
        </nav>

        <main className="content">
          <div className="welcome-line"><span className="sparkle">✦</span> YOUR PERSONAL CLOUD</div>
          <div className="heading-section">
            <div><h1>Your space, <span>your stuff.</span></h1><p>Drop it here. Find it anywhere. It's that simple.</p></div>
            <button className="btn btn-primary heading-add" onClick={() => inputRef.current?.click()} disabled={busy}><Plus size={18} /> Upload files</button>
          </div>

          <div className="quick-stats">
            <div className="stat"><div className="stat-icon sky"><FolderClosed size={19} /></div><div><strong>{fileCount}</strong><span>Files saved</span></div></div>
            <div className="stat"><div className="stat-icon honey"><StickyNote size={19} /></div><div><strong>{items.filter(i => i.kind === 'note').length}</strong><span>Quick notes</span></div></div>
            <div className="stat"><div className="stat-icon purple"><Link2 size={19} /></div><div><strong>{items.filter(i => i.kind === 'link').length}</strong><span>Saved links</span></div></div>
            <div className="stat"><div className="stat-icon mint"><Activity size={19} /></div><div><strong>{items.length}</strong><span>Total items</span></div></div>
          </div>

          <div className={`drop-zone ${dragging ? 'dragging' : ''} ${busy ? 'disabled' : ''}`}
            onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
            onDrop={receiveDrop}
            role="button" tabIndex={0}
            aria-label="Upload files"
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click() } }}
            onClick={() => { if (!busy) inputRef.current?.click() }}>
            <div className="drop-icon">{busy ? <LoaderCircle size={26} className="spin" /> : <CloudUpload size={28} />}</div>
            <div className="drop-copy"><h3>{busy ? 'Saving to your space…' : 'Drop your files here'}</h3><p>Drag and drop, or <b>browse files</b> to upload</p></div>
            <span className="drop-limit">UP TO 50 MB EACH</span>
          </div>
          <input ref={inputRef} hidden type="file" multiple onChange={e => { uploadFiles(e.target.files); e.target.value = '' }} />

          <div className="quick-add-label">OR SAVE SOMETHING QUICKLY</div>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => setCompose('note')}><span className="quick-icon amber"><StickyNote size={19} /></span><span><strong>Quick note</strong><small>Jot down an idea or text</small></span><Plus size={18} /></button>
            <button className="quick-action" onClick={() => setCompose('link')}><span className="quick-icon violet"><Link2 size={19} /></span><span><strong>Save a link</strong><small>Keep a website for later</small></span><Plus size={18} /></button>
          </div>

          <section className="library-section">
            <div className="library-heading"><div><span className="overline">YOUR COLLECTION</span><h2>{categories.find(c => c.id === tab)?.label} <span className="item-count">{visibleItems.length}</span></h2></div></div>
            <div className="library-toolbar">
              <div className="search"><Search size={18} /><input placeholder="Search your space…" aria-label="Search items" value={query} onChange={e => setQuery(e.target.value)} /></div>
              <div className="toolbar-right">
                <select className="sort-select" value={sort} aria-label="Sort items" onChange={e => setSort(e.target.value)}><option value="new">Newest first</option><option value="az">Name A–Z</option></select>
                <div className="view-switch" aria-label="Display options"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view" title="Grid view"><LayoutGrid size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view" title="List view"><List size={18} /></button></div>
              </div>
            </div>

            {fetching && !items.length
              ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>Loading your space…</p></div>
              : visibleItems.length === 0
                ? <div className="empty-state"><div className="empty-icon"><Sparkles size={26} /></div><h3>{query ? 'Nothing matches your search' : 'A fresh space, just for you'}</h3><p>{query ? 'Try a different word or search another category.' : 'Add your first file, note or link and it will show up here.'}</p>{!query && <button className="btn btn-subtle" onClick={() => inputRef.current?.click()}><Upload size={17} /> Upload your first file</button>}</div>
                : <div className={`items ${view === 'list' ? 'items-list' : ''}`}>{visibleItems.map(item => <ItemCard key={item.id} item={item} view={view} onOpen={openItem} onDownload={downloadItem} onDelete={deleteItem} onStar={toggleStar} onCopy={copyItem} />)}</div>}
          </section>
          <footer className="footer"><span>Made for the little things that matter.</span><span><LockKeyhole size={13} /> Private by default</span></footer>
        </main>
      </div>

      {pairModal && <LinkDeviceModal onClose={() => setPairModal(false)} />}
      {compose && <ComposerModal key={compose} kind={compose} onClose={() => !busy && setCompose(null)} onSave={saveEntry} busy={busy} />}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.type === 'error' ? <X size={17} /> : <Check size={17} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss"><X size={16} /></button></div>}
    </div>
  )
}

export default App
