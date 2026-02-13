import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCoursesStore, useEquipmentStore, useBookingsStore, useSettingsStore, useAuthStore, useCartStore } from '../../store/index.js'
import { Card, Button, Input, Spinner, Alert } from '../../components/common/index.jsx'

const STEPS = ['Välj kurs', 'Dina uppgifter', 'Utrustning', 'Bekräfta']

export default function Booking() {
  const { user } = useAuthStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    course_id: '', booking_date: '', booking_time: '09:00', participants: 1,
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
    phone: '',
    equipment_ids: [], notes: '',
    gdprConsent: !!user
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  const { courses, fetch: fetchCourses, fetchSchedules } = useCoursesStore()
  const { equipment, fetch: fetchEquipment } = useEquipmentStore()
  const { create: createBooking } = useBookingsStore()
  const features = useSettingsStore((s) => s.features)

  const [schedules, setSchedules] = useState([])
  const [schedLoading, setSchedLoading] = useState(false)

  useEffect(() => { fetchCourses() }, [fetchCourses])
  useEffect(() => {
    if (features.equipment) fetchEquipment()
  }, [features.equipment, fetchEquipment])

  // Fetch schedules when course changes
  useEffect(() => {
    if (form.course_id) {
      setSchedLoading(true)
      fetchSchedules(form.course_id)
        .then(setSchedules)
        .finally(() => setSchedLoading(false))
    } else {
      setSchedules([])
    }
  }, [form.course_id, fetchSchedules])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const validateStep = () => {
    const e = {}
    if (step === 0) {
      if (!form.course_id) e.course_id = 'Välj en kurs'
      if (!form.booking_date && !form.schedule_id) e.booking_date = 'Välj ett datum'
    }
    if (step === 1) {
      if (!form.first_name) e.first_name = 'Förnamn krävs'
      if (!form.last_name) e.last_name = 'Efternamn krävs'
      if (!form.email) e.email = 'E-post krävs'
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Ogiltig e-post'
      if (!form.gdprConsent) e.gdprConsent = 'Du måste godkänna integritetspolicyn'
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

  const { addItem, setCustomerInfo } = useCartStore()
  const navigate = useNavigate()
  const [wantsToRent, setWantsToRent] = useState(false)

  const handleSubmit = async () => {
    // Collect selected items
    const selectedCourse = courses.find((c) => c.id === parseInt(form.course_id))

    // Persist customer info for checkout
    setCustomerInfo({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      gdprConsent: form.gdprConsent
    })

    // Add Course to Cart
    addItem({
      type: 'course',
      courseId: selectedCourse.id,
      name: selectedCourse.name,
      price: selectedCourse.price,
      vat_rate: parseFloat(selectedCourse.vat_rate || 0.06),
      date: form.booking_date,
      time: form.booking_time,
      scheduleId: form.schedule_id,
      participants: form.participants
    })

    // Add selected equipment as separate items
    form.equipment_ids.forEach(eqId => {
      const item = equipment.find(e => e.id === eqId)
      if (item) {
        addItem({
          type: 'equipment',
          equipmentId: item.id,
          name: `Hyra: ${item.name}`,
          size: item.size,
          price: item.rental_price,
          vat_rate: 0.25 // Standard VAT for rentals
        })
      }
    })

    navigate('/kassa')
  }

  const selectedCourse = courses.find((c) => c.id === parseInt(form.course_id))
  const selectedSchedule = schedules.find(s => s.id === parseInt(form.schedule_id))

  if (step === 4) {
    const inv = success?.invoice
    const company = success?.company
    return (
      <div className="page container">
        <div className="booking-success">
          <div className="success-icon">✅</div>
          <h1>Bokning bekräftad!</h1>
          <p>Tack {success?.first_name}! Din bokning är registrerad.</p>
          <p>Bokningsnummer: <strong>#{success?.id}</strong></p>

          {inv ? (
            <Card style={{ marginTop: '2rem', textAlign: 'left', border: '1px solid var(--blue-100)', background: 'var(--blue-50)' }}>
              <h3 style={{ color: 'var(--blue-700)', marginBottom: '1rem' }}>Betalningsinformation</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Din faktura <strong>{inv.invoice_number}</strong> har skapats.</p>
              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', padding: '1rem', background: 'white', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Att betala:</span><strong>{parseFloat(inv.total_amount).toLocaleString('sv-SE')} kr</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bankgiro / Konto:</span><strong>{company?.bank_account || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ange referens:</span><strong>{inv.invoice_number}</strong></div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <a href={`/api/invoices/${inv.id}/pdf`} download className="btn btn-primary btn-sm">Ladda ner faktura (PDF)</a>
              </div>
            </Card>
          ) : (
            <p>Bekräftelse skickas till <strong>{success?.email}</strong></p>
          )}

          <div style={{ marginTop: '2rem' }}>
            {user ? (
              <Link to="/konto" className="btn btn-secondary">Gå till mina sidor</Link>
            ) : (
              <button className="btn btn-secondary" onClick={() => { setStep(0); setForm({ course_id: '', booking_date: '', booking_time: '09:00', participants: 1, first_name: '', last_name: '', email: '', phone: '', equipment_ids: [], notes: '', schedule_id: null, gdprConsent: false }) }}>
                Gör en ny bokning
              </button>
            )}
          </div>
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
              <label className="form-label">1. Vilken kurs vill du gå? *</label>
              {errors.course_id && <span className="error-msg">{errors.course_id}</span>}
              <div className="course-select-grid">
                {courses.filter(c => c.is_active).length === 0 ? (
                  <p style={{ color: 'var(--gray-400)', fontStyle: 'italic', gridColumn: '1/-1', padding: '1rem 0' }}>
                    Inga kurser tillgängliga för tillfället. Kontakta oss direkt.
                  </p>
                ) : courses.filter(c => c.is_active).map((course) => (
                  <div
                    key={course.id}
                    className={`course-option ${form.course_id === String(course.id) ? 'selected' : ''}`}
                    onClick={() => {
                      set('course_id', String(course.id))
                      set('schedule_id', null)
                      set('booking_date', '')
                    }}
                  >
                    <strong>{course.name}</strong>
                    <span>{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                    <span>{course.duration} dag{course.duration > 1 ? 'ar' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {form.course_id && (
              <div className="form-group" style={{ marginTop: '2rem' }}>
                <label className="form-label">2. Välj ett datum *</label>
                {errors.booking_date && <span className="error-msg">{errors.booking_date}</span>}

                {schedLoading ? <Spinner /> : (
                  <div className="course-select-grid">
                    {schedules.map(s => (
                      <div
                        key={s.id}
                        className={`course-option ${form.schedule_id === String(s.id) ? 'selected' : ''}`}
                        onClick={() => {
                          set('schedule_id', String(s.id))
                          set('booking_date', s.start_date)
                          set('booking_time', s.start_time)
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(s.sessions || [{ date: s.start_date, time: s.start_time }]).map((sess, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.9rem' }}>
                                {new Date(sess.date.replace(/-/g, '/')).toLocaleDateString('sv-SE', {
                                  weekday: 'short', day: 'numeric', month: 'short'
                                })}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                kl {sess.time ? sess.time.substring(0, 5) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--gray-100)', fontSize: '0.75rem', color: 'var(--blue)' }}>
                          {s.max_participants - s.current_participants} platser kvar
                        </div>
                      </div>
                    ))}
                    <div
                      className={`course-option ${!form.schedule_id && form.booking_date === 'CONTACT' ? 'selected' : ''}`}
                      onClick={() => {
                        set('schedule_id', null)
                        set('booking_date', 'CONTACT')
                      }}
                    >
                      <strong>Inget datum passar mig</strong>
                      <span>Kontakta mig för andra förslag</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.booking_date === 'CONTACT' && (
              <Alert type="info" style={{ marginTop: '1rem' }}>
                Inga problem! Fyll i dina uppgifter i nästa steg så återkommer vi med förslag på datum som passar dig.
              </Alert>
            )}

            <div className="grid grid-2" style={{ marginTop: '2rem' }}>
              <Input label="Antal deltagare" type="number" min={1} max={10} value={form.participants} onChange={(e) => set('participants', e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 1 – Personal info */}
        {step === 1 && (
          <div className="booking-step">
            <h2>Dina uppgifter</h2>
            {user ? (
              <Alert type="info" style={{ marginBottom: '1.5rem' }}>
                Du är inloggad som <strong>{user.firstName} {user.lastName}</strong>. Vi har förifyllt dina uppgifter.
              </Alert>
            ) : (
              <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Har du redan ett konto? <Link to="/loggain" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Logga in</Link> för smidigare bokning.
              </div>
            )}
            <div className="grid grid-2">
              <Input label="Förnamn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} required />
              <Input label="Efternamn" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} required />
              <Input label="E-post" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required />
              <Input label="Telefon" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>

            {!user && (
              <div style={{ marginTop: '1rem' }}>
                <label className="checkbox-container" style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.gdprConsent} onChange={e => set('gdprConsent', e.target.checked)} required />
                  <span>Jag godkänner att Dykgaraget sparar mina personuppgifter enligt <Link to="/integritetspolicy" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>integritetspolicyn</Link>.*</span>
                </label>
                {errors.gdprConsent && <span className="error-msg" style={{ display: 'block', marginTop: '0.25rem' }}>{errors.gdprConsent}</span>}
              </div>
            )}

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
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
            ) : !wantsToRent ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Behöver du hyra utrustning?</h3>
                <p style={{ marginBottom: '2rem', color: 'var(--gray-600)' }}>
                  Vi erbjuder allt från kompletta paket till enstaka artiklar.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <Button variant="secondary" onClick={next}>Nej, jag har egen</Button>
                  <Button onClick={() => setWantsToRent(true)}>Ja, visa utrustning</Button>
                </div>
              </div>
            ) : equipment.length === 0 ? (
              <Spinner text="Hämtar utrustning..." />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <p className="step-desc" style={{ margin: 0 }}>Välj utrustning att hyra. Pris visas per artikel och dag.</p>
                  <button onClick={() => setWantsToRent(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}>← Ångra/Göm</button>
                </div>
                <div className="equipment-grid">
                  {equipment.filter(e => e.is_active && e.is_for_rent).map((item) => (
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
              <div className="summary-row">
                <span>Datum:</span>
                <strong>{form.booking_date === 'CONTACT' ? 'Kontakta mig för datum' : form.booking_date}</strong>
              </div>
              {form.booking_date !== 'CONTACT' && (
                <div className="summary-row"><span>Tid:</span><strong>kl {form.booking_time.substring(0, 5)}</strong></div>
              )}
              <div className="summary-row"><span>Deltagare:</span><strong>{form.participants}</strong></div>
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
