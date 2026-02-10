import express from 'express'
import bcrypt from 'bcrypt'
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
        const { username, email, password, first_name, last_name, role = 'customer' } = req.body
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Användarnamn, e-post och lösenord krävs' })
        }

        const hash = await bcrypt.hash(password, 10)
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role`,
            [username, email, hash, first_name, last_name, role]
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
        const { username, email, password, first_name, last_name, role, is_active } = req.body
        const fields = []
        const values = []
        let i = 1

        if (username) { fields.push(`username = $${i++}`); values.push(username) }
        if (email) { fields.push(`email = $${i++}`); values.push(email) }
        if (first_name) { fields.push(`first_name = $${i++}`); values.push(first_name) }
        if (last_name) { fields.push(`last_name = $${i++}`); values.push(last_name) }
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

export default router
