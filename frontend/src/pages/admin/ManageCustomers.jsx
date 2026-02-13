import { useEffect, useState } from 'react'
import { useUsersStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Badge } from '../../components/common/index.jsx'
import client from '../../api/client.js'

const EMPTY = { username: '', email: '', password: '', first_name: '', last_name: '', phone: '', address: '', postal_code: '', city: '', role: 'customer' }

export default function ManageCustomers() {
    const { users, fetch, create, update, remove, loading } = useUsersStore()
    const { addToast, ask } = useUIStore()

    const [modal, setModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)

    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [history, setHistory] = useState({ bookings: [], invoices: [] })

    useEffect(() => { fetch() }, [fetch])

    const customers = users.filter(u => u.role === 'customer')

    const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
    const openEdit = (u) => {
        setEditing(u)
        setForm({
            username: u.username,
            email: u.email,
            password: '',
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            phone: u.phone || '',
            address: u.address || '',
            postal_code: u.postal_code || '',
            city: u.city || '',
            role: 'customer'
        })
        setModal(true)
    }
    const close = () => { setModal(false); setEditing(null) }
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

    const handleSave = async () => {
        // Auto-generate username from email if empty
        const finalForm = { ...form }
        if (!finalForm.username.trim()) finalForm.username = finalForm.email.split('@')[0] + Math.floor(Math.random() * 1000)

        if (!finalForm.email.trim()) {
            addToast('E-post krävs', 'error')
            return
        }

        setSaving(true)
        try {
            if (editing) await update(editing.id, finalForm)
            else {
                // For new customers, use email as fallback password if not provided
                if (!finalForm.password) finalForm.password = Math.random().toString(36).slice(-8)
                await create(finalForm)
            }
            addToast(editing ? 'Kund uppdaterad!' : 'Kund skapad!')
            close()
        } catch (err) {
            addToast(err.response?.data?.error || err.message, 'error')
        } finally { setSaving(false) }
    }

    const handleDelete = async (u) => {
        const ok = await ask({
            title: 'Ta bort kund?',
            message: `Är du säker på att du vill ta bort "${u.first_name} ${u.last_name}"? All historik kommer fortfarande finnas i boknings-/fakturasystemet men kopplingen till detta konto bryts.`,
            type: 'danger',
            confirmText: 'Ta bort'
        })
        if (!ok) return
        try {
            await remove(u.id)
            addToast('Kund borttagen')
        } catch (err) {
            addToast(err.message, 'error')
        }
    }

    const viewHistory = async (customer) => {
        setSelectedCustomer(customer)
        try {
            const [bookings, invoices] = await Promise.all([
                client.get(`/bookings`),
                client.get(`/invoices`)
            ])
            setHistory({
                bookings: bookings.filter(b => b.customer_id === customer.id || b.email === customer.email),
                invoices: invoices.filter(i => i.buyer_email === customer.email)
            })
        } catch (err) { console.error('History error:', err) }
    }

    return (
        <AdminLayout title="Kunder">
            <div className="page-actions"><Button onClick={openNew}>+ Ny kund</Button></div>

            {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
                <Card>
                    <table className="admin-table">
                        <thead>
                            <tr><th>Namn</th><th>E-post</th><th>Telefon</th><th>Registrerad</th><th>Åtgärder</th></tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 && <tr><td colSpan={5} className="empty">Inga kunder ännu</td></tr>}
                            {customers.map(c => (
                                <tr key={c.id}>
                                    <td><strong>{c.first_name} {c.last_name}</strong></td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <button className="btn btn-sm btn-ghost" onClick={() => viewHistory(c)} title="Historik">👁️</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(c)} title="Redigera">✎</button>
                                        <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(c)} title="Ta bort">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={modal} onClose={close} title={editing ? 'Redigera kund' : 'Ny kund'} size="lg">
                <div className="grid grid-2">
                    <Input label="Förnamn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
                    <Input label="Efternamn" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
                    <Input label="E-post" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
                    <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                    <Input label="Adress" value={form.address} onChange={(e) => set('address', e.target.value)} className="grid-full" />
                    <Input label="Postnummer" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} />
                    <Input label="Postort" value={form.city} onChange={(e) => set('city', e.target.value)} />
                    {!editing && <Input label="Användarnamn (lämna tomt för automatisk)" value={form.username} onChange={(e) => set('username', e.target.value)} />}
                    {!editing && <Input label="Lösenord (valfritt)" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />}
                </div>
                <div className="modal-footer">
                    <Button variant="secondary" onClick={close}>Avbryt</Button>
                    <Button onClick={handleSave} loading={saving}>Spara</Button>
                </div>
            </Modal>

            {selectedCustomer && (
                <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={`Historik: ${selectedCustomer.first_name} ${selectedCustomer.last_name}`} size="lg">
                    <div className="grid grid-2" style={{ gap: '2rem' }}>
                        <div>
                            <h4>Bokningar ({history.bookings.length})</h4>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {history.bookings.length === 0 && <p className="empty">Inga bokningar</p>}
                                {history.bookings.map(b => (
                                    <div key={b.id} style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 0' }}>
                                        <strong>{b.course_name || 'Okänd kurs'}</strong><br />
                                        <small>{b.booking_date} — <Badge size="xs" variant={b.status === 'confirmed' ? 'success' : 'warning'}>{b.status}</Badge></small>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4>Fakturor ({history.invoices.length})</h4>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {history.invoices.length === 0 && <p className="empty">Inga fakturor</p>}
                                {history.invoices.map(i => (
                                    <div key={i.id} style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.75rem 0' }}>
                                        <strong>{i.invoice_number}</strong> ({parseFloat(i.total_amount).toLocaleString()} kr)<br />
                                        <small>{i.invoice_date} — <Badge size="xs" variant={i.status === 'paid' ? 'success' : 'warning'}>{i.status}</Badge></small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </AdminLayout>
    )
}
