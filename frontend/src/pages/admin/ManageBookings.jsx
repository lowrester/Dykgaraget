import { useState, useEffect, useMemo } from 'react'
import { useBookingsStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Badge, Modal, Button } from '../../components/common/index.jsx'

const STATUS_MAP = { pending: 'warning', confirmed: 'success', cancelled: 'danger', completed: 'primary' }
const STATUS_SV = { pending: 'Väntande', confirmed: 'Bekräftad', cancelled: 'Avbokad', completed: 'Avslutad' }

function exportCSV(bookings) {
  const headers = ['#', 'Förnamn', 'Efternamn', 'E-post', 'Telefon', 'Kurs', 'Datum', 'Tid', 'Deltagare', 'Pris', 'Status']
  const rows = bookings.map(b => [
    b.id, b.first_name, b.last_name, b.email, b.phone || '',
    b.course_name || '', b.booking_date, b.booking_time || '',
    b.participants || 1, parseFloat(b.total_price || 0).toFixed(2), b.status
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `bokningar_${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function ManageBookings() {
  const { bookings, fetch, updateStatus, loading } = useBookingsStore()
  const { addToast } = useUIStore()
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setFilter] = useState('all')

  useEffect(() => { fetch() }, [fetch])

  const handleStatus = async (id, status) => {
    try {
      await updateStatus(id, status)
      addToast(`Status uppdaterad till "${STATUS_SV[status]}"`)
      if (detail?.id === id) setDetail(prev => ({ ...prev, status }))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  // Filtrering
  const filtered = useMemo(() => {
    let list = bookings
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.course_name?.toLowerCase().includes(q) ||
        String(b.id).includes(q)
      )
    }
    return list
  }, [bookings, statusFilter, search])

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0)

  return (
    <AdminLayout title="Bokningar">

      {/* Summering */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-tile"><span className="stat-tile-icon">📅</span><span className="stat-tile-value">{bookings.length}</span><span className="stat-tile-label">Totalt</span></div>
        <div className="stat-tile"><span className="stat-tile-icon">⏳</span><span className="stat-tile-value">{pendingCount}</span><span className="stat-tile-label">Väntande</span></div>
        <div className="stat-tile"><span className="stat-tile-icon">✅</span><span className="stat-tile-value">{confirmedCount}</span><span className="stat-tile-label">Bekräftade</span></div>
        <div className="stat-tile"><span className="stat-tile-icon">💰</span><span className="stat-tile-value">{totalRevenue.toLocaleString('sv-SE')} kr</span><span className="stat-tile-label">Bruttovärde</span></div>
      </div>

      {/* Sök + Filter + Export */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: '280px', marginBottom: 0 }}
          placeholder="🔍 Sök namn, email, kurs, #ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="form-input form-select" style={{ maxWidth: '160px', marginBottom: 0 }}
          value={statusFilter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Alla statusar</option>
          {Object.entries(STATUS_SV).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {search || statusFilter !== 'all' ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
            Visar {filtered.length} av {bookings.length}
          </span>
        ) : null}
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="secondary" onClick={() => exportCSV(filtered)}>
            ⬇ Exportera CSV ({filtered.length})
          </Button>
        </div>
      </div>

      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Kund</th><th>E-post</th><th>Kurs</th><th>Datum</th><th>Tid</th><th>Pers.</th><th>Pris</th><th>Status</th><th>Åtgärder</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="empty">
                  {search || statusFilter !== 'all' ? 'Inga bokningar matchar sökningen' : 'Inga bokningar ännu'}
                </td></tr>
              )}
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td>
                    <button style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 600, padding: 0 }} onClick={() => setDetail(b)}>
                      #{b.id}
                    </button>
                  </td>
                  <td>{b.first_name} {b.last_name}</td>
                  <td style={{ fontSize: '0.8rem' }}>{b.email}</td>
                  <td>{b.course_name || '—'}</td>
                  <td>{b.booking_date}</td>
                  <td>{b.booking_time || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{b.participants || 1}</td>
                  <td>{parseFloat(b.total_price || 0).toLocaleString('sv-SE')} kr</td>
                  <td><Badge variant={STATUS_MAP[b.status]}>{STATUS_SV[b.status] || b.status}</Badge></td>
                  <td>
                    <select className="form-select-sm" value={b.status} onChange={(e) => handleStatus(b.id, e.target.value)}>
                      {Object.entries(STATUS_SV).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detalj-modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Bokning #${detail?.id}`}>
        {detail && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                ['Kund', `${detail.first_name} ${detail.last_name}`],
                ['E-post', detail.email],
                ['Telefon', detail.phone || '—'],
                ['Kurs', detail.course_name || '—'],
                ['Datum', detail.booking_date],
                ['Tid', detail.booking_time || '—'],
                ['Deltagare', detail.participants || 1],
                ['Pris', `${parseFloat(detail.total_price || 0).toLocaleString('sv-SE')} kr`],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-400)', marginBottom: '0.15rem' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-800)' }}>{value}</div>
                </div>
              ))}
            </div>
            {detail.notes && (
              <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '0.25rem' }}>ANTECKNINGAR</div>
                <div style={{ fontSize: '0.875rem' }}>{detail.notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
              {detail.status === 'pending' && (
                <Button size="sm" variant="success" onClick={() => handleStatus(detail.id, 'confirmed')}>✓ Bekräfta</Button>
              )}
              {detail.status !== 'cancelled' && detail.status !== 'completed' && (
                <Button size="sm" variant="danger" onClick={() => { handleStatus(detail.id, 'cancelled'); setDetail(null) }}>Avboka</Button>
              )}
              {detail.status === 'confirmed' && (
                <Button size="sm" onClick={() => { handleStatus(detail.id, 'completed'); setDetail(null) }}>Markera avslutad</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
