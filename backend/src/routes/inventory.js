import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// ── Suppliers ──────────────────────────────────────────────

// GET /api/inventory/suppliers
router.get('/suppliers', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM suppliers ORDER BY name ASC')
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /api/inventory/suppliers
router.post('/suppliers', authenticateAdmin, async (req, res) => {
    const { name, contact_person, email, phone, address } = req.body
    try {
        const result = await pool.query(
            `INSERT INTO suppliers (name, contact_person, email, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, contact_person, email, phone, address]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ── Purchase Orders ────────────────────────────────────────

// GET /api/inventory/po
router.get('/po', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT po.*, s.name as supplier_name 
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `)
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /api/inventory/po
router.post('/po', authenticateAdmin, async (req, res) => {
    const client = await pool.connect()
    try {
        const { supplier_id, items, notes } = req.body
        await client.query('BEGIN')

        const poNumber = `PO-${Date.now()}` // Basic logic, could use seq

        const poRes = await client.query(
            `INSERT INTO purchase_orders (supplier_id, po_number, notes, status)
       VALUES ($1, $2, $3, 'draft') RETURNING *`,
            [supplier_id, poNumber, notes]
        )
        const po = poRes.rows[0]

        let totalAmount = 0
        for (const item of items) {
            const lineTotal = item.quantity_ordered * item.unit_price
            totalAmount += lineTotal
            await client.query(
                `INSERT INTO purchase_order_items (purchase_order_id, equipment_id, description, quantity_ordered, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [po.id, item.equipment_id, item.description, item.quantity_ordered, item.unit_price, lineTotal]
            )
        }

        await client.query('UPDATE purchase_orders SET total_amount = $1 WHERE id = $2', [totalAmount, po.id])

        await client.query('COMMIT')
        res.status(201).json({ ...po, total_amount: totalAmount })
    } catch (err) {
        await client.query('ROLLBACK')
        res.status(500).json({ error: err.message })
    } finally {
        client.release()
    }
})

// POST /api/inventory/po/:id/receive
router.post('/po/:id/receive', authenticateAdmin, async (req, res) => {
    const client = await pool.connect()
    try {
        const { items_received } = req.body // Array of { item_id, quantity_received }
        const poId = req.params.id

        await client.query('BEGIN')

        const poRes = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [poId])
        if (poRes.rows[0].status === 'received') {
            throw new Error('PO redan mottagen')
        }

        for (const data of items_received) {
            await client.query(
                'UPDATE purchase_order_items SET quantity_received = $1 WHERE id = $2',
                [data.quantity_received, data.item_id]
            )

            // Find equipment_id
            const itemRes = await client.query('SELECT equipment_id, description FROM purchase_order_items WHERE id = $1', [data.item_id])
            const { equipment_id } = itemRes.rows[0]

            if (equipment_id) {
                // Log transaction
                await client.query(
                    `INSERT INTO inventory_transactions (equipment_id, type, quantity, reference_type, reference_id, notes)
           VALUES ($1, 'inbound', $2, 'purchase_order', $3, $4)`,
                    [equipment_id, data.quantity_received, poId, 'Inleverans från PO']
                )

                // Update equipment totals
                await client.query(
                    `UPDATE equipment 
           SET quantity_total = quantity_total + $1, 
               quantity_available = quantity_available + $1 
           WHERE id = $2`,
                    [data.quantity_received, equipment_id]
                )
            }
        }

        await client.query(
            'UPDATE purchase_orders SET status = \'received\', received_at = NOW() WHERE id = $1',
            [poId]
        )

        await client.query('COMMIT')
        res.json({ success: true })
    } catch (err) {
        await client.query('ROLLBACK')
        res.status(500).json({ error: err.message })
    } finally {
        client.release()
    }
})

// ── Inventory Transactions ─────────────────────────────────

// GET /api/inventory/transactions/:equipmentId
router.get('/transactions/:equipmentId', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM inventory_transactions WHERE equipment_id = $1 ORDER BY created_at DESC',
            [req.params.equipmentId]
        )
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
