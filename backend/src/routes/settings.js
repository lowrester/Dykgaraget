import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { logAction } from '../services/audit.js'

const router = express.Router()

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY category, key')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/settings/features
router.get('/features', async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'feature_%'")
    const features = result.rows.reduce((acc, row) => {
      const featureKey = row.key.replace('feature_', '')
      acc[featureKey] = row.value === 'true'
      return acc
    }, {})
    res.json(features)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/:key  (admin)
router.put('/:key', authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    // Dependency check: payment requires invoicing
    if (key === 'feature_payment' && (value === true || value === 'true')) {
      const inv = await pool.query(
        "SELECT value FROM settings WHERE key = 'feature_invoicing'"
      )
      if (inv.rows[0]?.value !== 'true') {
        return res.status(400).json({
          error: 'Faktureringsmodulen måste vara aktiverad innan betalningsmodulen kan aktiveras'
        })
      }
    }

    // If invoicing is being disabled, also disable payment
    if (key === 'feature_invoicing' && (value === false || value === 'false')) {
      await pool.query(
        "UPDATE settings SET value = 'false', updated_at = NOW() WHERE key = 'feature_payment'"
      )
      await logAction(req.user.id, 'DISABLE_SETTING', 'settings', null, { key: 'feature_payment', reason: 'dependency' }, req)
    }

    const result = await pool.query(
      'UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [String(value), key]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    await logAction(req.user.id, 'UPDATE_SETTING', 'settings', result.rows[0].id, { key, value }, req)

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
