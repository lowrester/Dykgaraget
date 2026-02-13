import express from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// GET /api/users
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY username')
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /api/users
router.post('/', authenticateAdmin, async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'customer', phone, address, postal_code, city } = req.body
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Användarnamn, e-post och lösenord krävs' })
        }

        const hash = await bcrypt.hash(password, 10)
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role, phone, address, postal_code, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, username, email, role`,
            [username, email, hash, first_name, last_name, role, phone, address, postal_code, city]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Användarnamn eller e-post finns redan' })
        res.status(500).json({ error: err.message })
    }
})

// PUT /api/users/:id
router.put('/:id', authenticateAdmin, async (req, res) => {
    try {
        if (username) { fields.push(`username = $${i++}`); values.push(username) }
        if (email) { fields.push(`email = $${i++}`); values.push(email) }
        if (first_name !== undefined) { fields.push(`first_name = $${i++}`); values.push(first_name) }
        if (last_name !== undefined) { fields.push(`last_name = $${i++}`); values.push(last_name) }
        if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone) }
        if (address !== undefined) { fields.push(`address = $${i++}`); values.push(address) }
        if (postal_code !== undefined) { fields.push(`postal_code = $${i++}`); values.push(postal_code) }
        if (city !== undefined) { fields.push(`city = $${i++}`); values.push(city) }
        if (role) { fields.push(`role = $${i++}`); values.push(role) }
        if (is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(is_active) }

        if (password) {
            const hash = await bcrypt.hash(password, 10)
            fields.push(`password_hash = $${i++}`)
            values.push(hash)
        }

        if (fields.length === 0) return res.status(400).json({ error: 'Inget att uppdatera' })

        fields.push(`updated_at = NOW()`)
        values.push(req.params.id)

        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, username, email, role, is_active`,
            values
        )

        if (result.rows.length === 0) return res.status(404).json({ error: 'Användare hittades inte' })
        res.json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// DELETE /api/users/:id
router.delete('/:id', authenticateAdmin, async (req, res) => {
    try {
        // Prevent self-deletion
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Du kan inte ta bort ditt eget konto' })
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id])
        if (result.rows.length === 0) return res.status(404).json({ error: 'Användare hittades inte' })
        res.json({ message: 'Användare borttagen' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// GET /api/users/me/export - GDPR Right to Access
router.get('/me/export', async (req, res) => {
    try {
        // Fetch all data related to the user
        const userRes = await pool.query('SELECT id, username, email, first_name, last_name, role, phone, address, gdpr_consent, gdpr_consent_date, created_at FROM users WHERE id = $1', [req.user.id])
        const bookingsRes = await pool.query('SELECT * FROM bookings WHERE customer_id = $1', [req.user.id])
        const invoicesRes = await pool.query('SELECT * FROM invoices WHERE buyer_email = $1', [userRes.rows[0].email])

        res.json({
            user: userRes.rows[0],
            bookings: bookingsRes.rows,
            invoices: invoicesRes.rows
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// DELETE /api/users/me - GDPR Right to be Forgotten
router.delete('/me', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.user.id])
        res.json({ message: 'Ditt konto har tagits bort och din data har raderats i enlighet med GDPR.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
