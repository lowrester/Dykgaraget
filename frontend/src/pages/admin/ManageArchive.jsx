import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useEquipmentStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Button, Badge, Spinner } from '../../components/common/index.jsx'

export default function ManageArchive() {
    const { archived, fetchArchived, bulkRestore, remove, loading } = useEquipmentStore()
    const { addToast, ask } = useUIStore()
    const [selected, setSelected] = useState([])
    const [working, setWorking] = useState(false)

    useEffect(() => {
        fetchArchived()
    }, [fetchArchived])

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleSelectAll = () => {
        if (selected.length === archived.length) setSelected([])
        else setSelected(archived.map(a => a.id))
    }

    const handleBulkRestore = async () => {
        const ok = await ask({
            title: 'Återställ artiklar?',
            message: `Vill du återställa ${selected.length} markerade artiklar till den aktiva listan?`,
            type: 'info',
            confirmText: 'Återställ alla'
        })
        if (!ok) return

        setWorking(true)
        try {
            await bulkRestore(selected)
            addToast(`${selected.length} artiklar återställda`)
            setSelected([])
        } catch (err) {
            addToast(err.message, 'error')
        } finally { setWorking(false) }
    }

    const handleBulkDelete = async () => {
        const ok = await ask({
            title: 'Ta bort permanent?',
            message: `Är du säker på att du vill ta bort ${selected.length} markerade artiklar permanent? Detta går inte att ångra och all historik försvinner.`,
            type: 'danger',
            confirmText: 'Ta bort permanent'
        })
        if (!ok) return

        setWorking(true)
        try {
            for (const id of selected) {
                await remove(id)
            }
            addToast(`${selected.length} artiklar borttagna permanent`)
            setSelected([])
        } catch (err) {
            addToast(err.message, 'error')
        } finally { setWorking(false) }
    }

    return (
        <AdminLayout title="Arkiverade artiklar">
            <div className="page-actions">
                <Link to="/admin/utrustning" className="btn btn-ghost">← Tillbaka till artiklar</Link>
            </div>

            {selected.length > 0 && (
                <div style={{ background: 'var(--gray-800)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideDown 0.2s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 600 }}>{selected.length} arkiverade artiklar markerade</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button size="sm" variant="secondary" onClick={handleBulkRestore} loading={working}>Återställ markerade</Button>
                        <Button size="sm" variant="danger" onClick={handleBulkDelete} loading={working}>Ta bort permanent</Button>
                    </div>
                </div>
            )}

            {loading ? <Spinner /> : (
                <Card>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input type="checkbox" checked={selected.length === archived.length && archived.length > 0} onChange={toggleSelectAll} />
                                </th>
                                <th>Namn</th><th>Kategori</th><th>Arkiverad datum</th><th>Storlek</th><th>Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archived.length === 0 && <tr><td colSpan={6} className="empty">Inga arkiverade artiklar hittades</td></tr>}
                            {archived.map((e) => (
                                <tr key={e.id} className={selected.includes(e.id) ? 'selected-row' : ''}>
                                    <td>
                                        <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggleSelect(e.id)} />
                                    </td>
                                    <td><strong>{e.name}</strong></td>
                                    <td>{e.category}</td>
                                    <td>{new Date(e.archived_at).toLocaleDateString()}</td>
                                    <td>{e.size}</td>
                                    <td>
                                        <button className="btn btn-sm btn-ghost" onClick={async () => {
                                            const ok = await ask({ title: 'Återställ?', message: `Återställ "${e.name}"?` })
                                            if (ok) bulkRestore([e.id])
                                        }}>Återställ</button>
                                        <button className="btn btn-sm btn-ghost text-danger" onClick={async () => {
                                            const ok = await ask({ title: 'Ta bort?', message: `Ta bort "${e.name}" permanent?`, type: 'danger' })
                                            if (ok) remove(e.id)
                                        }}>Ta bort</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </AdminLayout>
    )
}
