import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// GET /api/courses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses ORDER BY id'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kurs hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/courses  (admin)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name, level, duration, price, description, prerequisites,
      included_materials, certification_agency, max_participants,
      min_participants, is_active = true
    } = req.body

    if (!name || !level || !duration || price === undefined) {
      return res.status(400).json({ error: 'Namn, nivå, längd och pris krävs' })
    }

    const result = await pool.query(
      `INSERT INTO courses
         (name,level,duration,price,description,prerequisites,included_materials,
          certification_agency,max_participants,min_participants,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, level, duration, price, description, prerequisites,
       included_materials, certification_agency || 'PADI',
       max_participants || 10, min_participants || 1, is_active]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/courses/:id  (admin)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const fields = [
      'name','level','duration','price','description','prerequisites',
      'included_materials','certification_agency','max_participants',
      'min_participants','is_active'
    ]
    const updates = []
    const values  = []
    let i = 1

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i++}`)
        values.push(req.body[field])
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })
    updates.push(`updated_at = NOW()`)
    values.push(req.params.id)

    const result = await pool.query(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kurs hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/courses/:id  (admin)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kurs hittades inte' })
    res.json({ message: 'Kurs borttagen' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
