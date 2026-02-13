import { useEffect, useState } from 'react'
import { useSettingsStore, useUIStore, useHealthStore } from '../../store/index.js'
import { AdminLayout, Card, Spinner, Button, Badge, Input, Textarea } from '../../components/common/index.jsx'

const FEATURE_META = {
  equipment: { label: 'Utrustningsmodul', icon: '🤿', desc: 'Utrustningshantering, inventarie och uthyrning vid bokning.', deps: [] },
  invoicing: { label: 'Faktureringsmodul', icon: '🧾', desc: 'PDF-fakturering och e-postutskick till kunder.', deps: [], required_by: ['payment'] },
  payment: { label: 'Betalningsmodul', icon: '💳', desc: 'Onlinebetalning via Stripe. Kräver att faktureringsmodulen är aktiverad.', deps: ['invoicing'] },
  email: { label: 'E-postmodul', icon: '✉️', desc: 'Bokningsbekräftelser och fakturanotiser via e-post.', deps: [] },
}

const COMPANY_LABELS = {
  company_name: 'Företagsnamn',
  company_org_number: 'Org.nummer',
  company_address: 'Adress',
  company_phone: 'Telefon',
  company_email: 'E-post',
  company_bank_account: 'Bankgiro / konto',
  company_f_skatt: 'Godkänd för F-skatt',
}

const INVOICE_LABELS = {
  invoice_vat_rate: 'Momssats (t.ex. 0.25)',
  invoice_terms_days: 'Betalningsvillkor (dagar)',
  invoice_prefix: 'Fakturanummer-prefix',
}

const EMAIL_LABELS = {
  email_sendgrid_key: 'SendGrid API Key',
  email_from: 'Avsändar-epost',
  email_from_name: 'Avsändarnamn',
}

const CONTENT_GROUP_LABELS = {
  home: 'Hem-sidan',
  courses: 'Kurser-sidan',
  contact: 'Kontakt-sidan',
  common: 'Gemensamt'
}

export default function FeatureSettings() {
  const { features, settings, fetchFeatures, fetchSettings, updateSetting, loading } = useSettingsStore()
  const { status: health, check: checkHealth } = useHealthStore()
  const { addToast, ask } = useUIStore()
  const [activeTab, setActiveTab] = useState('modules') // modules, info, content, system, payment

  const [toggling, setToggling] = useState(false)
  const [editKey, setEditKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchFeatures()
    checkHealth()
  }, [fetchSettings, fetchFeatures, checkHealth])

  const handleToggle = async (key, currentValue) => {
    const newValue = !currentValue
    const meta = FEATURE_META[key]
    if (key === 'payment' && newValue && !features.invoicing) {
      addToast('Faktureringsmodulen måste vara aktiverad innan betalningsmodulen kan aktiveras.', 'error')
      return
    }
    if (key === 'invoicing' && !newValue && features.payment) {
      const ok = await ask({ title: 'Betalningsmodul kräver fakturering', message: 'Betalningsmodulen kräver fakturering. Om du inaktiverar fakturering kommer även betalningar att inaktiveras. Fortsätt?', type: 'danger', confirmText: 'Inaktivera båda' })
      if (!ok) return
    }
    setToggling(true)
    try {
      await updateSetting(`feature_${key}`, String(newValue))
      addToast(`${meta.label} ${newValue ? 'aktiverad' : 'inaktiverad'}`)
    } catch (err) { addToast(err.message, 'error') }
    finally { setToggling(false) }
  }

  const startEdit = (key, value) => { setEditKey(key); setEditValue(value || '') }
  const cancelEdit = () => { setEditKey(null); setEditValue('') }

  const saveEdit = async () => {
    if (!editKey) return
    setSaving(true)
    try {
      await updateSetting(editKey, editValue)
      addToast('Inställning sparad')
      cancelEdit()
    } catch (err) { addToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const companySettings = settings.filter(s => s.category === 'company')
  const invoiceSettings = settings.filter(s => s.category === 'invoicing')
  const emailSettings = settings.filter(s => s.category === 'email' || s.key.startsWith('email_'))
  const contentSettings = settings.filter(s => s.key.startsWith('content_'))
  const paymentSettings = settings.filter(s => s.category === 'payment' || s.key.startsWith('stripe_'))

  // Group content
  const contentGroups = contentSettings.reduce((acc, s) => {
    const groupName = s.key.split('_')[1] || 'Övrigt'
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(s)
    return acc
  }, {})

  const tabs = [
    { id: 'modules', label: 'Moduler', icon: '🧩' },
    { id: 'info', label: 'Företag & Faktura', icon: '🏢' },
    { id: 'email', label: 'E-post', icon: '✉️' },
    { id: 'content', label: 'Webb-innehåll', icon: '✍️' },
    { id: 'payment', label: 'Betal-API', icon: '💳' },
    { id: 'system', label: 'Systemstatus', icon: '🛡️' },
  ]

  return (
    <AdminLayout title="Inställningar">
      <div className="tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--gray-200)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem', border: 'none', background: 'none',
              fontWeight: activeTab === tab.id ? 700 : 400,
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {loading && settings.length === 0 ? <Spinner /> : (
        <>
          {/* 🧩 TAB: Modules */}
          {activeTab === 'modules' && (
            <Card>
              <h2 style={{ marginBottom: '1.5rem' }}>Modulhantering</h2>
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
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={!!enabled} disabled={toggling || blocked} onChange={() => handleToggle(key, enabled)} />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  )
                })}
              </div>
              {toggling && <div style={{ marginTop: '1rem' }}><Spinner text="Uppdaterar..." /></div>}
              <h2 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Inloggning & Registrering</h2>
              <div style={{ maxWidth: '400px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                  Bestäm hur kontoskapande ska fungera för nya kunder vid köp i kassan.
                </p>
                <Select
                  label="Registreringsläge i kassan"
                  value={settings.find(s => s.key === 'checkout_registration_mode')?.value || 'optional'}
                  onChange={(e) => updateSetting('checkout_registration_mode', e.target.value)}
                  disabled={loading}
                >
                  <option value="disabled">Avstängt (Ingen registrering möjlig)</option>
                  <option value="optional">Valfritt (Bockas i av kunden)</option>
                  <option value="mandatory">Tvingande (Konto skapas alltid)</option>
                </Select>
              </div>
            </Card>
          )}

          {/* 🏢 TAB: Info */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <Card>
                <h2>Företagsinformation</h2>
                <table className="admin-table">
                  <tbody>
                    {companySettings.map(s => (
                      <tr key={s.key}>
                        <td style={{ width: '40%', fontWeight: 600 }}>{COMPANY_LABELS[s.key] || s.description || s.key}</td>
                        <td>
                          {editKey === s.key ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}><Input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ marginBottom: 0 }} autoFocus /><Button size="sm" onClick={saveEdit} loading={saving}>Ok</Button><Button size="sm" variant="secondary" onClick={cancelEdit}>X</Button></div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{s.value || '—'}</span><button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)}>✎</button></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card>
                <h2>Fakturainställningar</h2>
                <table className="admin-table">
                  <tbody>
                    {invoiceSettings.map(s => (
                      <tr key={s.key}>
                        <td style={{ width: '40%', fontWeight: 600 }}>{INVOICE_LABELS[s.key] || s.description || s.key}</td>
                        <td>
                          {editKey === s.key ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}><Input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ marginBottom: 0 }} autoFocus /><Button size="sm" onClick={saveEdit} loading={saving}>Ok</Button><Button size="sm" variant="secondary" onClick={cancelEdit}>X</Button></div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{s.value || '—'}</span><button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)}>✎</button></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ✍️ TAB: Content */}
          {activeTab === 'content' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(contentGroups).map(([groupId, items]) => (
                <Card key={groupId}>
                  <h2 style={{ textTransform: 'capitalize' }}>{CONTENT_GROUP_LABELS[groupId] || groupId}</h2>
                  <table className="admin-table">
                    <tbody>
                      {items.map(s => (
                        <tr key={s.key}>
                          <td style={{ width: '30%', fontWeight: 600, fontSize: '0.85rem' }}>{s.description || s.key.replace('content_', '')}</td>
                          <td>
                            {editKey === s.key ? (
                              <div style={{ display: 'flex', gap: '0.5rem' }}><Textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{ marginBottom: 0 }} autoFocus /><Button size="sm" onClick={saveEdit} loading={saving}>Ok</Button><Button size="sm" variant="secondary" onClick={cancelEdit}>X</Button></div>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{s.value}</span><button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)}>✎</button></div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ))}
            </div>
          )}

          {/* ✉️ TAB: Email */}
          {activeTab === 'email' && (
            <Card>
              <h2 style={{ marginBottom: '1.5rem' }}>E-postinställningar</h2>
              <div style={{ padding: '1rem', background: 'var(--blue-50)', borderRadius: '8px', border: '1px solid var(--blue-100)', marginBottom: '2rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--blue-700)', margin: 0 }}>
                  Dessa inställningar används för automatiska bekräftelser och fakturor.
                  Standardmetoden är <strong>SendGrid</strong>. Om ingen nyckel anges används en lokal loggmetod för test.
                </p>
              </div>
              <table className="admin-table">
                <tbody>
                  {emailSettings.length === 0 && <tr><td className="empty">Inga e-postinställningar hittades i databasen</td></tr>}
                  {emailSettings.map(s => (
                    <tr key={s.key}>
                      <td style={{ width: '40%', fontWeight: 600 }}>{EMAIL_LABELS[s.key] || s.description || s.key}</td>
                      <td>
                        {editKey === s.key ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Input
                              type={s.key.includes('key') ? 'password' : 'text'}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              style={{ marginBottom: 0 }}
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEdit} loading={saving}>Ok</Button>
                            <Button size="sm" variant="secondary" onClick={cancelEdit}>X</Button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{s.key.includes('key') ? '********' : (s.value || '—')}</span>
                            <button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)}>✎</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 💳 TAB: Payment */}
          {activeTab === 'payment' && (
            <Card>
              <h2 style={{ marginBottom: '0.5rem' }}>Betalningsmetoder och API</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Systemet är konfigurerat för <strong>automatisk fakturering</strong> vid bokning.
                Fakturor skapas med status "Obetald" och skickas/visas för kunden direkt.
              </p>

              <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--gray-200)', marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Kortbetalning (Valfritt)</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', margin: 0 }}>
                  Vill du erbjuda direkt kortbetalning? Aktivera <em>Betalningsmodul</em> i fliken <strong>Moduler</strong> och fyll i dina Stripe-nycklar nedan.
                  Vid kortbetalning markeras den automatiska fakturan som "Betald" direkt.
                </p>
              </div>

              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Stripe API-inställningar</h3>
              <table className="admin-table">
                <tbody>
                  {paymentSettings.length === 0 && <tr><td className="empty">Inga betalinställningar hittades i databasen</td></tr>}
                  {paymentSettings.map(s => (
                    <tr key={s.key}>
                      <td style={{ width: '40%', fontWeight: 600 }}>{s.description || s.key}</td>
                      <td>
                        {editKey === s.key ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}><Input type="password" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ marginBottom: 0 }} autoFocus /><Button size="sm" onClick={saveEdit} loading={saving}>Ok</Button><Button size="sm" variant="secondary" onClick={cancelEdit}>X</Button></div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><code>{s.value?.substring(0, 8)}********</code><button className="btn btn-sm btn-ghost" onClick={() => startEdit(s.key, s.value)}>✎</button></div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--blue-50)', borderRadius: '8px', border: '1px solid var(--blue-100)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--blue-700)', margin: 0 }}>
                  <strong>Tips:</strong> Se till att din Stripe Webhook URL är inställd på <code>https://api.dykgaraget.se/api/payments/webhook</code> för att hantera bekräftelser korrekt i produktion.
                </p>
              </div>
            </Card>
          )}

          {/* 🛡️ TAB: System */}
          {activeTab === 'system' && (
            <div className="grid grid-2">
              <Card>
                <h2>Systemhälsa</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Backend Server</span>
                    <Badge variant={health.backend === 'online' ? 'success' : 'danger'}>{health.backend.toUpperCase()}</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Database Connection</span>
                    <Badge variant={health.api === 'healthy' ? 'success' : 'warning'}>{health.api.toUpperCase()}</Badge>
                  </div>
                  <Button variant="secondary" size="sm" onClick={checkHealth} style={{ marginTop: '1rem' }}>Uppdatera hälsa</Button>
                </div>
              </Card>
              <Card>
                <h2>Versionsinfo</h2>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  <p><strong>Version:</strong> 1.3.0-rc1</p>
                  <p><strong>Miljö:</strong> {process.env.NODE_ENV}</p>
                  <p><strong>Senaste Deploy:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                  <hr style={{ opacity: 0.1, margin: '1rem 0' }} />
                  <p style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>Automatiskt update-system aktivt via <code>update.sh</code>.</p>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
