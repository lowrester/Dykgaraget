import { useState, useEffect } from 'react'
import { useEquipmentStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input } from '../../components/common/index.jsx'

const EMPTY = { name: '', category: 'Wetsuit', size: '', quantity_total: 1, quantity_available: 1, rental_price: 100, condition: 'god', is_active: true }
const CATS = ['Wetsuit', 'BCD', 'Mask', 'Regulator', 'Computer', 'Fenor', 'Torrdräkt', 'Övrigt']

export default function ManageEquipment() {
  const { equipment, fetch, create, update, remove, loading } = useEquipmentStore()
  const { addToast, ask } = useUIStore()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (e) => { setEditing(e); setForm({ ...e }); setModal(true) }
  const close = () => { setModal(false); setEditing(null) }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, quantity_total: parseInt(form.quantity_total), quantity_available: parseInt(form.quantity_available ?? form.quantity_total), rental_price: parseFloat(form.rental_price) }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      addToast(editing ? 'Utrustning uppdaterad!' : 'Utrustning skapad!')
      close()
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (item) => {
    const ok = await ask({ title: 'Ta bort utrustning?', message: `Är du säker på att du vill ta bort "${item.name} (${item.size})"?`, type: 'danger', confirmText: 'Ta bort' })
    if (!ok) return
    try {
      await remove(item.id)
      addToast('Utrustning borttagen')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <AdminLayout title="Utrustning">
      <div className="page-actions"><Button onClick={openNew}>+ Ny artikel</Button></div>
      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead><tr><th>Namn</th><th>Kategori</th><th>Storlek</th><th>Antal</th><th>Hyra/dag</th><th>Status</th><th>Åtgärder</th></tr></thead>
            <tbody>
              {equipment.length === 0 && <tr><td colSpan={7} className="empty">Ingen utrustning registrerad</td></tr>}
              {equipment.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.category}</td>
                  <td>{e.size}</td>
                  <td>{e.quantity_available}/{e.quantity_total}</td>
                  <td>{parseFloat(e.rental_price).toLocaleString('sv-SE')} kr</td>
                  <td><span className={`badge ${e.is_active ? 'badge-success' : 'badge-default'}`}>{e.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(e)}>Redigera</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e)} style={{ marginLeft: '0.5rem' }}>Ta bort</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal isOpen={modal} onClose={close} title={editing ? 'Redigera utrustning' : 'Ny utrustning'}>
        <div className="grid grid-2">
          <Input label="Namn" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-input form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <Input label="Storlek" value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="S, M, L, 40-43 ..." />
          <Input label="Totalt antal" type="number" min={1} value={form.quantity_total} onChange={(e) => set('quantity_total', e.target.value)} />
          <Input label="Tillgängligt antal" type="number" min={0} max={form.quantity_total} value={form.quantity_available ?? form.quantity_total} onChange={(e) => set('quantity_available', e.target.value)} />
          <Input label="Hyra/dag (kr)" type="number" min={0} value={form.rental_price} onChange={(e) => set('rental_price', e.target.value)} />
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="eq_active" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="eq_active">Aktiv</label>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>Avbryt</Button>
          <Button onClick={handleSave} loading={saving}>Spara</Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
