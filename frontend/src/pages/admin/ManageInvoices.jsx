import { useState, useEffect } from 'react'
import { useInvoicesStore, useBookingsStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Button, Badge } from '../../components/common/index.jsx'

export default function ManageInvoices() {
  const { invoices, fetch, create, markPaid, sendEmail, downloadPdf, loading } = useInvoicesStore()
  const { bookings, fetch: fetchBookings } = useBookingsStore()
  const { addToast, ask } = useUIStore()
  const [working, setWorking] = useState({})

  useEffect(() => { fetch(); fetchBookings() }, [fetch, fetchBookings])

  // Bookings without an invoice
  const uninvoiced = bookings.filter(b => b.status !== 'cancelled' && !invoices.find(i => i.booking_id === b.id))

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

  return (
    <AdminLayout title="Fakturor">

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

      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr><th>Fakturanr</th><th>Kund</th><th>Datum</th><th>Förfaller</th><th>Belopp</th><th>Status</th><th>Åtgärder</th></tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={7} className="empty">Inga fakturor ännu</td></tr>}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td>{inv.buyer_name}</td>
                  <td>{inv.invoice_date}</td>
                  <td>{inv.due_date}</td>
                  <td>{parseFloat(inv.total_amount).toLocaleString('sv-SE')} kr</td>
                  <td>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>
                      {inv.status === 'paid' ? 'Betald' : 'Obetald'}
                    </Badge>
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => downloadPdf(inv.id)} title="Ladda ner PDF">⬇ PDF</button>
                    <Button size="sm" variant="secondary" loading={working[inv.id] === 'emailing'} onClick={() => handleEmail(inv)} title="Skicka via e-post">
                      ✉ Email
                    </Button>
                    {inv.status !== 'paid' && (
                      <Button size="sm" variant="success" loading={working[inv.id] === 'paying'} onClick={() => handlePaid(inv)}>
                        ✓ Betald
                      </Button>
                    )}
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
