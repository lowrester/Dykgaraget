import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin, checkFeature } from '../middleware/auth.js'

const router = express.Router()
router.use(checkFeature('equipment'))

// GET /api/equipment
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment WHERE archived_at IS NULL ORDER BY category, size')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/equipment/archived (admin)
router.get('/archived', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment WHERE archived_at IS NOT NULL ORDER BY archived_at DESC')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/equipment/bulk-archive (admin)
router.post('/bulk-archive', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Inga ID:n angivna' })

    await pool.query('UPDATE equipment SET archived_at = NOW(), is_active = false WHERE id = ANY($1)', [ids])
    res.json({ message: `${ids.length} artiklar arkiverade` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/equipment/bulk-restore (admin)
router.post('/bulk-restore', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Inga ID:n angivna' })

    await pool.query('UPDATE equipment SET archived_at = NULL WHERE id = ANY($1)', [ids])
    res.json({ message: `${ids.length} artiklar återställda` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/equipment  (admin)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name, category, size, quantity_total, rental_price,
      is_for_rent = true, is_for_sale = false, sale_price = 0,
      condition, is_active = true
    } = req.body

    if (!name || !category) return res.status(400).json({ error: 'Namn och kategori krävs' })

    const qty = quantity_total || 1
    const result = await pool.query(
      `INSERT INTO equipment (
         name, category, size, quantity_total, quantity_available, 
         rental_price, is_for_rent, is_for_sale, sale_price, 
         condition, is_active
       )
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        name, category, size, qty, rental_price || 0,
        is_for_rent, is_for_sale, sale_price || 0,
        condition || 'god', is_active
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/equipment/:id  (admin)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const fields = [
      'name', 'category', 'size', 'quantity_total', 'quantity_available',
      'rental_price', 'is_for_rent', 'is_for_sale', 'sale_price',
      'condition', 'is_active'
    ]
    const updates = []
    const values = []
    let i = 1
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i++}`)
        values.push(req.body[field])
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })
    updates.push('updated_at = NOW()')
    values.push(req.params.id)

    const result = await pool.query(
      `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utrustning hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/equipment/:id  (admin)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utrustning hittades inte' })
    res.json({ message: 'Utrustning borttagen' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
