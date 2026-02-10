import { useState, useEffect } from 'react'
import { useBookingsStore } from '../../store/index.js'
import { AdminLayout, Card, Alert, Badge } from '../../components/common/index.jsx'

const STATUS_MAP = { pending:'warning', confirmed:'success', cancelled:'danger', completed:'primary' }
const STATUS_SV  = { pending:'Väntande', confirmed:'Bekräftad', cancelled:'Avbokad', completed:'Avslutad' }

export default function ManageBookings() {
  const { bookings, fetch, updateStatus, loading } = useBookingsStore()
  const [alert, setAlert] = useState(null)

  useEffect(() => { fetch() }, [fetch])

  const handleStatus = async (id, status) => {
    try {
      await updateStatus(id, status)
      setAlert({ type:'success', msg:`Status uppdaterad till "${STATUS_SV[status]}"` })
    } catch (err) {
      setAlert({ type:'error', msg: err.message })
    }
  }

  return (
    <AdminLayout title="Bokningar">
      {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}
      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Kund</th><th>E-post</th><th>Kurs</th><th>Datum</th><th>Pris</th><th>Status</th><th>Åtgärder</th></tr>
            </thead>
            <tbody>
              {bookings.length === 0 && <tr><td colSpan={8} className="empty">Inga bokningar ännu</td></tr>}
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.first_name} {b.last_name}</td>
                  <td>{b.email}</td>
                  <td>{b.course_name || '—'}</td>
                  <td>{b.booking_date}</td>
                  <td>{parseFloat(b.total_price || 0).toLocaleString('sv-SE')} kr</td>
                  <td><Badge variant={STATUS_MAP[b.status]}>{STATUS_SV[b.status] || b.status}</Badge></td>
                  <td>
                    <select
                      className="form-select-sm"
                      value={b.status}
                      onChange={(e) => handleStatus(b.id, e.target.value)}
                    >
                      {Object.entries(STATUS_SV).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
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
