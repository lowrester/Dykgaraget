import express from 'express'
import { processOrder } from '../services/orders.js'

const router = express.Router()

// POST /api/orders - Process a checkout/order
router.post('/', async (req, res) => {
    try {
        const orderData = req.body

        // Basic validation
        if (!orderData.items || !orderData.items.length) {
            return res.status(400).json({ error: 'Varukorgen är tom' })
        }
        if (!orderData.email) {
            return res.status(400).json({ error: 'E-post krävs' })
        }

        const result = await processOrder(orderData)

        // If stripe was requested and is active, stripe_url would be generated here if we integrate it.
        // For now, we focus on the invoice path.

        res.status(201).json(result)
    } catch (err) {
        console.error('Order error:', err)
        res.status(500).json({ error: err.message })
    }
})

export default router
