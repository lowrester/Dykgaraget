import { useState, useEffect, useMemo } from 'react'
import { useCoursesStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, LevelBadge } from '../../components/common/index.jsx'

const EMPTY = { name: '', level: 'Nybörjare', duration: 3, price: '', description: '', prerequisites: '', included_materials: '', certification_agency: 'PADI', max_participants: 10, min_participants: 1, is_active: true }
const LEVELS = ['Nybörjare', 'Fortsättning', 'Avancerad', 'Professionell']

export default function ManageCourses() {
  const { courses, fetch, create, update, remove, loading, fetchSchedules, addSchedule, removeSchedule } = useCoursesStore()
  const { addToast, ask } = useUIStore()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  // Schedules state
  const [schedModal, setSchedModal] = useState(false)
  const [schedCourse, setSchedCourse] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [schedForm, setSchedForm] = useState({
    start_date: '',
    start_time: '09:00',
    end_date: '',
    max_participants: 10,
    sessions: [{ date: '', time: '09:00' }]
  })

  const sorted = useMemo(() => {
    return [...courses].sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy]
      if (sortBy === 'price' || sortBy === 'duration') { va = parseFloat(va); vb = parseFloat(vb) }
      else { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase() }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
  }, [courses, sortBy, sortDir])

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }
  const SortIcon = ({ col }) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ·'

  useEffect(() => { fetch() }, [fetch])

  const openNew = () => { setEditing(null); setForm(EMPTY); setErrors({}); setModal(true) }
  const openEdit = (c) => { setEditing(c); setForm({ ...c, price: String(c.price) }); setErrors({}); setModal(true) }
  const closeModal = () => { setModal(false); setEditing(null) }

  // Schedules handlers
  const openSchedules = async (c) => {
    setSchedCourse(c)
    setSchedModal(true)
    try {
      const data = await fetchSchedules(c.id)
      setSchedules(data)
    } catch (err) {
      addToast('Kunde inte ladda schema: ' + err.message, 'error')
    }
  }

  const handleAddSchedule = async () => {
    const firstSession = schedForm.sessions[0]
    if (!firstSession?.date || !firstSession?.time) {
      addToast('Minst ett datum och tid krävs', 'warning')
      return
    }

    // Prevent past dates
    const selected = new Date(firstSession.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected < today) {
      addToast('Kan inte lägga till datum bakåt i tiden', 'warning')
      return
    }

    try {
      const resp = await addSchedule(schedCourse.id, schedForm)
      setSchedules(s => [...s, resp].sort((a, b) => a.start_date.localeCompare(b.start_date)))
      setSchedForm({ ...schedForm, sessions: [{ date: '', time: '09:00' }] })
      addToast('Datum tillagt!')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleRemoveSchedule = async (sid) => {
    const ok = await ask({ title: 'Ta bort datum?', message: 'Är du säker på att du vill ta bort detta schema-datum?', type: 'danger', confirmText: 'Ta bort' })
    if (!ok) return
    try {
      await removeSchedule(schedCourse.id, sid)
      setSchedules(s => s.filter(i => i.id !== sid))
      addToast('Datum borttaget')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Namn krävs'
    if (!form.price || parseFloat(form.price) < 0) e.price = 'Ange ett giltigt pris'
    if (form.duration < 1) e.duration = 'Minst 1 dag'
    if (form.max_participants < form.min_participants) e.max_participants = 'Max måste vara ≥ min'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { ...form, price: parseFloat(form.price), duration: parseInt(form.duration), max_participants: parseInt(form.max_participants), min_participants: parseInt(form.min_participants) }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      addToast(editing ? 'Kurs uppdaterad!' : 'Kurs skapad!')
      closeModal()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (course) => {
    const ok = await ask({ title: 'Ta bort kurs?', message: `Är du säker på att du vill ta bort "${course.name}"? Detta går inte att ångra.`, type: 'danger', confirmText: 'Ta bort' })
    if (!ok) return
    try {
      await remove(course.id)
      addToast('Kurs borttagen')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <AdminLayout title="Hantera kurser">

      <div className="page-actions">
        <Button onClick={openNew}>+ Ny kurs</Button>
      </div>

      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Namn<SortIcon col="name" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('level')}>Nivå<SortIcon col="level" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('duration')}>Längd<SortIcon col="duration" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('price')}>Pris<SortIcon col="price" /></th>
                <th>Max</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('is_active')}>Status<SortIcon col="is_active" /></th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={7} className="empty">Inga kurser ännu</td></tr>}
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><LevelBadge level={c.level} /></td>
                  <td>{c.duration} dag{c.duration > 1 ? 'ar' : ''}</td>
                  <td>{parseFloat(c.price).toLocaleString('sv-SE')} kr</td>
                  <td>{c.max_participants}</td>
                  <td><span className={`badge ${c.is_active ? 'badge-success' : 'badge-default'}`}>{c.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Redigera</button>
                    <button className="btn btn-sm btn-outline" onClick={() => openSchedules(c)} style={{ marginLeft: '0.5rem' }}>📅 Schema</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)} style={{ marginLeft: '0.5rem' }}>Ta bort</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal isOpen={modal} onClose={closeModal} title={editing ? 'Redigera kurs' : 'Ny kurs'} size="lg">
        {errors.submit && <Alert type="error">{errors.submit}</Alert>}
        <div className="grid grid-2">
          <Input label="Kursnamn" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required />
          <div className="form-group">
            <label className="form-label">Nivå *</label>
            <select className="form-input form-select" value={form.level} onChange={(e) => set('level', e.target.value)}>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <Input label="Längd (dagar)" type="number" min={1} value={form.duration} onChange={(e) => set('duration', e.target.value)} error={errors.duration} required />
          <Input label="Pris (kr)" type="number" min={0} value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} required />
          <Input label="Min deltagare" type="number" min={1} value={form.min_participants} onChange={(e) => set('min_participants', e.target.value)} />
          <Input label="Max deltagare" type="number" min={1} value={form.max_participants} onChange={(e) => set('max_participants', e.target.value)} error={errors.max_participants} />
          <Input label="Certifieringsorgan" value={form.certification_agency} onChange={(e) => set('certification_agency', e.target.value)} />
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="is_active">Aktiv (visas på webbplatsen)</label>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Förkunskaper</label>
          <input className="form-input" value={form.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Inkluderat material</label>
          <input className="form-input" value={form.included_materials} onChange={(e) => set('included_materials', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Beskrivning</label>
          <textarea className="form-input form-textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          {errors.description && <span className="error-msg">{errors.description}</span>}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={closeModal}>Avbryt</Button>
          <Button onClick={handleSave} loading={saving}>Spara</Button>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal isOpen={schedModal} onClose={() => setSchedModal(false)} title={`Schema: ${schedCourse?.name}`} size="lg">
        <Card style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--gray-50)' }}>
          <h4 style={{ marginBottom: '.75rem', fontSize: '.9rem' }}>Lägg till datum</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '1rem', alignItems: 'end' }}>
            <Input label="Max deltagare" type="number" value={schedForm.max_participants} onChange={e => setSchedForm({ ...schedForm, max_participants: e.target.value })} />
            <Button onClick={handleAddSchedule} style={{ marginBottom: '1rem' }}>Lägg till hela schemat</Button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--gray-500)' }}>SCHEMA (DATUM & TIDER)</div>
            {schedForm.sessions.map((session, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
                <Input
                  type="date"
                  value={session.date}
                  onChange={e => {
                    const newSessions = [...schedForm.sessions]
                    newSessions[idx].date = e.target.value
                    setSchedForm({ ...schedForm, sessions: newSessions })
                  }}
                />
                <Input
                  type="time"
                  value={session.time}
                  onChange={e => {
                    const newSessions = [...schedForm.sessions]
                    newSessions[idx].time = e.target.value
                    setSchedForm({ ...schedForm, sessions: newSessions })
                  }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  {idx > 0 && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      style={{ padding: '0.5rem', height: '38px', width: '38px' }}
                      onClick={() => setSchedForm({ ...schedForm, sessions: schedForm.sessions.filter((_, i) => i !== idx) })}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              style={{ width: '100%', marginTop: '0.25rem' }}
              onClick={() => setSchedForm({ ...schedForm, sessions: [...schedForm.sessions, { date: '', time: '09:00' }] })}
            >
              + Lägg till dag/session
            </Button>
          </div>
        </Card>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Tid</th>
              <th>Max deltagare</th>
              <th>Platser kvar</th>
              <th>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && <tr><td colSpan={5} className="empty">Inga datum inlagda</td></tr>}
            {schedules.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {(s.sessions || [{ date: s.start_date, time: s.start_time }]).map((sess, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem' }}>
                        {sess.date} <span style={{ color: 'var(--gray-400)' }}>kl {sess.time?.substring(0, 5)}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td>—</td>
                <td>{s.max_participants}</td>
                <td>{s.max_participants - s.current_participants}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleRemoveSchedule(s.id)}>Ta bort</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-footer">
          <Button onClick={() => setSchedModal(false)}>Klar</Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
