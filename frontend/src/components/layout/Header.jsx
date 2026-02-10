import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from '../../store/index.js'

export default function Header() {
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)
  const features = useSettingsStore((s) => s.features)
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">🤿 Dykgaraget</Link>

        <nav className="nav">
          <NavLink to="/"               className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>Hem</NavLink>
          <NavLink to="/certifieringar" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>Certifieringar</NavLink>
          <NavLink to="/instruktorer"   className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>Instruktörer</NavLink>
          {features.equipment && (
            <NavLink to="/utrustning" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>Utrustning</NavLink>
          )}
          <NavLink to="/kontakt" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>Kontakt</NavLink>
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <Link to="/admin" className="btn btn-sm btn-secondary">Admin</Link>
              <button onClick={handleLogout} className="btn btn-sm btn-ghost">Logga ut</button>
            </>
          ) : (
            <Link to="/bokning" className="btn btn-primary">Boka nu</Link>
          )}
        </div>
      </div>
    </header>
  )
}
