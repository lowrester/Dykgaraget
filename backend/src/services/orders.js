import { pool } from '../db/connection.js'
import { createInvoiceFromBooking, nextSeq } from './invoicing.js'

/**
 * processOrder - Handles the creation of multiple bookings and a single invoice.
 */
export async function processOrder(orderData, client = pool) {
    const {
        items, first_name, last_name, email, phone,
        customer_id, payment_method, address, zip, city
    } = orderData

    await client.query('BEGIN')

    try {
        const bookings = []
        const rentals = []

        // 1. Create bookings/rentals for each item in the cart
        for (const item of items) {
            if (item.type === 'course') {
                const result = await client.query(
                    `INSERT INTO bookings 
             (course_id, booking_date, booking_time, participants, first_name, last_name, email, phone, notes, status, customer_id, schedule_id, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10, $11, $12) 
           RETURNING *`,
                    [
                        item.courseId, item.date, item.time || '09:00', item.participants || 1,
                        first_name, last_name, email, phone, item.notes || '',
                        'confirmed', customer_id, item.scheduleId || null, item.price
                    ]
                )
                bookings.push(result.rows[0])
            } else if (item.type === 'equipment') {
                rentals.push(item)

                // Update inventory: decrease available quantity
                await client.query(
                    'UPDATE equipment SET quantity_available = quantity_available - 1 WHERE id = $1',
                    [item.equipmentId]
                )
                // Log transaction
                await client.query(
                    `INSERT INTO inventory_transactions (equipment_id, type, change, notes)
           VALUES ($1, 'sale', -1, $2)`,
                    [item.equipmentId, `Uthyrning via order: ${email}`]
                )
            }
        }

        // 2. Create the unified invoice
        const invoice = await createUnifiedInvoice(bookings, rentals, orderData, client)

        await client.query('COMMIT')

        // Fetch company info for response
        const companyRes = await client.query("SELECT key, value FROM settings WHERE category = 'company'")
        const company = companyRes.rows.reduce((acc, row) => {
            acc[row.key.replace('company_', '')] = row.value
            return acc
        }, {})

        return { bookings, invoice, company }
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    }
}

async function createUnifiedInvoice(bookings, rentals, orderData, client) {
    const { first_name, last_name, email, address, zip, city } = orderData

    const prefixRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    const prefix = prefixRes.rows[0]?.value || 'DYK'
    const termsRes = await client.query("SELECT value FROM settings WHERE key = 'invoice_terms_days'")
    const termsDays = parseInt(termsRes.rows[0]?.value || '30')

    let subtotal = 0
    let totalVat = 0
    const vatSummary = {}

    // 1. Process course bookings
    for (const b of bookings) {
        const price = parseFloat(b.total_price)
        const courseRes = await client.query('SELECT vat_rate FROM courses WHERE id = $1', [b.course_id])
        const rate = parseFloat(courseRes.rows[0]?.vat_rate || 0.06)

        const net = price / (1 + rate)
        const vat = price - net

        subtotal += net
        totalVat += vat

        const rKey = rate.toFixed(2)
        if (!vatSummary[rKey]) vatSummary[rKey] = { net: 0, vat: 0 }
        vatSummary[rKey].net += net
        vatSummary[rKey].vat += vat
    }

    // 2. Process equipment rentals
    for (const r of rentals) {
        const price = parseFloat(r.price)
        const rate = 0.25 // Standard VAT for rentals

        const net = price / (1 + rate)
        const vat = price - net

        subtotal += net
        totalVat += vat

        const rKey = rate.toFixed(2)
        if (!vatSummary[rKey]) vatSummary[rKey] = { net: 0, vat: 0 }
        vatSummary[rKey].net += net
        vatSummary[rKey].vat += vat
    }

    const totalAmount = subtotal + totalVat
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + termsDays)

    const seq = await nextSeq(client)
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`

    const fullAddress = `${address || ''}${zip ? ', ' + zip : ''}${city ? ' ' + city : ''}`

    const invRes = await client.query(
        `INSERT INTO invoices
       (invoice_number, buyer_name, buyer_email, buyer_address,
        subtotal, vat_rate, vat_amount, total_amount, due_date, status, terms_days, vat_summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid', $10, $11) RETURNING *`,
        [
            invoiceNumber, `${first_name} ${last_name}`, email, fullAddress,
            subtotal.toFixed(2), 0.06, totalVat.toFixed(2), totalAmount.toFixed(2),
            dueDate.toISOString().split('T')[0], termsDays, JSON.stringify(vatSummary)
        ]
    )
    const invoice = invRes.rows[0]

    // Add line items to invoice_items
    for (const b of bookings) {
        const courseRes = await client.query('SELECT name, vat_rate FROM courses WHERE id = $1', [b.course_id])
        const course = courseRes.rows[0]
        const rate = parseFloat(course?.vat_rate || 0.06)
        const net = parseFloat(b.total_price) / (1 + rate)

        await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, vat_rate)
       VALUES ($1,$2,$3,$4,$5,$6)`,
            [invoice.id, `Kurs: ${course?.name || 'Okänd'}`, b.participants, (net / b.participants).toFixed(2), net.toFixed(2), rate]
        )
    }

    for (const r of rentals) {
        const rate = 0.25
        const net = parseFloat(r.price) / (1 + rate)
        await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, vat_rate)
       VALUES ($1,$2,$3,$4,$5,$6)`,
            [invoice.id, r.name, 1, net.toFixed(2), net.toFixed(2), rate]
        )
    }

    return invoice
}
