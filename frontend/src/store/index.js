import { create } from 'zustand'
import client, { setToken, clearToken, loadToken } from '../api/client.js'

// ── Auth store ─────────────────────────────────────────────────
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  // Körs vid app-start: återställ session om token finns i sessionStorage
  initAuth: async () => {
    const stored = loadToken()
    if (!stored) return
    try {
      const data = await client.get('/auth/me')
      set({ user: data.user, token: stored })
    } catch {
      // Token ogiltig (utgången eller server omstartad) — rensa
      clearToken()
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const data = await client.post('/auth/login', { username, password })
      setToken(data.token)
      set({ user: data.user, token: data.token, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  logout: () => {
    clearToken()
    set({ user: null, token: null })
  },

  changePassword: async (currentPassword, newPassword) => {
    return await client.post('/auth/change-password', { currentPassword, newPassword })
  },
}))

// ── Settings / feature flags store ───────────────────────────
export const useSettingsStore = create((set, get) => ({
  features: {
    equipment: true,
    invoicing: true,
    payment: false,
    email: true,
  },
  settings: [],
  content: {}, // Maps content_key to value
  loading: false,
  error: null,

  fetchFeatures: async () => {
    try {
      const data = await client.get('/settings/features')
      set({ features: data })
    } catch { /* använd defaults om API är nere */ }
  },

  fetchSettings: async () => {
    set({ loading: true })
    try {
      const data = await client.get('/settings')
      // Map content_ keys into a nice object
      const contentMap = data
        .filter(s => s.key.startsWith('content_'))
        .reduce((acc, s) => ({ ...acc, [s.key.replace('content_', '')]: s.value }), {})

      set({ settings: data, content: contentMap, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  updateSetting: async (key, value) => {
    const data = await client.put(`/settings/${key}`, { value })
    if (key.startsWith('feature_')) await get().fetchFeatures()
    await get().fetchSettings() // Refresh both settings and content map
    return data
  },
}))

// ── Courses store ──────────────────────────────────────────────
export const useCoursesStore = create((set) => ({
  courses: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await client.get('/courses')
      set({ courses: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  create: async (payload) => {
    const data = await client.post('/courses', payload)
    set((s) => ({ courses: [...s.courses, data] }))
    return data
  },

  update: async (id, payload) => {
    const data = await client.put(`/courses/${id}`, payload)
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? data : c)) }))
    return data
  },

  remove: async (id) => {
    await client.delete(`/courses/${id}`)
    set((s) => ({ courses: s.courses.filter((c) => c.id !== id) }))
  },

  // Schedules
  fetchSchedules: async (id) => {
    return await client.get(`/courses/${id}/schedules`)
  },

  addSchedule: async (id, payload) => {
    return await client.post(`/courses/${id}/schedules`, payload)
  },

  removeSchedule: async (id, scheduleId) => {
    return await client.delete(`/courses/${id}/schedules/${scheduleId}`)
  },
}))

// ── Equipment store ────────────────────────────────────────────
export const useEquipmentStore = create((set) => ({
  equipment: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await client.get('/equipment')
      set({ equipment: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  create: async (payload) => {
    const data = await client.post('/equipment', payload)
    set((s) => ({ equipment: [...s.equipment, data] }))
    return data
  },

  update: async (id, payload) => {
    const data = await client.put(`/equipment/${id}`, payload)
    set((s) => ({ equipment: s.equipment.map((e) => (e.id === id ? data : e)) }))
    return data
  },

  remove: async (id) => {
    await client.delete(`/equipment/${id}`)
    set((s) => ({ equipment: s.equipment.filter((e) => e.id !== id) }))
  },
}))

// ── Instructors store ──────────────────────────────────────────
export const useInstructorsStore = create((set) => ({
  instructors: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await client.get('/instructors')
      set({ instructors: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  create: async (payload) => {
    const data = await client.post('/instructors', payload)
    set((s) => ({ instructors: [...s.instructors, data] }))
    return data
  },

  update: async (id, payload) => {
    const data = await client.put(`/instructors/${id}`, payload)
    set((s) => ({ instructors: s.instructors.map((i) => (i.id === id ? data : i)) }))
    return data
  },

  remove: async (id) => {
    await client.delete(`/instructors/${id}`)
    set((s) => ({ instructors: s.instructors.filter((i) => i.id !== id) }))
  },
}))

// ── Bookings store ─────────────────────────────────────────────
export const useBookingsStore = create((set) => ({
  bookings: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await client.get('/bookings')
      set({ bookings: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  create: async (payload) => {
    const data = await client.post('/bookings', payload)
    set((s) => ({ bookings: [data, ...s.bookings] }))
    return data
  },

  updateStatus: async (id, status) => {
    const data = await client.put(`/bookings/${id}/status`, { status })
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? data : b)) }))
    return data
  },
}))

// ── Invoices store ─────────────────────────────────────────────
export const useInvoicesStore = create((set) => ({
  invoices: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await client.get('/invoices')
      set({ invoices: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  create: async (bookingId) => {
    const data = await client.post('/invoices', { booking_id: bookingId })
    set((s) => ({ invoices: [data, ...s.invoices] }))
    return data
  },

  markPaid: async (id) => {
    const data = await client.put(`/invoices/${id}/paid`)
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? data : i)) }))
    return data
  },

  sendEmail: async (id) => {
    return await client.post(`/invoices/${id}/email`)
  },

  downloadPdf: (id) => {
    const base = import.meta.env.VITE_API_URL || '/api'
    window.open(`${base}/invoices/${id}/pdf`, '_blank')
  },
}))

// ── UI Store (Toasts & Confirmations) ──────────────────────────
export const useUIStore = create((set, get) => ({
  toasts: [],
  confirm: null, // { title, message, onConfirm, onCancel, type }

  addToast: (message, type = 'success', duration = 4000) => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    if (duration) {
      setTimeout(() => get().removeToast(id), duration)
    }
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  ask: (options) => {
    return new Promise((resolve) => {
      set({
        confirm: {
          ...options,
          onConfirm: () => {
            set({ confirm: null })
            resolve(true)
          },
          onCancel: () => {
            set({ confirm: null })
            resolve(false)
          },
        },
      })
    })
  },
}))
