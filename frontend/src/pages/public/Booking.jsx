import { useState, useEffect } from 'react'
import { useCoursesStore, useEquipmentStore, useBookingsStore, useSettingsStore } from '../../store/index.js'
import { Card, Button, Input, Spinner, Alert } from '../../components/common/index.jsx'

const STEPS = ['Välj kurs', 'Dina uppgifter', 'Utrustning', 'Bekräftelse']

export default function Booking() {
  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({
    course_id: '', booking_date: '', booking_time: '09:00',
    first_name: '', last_name: '', email: '', phone: '',
    equipment_ids: [], notes: '',
  })
  const [errors, setErrors]     = useState({})
  const [success, setSuccess]   = useState(null)
  const [loading, setLoading]   = useState(false)

  const { courses, fetch: fetchCourses }       = useCoursesStore()
  const { equipment, fetch: fetchEquipment }   = useEquipmentStore()
  const { create: createBooking }              = useBookingsStore()
  const features                               = useSettingsStore((s) => s.features)

  useEffect(() => { fetchCourses() }, [fetchCourses])
  useEffect(() => {
    if (features.equipment) fetchEquipment()
  }, [features.equipment, fetchEquipment])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const validateStep = () => {
    const e = {}
    if (step === 0) {
      if (!form.course_id)   e.course_id   = 'Välj en kurs'
      if (!form.booking_date) e.booking_date = 'Välj ett datum'
    }
    if (step === 1) {
      if (!form.first_name)  e.first_name  = 'Förnamn krävs'
      if (!form.last_name)   e.last_name   = 'Efternamn krävs'
      if (!form.email)       e.email       = 'E-post krävs'
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Ogiltig e-post'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validateStep()) setStep((s) => s + 1) }
  const prev = () => setStep((s) => s - 1)

  const toggleEquipment = (id) => {
    setForm((f) => ({
      ...f,
      equipment_ids: f.equipment_ids.includes(id)
        ? f.equipment_ids.filter((i) => i !== id)
        : [...f.equipment_ids, id],
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const booking = await createBooking({
        course_id:     parseInt(form.course_id),
        booking_date:  form.booking_date,
        booking_time:  form.booking_time,
        first_name:    form.first_name,
        last_name:     form.last_name,
        email:         form.email,
        phone:         form.phone,
        equipment_ids: form.equipment_ids,
        notes:         form.notes,
      })
      setSuccess(booking)
      setStep(4)
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setLoading(false)
    }
  }

  const selectedCourse = courses.find((c) => c.id === parseInt(form.course_id))

  if (step === 4) {
    return (
      <div className="page container">
        <div className="booking-success">
          <div className="success-icon">✅</div>
          <h1>Bokning bekräftad!</h1>
          <p>Tack {success?.first_name}! Din bokning är registrerad.</p>
          <p>Bokningsnummer: <strong>#{success?.id}</strong></p>
          <p>Bekräftelse skickas till <strong>{success?.email}</strong></p>
          <button className="btn btn-primary" onClick={() => { setStep(0); setForm({ course_id:'',booking_date:'',booking_time:'09:00',first_name:'',last_name:'',email:'',phone:'',equipment_ids:[],notes:'' }) }}>
            Gör en ny bokning
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page container">
      <h1 className="page-title">Boka kurs</h1>

      {/* Stepper */}
      <div className="stepper">
        {STEPS.map((label, i) => (
          <div key={i} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <div className="step-dot">{i < step ? '✓' : i + 1}</div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <Card className="booking-card">
        {/* Step 0 – Course */}
        {step === 0 && (
          <div className="booking-step">
            <h2>Välj kurs och datum</h2>
            <div className="form-group">
              <label className="form-label">Kurs *</label>
              {errors.course_id && <span className="error-msg">{errors.course_id}</span>}
              <div className="course-select-grid">
                {courses.filter(c => c.is_active).map((course) => (
                  <div
                    key={course.id}
                    className={`course-option ${form.course_id === String(course.id) ? 'selected' : ''}`}
                    onClick={() => set('course_id', String(course.id))}
                  >
                    <strong>{course.name}</strong>
                    <span>{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                    <span>{course.duration} dag{course.duration > 1 ? 'ar' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-2">
              <Input label="Datum" type="date" value={form.booking_date} onChange={(e) => set('booking_date', e.target.value)} error={errors.booking_date} required min={new Date().toISOString().split('T')[0]} />
              <Input label="Tid" type="time" value={form.booking_time} onChange={(e) => set('booking_time', e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 1 – Personal info */}
        {step === 1 && (
          <div className="booking-step">
            <h2>Dina uppgifter</h2>
            <div className="grid grid-2">
              <Input label="Förnamn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} required />
              <Input label="Efternamn" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} required />
              <Input label="E-post" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required />
              <Input label="Telefon" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Övrigt</label>
              <textarea className="form-input form-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Eventuella önskemål eller frågor..." />
            </div>
          </div>
        )}

        {/* Step 2 – Equipment */}
        {step === 2 && (
          <div className="booking-step">
            <h2>Utrustning</h2>
            {!features.equipment ? (
              <Alert type="info">Utrustningsuthyrning är inte tillgänglig för tillfället.</Alert>
            ) : equipment.length === 0 ? (
              <Spinner text="Hämtar utrustning..." />
            ) : (
              <>
                <p className="step-desc">Välj den utrustning du vill hyra (100 kr/dag per artikel).</p>
                <div className="equipment-grid">
                  {equipment.map((item) => (
                    <div
                      key={item.id}
                      className={`equipment-option ${form.equipment_ids.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => toggleEquipment(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <span>Stl {item.size}</span>
                      <span>{parseFloat(item.rental_price).toLocaleString('sv-SE')} kr/dag</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3 – Confirm */}
        {step === 3 && (
          <div className="booking-step">
            <h2>Bekräfta bokning</h2>
            {errors.submit && <Alert type="error">{errors.submit}</Alert>}
            <div className="summary">
              <div className="summary-row"><span>Kurs:</span><strong>{selectedCourse?.name}</strong></div>
              <div className="summary-row"><span>Datum:</span><strong>{form.booking_date} kl {form.booking_time}</strong></div>
              <div className="summary-row"><span>Namn:</span><strong>{form.first_name} {form.last_name}</strong></div>
              <div className="summary-row"><span>E-post:</span><strong>{form.email}</strong></div>
              {form.phone && <div className="summary-row"><span>Telefon:</span><strong>{form.phone}</strong></div>}
              {form.equipment_ids.length > 0 && (
                <div className="summary-row"><span>Utrustning:</span><strong>{form.equipment_ids.length} artiklar</strong></div>
              )}
              <div className="summary-row summary-total">
                <span>Totalt:</span>
                <strong>{selectedCourse ? parseFloat(selectedCourse.price).toLocaleString('sv-SE') : 0} kr</strong>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="booking-nav">
          {step > 0 && <Button variant="secondary" onClick={prev}>← Tillbaka</Button>}
          {step < 3 && <Button onClick={next}>Nästa →</Button>}
          {step === 3 && <Button onClick={handleSubmit} loading={loading}>Bekräfta bokning</Button>}
        </div>
      </Card>
    </div>
  )
}
