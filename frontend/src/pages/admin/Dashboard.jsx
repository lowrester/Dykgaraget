import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore, useBookingsStore, useInvoicesStore, useSettingsStore, useHealthStore } from '../../store/index.js'
import { AdminLayout, Card, Spinner, Badge } from '../../components/common/index.jsx'

export default function Dashboard() {
  const { courses, fetch: fetchCourses } = useCoursesStore()
  const { bookings, fetch: fetchBookings } = useBookingsStore()
  const { invoices, fetch: fetchInvoices } = useInvoicesStore()
  const { status: health, check: checkHealth } = useHealthStore()
  const features = useSettingsStore((s) => s.features)

  useEffect(() => {
    fetchCourses()
    fetchBookings()
    checkHealth()
    if (features.invoicing) fetchInvoices()
  }, [fetchCourses, fetchBookings, fetchInvoices, features.invoicing, checkHealth])

  const pendingBookings = bookings.filter(b => b.status === 'pending').length
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid').length

  const tiles = [
    { icon: '📚', label: 'Kurser', value: courses.length, link: '/admin/kurser' },
    { icon: '📅', label: 'Bokningar', value: bookings.length, link: '/admin/bokningar', sub: pendingBookings > 0 ? `${pendingBookings} väntande` : null },
    ...(features.invoicing ? [{ icon: '🧾', label: 'Fakturor', value: invoices.length, link: '/admin/fakturor', sub: unpaidInvoices > 0 ? `${unpaidInvoices} obetalda` : null }] : []),
  ]

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-3">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.link} className="stat-tile">
            <span className="stat-tile-icon">{tile.icon}</span>
            <span className="stat-tile-value">{tile.value}</span>
            <span className="stat-tile-label">{tile.label}</span>
            {tile.sub && <span className="stat-tile-sub">{tile.sub}</span>}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '2rem' }}>
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
      </div>
    </AdminLayout>
  )
}
