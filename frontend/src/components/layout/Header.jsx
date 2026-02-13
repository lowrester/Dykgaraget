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
  const toggleOpen = (val) => {
    setOpen(val)
    if (val) document.body.classList.add('menu-open')
    else document.body.classList.remove('menu-open')
  }

  const AuthActions = ({ mobile = false }) => {
    if (user) {
      return (
        <>
          {user.role === 'admin' ? (
            <Link to="/admin" className={`btn btn-secondary ${mobile ? '' : 'btn-sm'}`} onClick={() => toggleOpen(false)}>Admin</Link>
          ) : (
            <Link to="/konto" className={`btn btn-secondary ${mobile ? '' : 'btn-sm'}`} onClick={() => toggleOpen(false)}>Mina sidor</Link>
          )}
          <button onClick={handleLogout} className={`btn btn-ghost ${mobile ? '' : 'btn-sm'}`}>Logga ut</button>
        </>
      )
    }
    return (
      <>
        <Link to="/loggain" className={`btn btn-ghost ${mobile ? '' : 'btn-sm'}`} onClick={() => toggleOpen(false)}>Logga in</Link>
        <Link to="/bokning" className={`btn btn-primary ${mobile ? '' : 'btn-sm'}`} onClick={() => toggleOpen(false)}>Boka kurs</Link>
      </>
    )
  }

  return (
    <header className="header">
      <div className="container header-inner">

        {/* Overlay for mobile menu */}
        <div className={`header-overlay${open ? ' open' : ''}`} onClick={() => toggleOpen(false)} />

        {/* Logo med riktig bild */}
        <Link to="/" className="logo" onClick={() => toggleOpen(false)}>
          <img src="/logo.png" alt="Dykgaraget" className="logo-img" />
          <span className="logo-name">
            Dykgaraget
            <span className="logo-padi">Daniel · PADI 546513</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className={`nav${open ? ' open' : ''}`}>
          <NavLink to="/" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => toggleOpen(false)}>Hem</NavLink>
          <NavLink to="/certifieringar" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => toggleOpen(false)}>Certifieringar</NavLink>
          <NavLink to="/instruktorer" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => toggleOpen(false)}>Instruktörer</NavLink>
          {features.equipment && (
            <NavLink to="/utrustning" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => toggleOpen(false)}>Utrustning</NavLink>
          )}
          <NavLink to="/kontakt" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={() => toggleOpen(false)}>Kontakt</NavLink>

          {/* Mobile only actions at the bottom of the drawer */}
          <div className="mobile-only-actions">
            <AuthActions mobile />
          </div>
        </nav>

        {/* Actions */}
        <div className="header-actions">
          <div className="desktop-only-actions">
            <AuthActions />
          </div>

          {/* Hamburger */}
          <button className="nav-toggle" onClick={() => toggleOpen(!open)} aria-label="Meny">
            <span style={open ? { transform: 'rotate(45deg) translate(2px, -2px)' } : {}} />
            <span style={open ? { opacity: 0 } : {}} />
            <span style={open ? { transform: 'rotate(-45deg) translate(2px, 2px)' } : {}} />
          </button>
        </div>

      </div>
    </header>
  )
}
