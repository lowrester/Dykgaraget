import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { Button, Input, Alert } from '../components/common/index.jsx'

export default function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        gdprConsent: false
    })
    const { register, loading, error } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.gdprConsent) return alert('Du måste godkänna integritetspolicyn.')
        try {
            await register(formData)
            navigate('/konto')
        } catch { /* error i store */ }
    }

    return (
        <div className="page container">
            <div className="login-card" style={{ maxWidth: '500px', margin: '2rem auto' }}>
                <h1 className="login-title">Skapa konto</h1>
                <p className="login-sub">Gör dina framtida bokningar enklare genom att registrera dig.</p>

                {error && <Alert type="error">{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-2">
                        <Input label="Förnamn" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} required />
                        <Input label="Efternamn" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} required />
                    </div>
                    <Input label="Användarnamn" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                    <Input label="E-post" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                    <Input label="Lösenord" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={8} placeholder="Minst 8 tecken" />

                    <div style={{ marginTop: '1rem' }}>
                        <label className="checkbox-container" style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={formData.gdprConsent} onChange={e => setFormData({ ...formData, gdprConsent: e.target.checked })} required />
                            <span>Jag godkänner att Dykgaraget sparar mina personuppgifter enligt <Link to="/integritetspolicy" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>integritetspolicyn</Link>.</span>
                        </label>
                    </div>

                    <Button type="submit" loading={loading} className="btn-full" style={{ marginTop: '1.5rem' }}>
                        Registrera dig
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
                    Har du redan ett konto? <Link to="/loggain" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Logga in här</Link>
                </div>
            </div>
        </div>
    )
}
