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
      'name', 'level', 'duration', 'price', 'description', 'prerequisites',
      'included_materials', 'certification_agency', 'max_participants',
      'min_participants', 'is_active'
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

// ── Schedules ───────────────────────────────────────────────

// GET /api/courses/:id/schedules
router.get('/:id/schedules', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM course_schedules 
       WHERE course_id = $1 AND is_active = true AND start_date >= CURRENT_DATE
       ORDER BY start_date, start_time`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/courses/:id/schedules (admin)
router.post('/:id/schedules', authenticateAdmin, async (req, res) => {
  try {
    const { start_date, start_time, end_date, max_participants, sessions } = req.body

    // Support either traditional fields or new sessions array
    // Default to traditionals if sessions is missing
    const finalSessions = sessions || [{ date: start_date, time: start_time }]

    if (!finalSessions || finalSessions.length === 0 || !finalSessions[0].date) {
      return res.status(400).json({ error: 'Minst ett datum krävs' })
    }

    const result = await pool.query(
      `INSERT INTO course_schedules (course_id, start_date, start_time, end_date, max_participants, sessions)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.params.id,
        finalSessions[0].date,
        finalSessions[0].time,
        end_date || null, // Fix: Allow null/empty
        max_participants || 10,
        JSON.stringify(finalSessions)
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/courses/:id/schedules/:scheduleId (admin)
router.delete('/:id/schedules/:scheduleId', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM course_schedules WHERE id = $1 AND course_id = $2 RETURNING id',
      [req.params.scheduleId, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Schema-post hittades inte' })
    res.json({ message: 'Schema-post borttagen' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
