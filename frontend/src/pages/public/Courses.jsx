import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore, useSettingsStore, useCartStore, useUIStore } from '../../store/index.js'
import { Card, LevelBadge, Spinner } from '../../components/common/index.jsx'

export default function Courses() {
  const { courses, fetch, loading } = useCoursesStore()
  const content = useSettingsStore(s => s.content)
  const fetchSettings = useSettingsStore(s => s.fetchSettings)

  useEffect(() => {
    fetch()
    fetchSettings()
  }, [fetch, fetchSettings])

  const { addItem } = useCartStore()
  const { addToast } = useUIStore()

  const handleAddToCart = (course) => {
    addItem({
      type: 'course',
      courseId: course.id,
      name: course.name,
      price: course.price,
      vat_rate: parseFloat(course.vat_rate || 0.06),
      date: 'CONTACT', // Default to contact for date if added from list
      participants: 1
    })
    addToast(`${course.name} tillagd i varukorgen`, 'success')
  }

  const t = (key, fallback) => content[key] || fallback

  return (
    <div className="page container">
      <h1 className="page-title">{t('courses_title', 'Certifieringar')}</h1>
      <p className="page-subtitle">{t('courses_subtitle', 'Vi erbjuder PADI-certifierade kurser för alla nivåer — från nybörjare till divemaster.')}</p>
      {loading ? <Spinner /> : (
        <div className="grid grid-2">
          {courses.filter(c => c.is_active).map((course) => (
            <Card key={course.id} className="course-card-full">
              <div className="course-card-header">
                <LevelBadge level={course.level} />
                <span className="badge badge-default">{course.certification_agency || 'PADI'}</span>
              </div>
              <h2>{course.name}</h2>
              <p>{course.description}</p>
              {course.prerequisites && (
                <p className="prereq"><strong>Förkunskaper:</strong> {course.prerequisites}</p>
              )}
              {course.included_materials && (
                <p className="included"><strong>Inkluderat:</strong> {course.included_materials}</p>
              )}
              <div className="course-meta">
                <span>⏱ {course.duration} dag{course.duration > 1 ? 'ar' : ''}</span>
                <span>👥 Max {course.max_participants} deltagare</span>
              </div>
              <div className="course-footer" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="course-price" style={{ marginRight: 'auto' }}>{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                <Link to="/bokning" className="btn btn-secondary btn-sm">Boka</Link>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAddToCart(course)}
                  title="Lägg i varukorg"
                >
                  🛒 Köp
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
