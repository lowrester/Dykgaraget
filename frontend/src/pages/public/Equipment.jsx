import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useEquipmentStore, useCartStore, useSettingsStore, useUIStore } from '../../store/index.js'
import { Card, Spinner } from '../../components/common/index.jsx'

const CATEGORY_ICONS = {
  Våtdräkt: '🩱',
  BCD: '🦺',
  Mask: '🥽',
  Regulator: '🌬️',
  Dator: '⌚',
  Fenor: '🐟',
  Torrdräkt: '🧥',
  Merchandise: '👕',
  Tillbehör: '🎒',
  Övrigt: '🤿',
}

export default function Equipment() {
  const { equipment, fetch, loading } = useEquipmentStore()
  const { addItem } = useCartStore()
  const { features } = useSettingsStore()
  const { addToast } = useUIStore()

  useEffect(() => { fetch() }, [fetch])

  if (!features.equipment_sale) {
    return (
      <div className="page container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h1>Webshopen är tillfälligt stängd</h1>
        <p>Vi arbetar på att uppdatera vårt sortiment. Kontakta oss gärna direkt om du letar efter något speciellt.</p>
        <Link to="/kontakt" className="btn btn-primary" style={{ marginTop: '1rem' }}>Kontakta oss</Link>
      </div>
    )
  }

  // Gruppera per kategori - enbart försäljningsartiklar
  const saleArticles = equipment.filter((e) => e.is_active && e.is_for_sale)
  const byCategory = saleArticles.reduce((acc, item) => {
    const cat = item.category || 'Övrigt'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const handleBuy = (item) => {
    addItem({
      type: 'equipment',
      equipmentId: item.id,
      name: item.name,
      size: item.size,
      price: item.sale_price,
      vat_rate: 0.25
    })
    addToast(`${item.name} har lagts till i varukorgen!`)
  }

  return (
    <div className="page">
      {/* Hero */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Shop</h1>
          <p className="page-subtitle">
            Här hittar du dykutrustning av högsta kvalitet. Vi säljer allt från
            masker och fenor till avancerade dykdatorer och torrdräkter.
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {loading ? (
          <Spinner />
        ) : saleArticles.length === 0 ? (
          <div className="empty-state">
            <p>Inga produkter tillgängliga för försäljning just nu.</p>
            <Link to="/kontakt" className="btn btn-primary">Kontakta oss</Link>
          </div>
        ) : (
          Object.entries(byCategory).map(([category, items]) => (
            <section key={category} style={{ marginBottom: '4rem' }}>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid var(--blue-50)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{CATEGORY_ICONS[category] || '🤿'}</span> {category}
              </h2>
              <div className="grid grid-3">
                {items.map((item) => {
                  const available = (item.quantity_available ?? item.quantity_total) > 0

                  return (
                    <Card key={item.id} className="equipment-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div className="equipment-icon" style={{ fontSize: '3rem', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blue-50)', borderRadius: '12px', marginBottom: '1rem' }}>
                        {CATEGORY_ICONS[item.category] || '🤿'}
                      </div>
                      <h3 style={{ margin: '0 0 0.5rem' }}>{item.name}</h3>
                      {item.size && (
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.875rem', fontWeight: 500 }}>
                          Storlek: <span style={{ color: 'var(--blue-700)' }}>{item.size}</span>
                        </p>
                      )}
                      {item.description && (
                        <p style={{ margin: '1rem 0', fontSize: '0.9rem', color: 'var(--gray-600)', flex: 1, lineHeight: 1.5 }}>
                          {item.description}
                        </p>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--gray-100)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--blue-900)' }}>
                            {parseFloat(item.sale_price).toLocaleString('sv-SE')} kr
                          </span>
                          {!available && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 600, textTransform: 'uppercase' }}>
                              Slutsåld
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={!available}
                          className={`btn ${available ? 'btn-primary' : 'btn-disabled'}`}
                          style={{ width: '100%', padding: '0.75rem' }}
                        >
                          {available ? 'Köp nu' : 'Ej i lager'}
                        </button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))
        )}

        {/* Info Box */}
        {features.equipment_rent && (
          <div style={{ background: 'var(--blue-50)', padding: '2rem', borderRadius: '16px', marginTop: '4rem', display: 'flex', gap: '1.5rem', alignItems: 'center', border: '1px solid var(--blue-100)' }}>
            <div style={{ fontSize: '2.5rem' }}>🤿</div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--blue-900)' }}>Behöver du bara hyra utrustning för en kurs?</h3>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--blue-700)' }}>
                Utrustning för hyra väljer du enkelt till i samband med att du bokar en kurs.
                <Link to="/kurser" style={{ marginLeft: '0.5rem', fontWeight: 'bold', textDecoration: 'underline' }}>Se våra kurser här &rarr;</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
