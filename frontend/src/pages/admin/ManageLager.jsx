import { useState, useEffect } from 'react'
import { useInventoryStore, useEquipmentStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Select, Badge, Textarea } from '../../components/common/index.jsx'
import client from '../../api/client.js'

export default function ManageLager() {
    const {
        suppliers, purchaseOrders, fetchSuppliers, fetchPO, createSupplier, createPO, receivePO, adjustStock, loading
    } = useInventoryStore()
    const { equipment: articles, fetch: fetchArticles } = useEquipmentStore()
    const { addToast, ask } = useUIStore()

    const [activeTab, setActiveTab] = useState('inventory') // inventory, po, suppliers
    const [modal, setModal] = useState(null) // po, supplier, adjust, view_po
    const [form, setForm] = useState({ items: [] })
    const [selectedPO, setSelectedPO] = useState(null)
    const [poItems, setPoItems] = useState([])
    const [working, setWorking] = useState(false)

    useEffect(() => {
        fetchSuppliers()
        fetchPO()
        fetchArticles()
    }, [fetchSuppliers, fetchPO, fetchArticles])

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
        if (form.items.length === 0) return addToast('Lägg till minst en artikel', 'error')
        setWorking(true)
        try {
            await createPO(form)
            addToast('Inköpsorder skapad!')
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    const handleAdjustStock = async (e) => {
        e.preventDefault()
        setWorking(true)
        try {
            await adjustStock(form)
            addToast('Lagersaldo justerat!')
            fetchArticles() // Refresh list
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    const openViewPO = async (po) => {
        setSelectedPO(po)
        setWorking(true)
        try {
            const items = await client.get(`/inventory/po/${po.id}/items`)
            setPoItems(items)
            setModal('view_po')
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    const handleReceivePO = async (poId, items) => {
        const ok = await ask({ title: 'Bekräfta inleverans', message: 'Vill du markera hela ordern som mottagen? Detta kommer att uppdatera lagersaldon för alla artiklar i ordern.' })
        if (!ok) return

        setWorking(true)
        try {
            const receiveItems = items.map(item => ({
                item_id: item.id,
                quantity_received: item.quantity_ordered
            }))
            await receivePO(poId, receiveItems)
            addToast('Inleverans genomförd!')
            fetchArticles()
            setModal(null)
        } catch (err) { addToast(err.message, 'error') }
        finally { setWorking(false) }
    }

    // PO Item Helpers
    const addPOItem = () => {
        setForm({ ...form, items: [...form.items, { equipment_id: '', quantity_ordered: 1, unit_price: 0, description: '' }] })
    }
    const updatePOItem = (idx, k, v) => {
        const items = [...form.items]
        items[idx][k] = v
        setForm({ ...form, items })
    }
    const removePOItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
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
                            <tr><th>Artikel</th><th>Kategori</th><th>Lagersaldo</th><th>Status</th><th>Åtgärder</th></tr>
                        </thead>
                        <tbody>
                            {articles.map(e => (
                                <tr key={e.id}>
                                    <td>
                                        <strong>{e.name}</strong> <small style={{ color: '#666' }}>{e.size}</small>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                            {e.is_for_rent && <Badge variant="info" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>Hyr</Badge>}
                                            {e.is_for_sale && <Badge variant="warning" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>Köp</Badge>}
                                        </div>
                                    </td>
                                    <td>{e.category}</td>
                                    <td>{e.quantity_available} / {e.quantity_total}</td>
                                    <td>
                                        {e.quantity_available < 3 ? <Badge variant="warning">Lågt saldo</Badge> : <Badge variant="success">Okej</Badge>}
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-ghost" onClick={() => { setForm({ equipment_id: e.id, type: 'inbound', quantity: 1, notes: '' }); setModal('adjust') }}>🛠 Justera</button>
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
                                        <td><Badge variant={po.status === 'received' ? 'success' : 'default'}>{po.status === 'draft' ? 'Utkast' : po.status}</Badge></td>
                                        <td>{parseFloat(po.total_amount).toLocaleString('sv-SE')} kr</td>
                                        <td>
                                            <Button size="sm" variant="secondary" onClick={() => openViewPO(po)}>Visa detaljer</Button>
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

            {/* PO Modal with Line Items */}
            <Modal isOpen={modal === 'po'} onClose={() => setModal(null)} title="Skapa Inköpsorder" size="lg">
                <form onSubmit={handleCreatePO}>
                    <div className="grid grid-2">
                        <Select label="Leverantör" required value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                            <option value="">Välj leverantör...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        <Textarea label="Noteringar" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0 }}>Artiklar i ordern</h4>
                            <Button type="button" size="sm" variant="secondary" onClick={addPOItem}>+ Lägg till rad</Button>
                        </div>
                        <table className="admin-table" style={{ fontSize: '0.9rem' }}>
                            <thead>
                                <tr><th>Artikel</th><th>Beskrivning</th><th>Antal</th><th>A-pris</th><th>Totalt</th><th></th></tr>
                            </thead>
                            <tbody>
                                {form.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <select className="form-input" style={{ padding: '0.25rem' }} value={item.equipment_id} onChange={e => updatePOItem(idx, 'equipment_id', e.target.value)}>
                                                <option value="">Välj artikel...</option>
                                                {articles.map(a => <option key={a.id} value={a.id}>{a.name} ({a.size})</option>)}
                                            </select>
                                        </td>
                                        <td><input className="form-input" style={{ padding: '0.25rem' }} value={item.description} onChange={e => updatePOItem(idx, 'description', e.target.value)} placeholder="T.ex. svarta" /></td>
                                        <td><input className="form-input" type="number" style={{ padding: '0.25rem', width: '60px' }} value={item.quantity_ordered} onChange={e => updatePOItem(idx, 'quantity_ordered', parseInt(e.target.value))} /></td>
                                        <td><input className="form-input" type="number" style={{ padding: '0.25rem', width: '90px' }} value={item.unit_price} onChange={e => updatePOItem(idx, 'unit_price', parseFloat(e.target.value))} /></td>
                                        <td>{(item.quantity_ordered * item.unit_price).toLocaleString()} kr</td>
                                        <td><button type="button" className="btn btn-sm btn-ghost text-danger" onClick={() => removePOItem(idx)}>✕</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="modal-footer">
                        <Button variant="secondary" type="button" onClick={() => setModal(null)}>Avbryt</Button>
                        <Button type="submit" loading={working}>Spara inköpsorder</Button>
                    </div>
                </form>
            </Modal>

            {/* View PO Details Modal */}
            <Modal isOpen={modal === 'view_po'} onClose={() => setModal(null)} title={`Order: ${selectedPO?.po_number}`} size="lg">
                <div className="grid grid-2" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <div>
                        <p><strong>Leverantör:</strong> {selectedPO?.supplier_name}</p>
                        <p><strong>Datum:</strong> {new Date(selectedPO?.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                        <p><strong>Status:</strong> <Badge variant={selectedPO?.status === 'received' ? 'success' : 'default'}>{selectedPO?.status}</Badge></p>
                        <p><strong>Totalt belopp:</strong> {parseFloat(selectedPO?.total_amount || 0).toLocaleString()} kr</p>
                    </div>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr><th>Artikel</th><th>Beskrivning</th><th>Beställt</th><th>Mottaget</th><th>Pris</th></tr>
                    </thead>
                    <tbody>
                        {poItems.map(item => (
                            <tr key={item.id}>
                                <td>{articles.find(a => a.id === item.equipment_id)?.name || 'Okänd'}</td>
                                <td>{item.description}</td>
                                <td>{item.quantity_ordered}</td>
                                <td>{item.quantity_received || 0}</td>
                                <td>{parseFloat(item.unit_price).toLocaleString()} kr</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="modal-footer">
                    <Button variant="secondary" onClick={() => setModal(null)}>Stäng</Button>
                    {selectedPO?.status === 'draft' && (
                        <Button onClick={() => handleReceivePO(selectedPO.id, poItems)} loading={working}>Markera som mottagen</Button>
                    )}
                </div>
            </Modal>

            {/* Stock Adjustment Modal */}
            <Modal isOpen={modal === 'adjust'} onClose={() => setModal(null)} title="Justera Lagersaldo">
                <form onSubmit={handleAdjustStock}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--gray-600)' }}>
                        Justera saldot för <strong>{articles.find(a => a.id === form.equipment_id)?.name}</strong>.
                    </p>
                    <Select label="Typ av justering" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        <option value="inbound">Inleverans (+) / Korrigering upp</option>
                        <option value="outbound">Uttag (-) / Svinns / Korrigering ner</option>
                    </Select>
                    <Input label="Antal" type="number" min={1} required value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })} />
                    <Textarea label="Anledning / Notering" required placeholder="T.ex. Lagersvinn, Inventering" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    <div className="modal-footer">
                        <Button variant="secondary" type="button" onClick={() => setModal(null)}>Avbryt</Button>
                        <Button type="submit" loading={working}>Spara justering</Button>
                    </div>
                </form>
            </Modal>

        </AdminLayout>
    )
}
