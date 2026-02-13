import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { Button, Input, Alert } from '../../components/common/index.jsx'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, loading, error } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/admin')
    } catch { /* error från store */ }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Dykgaraget" />
        </div>
        <h1 className="login-title">Admin</h1>
        <p className="login-sub">Logga in för att hantera bokningar och kurser</p>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Input
            label="Användarnamn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required autoFocus
          />
          <Input
            label="Lösenord"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="btn-full" style={{ marginTop: '1.25rem' }}>
            Logga in
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <a href="/" style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>← Tillbaka till webbplatsen</a>
        </div>

        <details style={{ marginTop: '1.25rem', borderTop: '1px solid var(--gray-100)', paddingTop: '1rem' }}>
          <summary style={{ fontSize: '0.78rem', color: 'var(--gray-400)', cursor: 'pointer', userSelect: 'none' }}>
            Glömt lösenordet?
          </summary>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
            <strong>Återställ via terminalen:</strong><br />
            <code style={{ display: 'block', marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--gray-100)', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              cd /var/www/dykgaraget/backend<br />
              ADMIN_PASSWORD=NyttLösenord node src/db/reset-password.js
            </code>
          </div>
        </details>
      </div>
    </div>
  )
}
