import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { Button, Input, Alert } from '../../components/common/index.jsx'

export default function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const { login, loading, error } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await login(username, password)
            navigate('/konto')
        } catch { /* error i store */ }
    }

    return (
        <div className="page container">
            <div className="login-card" style={{ maxWidth: '400px', margin: '4rem auto' }}>
                <h1 className="login-title">Logga in</h1>
                <p className="login-sub">Hantera dina bokningar och ladda ner fakturor.</p>

                {error && <Alert type="error">{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <Input label="Användarnamn" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
                    <Input label="Lösenord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="submit" loading={loading} className="btn-full" style={{ marginTop: '1.5rem' }}>
                        Logga in
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
                    Saknar du konto? <Link to="/registrera" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Skapa ett konto här</Link>
                </div>
            </div>
        </div>
    )
}
