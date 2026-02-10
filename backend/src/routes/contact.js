import express from 'express'
import { sendEmail } from '../services/email.js'

const router = express.Router()

// POST /api/contact  (publik)
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Namn, e-post och meddelande krävs' })
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    await sendEmail({
      to:      process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || 'info@dykgaraget.se',
      subject: `[Kontaktformulär] ${subject || 'Nytt meddelande'} – ${name}`,
      html: `
        <h2>Nytt meddelande från kontaktformuläret</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
          <tr><td style="padding:6px 16px 6px 0;color:#666;font-weight:600">Namn:</td><td>${name}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#666;font-weight:600">E-post:</td><td><a href="mailto:${email}">${email}</a></td></tr>
          ${subject ? `<tr><td style="padding:6px 16px 6px 0;color:#666;font-weight:600">Ämne:</td><td>${subject}</td></tr>` : ''}
          <tr><td style="padding:6px 16px 6px 0;color:#666;font-weight:600;vertical-align:top">Meddelande:</td>
              <td style="white-space:pre-wrap">${message}</td></tr>
        </table>
        <p style="margin-top:16px;color:#999;font-size:12px">Skickat från Dykgaraget kontaktformulär</p>
      `,
    })

    res.json({ ok: true })
  } catch (err) {
    // Om email inte är konfigurerat – logga men returnera OK (degraded gracefully)
    console.warn('Contact email failed (email may not be configured):', err.message)
    res.json({ ok: true, warning: 'Email ej skickat — kontrollera email-konfiguration' })
  }
})

export default router
