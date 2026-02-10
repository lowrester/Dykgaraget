import { describe, it, expect } from 'vitest'
import express from 'express'
import authRoutes from './routes/auth.js'

describe('Backend Smoke Test', () => {
    it('loads auth routes without error', () => {
        const app = express()
        app.use('/auth', authRoutes)
        expect(app._router.stack.length).toBeGreaterThan(0)
    })
})
