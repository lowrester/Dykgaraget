import { useState, useEffect } from 'react'
import { Card, Button, Alert } from '../../components/common/index.jsx'
import { api } from '../../api/client.js'
import { useSettingsStore } from '../../store/index.js'

export default function Contact() {
  const content = useSettingsStore(s => s.content)
  const fetchSettings = useSettingsStore(s => s.fetchSettings)

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const t = (key, fallback) => content[key] || fallback

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/contact', form)
      setSubmitted(true)
    } catch (err) {
      if (err.message?.includes('warning') || err.status >= 200) {
        setSubmitted(true)
      } else {
        setError(err.message || 'Något gick fel. Försök igen eller ring oss direkt.')
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="page container">
      <h1 className="page-title">{t('contact_title', 'Kontakta oss')}</h1>

      <div className="grid grid-2 contact-grid">
        {/* ── Kontaktinfo ─────────────────────────────── */}
        <div className="contact-info">
          <h2>{t('contact_info_title', 'Kontaktuppgifter')}</h2>
          <div className="contact-item">
            <span className="contact-icon">📍</span>
            <div>
              <div className="contact-item-label">Adress</div>
              <div className="contact-item-value">{content.company_address || 'Dykgatan 1, 123 45 Stockholm'}</div>
            </div>
          </div>
          <div className="contact-item">
            <span className="contact-icon">📞</span>
            <div>
              <div className="contact-item-label">Telefon</div>
              <div className="contact-item-value">
                <a href={`tel:${(content.company_phone || '070-123 45 67').replace(/\s+/g, '')}`}>
                  {content.company_phone || '070-123 45 67'}
                </a>
              </div>
            </div>
          </div>
          <div className="contact-item">
            <span className="contact-icon">✉️</span>
            <div>
              <div className="contact-item-label">E-post</div>
              <div className="contact-item-value">
                <a href={`mailto:${content.company_email || 'info@dykgaraget.se'}`}>
                  {content.company_email || 'info@dykgaraget.se'}
                </a>
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
            {t('contact_hours_title', 'Öppettider')}
          </h3>
          <table className="hours-table">
            <tbody>
              <tr><td>Måndag – Fredag</td><td>{t('contact_hours_monfri', '09:00 – 18:00')}</td></tr>
              <tr><td>Lördag</td>         <td>{t('contact_hours_sat', '09:00 – 15:00')}</td></tr>
              <tr><td>Söndag</td>         <td>{t('contact_hours_sun', 'Stängt')}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Kontaktformulär ──────────────────────────── */}
        <Card>
          <h2 style={{ marginBottom: '1.25rem' }}>{t('contact_form_title', 'Skicka meddelande')}</h2>
          {submitted ? (
            <Alert type="success">
              Tack! Vi återkommer till dig inom 1–2 arbetsdagar.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}
              <div className="form-group">
                <label className="form-label">Namn *</label>
                <input className="form-input" type="text" required value={form.name}
                  onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-post *</label>
                <input className="form-input" type="email" required value={form.email}
                  onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ämne</label>
                <input className="form-input" type="text" value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  placeholder="Kursförfrågan, utrustning, övrigt..." />
              </div>
              <div className="form-group">
                <label className="form-label">Meddelande *</label>
                <textarea className="form-input form-textarea" required rows={4}
                  value={form.message} onChange={e => set('message', e.target.value)}
                  placeholder="Berätta vad vi kan hjälpa dig med..." />
              </div>
              <Button type="submit" className="btn-full" loading={loading}>
                Skicka meddelande
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
