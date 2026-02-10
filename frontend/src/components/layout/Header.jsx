import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from '../../store/index.js'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const features = useSettingsStore((s) => s.features)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <header className="header">
      <div className="container header-inner">

        {/* Logo med riktig bild */}
        <Link to="/" className="logo" onClick={() => setOpen(false)}>
          <img src="/logo.png" alt="Dykgaraget" className="logo-img" />
          <span className="logo-name">
            Dykgaraget
            <span className="logo-padi">Daniel · PADI 546513</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className={`nav${open ? ' open' : ''}`}>
          <NavLink to="/" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>Hem</NavLink>
          <NavLink to="/certifieringar" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>Certifieringar</NavLink>
          <NavLink to="/instruktorer" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>Instruktörer</NavLink>
          {features.equipment && (
            <NavLink to="/utrustning" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>Utrustning</NavLink>
          )}
          <NavLink to="/kontakt" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>Kontakt</NavLink>
        </nav>

        {/* Actions */}
        <div className="header-actions">
          {user ? (
            <>
              {user.role === 'admin' ? (
                <Link to="/admin" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Admin</Link>
              ) : (
                <Link to="/konto" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Mina sidor</Link>
              )}
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logga ut</button>
            </>
          ) : (
            <>
              <Link to="/loggain" className="btn btn-ghost btn-sm" style={{ marginRight: '0.5rem' }}>Logga in</Link>
              <Link to="/bokning" className="btn btn-primary btn-sm">Boka nu</Link>
            </>
          )}

          {/* Hamburger */}
          <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Meny">
            <span style={open ? { transform: 'rotate(45deg) translate(4px,4px)' } : {}} />
            <span style={open ? { opacity: 0 } : {}} />
            <span style={open ? { transform: 'rotate(-45deg) translate(4px,-4px)' } : {}} />
          </button>
        </div>

      </div>
    </header>
  )
}
