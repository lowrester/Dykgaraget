import { useState, useEffect } from 'react'
import { useEquipmentStore, useUIStore, useInventoryStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Badge } from '../../components/common/index.jsx'

const EMPTY = { name: '', category: 'Övrigt', size: '', quantity_total: 1, quantity_available: 1, rental_price: 100, sale_price: 0, is_for_rent: true, is_for_sale: false, condition: 'ny', is_active: true }
const CATS = ['Våtdräkt', 'BCD', 'Mask', 'Regulator', 'Dator', 'Fenor', 'Torrdräkt', 'Merchandise', 'Tillbehör', 'Övrigt']

export default function ManageArticles() {
  const { equipment: articles, fetch, create, update, remove, loading } = useEquipmentStore()
  const { transactions, fetchTransactions } = useInventoryStore()
  const { addToast, ask } = useUIStore()
  const [modal, setModal] = useState(false)
  const [historyModal, setHistoryModal] = useState(null)
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
      const payload = {
        ...form,
        quantity_total: parseInt(form.quantity_total),
        quantity_available: parseInt(form.quantity_available ?? form.quantity_total),
        rental_price: parseFloat(form.rental_price),
        sale_price: parseFloat(form.sale_price)
      }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      addToast(editing ? 'Artikel uppdaterad!' : 'Artikel skapad!')
      close()
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (item) => {
    const ok = await ask({ title: 'Ta bort artikel?', message: `Är du säker på att du vill ta bort "${item.name} (${item.size})"?`, type: 'danger', confirmText: 'Ta bort' })
    if (!ok) return
    try {
      await remove(item.id)
      addToast('Artikel borttagen')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const openHistory = async (item) => {
    setHistoryModal(item)
    try {
      await fetchTransactions(item.id)
    } catch (err) { addToast(err.message, 'error') }
  }

  return (
    <AdminLayout title="Artiklar">
      <div className="page-actions"><Button onClick={openNew}>+ Ny artikel</Button></div>
      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead><tr><th>Namn</th><th>Kategori</th><th>Status</th><th>Antal</th><th>Priser</th><th>Lägen</th><th>Åtgärder</th></tr></thead>
            <tbody>
              {articles.length === 0 && <tr><td colSpan={7} className="empty">Inga artiklar registrerade</td></tr>}
              {articles.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong> <small style={{ color: '#666' }}>{e.size}</small></td>
                  <td>{e.category}</td>
                  <td><Badge variant={e.is_active ? 'success' : 'default'}>{e.is_active ? 'Aktiv' : 'Inaktiv'}</Badge></td>
                  <td>{e.quantity_available}/{e.quantity_total}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>
                      {e.is_for_rent && <div>Hyra: {parseFloat(e.rental_price).toLocaleString('sv-SE')} kr/dag</div>}
                      {e.is_for_sale && <div>Köp: {parseFloat(e.sale_price).toLocaleString('sv-SE')} kr</div>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {e.is_for_rent && <Badge variant="info" style={{ fontSize: '0.65rem' }}>Hyr</Badge>}
                      {e.is_for_sale && <Badge variant="warning" style={{ fontSize: '0.65rem' }}>Köp</Badge>}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(e)}>Redigera</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openHistory(e)} style={{ marginLeft: '0.5rem' }}>Historik</button>
                    <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(e)} style={{ marginLeft: '0.5rem' }}>Ta bort</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal isOpen={modal} onClose={close} title={editing ? 'Redigera artikel' : 'Ny artikel'}>
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

          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--gray-100)', marginTop: '0.5rem', paddingTop: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Användningsområden</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="checkbox" id="is_for_rent" checked={form.is_for_rent} onChange={(e) => set('is_for_rent', e.target.checked)} />
                  <label htmlFor="is_for_rent" style={{ fontWeight: 600 }}>Tillägg vid bokning (Hyra)</label>
                </div>
                <Input label="Hyrespris (kr/dag)" type="number" min={0} value={form.rental_price} onChange={(e) => set('rental_price', e.target.value)} disabled={!form.is_for_rent} />
              </div>

              <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="checkbox" id="is_for_sale" checked={form.is_for_sale} onChange={(e) => set('is_for_sale', e.target.checked)} />
                  <label htmlFor="is_for_sale" style={{ fontWeight: 600 }}>Webshop (Försäljning)</label>
                </div>
                <Input label="Försäljningspris (kr)" type="number" min={0} value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} disabled={!form.is_for_sale} />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1rem' }}>
            <input type="checkbox" id="eq_active" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="eq_active" style={{ fontWeight: 600 }}>Artikel är aktiv</label>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>Avbryt</Button>
          <Button onClick={handleSave} loading={saving}>Spara</Button>
        </div>
      </Modal>

      <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title={`Historik: ${historyModal?.name}`}>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="admin-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr><th>Datum</th><th>Typ</th><th>Antal</th><th>Ref</th></tr>
            </thead>
            <tbody>
              {transactions.length === 0 && <tr><td colSpan={4} className="empty">Ingen historik hittades</td></tr>}
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td><Badge variant={t.type === 'inbound' ? 'success' : t.type === 'outbound' ? 'warning' : 'default'}>{t.type}</Badge></td>
                  <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                  <td>{t.reference_type || 'Manuellt'} {t.notes && <><br /><small>{t.notes}</small></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={() => setHistoryModal(null)}>Stäng</Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
