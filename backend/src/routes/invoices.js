import express from 'express'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { pool } from '../db/connection.js'
import { authenticate, authenticateAdmin, checkFeature } from '../middleware/auth.js'
import { sendEmail } from '../services/email.js'

const router = express.Router()
router.use(checkFeature('invoicing'))

// GET /api/invoices/me (customer view)
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE buyer_email = $1 ORDER BY created_at DESC', [req.user.email])
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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

    const bookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id])
    if (bookingRes.rows.length === 0) return res.status(404).json({ error: 'Bokning hittades inte' })
    const booking = bookingRes.rows[0]

    const prefixRes = await pool.query("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    const prefix = prefixRes.rows[0]?.value || 'DYK'
    const termsRes = await pool.query("SELECT value FROM settings WHERE key = 'invoice_terms_days'")
    const termsDays = parseInt(termsRes.rows[0]?.value || '30')
    const vatRes = await pool.query("SELECT value FROM settings WHERE key = 'invoice_vat_rate'")
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
          subtotal, vat_rate, vat_amount, total_amount, due_date, status, terms_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid', $10) RETURNING *`,
      [booking_id, invoiceNumber, `${booking.first_name} ${booking.last_name}`, booking.email,
        subtotal.toFixed(2), vatRate, vatAmount.toFixed(2), totalAmount.toFixed(2),
        dueDate.toISOString().split('T')[0], termsDays]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/invoices/manual  – create custom invoice
router.post('/manual', authenticateAdmin, async (req, res) => {
  const client = await pool.connect()
  try {
    const { buyer_name, buyer_email, buyer_address, items, terms_days } = req.body
    if (!buyer_name || !buyer_email || !items || !items.length) {
      return res.status(400).json({ error: 'Kunduppgifter och rader krävs' })
    }

    await client.query('BEGIN')

    const prefixRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    const prefix = prefixRes.rows[0]?.value || 'DYK'
    const vatRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_vat_rate'")
    const vatRate = parseFloat(vatRes.rows[0]?.value || '0.25')
    const finalTermsDays = parseInt(terms_days || '30')

    let subtotal = 0
    items.forEach(item => {
      subtotal += parseFloat(item.unit_price) * parseFloat(item.quantity)
    })

    const vatAmount = subtotal * vatRate
    const totalAmount = subtotal + vatAmount
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + finalTermsDays)

    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(await nextSeq(client)).padStart(4, '0')}`

    const invRes = await client.query(
      `INSERT INTO invoices
         (invoice_number, buyer_name, buyer_email, buyer_address,
          subtotal, vat_rate, vat_amount, total_amount, due_date, status, terms_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid', $10) RETURNING *`,
      [invoiceNumber, buyer_name, buyer_email, buyer_address,
        subtotal.toFixed(2), vatRate, vatAmount.toFixed(2), totalAmount.toFixed(2),
        dueDate.toISOString().split('T')[0], finalTermsDays]
    )
    const invoice = invRes.rows[0]

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoice.id, item.description, item.quantity, item.unit_price, (item.quantity * item.unit_price).toFixed(2)]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(invoice)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/invoices/preview – generate preview PDF (unsaved)
router.post('/preview', authenticateAdmin, async (req, res) => {
  try {
    const { buyer_name, buyer_email, buyer_address, items, terms_days } = req.body

    const prefixRes = await pool.query("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    const prefix = prefixRes.rows[0]?.value || 'DYK'
    const vatRes = await pool.query("SELECT value FROM settings WHERE key = 'invoice_vat_rate'")
    const vatRate = parseFloat(vatRes.rows[0]?.value || '0.25')
    const finalTermsDays = parseInt(terms_days || '30')

    let subtotal = 0
    items.forEach(item => {
      subtotal += parseFloat(item.unit_price) * parseFloat(item.quantity)
    })

    const vatAmount = subtotal * vatRate
    const totalAmount = subtotal + vatAmount
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + finalTermsDays)

    // Mock invoice object for PDF generator
    const mockInvoice = {
      invoice_number: `${prefix}-PREVIEW`,
      invoice_date: new Date(),
      due_date: dueDate,
      buyer_name,
      buyer_email,
      buyer_address,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      status: 'unpaid',
      items: items.map(i => ({ ...i, total: i.quantity * i.unit_price }))
    }

    const company = await getCompanySettings()
    const doc = new PDFDocument({ margin: 50, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf')
    doc.pipe(res)
    await generatePDFBody(doc, mockInvoice, company)
    doc.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/invoices/:id/archive – toggle archive status
router.patch('/:id/archive', authenticateAdmin, async (req, res) => {
  try {
    const { is_archived } = req.body
    const result = await pool.query(
      'UPDATE invoices SET is_archived = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [is_archived, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faktura hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/invoices/:id/pdf  – download PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Faktura hittades inte' })

    // Check ownership if not admin
    if (req.user.role !== 'admin' && invoice.buyer_email !== req.user.email) {
      return res.status(403).json({ error: 'Du har inte tillgång till denna faktura' })
    }

    // Fetch items if they exist
    const itemsRes = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoice.id])
    invoice.items = itemsRes.rows

    const company = await getCompanySettings()
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'invoices')
    fs.mkdirSync(dir, { recursive: true })
    const filepath = path.join(dir, `${invoice.invoice_number}.pdf`)

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filepath)
    doc.pipe(stream)
    await generatePDFBody(doc, invoice, company)
    doc.end()

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', reject)
    })

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
    const featureCheck = await pool.query("SELECT value FROM settings WHERE key = 'feature_email'")
    if (featureCheck.rows[0]?.value !== 'true') {
      return res.status(403).json({ error: 'Email-modulen är inte aktiverad' })
    }

    const invoice = await getInvoice(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Faktura hittades inte' })

    // Fetch items
    const itemsRes = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoice.id])
    invoice.items = itemsRes.rows

    const company = await getCompanySettings()
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'invoices')
    fs.mkdirSync(dir, { recursive: true })
    const filepath = path.join(dir, `${invoice.invoice_number}.pdf`)
    const stream = fs.createWriteStream(filepath)
    doc.pipe(stream)
    await generatePDFBody(doc, invoice, company)
    doc.end()

    await new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej) })

    await sendEmail({
      to: invoice.buyer_email,
      subject: `Faktura ${invoice.invoice_number} från ${company.name}`,
      html: `
        <h2>Hej ${invoice.buyer_name}!</h2>
        <p>Bifogad finner du faktura <strong>${invoice.invoice_number}</strong>.</p>
        <p>Totalt att betala: <strong>${parseFloat(invoice.total_amount).toLocaleString('sv-SE')} kr</strong></p>
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

async function nextSeq(poolOrClient) {
  const r = await poolOrClient.query("SELECT nextval('invoice_number_seq')")
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

async function generatePDFBody(doc, invoice, company) {
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

  let currentY = tableTop + 24
  const items = invoice.items && invoice.items.length > 0
    ? invoice.items
    : [{ description: 'Dykkurs / bokning', quantity: 1, unit_price: invoice.subtotal, total: invoice.subtotal }]

  items.forEach(item => {
    doc.text(item.description, 55, currentY, { width: 300 })
    doc.text(String(item.quantity), 370, currentY)
    doc.text(`${parseFloat(item.unit_price).toLocaleString('sv-SE')} kr`, 410, currentY)
    doc.text(`${parseFloat(item.total).toLocaleString('sv-SE')} kr`, 475, currentY)

    currentY += 20
    doc.moveTo(50, currentY - 2).lineTo(545, currentY - 2).lineWidth(0.5).strokeColor('#E5E7EB').stroke()
  })

  // ── Totals ───────────────────────────────────────────────────
  let totY = currentY + 15
  if (totY > 700) { doc.addPage(); totY = 50 }

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
  let payY = totY + 90
  if (payY > 650) { doc.addPage(); payY = 50 }

  doc.fontSize(9).font('Helvetica-Bold').text('BETALNINGSINFORMATION', 50, payY)
  doc.moveTo(50, payY + 14).lineTo(545, payY + 14).lineWidth(0.5).strokeColor('#E5E7EB').stroke()
  doc.font('Helvetica')
  doc.text(`Bankkontonummer: ${company.bank || ''}`, 50, payY + 22)
  doc.text(`Referens: ${invoice.invoice_number}`, 50, payY + 36)
  doc.text(`Betalningsvillkor: ${invoice.terms_days || 30} dagar netto`, 50, payY + 50)

  // ── Footer ───────────────────────────────────────────────────
  let footerText = `${company.name || 'Dykgaraget AB'}  •  ${company.address || ''}  •  ${company.email || ''}`
  if (company.f_skatt === 'true') {
    footerText += '  •  Godkänd för F-skatt'
  }
  doc.fontSize(8).fillColor('#9CA3AF')
    .text(footerText, 50, 780, { align: 'center' })
}

export default router
