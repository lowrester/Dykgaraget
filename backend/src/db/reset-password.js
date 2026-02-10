/**
 * Verktyg för att återställa admin-lösenord
 * Kör: node src/db/reset-password.js
 * Eller: ADMIN_PASSWORD=NyttLösenord node src/db/reset-password.js
 */
import { pool } from './connection.js'
import bcrypt   from 'bcrypt'
import dotenv   from 'dotenv'
dotenv.config()

async function resetPassword() {
  const username = process.env.RESET_USER     || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'Admin123!'

  console.log(`🔐 Återställer lösenord för användaren: ${username}`)

  const hash = await bcrypt.hash(password, 10)

  const result = await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username, email',
    [hash, username]
  )

  if (result.rows.length === 0) {
    console.error(`❌ Användaren "${username}" hittades inte`)
    process.exit(1)
  }

  console.log(`✅ Lösenord uppdaterat för ${result.rows[0].email}`)
  console.log(`   Användarnamn: ${username}`)
  console.log(`   Lösenord: ${password}`)
  console.log('')
  console.log('⚠️  Logga in och byt lösenordet direkt på admin-sidan!')

  await pool.end()
}

resetPassword().catch((err) => {
  console.error('❌ Fel:', err.message)
  process.exit(1)
})
