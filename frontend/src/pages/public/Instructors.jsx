import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useInstructorsStore } from '../../store/index.js'
import { Card, Spinner } from '../../components/common/index.jsx'

export default function Instructors() {
  const { instructors, fetch, loading } = useInstructorsStore()
  useEffect(() => { fetch() }, [fetch])

  const visible = instructors.filter(i => i.is_available)

  return (
    <div className="page container">
      <h1 className="page-title">Våra instruktörer</h1>
      <p className="page-subtitle">Möt teamet bakom Dykgaraget — erfarna och certifierade proffs.</p>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</p>
          <p>Inga instruktörer tillgängliga just nu.</p>
          <Link to="/kontakt" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Kontakta oss
          </Link>
        </div>
      ) : (
        <div className="grid grid-3">
          {visible.map((inst) => (
            <Card key={inst.id} className="instructor-card">
              {inst.photo_url
                ? <img src={inst.photo_url} alt={inst.name} className="instructor-avatar" style={{objectFit:'cover'}} />
                : <div className="instructor-avatar">{inst.name.charAt(0)}</div>
              }
              <h3>{inst.name}</h3>
              <p className="instructor-specialty">{inst.specialty}</p>
              <p className="instructor-bio">{inst.bio}</p>
              <div className="instructor-meta">
                <span>⭐ {inst.experience_years} år erfarenhet</span>
              </div>
              {inst.certifications && (
                <p className="instructor-certs">{inst.certifications}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
