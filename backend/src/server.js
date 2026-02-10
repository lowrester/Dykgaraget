import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { pool } from './db/connection.js'

import authRoutes from './routes/auth.js'
import coursesRoutes from './routes/courses.js'
import equipmentRoutes from './routes/equipment.js'
import instructorsRoutes from './routes/instructors.js'
import bookingsRoutes from './routes/bookings.js'
import invoicesRoutes from './routes/invoices.js'
import paymentsRoutes from './routes/payments.js'
import settingsRoutes from './routes/settings.js'
import contactRoutes from './routes/contact.js'
import usersRoutes from './routes/users.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// ── Trust proxy (krävs bakom nginx/one.com) ──────────────────
app.set('trust proxy', 1)

// ── Security ─────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Hanteras av nginx
}))

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(o => o.trim()) : [])
]
app.use(cors({
  origin: (origin, cb) => {
    // Tillåt requests utan origin (curl, Postman, server-till-server)
    if (!origin) return cb(null, true)
    // Exakt match eller kollar listan
    if (allowedOrigins.includes(origin)) return cb(null, true)

    cb(new Error(`CORS: ${origin} ej tillåten`))
  },
  credentials: true,
}))

// ── Rate limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många förfrågningar, försök igen om en stund' },
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'För många inloggningsförsök, vänta 15 minuter' },
})
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)

// ── Body parsing ──────────────────────────────────────────────
// Stripe webhook behöver raw body — montera FÖRE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── Static uploads ────────────────────────────────────────────
app.use('/uploads', express.static('uploads'))

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS time')
    res.json({
      status: 'healthy',
      timestamp: result.rows[0].time,
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development',
    })
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message })
  }
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/courses', coursesRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/instructors', instructorsRoutes)
app.use('/api/bookings', bookingsRoutes)
app.use('/api/invoices', invoicesRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/users', usersRoutes)

// ── 404 ───────────────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint hittades inte' })
})

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production'
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message)
  if (isDev) console.error(err.stack)

  // CORS error
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message })
  }

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internt serverfel',
    ...(isDev && { stack: err.stack }),
  })
})

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Dykgaraget API kör på port ${PORT}`)
  console.log(`🌍 Miljö: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`)
})
