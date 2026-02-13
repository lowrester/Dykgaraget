import { pool } from '../db/connection.js'

export const logAction = async (userId, action, entityType = null, entityId = null, metadata = {}, req = null) => {
    try {
        const ip = req?.ip || req?.headers['x-forwarded-for'] || null
        const ua = req?.headers['user-agent'] || null

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entityType, entityId, JSON.stringify(metadata), ip, ua]
        )
    } catch (err) {
        console.error('Audit log error:', err.message)
        // Don't throw — we don't want to crash the request if logging fails
    }
}
