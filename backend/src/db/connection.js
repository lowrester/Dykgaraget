import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool, types } = pg

// Return DATE (1082) as raw string YYYY-MM-DD instead of Date object
types.setTypeParser(1082, (val) => val)

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dykgaraget',
  user: process.env.DB_USER || 'dykgaraget_user',
  password: process.env.DB_PASSWORD || '',
  max: 10,          // Max antal anslutningar i poolen
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[DB] Oväntat fel på inaktiv klient:', err.message)
})

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DB] Ny anslutning upprättad')
  }
})

// Testa anslutningen vid uppstart
pool.query('SELECT 1')
  .then(() => console.log('[DB] PostgreSQL ansluten ✓'))
  .catch((err) => {
    console.error('[DB] KRITISKT: Kan inte ansluta till PostgreSQL:', err.message)
    console.error('[DB] Kontrollera DB_HOST, DB_NAME, DB_USER, DB_PASSWORD i .env')
    process.exit(1)
  })

export default pool
