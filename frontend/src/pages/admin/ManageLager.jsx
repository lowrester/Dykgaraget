import { useState, useEffect } from 'react'
import { useInventoryStore, useEquipmentStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Select, Badge, Textarea } from '../../components/common/index.jsx'

export default function ManageLager() {
    const {
        suppliers, purchaseOrders, fetchSuppliers, fetchPO, createSupplier, createPO, receivePO, loading
    } = useInventoryStore()
    const { equipment, fetch: fetchEquipment } = useEquipmentStore()
    const { addToast } = useUIStore()

    const [activeTab, setActiveTab] = useState('inventory') // inventory, po, suppliers
    const [modal, setModal] = useState(null) // po, supplier, receive
    const [form, setForm] = useState({})
    const [working, setWorking] = useState(false)

    useEffect(() => {
        fetchSuppliers()
        fetchPO()
        fetchEquipment()
    }, [fetchSuppliers, fetchPO, fetchEquipment])

    const handleCreateSupplier = async (e) => {
        e.preventDefault()
        setWorking(true)
        try {
            await createSupplier(form)
            addToast('Leverantör tillagd!')
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    const handleCreatePO = async (e) => {
        e.preventDefault()
        setWorking(true)
        try {
            // Basic validation for items could be added here
            await createPO(form)
            addToast('Inköpsorder skapad!')
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    const handleReceivePO = async (po) => {
        setWorking(true)
        try {
            const receiveItems = po.items.map(item => ({
                item_id: item.id,
                quantity_received: item.quantity_ordered // Default to full delivery
            }))
            await receivePO(po.id, receiveItems)
            addToast('Inleverans genomförd!')
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    return (
        <AdminLayout title="Lager & Inköp">
            <div className="tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--gray-200)' }}>
                <button
                    className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                    style={{ padding: '0.75rem 1rem', border: 'none', background: 'none', fontWeight: activeTab === 'inventory' ? 700 : 400, borderBottom: activeTab === 'inventory' ? '2px solid var(--primary)' : 'none', cursor: 'pointer' }}
                >
                    Lagersaldo
                </button>
                <button
                    className={`tab-btn ${activeTab === 'po' ? 'active' : ''}`}
                    onClick={() => setActiveTab('po')}
                    style={{ padding: '0.75rem 1rem', border: 'none', background: 'none', fontWeight: activeTab === 'po' ? 700 : 400, borderBottom: activeTab === 'po' ? '2px solid var(--primary)' : 'none', cursor: 'pointer' }}
                >
                    Inköpsorder
                </button>
                <button
                    className={`tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suppliers')}
                    style={{ padding: '0.75rem 1rem', border: 'none', background: 'none', fontWeight: activeTab === 'suppliers' ? 700 : 400, borderBottom: activeTab === 'suppliers' ? '2px solid var(--primary)' : 'none', cursor: 'pointer' }}
                >
                    Leverantörer
                </button>
            </div>

            {activeTab === 'inventory' && (
                <Card>
                    <table className="admin-table">
                        <thead>
                            <tr><th>Artikel</th><th>Kategori</th><th>Lagersaldo</th><th>Värde</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {equipment.map(e => (
                                <tr key={e.id}>
                                    <td><strong>{e.name}</strong> <small style={{ color: '#666' }}>{e.size}</small></td>
                                    <td>{e.category}</td>
                                    <td>{e.quantity_available} / {e.quantity_total}</td>
                                    <td>{(e.quantity_total * e.rental_price).toLocaleString('sv-SE')} kr</td>
                                    <td>
                                        {e.quantity_available < 3 ? <Badge variant="warning">Lågt saldo</Badge> : <Badge variant="success">Okej</Badge>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {activeTab === 'po' && (
                <>
                    <div className="page-actions" style={{ marginBottom: '1rem' }}>
                        <Button onClick={() => { setForm({ supplier_id: '', items: [], notes: '' }); setModal('po') }}>+ Ny PO</Button>
                    </div>
                    <Card>
                        <table className="admin-table">
                            <thead>
                                <tr><th>Nr</th><th>Leverantör</th><th>Datum</th><th>Status</th><th>Belopp</th><th>Åtgärder</th></tr>
                            </thead>
                            <tbody>
                                {purchaseOrders.map(po => (
                                    <tr key={po.id}>
                                        <td>{po.po_number}</td>
                                        <td>{po.supplier_name}</td>
                                        <td>{new Date(po.created_at).toLocaleDateString()}</td>
                                        <td><Badge variant={po.status === 'received' ? 'success' : 'default'}>{po.status}</Badge></td>
                                        <td>{parseFloat(po.total_amount).toLocaleString('sv-SE')} kr</td>
                                        <td>
                                            {po.status === 'draft' && <Button size="sm" variant="secondary" onClick={() => handleReceivePO(po)} loading={working}>Markera mottagen</Button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            {activeTab === 'suppliers' && (
                <>
                    <div className="page-actions" style={{ marginBottom: '1rem' }}>
                        <Button onClick={() => { setForm({}); setModal('supplier') }}>+ Ny Leverantör</Button>
                    </div>
                    <Card>
                        <table className="admin-table">
                            <thead>
                                <tr><th>Namn</th><th>Kontakt</th><th>E-post</th><th>Stad</th></tr>
                            </thead>
                            <tbody>
                                {suppliers.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.name}</strong></td>
                                        <td>{s.contact_person}</td>
                                        <td>{s.email}</td>
                                        <td>{s.address?.split('\n')[1] || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            {/* Modal for Supplier */}
            <Modal isOpen={modal === 'supplier'} onClose={() => setModal(null)} title="Ny Leverantör">
                <form onSubmit={handleCreateSupplier}>
                    <Input label="Företagsnamn" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Input label="Kontaktperson" value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                    <Input label="E-post" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                    <Textarea label="Adress" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
                    <div className="modal-footer">
                        <Button variant="secondary" type="button" onClick={() => setModal(null)}>Avbryt</Button>
                        <Button type="submit" loading={working}>Spara</Button>
                    </div>
                </form>
            </Modal>

            {/* Simplified PO Modal for demonstration */}
            <Modal isOpen={modal === 'po'} onClose={() => setModal(null)} title="Skapa Inköpsorder">
                <form onSubmit={handleCreatePO}>
                    <Select label="Leverantör" required value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                        <option value="">Välj leverantör...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                    <Textarea label="Noteringar" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>* För enkelhetens skull skapas PO med tomma rader i denna demo-version. I produktion bör rad-editor läggas till här.</p>
                    <div className="modal-footer">
                        <Button variant="secondary" type="button" onClick={() => setModal(null)}>Avbryt</Button>
                        <Button type="submit" loading={working}>Skapa Draft</Button>
                    </div>
                </form>
            </Modal>

        </AdminLayout>
    )
}
