import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// GET /api/bookings  (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, c.name AS course_name, c.price AS course_price
      FROM bookings b
      LEFT JOIN courses c ON b.course_id = c.id
      ORDER BY b.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bookings/:id
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, c.name AS course_name,
             json_agg(json_build_object('id', e.id, 'name', e.name, 'size', e.size)) AS equipment
      FROM bookings b
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN booking_equipment be ON be.booking_id = b.id
      LEFT JOIN equipment e ON be.equipment_id = e.id
      WHERE b.id = $1
      GROUP BY b.id, c.name
    `, [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bokning hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bookings  (public – anyone can book)
router.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const {
      course_id, booking_date, booking_time, participants = 1,
      first_name, last_name, email, phone, equipment_ids = [], notes
    } = req.body

    if (!course_id || !booking_date || !booking_time || !first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Kurs, datum, tid och kontaktuppgifter krävs' })
    }

    // Fetch course price
    const courseResult = await client.query('SELECT price FROM courses WHERE id = $1 AND is_active = true', [course_id])
    if (courseResult.rows.length === 0) return res.status(404).json({ error: 'Kurs hittades inte' })

    const coursePrice = parseFloat(courseResult.rows[0].price)

    // Calculate equipment price
    let equipmentPrice = 0
    if (equipment_ids.length > 0) {
      const eqResult = await client.query(
        'SELECT id, rental_price FROM equipment WHERE id = ANY($1) AND is_active = true',
        [equipment_ids]
      )
      equipmentPrice = eqResult.rows.reduce((sum, e) => sum + parseFloat(e.rental_price), 0)
    }

    const totalPrice = coursePrice + equipmentPrice

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings
         (course_id, booking_date, booking_time, participants, total_price,
          first_name, last_name, email, phone, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed') RETURNING *`,
      [course_id, booking_date, booking_time, participants, totalPrice,
       first_name, last_name, email, phone, notes]
    )
    const booking = bookingResult.rows[0]

    // Link equipment
    for (const eqId of equipment_ids) {
      await client.query(
        'INSERT INTO booking_equipment (booking_id, equipment_id, price) VALUES ($1,$2,100)',
        [booking.id, eqId]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(booking)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// PUT /api/bookings/:id/status  (admin)
router.put('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['pending','confirmed','cancelled','completed']
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status måste vara: ${allowed.join(', ')}` })
    }
    const result = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bokning hittades inte' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
