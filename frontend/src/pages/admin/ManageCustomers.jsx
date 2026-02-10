import { useEffect, useState } from 'react'
import { AdminLayout, Card, Button, Badge } from '../../components/common/index.jsx'
import client from '../../api/client.js'

export default function ManageCustomers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [history, setHistory] = useState({ bookings: [], invoices: [] })

    const fetchCustomers = async () => {
        try {
            const data = await client.get('/users')
            // Filter for customers only if needed, or show all users with roles
            setCustomers(data.filter(u => u.role === 'customer'))
        } catch (err) {
            console.error('Error fetching customers:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchCustomers() }, [])

    const viewHistory = async (customer) => {
        setSelectedCustomer(customer)
        try {
            // We'll need endpoints for this or just filter all data
            // For now let's assume we can fetch them by email/id
            const [bookings, invoices] = await Promise.all([
                client.get(`/bookings`), // Note: this fetches ALL, we filter here for prototype
                client.get(`/invoices`)
            ])
            setHistory({
                bookings: bookings.filter(b => b.customer_id === customer.id || b.email === customer.email),
                invoices: invoices.filter(i => i.buyer_email === customer.email)
            })
        } catch (err) {
            console.error('Error fetching history:', err)
        }
    }

    return (
        <AdminLayout title="Kunder">
            {loading ? <div className="spinner" /> : (
                <Card>
                    <table className="admin-table">
                        <thead>
                            <tr><th>Namn</th><th>E-post</th><th>Telefon</th><th>Registrerad</th><th>Åtgärder</th></tr>
                        </thead>
                        <tbody>
                            {customers.map(c => (
                                <tr key={c.id}>
                                    <td>{c.first_name} {c.last_name}</td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <Button size="sm" variant="secondary" onClick={() => viewHistory(c)}>Visa historik</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {selectedCustomer && (
                <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
                    <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>Historik: {selectedCustomer.first_name} {selectedCustomer.last_name}</h2>
                            <button className="btn-close" onClick={() => setSelectedCustomer(null)}>×</button>
                        </div>

                        <div className="grid grid-2" style={{ gap: '2rem' }}>
                            <div>
                                <h4>Bokningar ({history.bookings.length})</h4>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {history.bookings.map(b => (
                                        <div key={b.id} style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 0' }}>
                                            <strong>{b.course_name}</strong><br />
                                            <small>{b.booking_date} — <Badge size="xs" variant={b.status === 'confirmed' ? 'success' : 'warning'}>{b.status}</Badge></small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4>Fakturor ({history.invoices.length})</h4>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {history.invoices.map(i => (
                                        <div key={i.id} style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 0' }}>
                                            <strong>{i.invoice_number}</strong> ({parseFloat(i.total_amount).toLocaleString()} kr)<br />
                                            <small>{i.invoice_date} — <Badge size="xs" variant={i.status === 'paid' ? 'success' : 'warning'}>{i.status}</Badge></small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
