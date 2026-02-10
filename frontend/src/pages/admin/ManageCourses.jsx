import { useState, useEffect, useMemo } from 'react'
import { useCoursesStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Alert, LevelBadge } from '../../components/common/index.jsx'

const EMPTY = { name:'', level:'Nybörjare', duration:3, price:'', description:'', prerequisites:'', included_materials:'', certification_agency:'PADI', max_participants:10, min_participants:1, is_active:true }
const LEVELS = ['Nybörjare','Fortsättning','Avancerad','Professionell']

export default function ManageCourses() {
  const { courses, fetch, create, update, remove, loading } = useCoursesStore()
  const [modal,  setModal]  = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,   setForm]   = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [alert,  setAlert]  = useState(null)
  const [saving, setSaving] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

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

  const openNew  = () => { setEditing(null); setForm(EMPTY); setErrors({}); setModal(true) }
  const openEdit = (c) => { setEditing(c); setForm({ ...c, price: String(c.price) }); setErrors({}); setModal(true) }
  const closeModal = () => { setModal(false); setEditing(null) }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())                       e.name        = 'Namn krävs'
    if (!form.price || parseFloat(form.price) < 0) e.price    = 'Ange ett giltigt pris'
    if (form.duration < 1)                        e.duration   = 'Minst 1 dag'
    if (!form.description.trim())                 e.description = 'Beskrivning krävs'
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
      else         await create(payload)
      setAlert({ type: 'success', msg: editing ? 'Kurs uppdaterad!' : 'Kurs skapad!' })
      closeModal()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (course) => {
    if (!window.confirm(`Ta bort "${course.name}"?`)) return
    try {
      await remove(course.id)
      setAlert({ type: 'success', msg: 'Kurs borttagen' })
    } catch (err) {
      setAlert({ type: 'error', msg: err.message })
    }
  }

  return (
    <AdminLayout title="Hantera kurser">
      {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <div className="page-actions">
        <Button onClick={openNew}>+ Ny kurs</Button>
      </div>

      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <Card>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('name')}>Namn<SortIcon col="name"/></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('level')}>Nivå<SortIcon col="level"/></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('duration')}>Längd<SortIcon col="duration"/></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('price')}>Pris<SortIcon col="price"/></th>
                <th>Max</th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('is_active')}>Status<SortIcon col="is_active"/></th>
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
                    <button className="btn btn-sm btn-danger"    onClick={() => handleDelete(c)} style={{marginLeft:'0.5rem'}}>Ta bort</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

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
          <div className="form-group" style={{display:'flex',alignItems:'center',gap:'0.5rem',paddingTop:'1.5rem'}}>
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
          <label className="form-label">Beskrivning *</label>
          <textarea className="form-input form-textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          {errors.description && <span className="error-msg">{errors.description}</span>}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={closeModal}>Avbryt</Button>
          <Button onClick={handleSave} loading={saving}>Spara</Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
