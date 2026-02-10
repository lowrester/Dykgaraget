import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/index.js'
import { AdminLayout, Card, Alert, Spinner } from '../../components/common/index.jsx'

const FEATURE_META = {
  equipment: {
    label: 'Utrustningsmodul',
    icon:  '🤿',
    desc:  'Utrustningshantering, inventarie och uthyrning vid bokning.',
    deps:  [],
  },
  invoicing: {
    label: 'Faktureringsmodul',
    icon:  '🧾',
    desc:  'PDF-fakturering och e-postutskick till kunder.',
    deps:  [],
    required_by: ['payment'],
  },
  payment: {
    label: 'Betalningsmodul',
    icon:  '💳',
    desc:  'Onlinebetalning via Stripe. Kräver att faktureringsmodulen är aktiverad.',
    deps:  ['invoicing'],
  },
  email: {
    label: 'E-postmodul',
    icon:  '✉️',
    desc:  'Bokningsbekräftelser och fakturanotiser via e-post.',
    deps:  [],
  },
}

export default function FeatureSettings() {
  const { features, settings, fetchFeatures, fetchSettings, updateSetting } = useSettingsStore()
  const [alert,   setAlert]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchFeatures()
  }, [fetchSettings, fetchFeatures])

  const handleToggle = async (key, currentValue) => {
    const newValue = !currentValue
    const meta = FEATURE_META[key]

    // Block enabling payment without invoicing
    if (key === 'payment' && newValue && !features.invoicing) {
      setAlert({ type:'error', msg:'Faktureringsmodulen måste vara aktiverad innan betalningsmodulen kan aktiveras.' })
      return
    }

    // Warn when disabling invoicing (will also disable payment)
    if (key === 'invoicing' && !newValue && features.payment) {
      if (!window.confirm('Betalningsmodulen kräver fakturering. Båda inaktiveras — fortsätt?')) return
    }

    setLoading(true)
    try {
      await updateSetting(`feature_${key}`, String(newValue))
      setAlert({ type:'success', msg: `${meta.label} ${newValue ? 'aktiverad' : 'inaktiverad'}` })
    } catch (err) {
      setAlert({ type:'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Company settings (non-feature)
  const companySettings = settings.filter(s => s.category === 'company')
  const invoiceSettings = settings.filter(s => s.category === 'invoicing')

  return (
    <AdminLayout title="Inställningar">
      {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* Feature Toggles */}
      <Card style={{marginBottom:'2rem'}}>
        <h2 style={{marginBottom:'1.5rem'}}>Moduler</h2>
        <div className="feature-grid">
          {Object.entries(FEATURE_META).map(([key, meta]) => {
            const enabled  = features[key]
            const blocked  = meta.deps.some(dep => !features[dep])

            return (
              <div key={key} className={`feature-card ${enabled ? 'enabled' : ''} ${blocked ? 'blocked' : ''}`}>
                <div className="feature-icon">{meta.icon}</div>
                <div className="feature-info">
                  <h3>{meta.label}</h3>
                  <p>{meta.desc}</p>
                  {blocked && <p className="feature-dep-warning">⚠ Kräver: {meta.deps.map(d => FEATURE_META[d]?.label).join(', ')}</p>}
                  {meta.required_by?.length > 0 && enabled && (
                    <p className="feature-dep-info">ℹ Krävs av: {meta.required_by.map(d => FEATURE_META[d]?.label).join(', ')}</p>
                  )}
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!enabled}
                    disabled={loading || blocked}
                    onChange={() => handleToggle(key, enabled)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            )
          })}
        </div>
        {loading && <div style={{marginTop:'1rem'}}><Spinner text="Uppdaterar..." /></div>}
      </Card>

      {/* Company Settings */}
      {companySettings.length > 0 && (
        <Card style={{marginBottom:'2rem'}}>
          <h2 style={{marginBottom:'1rem'}}>Företagsinformation</h2>
          <p style={{color:'var(--gray-500)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            Används i genererade PDF-fakturor.
          </p>
          <table className="admin-table">
            <tbody>
              {companySettings.map(s => (
                <tr key={s.key}>
                  <td style={{width:'40%'}}><strong>{s.description}</strong></td>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{marginTop:'1rem',color:'var(--gray-400)',fontSize:'0.8rem'}}>
            Ändra via databasen eller API: <code>PUT /api/settings/company_name</code>
          </p>
        </Card>
      )}

      {/* Invoice Settings */}
      {invoiceSettings.length > 0 && (
        <Card>
          <h2 style={{marginBottom:'1rem'}}>Fakturainställningar</h2>
          <table className="admin-table">
            <tbody>
              {invoiceSettings.map(s => (
                <tr key={s.key}>
                  <td style={{width:'40%'}}><strong>{s.description}</strong></td>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AdminLayout>
  )
}
