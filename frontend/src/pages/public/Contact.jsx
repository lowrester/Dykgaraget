import { useState } from 'react'
import { Card, Button, Alert } from '../../components/common/index.jsx'

export default function Contact() {
  const [form, setForm]       = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="page container">
      <h1 className="page-title">Kontakta oss</h1>

      <div className="grid grid-2 contact-grid">
        <div>
          <h2>Kontaktuppgifter</h2>
          <div className="contact-info">
            <p>📍 Dykgatan 1, 123 45 Stockholm</p>
            <p>📞 <a href="tel:0701234567">070-123 45 67</a></p>
            <p>✉️ <a href="mailto:info@dykgaraget.se">info@dykgaraget.se</a></p>
          </div>
          <h2 style={{marginTop:'2rem'}}>Öppettider</h2>
          <table className="hours-table">
            <tbody>
              <tr><td>Måndag – Fredag</td><td>09:00 – 18:00</td></tr>
              <tr><td>Lördag</td><td>09:00 – 15:00</td></tr>
              <tr><td>Söndag</td><td>Stängt</td></tr>
            </tbody>
          </table>
        </div>

        <Card>
          <h2>Skicka meddelande</h2>
          {submitted ? (
            <Alert type="success">Tack! Vi återkommer till dig inom 1–2 arbetsdagar.</Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Namn *</label>
                <input className="form-input" type="text" required value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">E-post *</label>
                <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ämne</label>
                <input className="form-input" type="text" value={form.subject} onChange={(e) => setForm(f => ({...f, subject: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Meddelande *</label>
                <textarea className="form-input form-textarea" required rows={4} value={form.message} onChange={(e) => setForm(f => ({...f, message: e.target.value}))} />
              </div>
              <Button type="submit" className="btn-full">Skicka meddelande</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
