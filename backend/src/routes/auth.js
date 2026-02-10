import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone, address, gdprConsent } = req.body
    if (!username || !email || !password || !gdprConsent) {
      return res.status(400).json({ error: 'Alla fält inklusive GDPR-samtycke krävs' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Lösenordet måste vara minst 8 tecken' })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users 
         (username, email, password_hash, first_name, last_name, role, phone, address, gdpr_consent, gdpr_consent_date)
       VALUES ($1, $2, $3, $4, $5, 'customer', $6, $7, true, NOW()) RETURNING id, username, email`,
      [username, email, hash, firstName, lastName, phone, address]
    )

    const user = result.rows[0]
    const token = jwt.sign(
      { userId: user.id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({
      token,
      user: { ...user, role: 'customer' }
    })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Användarnamn eller e-post finns redan' })
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Användarnamn och lösenord krävs' })
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    )
    const user = result.rows[0]

    if (!user) return res.status(401).json({ error: 'Felaktiga inloggningsuppgifter' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Felaktiga inloggningsuppgifter' })

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Båda lösenord krävs' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Lösenordet måste vara minst 8 tecken' })
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Nuvarande lösenord stämmer inte' })

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id])

    res.json({ message: 'Lösenord uppdaterat' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
