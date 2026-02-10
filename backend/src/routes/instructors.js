import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM instructors ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, specialty, experience_years, certifications, bio, hourly_rate, is_available = true } = req.body
    if (!name) return res.status(400).json({ error: 'Namn krävs' })
    const result = await pool.query(
      `INSERT INTO instructors (name,specialty,experience_years,certifications,bio,hourly_rate,is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, specialty, experience_years || 0, certifications, bio, hourly_rate, is_available]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const fields = ['name','specialty','experience_years','certifications','bio','hourly_rate','is_available','insurance_valid']
    const updates = []; const values = []; let i = 1
    for (const field of fields) {
      if (req.body[field] !== undefined) { updates.push(`${field} = $${i++}`); values.push(req.body[field]) }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })
    updates.push('updated_at = NOW()'); values.push(req.params.id)
    const result = await pool.query(
      `UPDATE instructors SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Instruktör hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM instructors WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Instruktör hittades inte' })
    res.json({ message: 'Instruktör borttagen' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
