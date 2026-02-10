import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useEquipmentStore } from '../../store/index.js'
import { Card, Spinner } from '../../components/common/index.jsx'

const CATEGORY_ICONS = {
  Wetsuit:    '🩱',
  BCD:        '🦺',
  Mask:       '🥽',
  Regulator:  '🌬️',
  Computer:   '⌚',
  Fenor:      '🐟',
  Torrdräkt:  '🧥',
  Övrigt:     '🤿',
}

export default function Equipment() {
  const { equipment, fetch, loading } = useEquipmentStore()

  useEffect(() => { fetch() }, [fetch])

  // Gruppera per kategori
  const activeEquipment = equipment.filter((e) => e.is_active)
  const byCategory = activeEquipment.reduce((acc, item) => {
    const cat = item.category || 'Övrigt'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="page">
      {/* Hero */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Utrustning</h1>
          <p className="page-subtitle">
            Vi erbjuder hyra av högkvalitativ dykutrustning för alla nivåer.
            Utrustningen ingår i kurserna — eller kan hyras separat.
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {loading ? (
          <Spinner />
        ) : activeEquipment.length === 0 ? (
          <div className="empty-state">
            <p>Ingen utrustning tillgänglig för tillfället.</p>
            <Link to="/kontakt" className="btn btn-primary">Kontakta oss</Link>
          </div>
        ) : (
          Object.entries(byCategory).map(([category, items]) => (
            <section key={category} style={{ marginBottom: '3rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>
                {CATEGORY_ICONS[category] || '🤿'} {category}
              </h2>
              <div className="grid grid-3">
                {items.map((item) => {
                  const available = item.quantity_available ?? item.quantity_total
                  const total     = item.quantity_total
                  const pct       = total > 0 ? (available / total) * 100 : 0
                  const statusColor = pct > 50 ? 'var(--green-600)' : pct > 0 ? 'var(--yellow-600)' : 'var(--red-600)'
                  const statusText  = available > 0 ? `${available} av ${total} tillgängliga` : 'Ej tillgänglig just nu'

                  return (
                    <Card key={item.id} className="equipment-card">
                      <div className="equipment-icon">
                        {CATEGORY_ICONS[item.category] || '🤿'}
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{item.name}</h3>
                      {item.size && (
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                          Storlek: {item.size}
                        </p>
                      )}
                      {item.description && (
                        <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                          {item.description}
                        </p>
                      )}
                      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                            {parseFloat(item.rental_price).toLocaleString('sv-SE')} kr<span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--gray-500)' }}>/dag</span>
                          </span>
                          <span style={{ fontSize: '0.8rem', color: statusColor, fontWeight: 500 }}>
                            {statusText}
                          </span>
                        </div>
                        <Link
                          to="/bokning"
                          className={`btn btn-primary btn-sm ${available === 0 ? 'btn-disabled' : ''}`}
                          style={{ width: '100%', textAlign: 'center' }}
                        >
                          {available > 0 ? 'Boka med utrustning' : 'Ej tillgänglig'}
                        </Link>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))
        )}

        {/* CTA */}
        <section className="cta-section" style={{ marginTop: '2rem' }}>
          <div className="cta-inner">
            <h2>Osäker på vad du behöver?</h2>
            <p>Kontakta oss så hjälper vi dig välja rätt utrustning för din nivå och kurs.</p>
            <Link to="/kontakt" className="btn btn-primary btn-lg">Kontakta oss</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
