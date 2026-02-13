/**
 * Invoice Service
 *
 * PDF-generering och email-utskick av fakturor.
 * Logiken körs direkt i routes/invoices.js via PDFKit.
 * Den här filen exporterar hjälpfunktioner som kan återanvändas
 * från andra delar av systemet (t.ex. efter betalning via Stripe).
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { pool } from '../db/connection.js'
import { sendEmail } from './email.js'

/**
 * Generera PDF för en befintlig faktura och spara till disk.
 * @param {number} invoiceId
 * @returns {Promise<string>} Sökväg till den sparade PDF-filen
 */
export async function generateInvoicePDF(invoiceId) {
  // Hämta faktura + kundinfo
  const invRes = await pool.query(`
    SELECT i.*,
           u.first_name, u.last_name, u.email AS customer_email,
           u.phone AS customer_phone
    FROM   invoices i
    LEFT   JOIN users u ON u.id = i.user_id
    WHERE  i.id = $1
  `, [invoiceId])

  if (invRes.rows.length === 0) throw new Error('Faktura hittades inte')
  const inv = invRes.rows[0]

  // Hämta företagsinställningar
  const setRes = await pool.query(`SELECT key, value FROM settings WHERE category = 'company'`)
  const co = setRes.rows.reduce((acc, r) => {
    acc[r.key.replace('company_', '')] = r.value
    return acc
  }, {})

  // Skapa PDF
  const doc = new PDFDocument({ margin: 50 })
  const filename = `invoice_${inv.invoice_number}.pdf`
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'invoices')
  fs.mkdirSync(dir, { recursive: true })
  const filepath = path.join(dir, filename)
  const stream = fs.createWriteStream(filepath)
  doc.pipe(stream)

  // ── Avsändare (vänster) ─────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').text(co.name || 'Dykgaraget AB', 50, 50)
  doc.fontSize(9).font('Helvetica')
    .text(co.address || '', 50, 80)
    .text(`Org.nr: ${co.org_number || ''}`, 50, 93)
    .text(`Telefon: ${co.phone || ''}`, 50, 106)
    .text(`E-post: ${co.email || ''}`, 50, 119)

  // ── Fakturarubrik (höger) ────────────────────────────────
  doc.fontSize(26).font('Helvetica-Bold').fillColor('#0066CC').text('FAKTURA', 350, 50, { align: 'right' })
  doc.fontSize(9).font('Helvetica').fillColor('#000000')
    .text(`Nr: ${inv.invoice_number}`, 350, 90, { align: 'right' })
    .text(`Datum: ${fmtDate(inv.invoice_date)}`, 350, 103, { align: 'right' })
    .text(`Förfaller: ${fmtDate(inv.due_date)}`, 350, 116, { align: 'right' })

  if (inv.supply_date) {
    doc.text(`Leveransdatum: ${fmtDate(inv.supply_date)}`, 350, 129, { align: 'right' })
  }

  // ── Mottagare ────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').text('Faktureras till:', 50, 175)
  doc.font('Helvetica').fontSize(10)
  if (inv.buyer_name) doc.text(inv.buyer_name, 50, 193)
  if (inv.buyer_address) doc.text(inv.buyer_address, 50, 206)
  if (inv.buyer_email) doc.text(inv.buyer_email, 50, 219)
  if (inv.buyer_vat_number) doc.text(`VAT: ${inv.buyer_vat_number}`, 50, 232)

  // ── Tabellhuvud ──────────────────────────────────────────
  const tableTop = 280
  doc.rect(50, tableTop - 5, 495, 20).fill('#F9FAFB')
  doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(9)
    .text('Beskrivning', 60, tableTop)
    .text('Antal', 310, tableTop, { width: 50, align: 'right' })
    .text('À-pris', 365, tableTop, { width: 60, align: 'right' })
    .text('Moms', 430, tableTop, { width: 40, align: 'right' })
    .text('Summa', 480, tableTop, { width: 65, align: 'right' })
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#E5E7EB').stroke()
  doc.fillColor('#000000')

  // ── Rader ────────────────────────────────────────────────
  const items = inv.items || (await pool.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  ).then(r => r.rows).catch(() => []))

  let y = tableTop + 25
  doc.font('Helvetica').fontSize(9)
  items.forEach(item => {
    const textHeight = doc.heightOfString(item.description, { width: 240 })
    doc.text(item.description, 60, y, { width: 240 })
      .text(String(item.quantity), 310, y, { width: 50, align: 'right' })
      .text(fmtSEK(item.unit_price), 365, y, { width: 60, align: 'right' })
      .text(`${Math.round((item.vat_rate || 0.25) * 100)}%`, 430, y, { width: 40, align: 'right' })
      .text(fmtSEK(item.total), 480, y, { width: 65, align: 'right' })

    y += Math.max(18, textHeight + 5)
    doc.moveTo(50, y - 2).lineTo(545, y - 2).strokeColor('#F3F4F6').stroke()
  })

  // ── Summering & VAT-Split ────────────────────────────────
  y += 15
  if (y > 700) { doc.addPage(); y = 50 }

  doc.font('Helvetica').fontSize(9)
    .text('Netto totalt:', 380, y, { width: 95, align: 'right' })
    .text(fmtSEK(inv.subtotal), 480, y, { width: 65, align: 'right' })
  y += 14

  // Breakdown of VAT
  const summary = inv.vat_summary || {}
  Object.keys(summary).sort().forEach(rateStr => {
    const rateVal = parseFloat(rateStr)
    const data = summary[rateStr]
    doc.fontSize(8).fillColor('#6B7280')
      .text(`Moms (${Math.round(rateVal * 100)}% på ${fmtSEK(data.net)}):`, 350, y, { width: 125, align: 'right' })
      .text(fmtSEK(data.vat), 480, y, { width: 65, align: 'right' })
    y += 12
  })
  doc.fillColor('#000000').fontSize(9)

  if (Object.keys(summary).length === 0) {
    const vatLabel = `Moms ${Math.round((inv.vat_rate || 0.25) * 100)}%:`
    doc.text(vatLabel, 380, y, { width: 95, align: 'right' })
      .text(fmtSEK(inv.vat_amount), 480, y, { width: 65, align: 'right' })
    y += 14
  }
  y += 6

  doc.font('Helvetica-Bold').fontSize(11)
  doc.rect(370, y - 5, 175, 22).fill('#0066CC')
  doc.fillColor('#FFFFFF')
    .text('Att betala:', 380, y, { width: 95, align: 'right' })
    .text(fmtSEK(inv.total_amount), 480, y, { width: 65, align: 'right' })
  doc.fillColor('#000000')

  // ── Notes ────────────────────────────────────────────────
  if (inv.notes) {
    y += 40
    if (y > 700) { doc.addPage(); y = 50 }
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6B7280')
      .text('Noteringar:', 50, y)
      .text(inv.notes, 50, y + 10, { width: 495 })
    doc.fillColor('#000000').font('Helvetica')
  }

  // ── Betalningsinfo ───────────────────────────────────────
  y += 60
  if (y > 700) { doc.addPage(); y = 50 }
  doc.font('Helvetica-Bold').fontSize(9).text('Betalningsinformation:', 50, y)
  doc.font('Helvetica').fontSize(9)
    .text(`Bankgiro / konto: ${co.bank_account || '–'}`, 50, y + 14)
    .text(`Referens: ${inv.invoice_number}`, 50, y + 27)
    .text(`Betalningsvillkor: ${inv.terms_days || 30} dagar netto`, 50, y + 40)

  // ── Sidfot ───────────────────────────────────────────────
  let footerText = 'Tack för din beställning!'
  if (co.f_skatt === 'true') {
    footerText = `Godkänd för F-skatt  •  ${footerText}`
  }
  doc.fontSize(8).fillColor('#888888')
    .text(footerText, 50, 750, { align: 'center', width: 495 })

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filepath))
    stream.on('error', reject)
  })
}

/**
 * Skicka faktura via e-post med PDF som bilaga.
 * @param {number} invoiceId
 */
export async function emailInvoice(invoiceId) {
  const invRes = await pool.query(`
    SELECT i.*, u.email AS customer_email, u.first_name
    FROM   invoices i
    LEFT   JOIN users u ON u.id = i.user_id
    WHERE  i.id = $1
  `, [invoiceId])

  if (invRes.rows.length === 0) throw new Error('Faktura hittades inte')
  const inv = invRes.rows[0]

  const pdfPath = await generateInvoicePDF(invoiceId)

  await sendEmail({
    to: inv.customer_email,
    subject: `Faktura ${inv.invoice_number} från Dykgaraget`,
    html: `
      <p>Hej ${inv.first_name || ''},</p>
      <p>Tack för din bokning hos Dykgaraget!</p>
      <p>Bifogad finner du faktura <strong>${inv.invoice_number}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Att betala:</td>
            <td style="padding:4px 0"><strong>${fmtSEK(inv.total_amount)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Förfallodatum:</td>
            <td style="padding:4px 0">${fmtDate(inv.due_date)}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">
        Vid frågor, kontakta oss på info@dykgaraget.se
      </p>
      <p>Vänliga hälsningar,<br><strong>Dykgaraget</strong></p>
    `,
    attachments: [{
      filename: path.basename(pdfPath),
      path: pdfPath,
    }],
  })

  // Markera som skickad i databasen
  await pool.query(
    `UPDATE invoices SET pdf_generated = true, pdf_path = $1, sent_at = NOW() WHERE id = $2`,
    [pdfPath, invoiceId]
  )
}

// ── Hjälpfunktioner ──────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('sv-SE')
}

function fmtSEK(amount) {
  if (amount == null) return '–'
  return `${Number(amount).toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr`
}
