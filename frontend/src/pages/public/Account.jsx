import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import client from '../../api/client.js'
import { Button, Card, Badge, Alert } from '../../components/common/index.jsx'

export default function Account() {
    const { user, logout, exportData, deleteAccount } = useAuthStore()
    const navigate = useNavigate()
    const [bookings, setBookings] = useState([])
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) {
            navigate('/loggain')
            return
        }

        const fetchData = async () => {
            try {
                const [bRes, iRes] = await Promise.all([
                    client.get('/bookings/me'),
                    client.get('/invoices/me')
                ])
                setBookings(bRes)
                setInvoices(iRes)
            } catch (err) {
                console.error('Error fetching account data:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [user, navigate])

    const handleDelete = async () => {
        if (window.confirm('Är du helt säker? Detta raderar ditt konto och all din personliga historik i enlighet med GDPR. Detta går inte att ångra.')) {
            await deleteAccount()
            navigate('/')
        }
    }

    if (!user) return null

    return (
        <div className="page container account-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Mina sidor</h1>
                <Button variant="secondary" onClick={() => { logout(); navigate('/') }}>Logga ut</Button>
            </div>

            <div className="grid grid-3-1" style={{ gap: '2rem' }}>
                <div className="account-main">
                    <section style={{ marginBottom: '3rem' }}>
                        <h3>Mina bokningar</h3>
                        {loading ? <div className="spinner" /> : bookings.length === 0 ? <p className="empty">Du har inga bokningar ännu.</p> : (
                            <div className="bookings-list">
                                {bookings.map(b => (
                                    <Card key={b.id} style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div>
                                                <h4 style={{ margin: 0 }}>{b.course_name}</h4>
                                                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                                                    📅 {b.booking_date} kl. {b.booking_time}
                                                </p>
                                            </div>
                                            <Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}>
                                                {b.status}
                                            </Badge>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <h3>Mina fakturor</h3>
                        {loading ? <div className="spinner" /> : invoices.length === 0 ? <p className="empty">Du har inga fakturor ännu.</p> : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Nr</th><th>Datum</th><th>Belopp</th><th>Status</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id}>
                                            <td>{inv.invoice_number}</td>
                                            <td>{inv.invoice_date}</td>
                                            <td>{parseFloat(inv.total_amount).toLocaleString('sv-SE')} kr</td>
                                            <td><Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge></td>
                                            <td>
                                                <button className="btn btn-sm btn-secondary" onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}>⬇ PDF</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                </div>

                <aside className="account-sidebar">
                    <Card>
                        <h4>Din profil</h4>
                        <div style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            <p><strong>Namn:</strong> {user.firstName} {user.lastName}</p>
                            <p><strong>E-post:</strong> {user.email}</p>
                            <p><strong>Roll:</strong> {user.role === 'admin' ? 'Administratör' : 'Kund'}</p>
                        </div>

                        <hr style={{ margin: '1.5rem 0', opacity: 0.1 }} />

                        <h4>Inställningar & GDPR</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                            Här kan du hantera din data i enlighet med dataskyddsförordningen (GDPR).
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <Button variant="secondary" size="sm" onClick={exportData} title="Ladda ner all din data som en JSON-fil">
                                💾 Exportera min data
                            </Button>
                            <Button variant="danger" size="sm" onClick={handleDelete} title="Ta bort ditt konto och all din data permanent">
                                🗑 Radera mitt konto
                            </Button>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    )
}
