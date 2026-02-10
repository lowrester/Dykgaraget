import express from 'express'
import { pool } from '../db/connection.js'
import { authenticateAdmin, checkFeature } from '../middleware/auth.js'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()
router.use(checkFeature('payment'))

// POST /api/payments/create-checkout
router.post('/create-checkout', async (req, res) => {
  try {
    const { invoice_id } = req.body
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id krävs' })

    const invResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice_id])
    if (invResult.rows.length === 0) return res.status(404).json({ error: 'Faktura hittades inte' })
    const invoice = invResult.rows[0]

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe ej konfigurerat (STRIPE_SECRET_KEY saknas)' })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'sek',
          product_data: { name: `Faktura ${invoice.invoice_number}` },
          unit_amount: Math.round(parseFloat(invoice.total_amount) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/betalning/bekraftad?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/betalning/avbruten`,
      metadata: { invoice_id: String(invoice.id), invoice_number: invoice.invoice_number },
    })

    // Save session reference
    await pool.query(
      `INSERT INTO payments (invoice_id, stripe_session_id, amount, status)
       VALUES ($1, $2, $3, 'pending')`,
      [invoice.id, session.id, invoice.total_amount]
    )

    res.json({ url: session.url, session_id: session.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/webhook  - Stripe calls this
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.sendStatus(200)

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const sig = req.headers['stripe-signature']
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const invoiceId = session.metadata?.invoice_id

      if (invoiceId) {
        await pool.query(
          "UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1",
          [invoiceId]
        )
        await pool.query(
          "UPDATE payments SET status='paid', stripe_payment_intent=$1, updated_at=NOW() WHERE stripe_session_id=$2",
          [session.payment_intent, session.id]
        )
      }
    }

    res.sendStatus(200)
  } catch (err) {
    console.error('Webhook error:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
  }
})

// GET /api/payments/:invoiceId
router.get('/:invoiceId', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
      [req.params.invoiceId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
