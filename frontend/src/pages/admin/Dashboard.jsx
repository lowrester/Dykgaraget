import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore, useBookingsStore, useInvoicesStore, useSettingsStore } from '../../store/index.js'
import { AdminLayout, Card, Spinner } from '../../components/common/index.jsx'

export default function Dashboard() {
  const { courses, fetch: fetchCourses } = useCoursesStore()
  const { bookings, fetch: fetchBookings } = useBookingsStore()
  const { invoices, fetch: fetchInvoices } = useInvoicesStore()
  const features = useSettingsStore((s) => s.features)

  useEffect(() => {
    fetchCourses()
    fetchBookings()
    if (features.invoicing) fetchInvoices()
  }, [fetchCourses, fetchBookings, fetchInvoices, features.invoicing])

  const pendingBookings = bookings.filter(b => b.status === 'pending').length
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid').length
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)

  const tiles = [
    { icon: '📚', label: 'Kurser', value: courses.length, link: '/admin/kurser' },
    { icon: '📅', label: 'Bokningar', value: bookings.length, link: '/admin/bokningar', sub: pendingBookings > 0 ? `${pendingBookings} väntande` : null },
    ...(features.invoicing ? [{ icon: '🧾', label: 'Fakturor', value: invoices.length, link: '/admin/fakturor', sub: unpaidInvoices > 0 ? `${unpaidInvoices} obetalda` : null }] : []),
    ...(features.invoicing ? [{ icon: '💰', label: 'Intäkter', value: `${revenue.toLocaleString('sv-SE')} kr`, link: '/admin/fakturor' }] : []),
  ]

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.link} className="stat-tile">
            <span className="stat-tile-icon">{tile.icon}</span>
            <span className="stat-tile-value">{tile.value}</span>
            <span className="stat-tile-label">{tile.label}</span>
            {tile.sub && <span className="stat-tile-sub">{tile.sub}</span>}
          </Link>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: '2rem' }}>
        <Card>
          <h3>Senaste bokningar</h3>
          {bookings.length === 0 ? <p className="empty">Inga bokningar ännu</p> : (
            <table className="admin-table">
              <thead><tr><th>Namn</th><th>Datum</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.slice(0, 5).map(b => (
                  <tr key={b.id}>
                    <td>{b.first_name} {b.last_name}</td>
                    <td>{b.booking_date}</td>
                    <td><span className={`badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/admin/bokningar" className="btn btn-sm btn-secondary" style={{ marginTop: '1rem' }}>Visa alla →</Link>
        </Card>

        <Card>
          <h3>Snabblänkar</h3>
          <div className="quick-links">
            <Link to="/admin/innehall" className="quick-link" style={{ background: 'var(--primary)', color: 'white', fontWeight: 'bold' }}>✍️ Hantera innehåll</Link>
            <Link to="/admin/kurser" className="quick-link">📚 Hantera kurser</Link>
            <Link to="/admin/bokningar" className="quick-link">📅 Hantera bokningar</Link>
            <Link to="/admin/instruktorer" className="quick-link">👥 Hantera instruktörer</Link>
            {features.equipment && <Link to="/admin/utrustning" className="quick-link">🤿 Hantera utrustning</Link>}
            {features.invoicing && <Link to="/admin/fakturor" className="quick-link">🧾 Hantera fakturor</Link>}
            <Link to="/admin/anvandare" className="quick-link">👤 Hantera användare</Link>
            <Link to="/admin/installningar" className="quick-link">⚙️ Inställningar</Link>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
