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
    buyer_name: '', buyer_email: '', buyer_address: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    terms_days: 30
  })

  useEffect(() => {
    fetch();
    fetchBookings();
    fetchCourses();
    fetchEquipment();
  }, [fetch, fetchBookings, fetchCourses, fetchEquipment])

  // Filters
  const filteredInvoices = invoices.filter(inv => inv.is_archived === showArchived)
  const uninvoiced = bookings.filter(b => b.status !== 'cancelled' && !invoices.find(i => i.booking_id === b.id))

  // Revenue
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
  const unpaidTotal = invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)

  const setWork = (id, val) => setWorking(w => ({ ...w, [id]: val }))

  const handleCreate = async (bookingId) => {
    setWork(bookingId, 'creating')
    try {
      await create(bookingId)
      addToast('Faktura skapad!')
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setWork(bookingId, null) }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    setWork('manual', 'creating')
    try {
      await createManual(manualInvoice)
      addToast('Manuell faktura skapad!')
      setShowManualModal(false)
      setManualInvoice({
        buyer_name: '', buyer_email: '', buyer_address: '',
        items: [{ description: '', quantity: 1, unit_price: 0 }],
        terms_days: 30
      })
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setWork('manual', null) }
  }

  const handlePreview = async () => {
    try {
      await previewInvoice(manualInvoice)
    } catch (err) {
      addToast('Kunde inte förhandsgranska: ' + err.message, 'error')
    }
  }

  const handleArchive = async (id, isArchived) => {
    try {
      await archiveInvoice(id, isArchived)
      addToast(isArchived ? 'Faktura arkiverad' : 'Faktura återställd')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleEmail = async (invoice) => {
    setWork(invoice.id, 'emailing')
    try {
      await sendEmail(invoice.id)
      addToast(`Faktura skickad till ${invoice.buyer_email}`)
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setWork(invoice.id, null) }
  }

  const handlePaid = async (invoice) => {
    const ok = await ask({ title: 'Markera som betald?', message: 'Vill du markera denna faktura som betald?', confirmText: 'Markera som betald' })
    if (!ok) return
    setWork(invoice.id, 'paying')
    try {
      await markPaid(invoice.id)
      addToast('Faktura markerad som betald')
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setWork(invoice.id, null) }
  }

  const addLineItem = () => {
    setManualInvoice(m => ({ ...m, items: [...m.items, { description: '', quantity: 1, unit_price: 0 }] }))
  }

  const updateLineItem = (idx, field, val) => {
    const newItems = [...manualInvoice.items]
    newItems[idx][field] = val
    setManualInvoice(m => ({ ...m, items: newItems }))
  }

  const prefillItem = (idx, type, id) => {
    if (type === 'course') {
      const c = courses.find(x => x.id === parseInt(id))
      if (c) updateLineItem(idx, 'description', `Kurs: ${c.name} (${c.level})`), updateLineItem(idx, 'unit_price', c.price)
    } else {
      const e = equipment.find(x => x.id === parseInt(id))
      if (e) updateLineItem(idx, 'description', `Hyra: ${e.name} (${e.size || ''})`), updateLineItem(idx, 'unit_price', e.rental_price)
    }
  }

  return (
    <AdminLayout title="Fakturering">

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="stat-tile no-link">
          <span className="stat-tile-label">Total intäkt (betalt)</span>
          <span className="stat-tile-value" style={{ color: 'var(--success)' }}>{totalRevenue.toLocaleString('sv-SE')} kr</span>
        </div>
        <div className="stat-tile no-link">
          <span className="stat-tile-label">Väntande betalningar</span>
          <span className="stat-tile-value" style={{ color: 'var(--warning)' }}>{unpaidTotal.toLocaleString('sv-SE')} kr</span>
        </div>
        <div className="stat-tile no-link" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
          <Button onClick={() => setShowManualModal(true)} className="btn-full">+ Ny manuell faktura</Button>
        </div>
      </div>

      {uninvoiced.length > 0 && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <h3>Bokningar utan faktura ({uninvoiced.length})</h3>
          <table className="admin-table">
            <thead><tr><th>#</th><th>Kund</th><th>Kurs</th><th>Datum</th><th>Belopp</th><th></th></tr></thead>
            <tbody>
              {uninvoiced.map(b => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.first_name} {b.last_name}</td>
                  <td>{b.course_name || '—'}</td>
                  <td>{b.booking_date}</td>
                  <td>{parseFloat(b.total_price || 0).toLocaleString('sv-SE')} kr</td>
                  <td>
                    <Button size="sm" loading={working[b.id] === 'creating'} onClick={() => handleCreate(b.id)}>
                      Skapa faktura
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{showArchived ? 'Arkiverade fakturor' : 'Aktiva fakturor'}</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Visa aktiva' : 'Visa arkiv'}
        </Button>
      </div>

      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr><th>Fakturanr</th><th>Kund</th><th>Datum</th><th>Status</th><th>Belopp</th><th>Åtgärder</th></tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 && <tr><td colSpan={6} className="empty">Inga fakturor här</td></tr>}
              {filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td>{inv.buyer_name}</td>
                  <td>{inv.invoice_date}</td>
                  <td>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>
                      {inv.status === 'paid' ? 'Betald' : 'Obetald'}
                    </Badge>
                  </td>
                  <td>{parseFloat(inv.total_amount).toLocaleString('sv-SE')} kr</td>
                  <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => downloadPdf(inv.id)} title="Ladda ner PDF">⬇ PDF</button>
                    <Button size="sm" variant="secondary" loading={working[inv.id] === 'emailing'} onClick={() => handleEmail(inv)} title="Skicka via e-post">
                      ✉
                    </Button>
                    {inv.status !== 'paid' && (
                      <Button size="sm" variant="success" loading={working[inv.id] === 'paying'} onClick={() => handlePaid(inv)}>
                        ✓
                      </Button>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => handleArchive(inv.id, !inv.is_archived)}>
                      {inv.is_archived ? '📦 Återställ' : '📦 Arkivera'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showManualModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <h2>Skapa manuell faktura</h2>
            <form onSubmit={handleManualSubmit}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label>Kundens namn</label>
                  <input type="text" value={manualInvoice.buyer_name} onChange={e => setManualInvoice({ ...manualInvoice, buyer_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Kundens e-post</label>
                  <input type="email" value={manualInvoice.buyer_email} onChange={e => setManualInvoice({ ...manualInvoice, buyer_email: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Fakturaadress</label>
                <textarea rows="2" value={manualInvoice.buyer_address} onChange={e => setManualInvoice({ ...manualInvoice, buyer_address: e.target.value })} />
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold' }}>Fakturarader</label>
                  <Button type="button" variant="secondary" size="sm" onClick={addLineItem}>+ Lägg till rad</Button>
                </div>
                {manualInvoice.items.map((item, idx) => (
                  <div key={idx} className="grid" style={{ gridTemplateColumns: '1fr 80px 120px 200px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.7rem' }}>Beskrivning</label>
                      <input type="text" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.7rem' }}>Antal</label>
                      <input type="number" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.7rem' }}>À-pris</label>
                      <input type="number" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.7rem' }}>Hämta från register</label>
                      <select onChange={e => {
                        const [type, id] = e.target.value.split(':')
                        if (id) prefillItem(idx, type, id)
                      }} defaultValue="">
                        <option value="">-- Välj artikel --</option>
                        <optgroup label="Kurser">
                          {courses.map(c => <option key={`c:${c.id}`} value={`course:${c.id}`}>{c.name}</option>)}
                        </optgroup>
                        <optgroup label="Utrustning">
                          {equipment.map(e => <option key={`e:${e.id}`} value={`equip:${e.id}`}>{e.name} ({e.size})</option>)}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <Button type="button" variant="secondary" onClick={() => setShowManualModal(false)}>Avbryt</Button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="secondary" onClick={handlePreview}>👁 Förhandsgranska</Button>
                  <Button type="submit" loading={working.manual === 'creating'}>Spara och skapa</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
