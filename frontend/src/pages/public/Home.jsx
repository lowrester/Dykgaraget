import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore } from '../../store/index.js'
import { Card, LevelBadge, Spinner } from '../../components/common/index.jsx'

export default function Home() {
  const { courses, fetch, loading } = useCoursesStore()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="page-home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Dyk in i en ny värld</h1>
          <p className="hero-subtitle">Professionell dykutbildning av PADI-certifierade instruktörer. Oavsett nivå har vi rätt kurs för dig.</p>
          <div className="hero-actions">
            <Link to="/bokning"        className="btn btn-primary btn-lg">Boka kurs</Link>
            <Link to="/certifieringar" className="btn btn-outline btn-lg">Se alla kurser</Link>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="container stats-grid">
          <div className="stat"><span className="stat-number">500+</span><span className="stat-label">Nöjda elever</span></div>
          <div className="stat"><span className="stat-number">12</span><span className="stat-label">År av erfarenhet</span></div>
          <div className="stat"><span className="stat-number">3</span><span className="stat-label">Certifierade instruktörer</span></div>
          <div className="stat"><span className="stat-number">PADI</span><span className="stat-label">Certifierad skola</span></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Populära kurser</h2>
          {loading ? <Spinner /> : (
            <div className="grid grid-3">
              {courses.slice(0, 3).map((course) => (
                <Card key={course.id} className="course-card">
                  <div className="course-card-header">
                    <LevelBadge level={course.level} />
                    <span className="course-duration">{course.duration} dag{course.duration > 1 ? 'ar' : ''}</span>
                  </div>
                  <h3>{course.name}</h3>
                  <p className="course-desc">{course.description}</p>
                  <div className="course-footer">
                    <span className="course-price">{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                    <Link to="/bokning" className="btn btn-sm btn-primary">Boka</Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div className="section-cta">
            <Link to="/certifieringar" className="btn btn-outline">Se alla certifieringar →</Link>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-inner">
          <h2>Redo att börja dyka?</h2>
          <p>Boka din kurs idag och ta första steget ut i det blå.</p>
          <Link to="/bokning" className="btn btn-primary btn-lg">Boka nu</Link>
        </div>
      </section>
    </div>
  )
}
