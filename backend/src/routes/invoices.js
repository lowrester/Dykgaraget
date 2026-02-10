import express from 'express'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { pool } from '../db/connection.js'
import { authenticateAdmin, checkFeature } from '../middleware/auth.js'
import { sendEmail } from '../services/email.js'

const router = express.Router()
router.use(checkFeature('invoicing'))

// GET /api/invoices  (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/invoices/:id
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faktura hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/invoices  – create from booking
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { booking_id } = req.body
    if (!booking_id) return res.status(400).json({ error: 'booking_id krävs' })

    // Fetch booking
    const bookingRes = await pool.query(
      'SELECT * FROM bookings WHERE id = $1', [booking_id]
    )
    if (bookingRes.rows.length === 0) return res.status(404).json({ error: 'Bokning hittades inte' })
    const booking = bookingRes.rows[0]

    // Invoice prefix from settings
    const prefixRes = await pool.query(
      "SELECT value FROM settings WHERE key = 'invoice_prefix'"
    )
    const prefix = prefixRes.rows[0]?.value || 'DYK'

    const termsRes = await pool.query(
      "SELECT value FROM settings WHERE key = 'invoice_terms_days'"
    )
    const termsDays = parseInt(termsRes.rows[0]?.value || '30')

    const vatRes = await pool.query(
      "SELECT value FROM settings WHERE key = 'invoice_vat_rate'"
    )
    const vatRate = parseFloat(vatRes.rows[0]?.value || '0.25')

    const subtotal = parseFloat(booking.total_price) / (1 + vatRate)
    const vatAmount = parseFloat(booking.total_price) - subtotal
    const totalAmount = parseFloat(booking.total_price)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + termsDays)

    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(await nextSeq(pool)).padStart(4, '0')}`

    const result = await pool.query(
      `INSERT INTO invoices
         (booking_id, invoice_number, buyer_name, buyer_email,
          subtotal, vat_rate, vat_amount, total_amount, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid') RETURNING *`,
      [booking_id, invoiceNumber,
        `${booking.first_name} ${booking.last_name}`, booking.email,
        subtotal.toFixed(2), vatRate, vatAmount.toFixed(2), totalAmount.toFixed(2),
        dueDate.toISOString().split('T')[0]]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/invoices/:id/pdf  – download PDF
router.get('/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Faktura hittades inte' })

    const company = await getCompanySettings()
    const filepath = await generatePDF(invoice, company)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`)
    fs.createReadStream(filepath).pipe(res)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/invoices/:id/email  – send PDF via email
router.post('/:id/email', authenticateAdmin, async (req, res) => {
  try {
    const featureCheck = await pool.query(
      "SELECT value FROM settings WHERE key = 'feature_email'"
    )
    if (featureCheck.rows[0]?.value !== 'true') {
      return res.status(403).json({ error: 'Email-modulen är inte aktiverad' })
    }

    const invoice = await getInvoice(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Faktura hittades inte' })

    const company = await getCompanySettings()
    const filepath = await generatePDF(invoice, company)

    await sendEmail({
      to: invoice.buyer_email,
      subject: `Faktura ${invoice.invoice_number} från ${company.name}`,
      html: `
        <h2>Hej ${invoice.buyer_name}!</h2>
        <p>Tack för din bokning hos ${company.name}.</p>
        <p>Bifogad finner du faktura <strong>${invoice.invoice_number}</strong>.</p>
        <table style="border-collapse:collapse;margin:1em 0">
          <tr><td style="padding:4px 12px 4px 0"><strong>Fakturanummer:</strong></td><td>${invoice.invoice_number}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Förfallodatum:</strong></td><td>${new Date(invoice.due_date).toLocaleDateString('sv-SE')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Totalt att betala:</strong></td><td><strong>${parseFloat(invoice.total_amount).toLocaleString('sv-SE')} kr</strong></td></tr>
        </table>
        <p>Bankkontonummer: ${company.bank}</p>
        <p>Referens: ${invoice.invoice_number}</p>
        <br><p>Vänliga hälsningar,<br>${company.name}</p>
      `,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, path: filepath }]
    })

    await pool.query(
      'UPDATE invoices SET emailed_at = NOW(), pdf_generated = true, pdf_path = $1 WHERE id = $2',
      [filepath, req.params.id]
    )

    res.json({ success: true, message: `Faktura skickad till ${invoice.buyer_email}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/invoices/:id/paid  (admin marks as paid)
router.put('/:id/paid', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faktura hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Helpers ───────────────────────────────────────────────────

async function nextSeq(pool) {
  const r = await pool.query("SELECT nextval('invoice_number_seq')")
  return r.rows[0].nextval
}

async function getInvoice(id) {
  const r = await pool.query('SELECT * FROM invoices WHERE id = $1', [id])
  return r.rows[0] || null
}

async function getCompanySettings() {
  const r = await pool.query("SELECT key, value FROM settings WHERE category = 'company'")
  return r.rows.reduce((acc, row) => {
    acc[row.key.replace('company_', '')] = row.value
    return acc
  }, {})
}

async function generatePDF(invoice, company) {
  const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'invoices')
  fs.mkdirSync(dir, { recursive: true })
  const filepath = path.join(dir, `${invoice.invoice_number}.pdf`)

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const stream = fs.createWriteStream(filepath)
  doc.pipe(stream)

  // ── Header ──────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').text(company.name || 'Dykgaraget AB', 50, 50)
  doc.fontSize(9).font('Helvetica')
  let y = 78
  if (company.address) { doc.text(company.address, 50, y); y += 14 }
  if (company.org_number) { doc.text(`Org.nr: ${company.org_number}`, 50, y); y += 14 }
  if (company.vat_number) { doc.text(`VAT: ${company.vat_number}`, 50, y); y += 14 }
  if (company.email) { doc.text(`E-post: ${company.email}`, 50, y); y += 14 }
  if (company.phone) { doc.text(`Tel: ${company.phone}`, 50, y) }

  // ── Invoice title (right) ───────────────────────────────────
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#0066CC').text('FAKTURA', 350, 50, { align: 'right' })
  doc.fillColor('#000000').fontSize(9).font('Helvetica')
  doc.text(`Nr: ${invoice.invoice_number}`, 350, 90, { align: 'right' })
  doc.text(`Datum: ${new Date(invoice.invoice_date).toLocaleDateString('sv-SE')}`, 350, 104, { align: 'right' })
  doc.text(`Förfaller: ${new Date(invoice.due_date).toLocaleDateString('sv-SE')}`, 350, 118, { align: 'right' })
  const statusLabel = invoice.status === 'paid' ? '✓ BETALD' : 'OBETALD'
  doc.fontSize(11).font('Helvetica-Bold')
    .fillColor(invoice.status === 'paid' ? '#2E7D32' : '#DC2626')
    .text(statusLabel, 350, 136, { align: 'right' })
  doc.fillColor('#000000')

  // ── Divider ─────────────────────────────────────────────────
  doc.moveTo(50, 165).lineTo(545, 165).lineWidth(1).strokeColor('#0066CC').stroke()

  // ── Buyer ───────────────────────────────────────────────────
  doc.fontSize(9).font('Helvetica-Bold').text('KUND', 50, 180)
  doc.font('Helvetica')
  doc.text(invoice.buyer_name || '', 50, 194)
  doc.text(invoice.buyer_address || '', 50, 208)
  doc.text(invoice.buyer_email || '', 50, 222)

  // ── Line items table ─────────────────────────────────────────
  const tableTop = 265
  doc.fontSize(9).font('Helvetica-Bold')
  doc.rect(50, tableTop - 4, 495, 18).fill('#0066CC')
  doc.fillColor('#FFFFFF')
  doc.text('Beskrivning', 55, tableTop)
  doc.text('Ant.', 370, tableTop)
  doc.text('À-pris', 410, tableTop)
  doc.text('Belopp', 475, tableTop)
  doc.fillColor('#000000').font('Helvetica')

  const rowY = tableTop + 24
  doc.text('Dykkurs / bokning', 55, rowY)
  doc.text('1', 370, rowY)
  doc.text(`${parseFloat(invoice.subtotal).toLocaleString('sv-SE')} kr`, 410, rowY)
  doc.text(`${parseFloat(invoice.subtotal).toLocaleString('sv-SE')} kr`, 475, rowY)
  doc.moveTo(50, rowY + 18).lineTo(545, rowY + 18).lineWidth(0.5).strokeColor('#E5E7EB').stroke()

  // ── Totals ───────────────────────────────────────────────────
  const totY = rowY + 35
  doc.fontSize(9).font('Helvetica')
  doc.text('Delsumma (exkl. moms):', 340, totY)
  doc.text(`${parseFloat(invoice.subtotal).toLocaleString('sv-SE')} kr`, 475, totY)
  doc.text(`Moms (${(invoice.vat_rate * 100).toFixed(0)}%):`, 340, totY + 16)
  doc.text(`${parseFloat(invoice.vat_amount).toLocaleString('sv-SE')} kr`, 475, totY + 16)

  doc.rect(335, totY + 34, 210, 22).fill('#F5F7FA')
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
  doc.text('TOTALT ATT BETALA:', 340, totY + 38)
  doc.text(`${parseFloat(invoice.total_amount).toLocaleString('sv-SE')} kr`, 475, totY + 38)

  // ── Payment info ─────────────────────────────────────────────
  const payY = totY + 90
  doc.fontSize(9).font('Helvetica-Bold').text('BETALNINGSINFORMATION', 50, payY)
  doc.moveTo(50, payY + 14).lineTo(545, payY + 14).lineWidth(0.5).strokeColor('#E5E7EB').stroke()
  doc.font('Helvetica')
  doc.text(`Bankkontonummer: ${company.bank || ''}`, 50, payY + 22)
  doc.text(`Referens: ${invoice.invoice_number}`, 50, payY + 36)
  doc.text(`Betalningsvillkor: 30 dagar netto`, 50, payY + 50)

  // ── Footer ───────────────────────────────────────────────────
  let footerText = `${company.name || 'Dykgaraget AB'}  •  ${company.address || ''}  •  ${company.email || ''}`
  if (company.f_skatt === 'true') {
    footerText += '  •  Godkänd för F-skatt'
  }
  doc.fontSize(8).fillColor('#9CA3AF')
    .text(footerText, 50, 780, { align: 'center' })

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filepath))
    stream.on('error', reject)
  })
}

export default router
