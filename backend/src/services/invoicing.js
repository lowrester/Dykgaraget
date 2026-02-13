import { pool } from '../db/connection.js'

export async function nextSeq(poolOrClient) {
    const r = await poolOrClient.query("SELECT nextval('invoice_number_seq')")
    return r.rows[0].nextval
}

export async function createInvoiceFromBooking(bookingId, client = pool) {
    const bookingRes = await client.query('SELECT * FROM bookings WHERE id = $1', [bookingId])
    if (bookingRes.rows.length === 0) throw new Error('Bokning hittades inte')
    const booking = bookingRes.rows[0]

    const prefixRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    const prefix = prefixRes.rows[0]?.value || 'DYK'
    const termsRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_terms_days'")
    const termsDays = parseInt(termsRes.rows[0]?.value || '30')
    const vatRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_vat_rate'")
    const vatRate = parseFloat(vatRes.rows[0]?.value || '0.25')

    const subtotal = parseFloat(booking.total_price) / (1 + vatRate)
    const vatAmount = parseFloat(booking.total_price) - subtotal
    const totalAmount = parseFloat(booking.total_price)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + termsDays)

    const seq = await nextSeq(client)
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`

    const result = await client.query(
        `INSERT INTO invoices
       (booking_id, invoice_number, buyer_name, buyer_email,
        subtotal, vat_rate, vat_amount, total_amount, due_date, status, terms_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid', $10) RETURNING *`,
        [bookingId, invoiceNumber, `${booking.first_name} ${booking.last_name}`, booking.email,
            subtotal.toFixed(2), vatRate, vatAmount.toFixed(2), totalAmount.toFixed(2),
            dueDate.toISOString().split('T')[0], termsDays]
    )

    return result.rows[0]
}

export async function getCompanySettings(client = pool) {
    const r = await client.query("SELECT key, value FROM settings WHERE category = 'company'")
    return r.rows.reduce((acc, row) => {
        acc[row.key.replace('company_', '')] = row.value
        return acc
    }, {})
}
