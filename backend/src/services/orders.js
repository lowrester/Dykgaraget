import { pool } from '../db/connection.js'
import { nextSeq } from './invoicing.js'
import bcrypt from 'bcryptjs'
import { sendEmail } from './email.js'

/**
 * generatePassword - Generates a secure 12-char password
 * No åäö, has special chars.
 */
function generatePassword() {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"
    let retVal = ""
    for (let i = 0, n = charset.length; i < 12; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n))
    }
    return retVal
}

/**
 * processOrder - Handles the creation of multiple bookings and a single invoice.
 */
export async function processOrder(orderData, client = pool) {
    const {
        items, first_name, last_name, email, phone,
        customer_id, payment_method, address, zip, city,
        create_account: requestedCreateAccount
    } = orderData

    let userId = customer_id
    let generatedPassword = null
    let create_account = requestedCreateAccount

    await client.query('BEGIN')

    try {
        // Fetch registration mode
        const regModeRes = await client.query("SELECT value FROM settings WHERE key = 'checkout_registration_mode'")
        const regMode = regModeRes.rows[0]?.value || 'optional'

        if (regMode === 'mandatory') create_account = true
        if (regMode === 'disabled') create_account = false

        // 0. Handle Auto-Registration
        if (create_account && !userId) {
            // Check if user already exists
            const existing = await client.query('SELECT id FROM users WHERE email = $1', [email])
            if (existing.rows.length > 0) {
                userId = existing.rows[0].id
            } else {
                generatedPassword = generatePassword()
                const hash = await bcrypt.hash(generatedPassword, 10)
                // Use email as username for simplicity in auto-reg
                const userRes = await client.query(
                    `INSERT INTO users 
                     (username, email, password_hash, first_name, last_name, role, phone, address, gdpr_consent, gdpr_consent_date)
                     VALUES ($1, $2, $3, $4, $5, 'customer', $6, $7, true, NOW()) RETURNING id`,
                    [email, email, hash, first_name, last_name, phone, `${address || ''} ${zip || ''} ${city || ''}`]
                )
                userId = userRes.rows[0].id
            }
        }

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
                        'confirmed', userId, item.scheduleId || null, item.price
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
                const isRental = item.name.startsWith('Hyra:')
                await client.query(
                    `INSERT INTO inventory_transactions (equipment_id, type, change, notes)
                     VALUES ($1, $2, -1, $3)`,
                    [item.equipmentId, isRental ? 'rental' : 'sale', `${isRental ? 'Uthyrning' : 'Försäljning'} via order: ${email}`]
                )
            }
        }

        // 2. Create the unified invoice
        const invoice = await createUnifiedInvoice(bookings, rentals, orderData, client, userId)

        await client.query('COMMIT')

        // 3. Post-commit: Send welcome email if account was created
        if (generatedPassword) {
            try {
                await sendEmail({
                    to: email,
                    subject: 'Välkommen till Dykgaraget - Ditt konto är skapat',
                    html: `
                        <h1>Hej ${first_name}!</h1>
                        <p>Tack för din beställning. Vi har skapat ett konto åt dig så att du smidigt kan se dina bokningar och ladda ner kvitton.</p>
                        <p><strong>Dina inloggningsuppgifter:</strong></p>
                        <ul>
                            <li><strong>Användarnamn:</strong> ${email}</li>
                            <li><strong>Lösenord:</strong> <code>${generatedPassword}</code></li>
                        </ul>
                        <p>Vi rekommenderar att du byter lösenord första gången du loggar in.</p>
                        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/loggain">Logga in här</a></p>
                        <br/>
                        <p>Med vänliga hälsningar,<br/>Dykgaraget</p>
                    `
                })
            } catch (emailErr) {
                console.error('Failed to send welcome email:', emailErr)
                // Don't fail the whole order if email fails
            }
        }

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

async function createUnifiedInvoice(bookings, rentals, orderData, client, userId = null) {
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
        subtotal, vat_rate, vat_amount, total_amount, due_date, status, terms_days, vat_summary, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid', $10, $11, $12) RETURNING *`,
        [
            invoiceNumber, `${first_name} ${last_name}`, email, fullAddress,
            subtotal.toFixed(2), 0.25, totalVat.toFixed(2), totalAmount.toFixed(2),
            dueDate.toISOString().split('T')[0], termsDays, JSON.stringify(vatSummary), userId
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
