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
      first_name, last_name, email, phone, equipment_ids = [], notes,
      schedule_id
    } = req.body

    if (!course_id || (!booking_date && !schedule_id) || !first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Kurs, datum och kontaktuppgifter krävs' })
    }

    const participantCount = Math.max(1, Math.min(20, parseInt(participants) || 1))
    let finalDate = booking_date
    let finalTime = booking_time || '09:00'

    // Handle Schedule
    if (schedule_id) {
      const schedRes = await client.query(
        'SELECT * FROM course_schedules WHERE id = $1 AND course_id = $2',
        [schedule_id, course_id]
      )
      if (schedRes.rows.length === 0) return res.status(404).json({ error: 'Valt datum hittades inte' })

      const sched = schedRes.rows[0]
      if (sched.current_participants + participantCount > sched.max_participants) {
        return res.status(400).json({ error: 'Tyvärr är det valt datumet fullbokat' })
      }

      finalDate = sched.start_date
      finalTime = sched.start_time

      // Update participant count
      await client.query(
        'UPDATE course_schedules SET current_participants = current_participants + $1 WHERE id = $2',
        [participantCount, schedule_id]
      )
    }

    // Validera e-post
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // Validera datum
    if (isNaN(Date.parse(finalDate))) {
      return res.status(400).json({ error: 'Ogiltigt datum' })
    }

    // Sanitera strängar
    const safe = (s, max = 200) => String(s || '').trim().slice(0, max)
    const sanitized = {
      first_name: safe(first_name, 100),
      last_name: safe(last_name, 100),
      email: safe(email, 200).toLowerCase(),
      phone: safe(phone, 50),
      notes: safe(notes, 1000),
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
          first_name, last_name, email, phone, notes, status, schedule_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed', $11) RETURNING *`,
      [course_id, finalDate, finalTime, participantCount, totalPrice,
        sanitized.first_name, sanitized.last_name, sanitized.email, sanitized.phone, sanitized.notes, schedule_id]
    )
    const booking = bookingResult.rows[0]

    // Link equipment with correct price
    for (const eqId of equipment_ids) {
      const priceRow = await client.query('SELECT rental_price FROM equipment WHERE id = $1', [eqId])
      const eqPrice = priceRow.rows[0]?.rental_price ?? 0
      await client.query(
        'INSERT INTO booking_equipment (booking_id, equipment_id, price) VALUES ($1,$2,$3)',
        [booking.id, eqId, eqPrice]
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
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed']
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
