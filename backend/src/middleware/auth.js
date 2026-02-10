import jwt from 'jsonwebtoken'
import { pool } from '../db/connection.js'

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token provided' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const result = await pool.query(
      'SELECT id, username, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    )
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid token' })

    req.user = result.rows[0]
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export const authenticateAdmin = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  })
}

export const checkFeature = (featureName) => async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = $1",
      [`feature_${featureName}`]
    )
    if (result.rows[0]?.value !== 'true') {
      return res.status(403).json({
        error: `Modulen "${featureName}" är inte aktiverad`,
        feature: featureName,
        enabled: false
      })
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
