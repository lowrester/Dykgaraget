import { useState, useEffect, useRef } from 'react'
import { useInstructorsStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input } from '../../components/common/index.jsx'
import { api } from '../../api/client.js'

const EMPTY = { name: '', specialty: '', experience_years: 0, certifications: '', bio: '', hourly_rate: '', photo_url: '', is_available: true }

export default function ManageInstructors() {
  const { instructors, fetch, create, update, remove, loading } = useInstructorsStore()
  const { addToast, ask } = useUIStore()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetch() }, [fetch])

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (i) => { setEditing(i); setForm({ ...i, hourly_rate: String(i.hourly_rate || '') }); setModal(true) }
  const close = () => { setModal(false); setEditing(null) }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const { url } = await api.post('/instructors/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      set('photo_url', url)
      addToast('Bild uppladdad!')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, experience_years: parseInt(form.experience_years) || 0, hourly_rate: parseFloat(form.hourly_rate) || 0 }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      addToast(editing ? 'Instruktör uppdaterad!' : 'Instruktör skapad!')
      close()
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (inst) => {
    const ok = await ask({ title: 'Ta bort instruktör?', message: `Är du säker på att du vill ta bort "${inst.name}"?`, type: 'danger', confirmText: 'Ta bort' })
    if (!ok) return
    try {
      await remove(inst.id)
      addToast('Instruktör borttagen')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const getFullUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    const base = import.meta.env.VITE_API_URL || '/api'
    // Om det börjar med /uploads, ta bort /api om det finns i base (förenklat)
    const normalizedBase = base.endsWith('/api') ? base.slice(0, -4) : base
    return `${normalizedBase}${url}`
  }

  return (
    <AdminLayout title="Instruktörer">
      <div className="page-actions"><Button onClick={openNew}>+ Ny instruktör</Button></div>
      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <div className="grid grid-3">
          {instructors.length === 0 && <p className="empty">Inga instruktörer ännu</p>}
          {instructors.map((inst) => (
            <Card key={inst.id} className="instructor-card">
              {inst.photo_url
                ? <img src={getFullUrl(inst.photo_url)} alt={inst.name} className="instructor-avatar" style={{ objectFit: 'cover' }} />
                : <div className="instructor-avatar">{inst.name.charAt(0)}</div>
              }
              <h3>{inst.name}</h3>
              <p className="instructor-specialty">{inst.specialty}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>{inst.bio}</p>
              <p style={{ fontSize: '0.8rem' }}><strong>Erfarenhet:</strong> {inst.experience_years} år</p>
              <p style={{ fontSize: '0.8rem' }}><strong>Certifikat:</strong> {inst.certifications}</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(inst)}>Redigera</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(inst)}>Ta bort</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={modal} onClose={close} title={editing ? 'Redigera instruktör' : 'Ny instruktör'} size="lg">
        <div className="grid grid-2">
          <Input label="Namn" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <Input label="Specialitet" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} />
          <Input label="Erfarenhet (år)" type="number" min={0} value={form.experience_years} onChange={(e) => set('experience_years', e.target.value)} />
          <Input label="Timarvode (kr)" type="number" min={0} value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Certifieringar</label>
          <input className="form-input" value={form.certifications} onChange={(e) => set('certifications', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Bio</label>
          <textarea className="form-input form-textarea" rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Profilbild</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {form.photo_url ? (
              <img
                src={getFullUrl(form.photo_url)}
                alt="Förhandsgranskning"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gray-200)' }}
              />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>
            )}
            <div style={{ flex: 1 }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileUpload}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
              >
                {form.photo_url ? 'Byt bild' : 'Ladda upp bild'}
              </Button>
              <div style={{ marginTop: '0.5rem' }}>
                <Input
                  value={form.photo_url || ''}
                  onChange={(e) => set('photo_url', e.target.value)}
                  placeholder="Eller klistra in en URL här..."
                  style={{ marginBottom: 0 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="inst_avail" checked={form.is_available} onChange={(e) => set('is_available', e.target.checked)} />
          <label htmlFor="inst_avail">Tillgänglig för bokningar</label>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>Avbryt</Button>
          <Button onClick={handleSave} loading={saving}>Spara</Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
