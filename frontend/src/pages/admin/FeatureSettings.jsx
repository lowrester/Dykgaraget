import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/index.js'
import { AdminLayout, Card, Alert, Spinner, Button } from '../../components/common/index.jsx'

const FEATURE_META = {
  equipment: { label:'Utrustningsmodul', icon:'🤿',  desc:'Utrustningshantering, inventarie och uthyrning vid bokning.', deps:[] },
  invoicing: { label:'Faktureringsmodul', icon:'🧾',  desc:'PDF-fakturering och e-postutskick till kunder.', deps:[], required_by:['payment'] },
  payment:   { label:'Betalningsmodul',   icon:'💳',  desc:'Onlinebetalning via Stripe. Kräver att faktureringsmodulen är aktiverad.', deps:['invoicing'] },
  email:     { label:'E-postmodul',       icon:'✉️',  desc:'Bokningsbekräftelser och fakturanotiser via e-post.', deps:[] },
}

const COMPANY_LABELS = {
  company_name:        'Företagsnamn',
  company_org_number:  'Org.nummer',
  company_address:     'Adress',
  company_phone:       'Telefon',
  company_email:       'E-post',
  company_bank_account:'Bankgiro / konto',
}

const INVOICE_LABELS = {
  invoice_vat_rate:    'Momssats',
  invoice_terms_days:  'Betalningsvillkor (dagar)',
  invoice_prefix:      'Fakturanummer-prefix',
}

export default function FeatureSettings() {
  const { features, settings, fetchFeatures, fetchSettings, updateSetting } = useSettingsStore()
  const [alert,      setAlert]    = useState(null)
  const [toggling,   setToggling] = useState(false)
  const [editKey,    setEditKey]  = useState(null)   // vilket settings-nyckel redigeras
  const [editValue,  setEditValue] = useState('')
  const [saving,     setSaving]   = useState(false)

  useEffect(() => { fetchSettings(); fetchFeatures() }, [fetchSettings, fetchFeatures])

  const handleToggle = async (key, currentValue) => {
    const newValue = !currentValue
    const meta = FEATURE_META[key]
    if (key === 'payment' && newValue && !features.invoicing) {
      setAlert({ type:'error', msg:'Faktureringsmodulen måste vara aktiverad innan betalningsmodulen kan aktiveras.' })
      return
    }
    if (key === 'invoicing' && !newValue && features.payment) {
      if (!window.confirm('Betalningsmodulen kräver fakturering. Båda inaktiveras — fortsätt?')) return
    }
    setToggling(true)
    try {
      await updateSetting(`feature_${key}`, String(newValue))
      setAlert({ type:'success', msg:`${meta.label} ${newValue ? 'aktiverad' : 'inaktiverad'}` })
    } catch (err) {
      setAlert({ type:'error', msg: err.message })
    } finally { setToggling(false) }
  }

  const startEdit = (key, value) => { setEditKey(key); setEditValue(value || '') }
  const cancelEdit = () => { setEditKey(null); setEditValue('') }

  const saveEdit = async () => {
    if (!editKey) return
    setSaving(true)
    try {
      await updateSetting(editKey, editValue)
      setAlert({ type:'success', msg:'Inställning sparad' })
      cancelEdit()
    } catch (err) {
      setAlert({ type:'error', msg: err.message })
    } finally { setSaving(false) }
  }

  const getSetting = (key) => settings.find(s => s.key === key)?.value || ''

  const companySettings = settings.filter(s => s.category === 'company')
  const invoiceSettings = settings.filter(s => s.category === 'invoicing')

  return (
    <AdminLayout title="Inställningar">
      {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* ── Moduler ─────────────────────────────────── */}
      <Card style={{marginBottom:'2rem'}}>
        <h2 style={{marginBottom:'1.5rem'}}>Moduler</h2>
        <div className="feature-grid">
          {Object.entries(FEATURE_META).map(([key, meta]) => {
            const enabled = features[key]
            const blocked = meta.deps.some(dep => !features[dep])
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
                  <input type="checkbox" checked={!!enabled} disabled={toggling || blocked} onChange={() => handleToggle(key, enabled)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            )
          })}
        </div>
        {toggling && <div style={{marginTop:'1rem'}}><Spinner text="Uppdaterar..." /></div>}
      </Card>

      {/* ── Företagsinformation (redigerbart) ────────── */}
      {companySettings.length > 0 && (
        <Card style={{marginBottom:'2rem'}}>
          <h2 style={{marginBottom:'0.5rem'}}>Företagsinformation</h2>
          <p style={{color:'var(--gray-500)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            Visas i genererade PDF-fakturor.
          </p>
          <table className="admin-table">
            <tbody>
              {companySettings.map(s => (
                <tr key={s.key}>
                  <td style={{width:'38%',fontWeight:600}}>
                    {COMPANY_LABELS[s.key] || s.description || s.key}
                  </td>
                  <td>
                    {editKey === s.key ? (
                      <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                        <input className="form-input" style={{marginBottom:0}} autoFocus
                          value={editValue} onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') cancelEdit() }} />
                        <Button size="sm" onClick={saveEdit} loading={saving}>Spara</Button>
                        <Button size="sm" variant="secondary" onClick={cancelEdit}>Avbryt</Button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                        <span style={{color: s.value ? 'var(--gray-700)' : 'var(--gray-300)', fontStyle: s.value ? 'normal' : 'italic'}}>
                          {s.value || 'Ej angett'}
                        </span>
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)} style={{marginLeft:'auto', opacity:0.7}}>
                          ✎ Redigera
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Fakturainställningar (redigerbart) ──────── */}
      {invoiceSettings.length > 0 && (
        <Card>
          <h2 style={{marginBottom:'0.5rem'}}>Fakturainställningar</h2>
          <p style={{color:'var(--gray-500)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            Inställningar för fakturagenerering och betalningsvillkor.
          </p>
          <table className="admin-table">
            <tbody>
              {invoiceSettings.map(s => (
                <tr key={s.key}>
                  <td style={{width:'38%',fontWeight:600}}>
                    {INVOICE_LABELS[s.key] || s.description || s.key}
                  </td>
                  <td>
                    {editKey === s.key ? (
                      <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                        <input className="form-input" style={{marginBottom:0}} autoFocus
                          value={editValue} onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') cancelEdit() }} />
                        <Button size="sm" onClick={saveEdit} loading={saving}>Spara</Button>
                        <Button size="sm" variant="secondary" onClick={cancelEdit}>Avbryt</Button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                        <span style={{color: s.value ? 'var(--gray-700)' : 'var(--gray-300)', fontStyle: s.value ? 'normal' : 'italic'}}>
                          {s.value || 'Ej angett'}
                        </span>
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)} style={{marginLeft:'auto', opacity:0.7}}>
                          ✎ Redigera
                        </button>
                      </div>
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
