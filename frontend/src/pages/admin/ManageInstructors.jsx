import { useState, useEffect } from 'react'
import { useInstructorsStore } from '../../store/index.js'
import { AdminLayout, Card, Modal, Button, Input, Alert } from '../../components/common/index.jsx'

const EMPTY = { name:'', specialty:'', experience_years:0, certifications:'', bio:'', hourly_rate:'', is_available:true }

export default function ManageInstructors() {
  const { instructors, fetch, create, update, remove, loading } = useInstructorsStore()
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [alert,   setAlert]   = useState(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { fetch() }, [fetch])

  const openNew  = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (i) => { setEditing(i); setForm({ ...i, hourly_rate: String(i.hourly_rate || '') }); setModal(true) }
  const close    = () => { setModal(false); setEditing(null) }
  const set      = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, experience_years: parseInt(form.experience_years) || 0, hourly_rate: parseFloat(form.hourly_rate) || 0 }
      if (editing) await update(editing.id, payload)
      else         await create(payload)
      setAlert({ type:'success', msg: editing ? 'Uppdaterad!' : 'Skapad!' })
      close()
    } catch (err) {
      setAlert({ type:'error', msg: err.message })
    } finally { setSaving(false) }
  }

  const handleDelete = async (inst) => {
    if (!window.confirm(`Ta bort "${inst.name}"?`)) return
    try { await remove(inst.id); setAlert({ type:'success', msg:'Borttagen' }) }
    catch (err) { setAlert({ type:'error', msg: err.message }) }
  }

  return (
    <AdminLayout title="Instruktörer">
      {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}
      <div className="page-actions"><Button onClick={openNew}>+ Ny instruktör</Button></div>
      {loading ? <div className="spinner-wrapper"><div className="spinner" /></div> : (
        <div className="grid grid-3">
          {instructors.length === 0 && <p className="empty">Inga instruktörer ännu</p>}
          {instructors.map((inst) => (
            <Card key={inst.id} className="instructor-card">
              <div className="instructor-avatar">{inst.name.charAt(0)}</div>
              <h3>{inst.name}</h3>
              <p className="instructor-specialty">{inst.specialty}</p>
              <p style={{fontSize:'0.875rem',color:'var(--gray-600)'}}>{inst.bio}</p>
              <p style={{fontSize:'0.8rem'}}><strong>Erfarenhet:</strong> {inst.experience_years} år</p>
              <p style={{fontSize:'0.8rem'}}><strong>Certifikat:</strong> {inst.certifications}</p>
              <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem'}}>
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
        <div className="form-group" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
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
