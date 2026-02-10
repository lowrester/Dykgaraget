import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { pool } from './db/connection.js'

import authRoutes       from './routes/auth.js'
import coursesRoutes    from './routes/courses.js'
import equipmentRoutes  from './routes/equipment.js'
import instructorsRoutes from './routes/instructors.js'
import bookingsRoutes   from './routes/bookings.js'
import invoicesRoutes   from './routes/invoices.js'
import paymentsRoutes   from './routes/payments.js'
import settingsRoutes   from './routes/settings.js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3000

// ── Security ────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// ── Rate limiting ────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Static uploads ───────────────────────────────────────────
app.use('/uploads', express.static('uploads'))

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'healthy', timestamp: new Date(), version: '1.0.0' })
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message })
  }
})

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',        authRoutes)
app.use('/api/courses',     coursesRoutes)
app.use('/api/equipment',   equipmentRoutes)
app.use('/api/instructors', instructorsRoutes)
app.use('/api/bookings',    bookingsRoutes)
app.use('/api/invoices',    invoicesRoutes)
app.use('/api/payments',    paymentsRoutes)
app.use('/api/settings',    settingsRoutes)

// ── 404 ──────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Dykgaraget API running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`)
})
