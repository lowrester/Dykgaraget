import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App.jsx'

// Mock store to avoid network calls during smoke test
vi.mock('../store/index.js', () => ({
    useAuthStore: () => ({ initAuth: vi.fn().mockResolvedValue({}), user: null, loading: false }),
    useSettingsStore: () => ({ fetchFeatures: vi.fn().mockResolvedValue({}), features: {} }),
    useUIStore: () => ({})
}))

describe('App Smoke Test', () => {
    it('renders without crashing', async () => {
        render(<App />)
        // The spinner should be visible initially while ready is false
        expect(document.querySelector('.spinner')).toBeInTheDocument()
    })
})
