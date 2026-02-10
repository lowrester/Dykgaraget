import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore, useSettingsStore } from '../../store/index.js'
import { Card, LevelBadge, Spinner } from '../../components/common/index.jsx'

export default function Courses() {
  const { courses, fetch, loading } = useCoursesStore()
  const content = useSettingsStore(s => s.content)
  const fetchSettings = useSettingsStore(s => s.fetchSettings)

  useEffect(() => {
    fetch()
    fetchSettings()
  }, [fetch, fetchSettings])

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
              <div className="course-footer">
                <span className="course-price">{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                <Link to="/bokning" className="btn btn-primary">Boka</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
