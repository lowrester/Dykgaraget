import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore, useUIStore } from '../../store/index.js'

// ── Button ──────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', loading = false, disabled, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : children}
    </button>
  )
}

// ── Card ────────────────────────────────────────────────────
export function Card({ children, className = '', ...props }) {
  return <div className={`card ${className}`} {...props}>{children}</div>
}

// ── Modal ───────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box${size === 'lg' ? ' modal-lg' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ── Input ───────────────────────────────────────────────────
export function Input({ label, error, required, id, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={inputId}>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}</label>}
      <input id={inputId} className={`form-input${error ? ' error' : ''} ${className}`} {...props} />
      {error && <span className="error-msg">{error}</span>}
    </div>
  )
}

// ── Textarea ────────────────────────────────────────────────
export function Textarea({ label, error, required, id, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={inputId}>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}</label>}
      <textarea id={inputId} className={`form-input form-textarea${error ? ' error' : ''} ${className}`} {...props} />
      {error && <span className="error-msg">{error}</span>}
    </div>
  )
}

// ── Select ──────────────────────────────────────────────────
export function Select({ label, error, required, id, children, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={inputId}>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}</label>}
      <select id={inputId} className={`form-input form-select ${className}`} {...props}>{children}</select>
      {error && <span className="error-msg">{error}</span>}
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────
export function Spinner({ text = '' }) {
  return (
    <div className="spinner-wrapper">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" />
        {text && <p className="spinner-text">{text}</p>}
      </div>
    </div>
  )
}

// ── Alert ───────────────────────────────────────────────────
export function Alert({ type = 'info', children, onClose }) {
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }
  return (
    <div className={`alert alert-${type}`} role="alert">
      <span>{icons[type]}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && <button className="alert-close" onClick={onClose} aria-label="Stäng">✕</button>}
    </div>
  )
}

// ── Badge ───────────────────────────────────────────────────
export function Badge({ children, variant = 'default' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

// ── LevelBadge ──────────────────────────────────────────────
export function LevelBadge({ level }) {
  const cls = level?.toLowerCase().replace('ä', 'a').replace('ö', 'o').replace('å', 'a') || 'default'
  return <span className={`badge-level level-${cls}`}>{level || '—'}</span>
}

// ── AdminLayout ─────────────────────────────────────────────
export function AdminLayout({ title, children }) {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const features = useSettingsStore((s) => s.features)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  const navItems = [
    { to: '/admin', icon: '📊', label: 'Dashboard' },
    { to: '/admin/kurser', icon: '📚', label: 'Kurser' },
    { to: '/admin/bokningar', icon: '📅', label: 'Bokningar' },
    { to: '/admin/instruktorer', icon: '👥', label: 'Instruktörer' },
    { to: '/admin/innehall', icon: '✍️', label: 'Hantera innehåll' },
    ...(features.equipment ? [{ to: '/admin/utrustning', icon: '🤿', label: 'Utrustning' }] : []),
    ...(features.invoicing ? [{ to: '/admin/fakturor', icon: '🧾', label: 'Fakturor' }] : []),
    { to: '/admin/installningar', icon: '⚙️', label: 'Inställningar', separator: true },
    { to: '/admin/kunder', icon: '👥', label: 'Kunder' },
    { to: '/admin/anvandare', icon: '👥', label: 'Användare' },
  ]

  const SidebarContent = () => (
    <>
      <div className="admin-sidebar-logo">
        <Link to="/" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" alt="Dykgaraget" />
          <span>Dykgaraget</span>
        </Link>
      </div>
      <nav className="admin-nav-group">
        <div className="admin-nav-label">Meny</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
            style={item.separator ? { marginTop: '0.5rem', borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' } : {}}
            onClick={() => setMobileOpen(false)}
          >
            <span className="admin-nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '1rem', borderTop: '1px solid var(--gray-200)', marginTop: 'auto' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: '0.5rem' }}>{user?.username}</div>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm btn-full" style={{ justifyContent: 'flex-start' }}>Logga ut</button>
      </div>
    </>
  )

  return (
    <div className="admin-wrapper">
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`admin-sidebar admin-sidebar-mobile ${mobileOpen ? 'open' : ''}`}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="admin-main">
        <div className="admin-topbar">
          {/* Hamburger — mobil */}
          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Öppna meny"
          >
            <span /><span /><span />
          </button>
          <h1>{title}</h1>
          <div className="admin-topbar-actions">
            <Link to="/" className="btn btn-ghost btn-sm">← Webbplats</Link>
          </div>
        </div>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}

// ── Confirm Modal ───────────────────────────────────────────
export function ConfirmModal() {
  const confirm = useUIStore((s) => s.confirm)
  if (!confirm) return null

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>{confirm.title || 'Är du säker?'}</h2>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>{confirm.message}</p>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={confirm.onCancel}>Avbryt</Button>
          <Button variant={confirm.type === 'danger' ? 'danger' : 'primary'} onClick={confirm.onConfirm}>
            {confirm.confirmText || 'Fortsätt'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Toasts ──────────────────────────────────────────────────
export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const remove = useUIStore((s) => s.removeToast)

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
          <span className="toast-icon">{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
