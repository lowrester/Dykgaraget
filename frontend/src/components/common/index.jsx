import { useEffect } from 'react'

// ── Button ─────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', loading = false, disabled, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <><span className="spinner-sm" /> Laddar...</> : children}
    </button>
  )
}

// ── Card ───────────────────────────────────────────────────────
export function Card({ children, className = '', ...props }) {
  return <div className={`card ${className}`} {...props}>{children}</div>
}

// ── Modal ──────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      const handler = (e) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', handler)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handler)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ── Input ──────────────────────────────────────────────────────
export function Input({ label, error, required, id, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}{required && <span className="required">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input ${error ? 'input-error' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        {...props}
      />
      {error && <span id={`${inputId}-error`} className="error-msg" role="alert">{error}</span>}
    </div>
  )
}

// ── Textarea ───────────────────────────────────────────────────
export function Textarea({ label, error, required, id, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}{required && <span className="required">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        className={`form-input form-textarea ${error ? 'input-error' : ''}`}
        aria-invalid={!!error}
        required={required}
        {...props}
      />
      {error && <span className="error-msg" role="alert">{error}</span>}
    </div>
  )
}

// ── Select ─────────────────────────────────────────────────────
export function Select({ label, error, required, id, children, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}{required && <span className="required">*</span>}
        </label>
      )}
      <select id={inputId} className={`form-input form-select ${error ? 'input-error' : ''}`} required={required} {...props}>
        {children}
      </select>
      {error && <span className="error-msg" role="alert">{error}</span>}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────
export function Spinner({ text = 'Laddar...' }) {
  return (
    <div className="spinner-wrapper">
      <div className="spinner" />
      {text && <p>{text}</p>}
    </div>
  )
}

// ── Alert ──────────────────────────────────────────────────────
export function Alert({ type = 'info', children, onClose }) {
  return (
    <div className={`alert alert-${type}`} role="alert">
      <span>{children}</span>
      {onClose && <button className="alert-close" onClick={onClose}>✕</button>}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────
export function Badge({ children, variant = 'default' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

// ── Level badge helper ─────────────────────────────────────────
export function LevelBadge({ level }) {
  const map = {
    'Nybörjare':    'primary',
    'Fortsättning': 'warning',
    'Avancerad':    'purple',
    'Professionell':'danger',
  }
  return <Badge variant={map[level] || 'default'}>{level}</Badge>
}

// ── Admin layout wrapper ───────────────────────────────────────
export function AdminLayout({ title, children }) {
  const logout   = () => { useAuthStore?.getState?.()?.logout(); window.location.href = '/admin/login' }
  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">🤿 Dykgaraget</div>
        <nav className="sidebar-nav">
          <a href="/admin"                className="sidebar-link">📊 Dashboard</a>
          <a href="/admin/kurser"         className="sidebar-link">📚 Kurser</a>
          <a href="/admin/bokningar"      className="sidebar-link">📅 Bokningar</a>
          <a href="/admin/instruktorer"   className="sidebar-link">👥 Instruktörer</a>
          <a href="/admin/utrustning"     className="sidebar-link">🤿 Utrustning</a>
          <a href="/admin/fakturor"       className="sidebar-link">🧾 Fakturor</a>
          <a href="/admin/installningar"  className="sidebar-link">⚙️ Inställningar</a>
        </nav>
        <button className="sidebar-logout" onClick={() => { window.location.href = '/admin/login' }}>Logga ut</button>
      </aside>
      <main className="admin-main">
        <div className="admin-header">
          <h1>{title}</h1>
        </div>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}
