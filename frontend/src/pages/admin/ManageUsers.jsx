import { useState, useEffect } from 'react'
import { useUsersStore, useUIStore, useAuthStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Select, Badge } from '../../components/common/index.jsx'

const EMPTY = { username: '', email: '', password: '', first_name: '', last_name: '', role: 'customer' }

export default function ManageUsers() {
    const { users, fetch, create, update, remove, loading } = useUsersStore()
    const { addToast, ask } = useUIStore()
    const currentUser = useAuthStore(s => s.user)

    const [modal, setModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetch() }, [fetch])

    const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
    const openEdit = (u) => {
        setEditing(u)
        setForm({
            username: u.username,
            email: u.email,
            password: '',
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            role: u.role
        })
        setModal(true)
    }
    const close = () => { setModal(false); setEditing(null) }
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

    const handleSave = async () => {
        if (!form.username.trim() || !form.email.trim()) {
            addToast('Användarnamn och e-post krävs', 'error')
            return
        }
        if (!editing && !form.password) {
            addToast('Lösenord krävs för nya användare', 'error')
            return
        }

        setSaving(true)
        try {
            if (editing) await update(editing.id, form)
            else await create(form)
            addToast(editing ? 'Användare uppdaterad!' : 'Användare skapad!')
            close()
        } catch (err) {
            addToast(err.response?.data?.error || err.message, 'error')
        } finally { setSaving(false) }
    }

    const handleDelete = async (u) => {
        if (u.id === currentUser.id) {
            addToast('Du kan inte ta bort dig själv!', 'error')
            return
        }
        const ok = await ask({
            title: 'Ta bort användare?',
            message: `Är du säker på att du vill ta bort "${u.username}"?`,
            type: 'danger',
            confirmText: 'Ta bort'
        })
        if (!ok) return
        try {
            await remove(u.id)
            addToast('Användare borttagen')
        } catch (err) {
            addToast(err.message, 'error')
        }
    }

    return (
        <AdminLayout title="Användare">
            <div className="page-actions"><Button onClick={openNew}>+ Ny användare</Button></div>

            {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
                <Card>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Användarnamn</th>
                                <th>E-post</th>
                                <th>Namn</th>
                                <th>Roll</th>
                                <th>Status</th>
                                <th>Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 && <tr><td colSpan={6} className="empty">Inga användare ännu</td></tr>}
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td><strong>{u.username}</strong> {u.id === currentUser.id && <Badge variant="info">Du</Badge>}</td>
                                    <td>{u.email}</td>
                                    <td>{u.first_name} {u.last_name}</td>
                                    <td><Badge variant={u.role === 'admin' ? 'success' : 'default'}>{u.role}</Badge></td>
                                    <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                                    <td>
                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Redigera</button>
                                        {u.id !== currentUser.id && (
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)} style={{ marginLeft: '0.5rem' }}>Ta bort</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={modal} onClose={close} title={editing ? 'Redigera användare' : 'Ny användare'} size="lg">
                <div className="grid grid-2">
                    <Input label="Användarnamn" value={form.username} onChange={(e) => set('username', e.target.value)} required />
                    <Input label="E-post" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
                    <Input label={editing ? 'Lösenord (lämna tomt för att behålla)' : 'Lösenord'} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!editing} />
                    <Select label="Roll" value={form.role} onChange={(e) => set('role', e.target.value)}>
                        <option value="customer">Kund</option>
                        <option value="admin">Administratör</option>
                    </Select>
                    <Input label="Förnamn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
                    <Input label="Efternamn" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
                </div>
                <div className="modal-footer">
                    <Button variant="secondary" onClick={close}>Avbryt</Button>
                    <Button onClick={handleSave} loading={saving}>Spara</Button>
                </div>
            </Modal>
        </AdminLayout>
    )
}
