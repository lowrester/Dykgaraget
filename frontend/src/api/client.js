import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Token i minnet - laddas från sessionStorage vid start
// sessionStorage rensas när fliken stängs (bättre än localStorage)
let _token = null

export function setToken(t) {
  _token = t
  try { sessionStorage.setItem('dyk_tok', t) } catch { /* privat läge */ }
}

export function clearToken() {
  _token = null
  try { sessionStorage.removeItem('dyk_tok') } catch { /* privat läge */ }
}

export function loadToken() {
  try {
    const stored = sessionStorage.getItem('dyk_tok')
    if (stored) { _token = stored }
    return stored
  } catch { return null }
}

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Något gick fel'
    // Om 401 - rensa token
    if (err.response?.status === 401) clearToken()
    return Promise.reject(new Error(msg))
  }
)

export default client

// Namngivet hjälpobjekt för komponenter som importerar { api }
export const api = {
  get:    (url, cfg)       => client.get(url, cfg),
  post:   (url, data, cfg) => client.post(url, data, cfg),
  put:    (url, data, cfg) => client.put(url, data, cfg),
  delete: (url, cfg)       => client.delete(url, cfg),
}
