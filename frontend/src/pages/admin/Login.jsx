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
    } catch { /* error shown from store */ }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤿 Dykgaraget</div>
        <h1 className="login-title">Admin</h1>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Input
            label="Användarnamn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Lösenord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="btn-full" style={{marginTop:'1rem'}}>
            Logga in
          </Button>
        </form>
      </div>
    </div>
  )
}
