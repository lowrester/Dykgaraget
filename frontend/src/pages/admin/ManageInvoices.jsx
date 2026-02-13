import { useState, useEffect } from 'react'
import { useInvoicesStore, useBookingsStore, useCoursesStore, useEquipmentStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Button, Badge } from '../../components/common/index.jsx'

export default function ManageInvoices() {
  const { invoices, fetch, create, markPaid, sendEmail, createManual, previewInvoice, archiveInvoice, downloadPdf, loading } = useInvoicesStore()
  const { bookings, fetch: fetchBookings } = useBookingsStore()
  const { courses, fetch: fetchCourses } = useCoursesStore()
  const { equipment, fetch: fetchEquipment } = useEquipmentStore()
  const { addToast, ask } = useUIStore()

  const [working, setWorking] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualInvoice, setManualInvoice] = useState({
    buyer_name: '', buyer_email: '', buyer_address: '', buyer_vat_number: '',
    items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: 0.25 }],
    terms_days: 30,
    supply_date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  // ... (keeping other handlers same as before)

  const addLineItem = () => {
    setManualInvoice(m => ({ ...m, items: [...m.items, { description: '', quantity: 1, unit_price: 0, vat_rate: 0.25 }] }))
  }

  const updateLineItem = (idx, field, val) => {
    const newItems = [...manualInvoice.items]
    newItems[idx][field] = val
    setManualInvoice(m => ({ ...m, items: newItems }))
  }

  const prefillItem = (idx, type, id) => {
    if (type === 'course') {
      const c = courses.find(x => x.id === parseInt(id))
      if (c) {
        updateLineItem(idx, 'description', `Kurs: ${c.name} (${c.level})`)
        updateLineItem(idx, 'unit_price', c.price)
        updateLineItem(idx, 'vat_rate', 0.06) // 6% for courses
      }
    } else {
      const e = equipment.find(x => x.id === parseInt(id))
      if (e) {
        updateLineItem(idx, 'description', `Hyra: ${e.name} (${e.size || ''})`)
        updateLineItem(idx, 'unit_price', e.rental_price)
        updateLineItem(idx, 'vat_rate', 0.25) // 25% for equipment
      }
    }
  }

  // Calculate manual totals with VAT split
  const getManualStats = () => {
    let subtotal = 0
    const vatSplits = { '0.25': 0, '0.12': 0, '0.06': 0 }

    manualInvoice.items.forEach(item => {
      const net = parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)
      const rate = parseFloat(item.vat_rate || 0.25).toFixed(2)
      subtotal += net
      if (vatSplits[rate] !== undefined) vatSplits[rate] += net * parseFloat(rate)
    })

    const totalVat = Object.values(vatSplits).reduce((s, v) => s + v, 0)
    return { subtotal, vatSplits, total: subtotal + totalVat }
  }

  const stats = getManualStats()

  return (
    <AdminLayout title="Fakturering">
      {/* ... previous content ... */}

      {showManualModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '1.5rem 2rem', background: 'var(--gray-900)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Invoice Builder <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.9rem', marginLeft: '0.5rem' }}>— Multi-VAT (2026 Ready)</span></h2>
              <button onClick={() => setShowManualModal(false)} style={{ color: 'white', fontSize: '1.5rem', opacity: 0.5 }}>×</button>
            </div>

            <form onSubmit={handleManualSubmit} style={{ padding: '2rem' }}>
              <div className="grid grid-2" style={{ gap: '2.5rem' }}>
                {/* Section: Customer */}
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                    <span>👤</span> Kunduppgifter
                  </h4>
                  <div className="form-group">
                    <label>Företag / Namn</label>
                    <input type="text" placeholder="T.ex. Dykarstugan AB" value={manualInvoice.buyer_name} onChange={e => setManualInvoice({ ...manualInvoice, buyer_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>E-post för faktura</label>
                    <input type="email" placeholder="ekonomi@exempel.se" value={manualInvoice.buyer_email} onChange={e => setManualInvoice({ ...manualInvoice, buyer_email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Postmottagare & Adress</label>
                    <textarea rows="3" placeholder="Gatuadress&#10;Postnummer och ort" value={manualInvoice.buyer_address} onChange={e => setManualInvoice({ ...manualInvoice, buyer_address: e.target.value })} />
                  </div>
                </div>

                {/* Section: Invoice Details */}
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                    <span>📄</span> Fakturadetaljer
                  </h4>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label>Leveransdatum</label>
                      <input type="date" value={manualInvoice.supply_date} onChange={e => setManualInvoice({ ...manualInvoice, supply_date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Betalningsvillkor</label>
                      <select value={manualInvoice.terms_days} onChange={e => setManualInvoice({ ...manualInvoice, terms_days: e.target.value })}>
                        <option value="10">10 dagar</option>
                        <option value="15">15 dagar</option>
                        <option value="30">30 dagar</option>
                        <option value="60">60 dagar</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Köparens VAT-nummer (valfritt)</label>
                    <input type="text" placeholder="T.ex. SE12345678901" value={manualInvoice.buyer_vat_number} onChange={e => setManualInvoice({ ...manualInvoice, buyer_vat_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Faktura-notering (visas på PDF)</label>
                    <input type="text" placeholder="T.ex. Projekt X eller referensnummer" value={manualInvoice.notes} onChange={e => setManualInvoice({ ...manualInvoice, notes: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="invoice-items-section" style={{ marginTop: '2rem', background: '#fcfcfc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Fakturarader</h4>
                  <Button type="button" variant="secondary" size="sm" onClick={addLineItem}>+ Lägg till rad</Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {manualInvoice.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 120px 40px', gap: '0.75rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label-sm">Beskrivning</label>
                        <input type="text" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label-sm">Antal</label>
                        <input type="number" min="1" step="0.1" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label-sm">À-pris</label>
                        <input type="number" min="0" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label-sm">Moms</label>
                        <select value={item.vat_rate} onChange={e => updateLineItem(idx, 'vat_rate', e.target.value)}>
                          <option value="0.25">25% (Varor)</option>
                          <option value="0.06">6% (Idrott)</option>
                          <option value="0.12">12% (Övr)</option>
                          <option value="0">Momsfritt</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label-sm">Snabbval</label>
                        <select onChange={e => {
                          const [type, id] = e.target.value.split(':')
                          if (id) prefillItem(idx, type, id)
                        }} defaultValue="" style={{ fontSize: '0.8rem' }}>
                          <option value="">Register...</option>
                          <optgroup label="Kurser">
                            {courses.map(c => <option key={`c:${c.id}`} value={`course:${c.id}`}>{c.name}</option>)}
                          </optgroup>
                          <optgroup label="Utrustning">
                            {equipment.map(e => <option key={`e:${e.id}`} value={`equip:${e.id}`}>{e.name} ({e.size})</option>)}
                          </optgroup>
                        </select>
                      </div>
                      <button type="button" onClick={() => {
                        const newItems = manualInvoice.items.filter((_, i) => i !== idx)
                        setManualInvoice(m => ({ ...m, items: newItems.length ? newItems : [{ description: '', quantity: 1, unit_price: 0, vat_rate: 0.25 }] }))
                      }} style={{ color: 'var(--red)', background: 'none', border: 'none', padding: '10px', cursor: 'pointer', opacity: 0.5 }}>🗑️</button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: '320px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#666' }}>Summa Netto:</span>
                      <span style={{ fontWeight: 600 }}>{stats.subtotal.toLocaleString('sv-SE')} kr</span>
                    </div>

                    {Object.entries(stats.vatSplits).map(([rate, val]) => val > 0 && (
                      <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem', color: '#666' }}>
                        <span>Moms ({Math.round(rate * 100)}%):</span>
                        <span style={{ fontWeight: 500 }}>{val.toLocaleString('sv-SE')} kr</span>
                      </div>
                    ))}

                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Att betala:</span>
                      <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--primary)' }}>
                        {stats.total.toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button type="button" variant="ghost" onClick={() => setShowManualModal(false)}>Avbryt</Button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Button type="button" variant="secondary" onClick={handlePreview}>
                    👁 Förhandsgranska PDF
                  </Button>
                  <Button type="submit" variant="primary" loading={working.manual === 'creating'}>
                    Skapa & registrera faktura
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
