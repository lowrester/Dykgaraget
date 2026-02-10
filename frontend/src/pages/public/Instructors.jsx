import { useEffect } from 'react'
import { useInstructorsStore } from '../../store/index.js'
import { Card, Spinner } from '../../components/common/index.jsx'

export default function Instructors() {
  const { instructors, fetch, loading } = useInstructorsStore()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="page container">
      <h1 className="page-title">Våra instruktörer</h1>
      <p className="page-subtitle">Möt teamet bakom Dykgaraget — erfarna och certifierade proffs.</p>
      {loading ? <Spinner /> : (
        <div className="grid grid-3">
          {instructors.filter(i => i.is_available).map((inst) => (
            <Card key={inst.id} className="instructor-card">
              <div className="instructor-avatar">{inst.name.charAt(0)}</div>
              <h3>{inst.name}</h3>
              <p className="instructor-specialty">{inst.specialty}</p>
              <p className="instructor-bio">{inst.bio}</p>
              <div className="instructor-meta">
                <span>⭐ {inst.experience_years} år erfarenhet</span>
              </div>
              <p className="instructor-certs">{inst.certifications}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
