import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoursesStore, useSettingsStore } from '../../store/index.js'
import { Card, LevelBadge, Spinner } from '../../components/common/index.jsx'

export default function Home() {
  const { courses, fetch, loading } = useCoursesStore()
  const features = useSettingsStore((s) => s.features)
  const content = useSettingsStore((s) => s.content)
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)

  useEffect(() => {
    fetch()
    fetchSettings()
  }, [fetch, fetchSettings])

  // Content helpers with fallbacks
  const t = (key, fallback) => content[key] || fallback

  return (
    <div className="page-home">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-eyebrow">{t('home_hero_eyebrow', '🤿 PADI-certifierad dykskola')}</div>
            <h1 className="hero-title">
              {t('home_hero_title', 'Din guide till dykning i Sverige')}
            </h1>
            <p className="hero-subtitle">
              {t('home_hero_subtitle', 'Professionell dykutbildning med PADI-certifierade instruktörer. Oavsett nivå — från första dyket till divemaster.')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <div className="stats-bar">
        <div className="container stats-grid">
          <div className="stat">
            <span className="stat-number">{t('home_stats_1_num', '500+')}</span>
            <span className="stat-label">{t('home_stats_1_lbl', 'Nöjda elever')}</span>
          </div>
          <div className="stat">
            <span className="stat-number">{t('home_stats_2_num', '12')}</span>
            <span className="stat-label">{t('home_stats_2_lbl', 'År av erfarenhet')}</span>
          </div>
          <div className="stat">
            <span className="stat-number">{t('home_stats_3_num', 'PADI')}</span>
            <span className="stat-label">{t('home_stats_3_lbl', 'Certifierad')}</span>
          </div>
          <div className="stat">
            <span className="stat-number">{t('home_stats_4_num', '546513')}</span>
            <span className="stat-label">{t('home_stats_4_lbl', 'Instruktörsnr')}</span>
          </div>
        </div>
      </div>

      {/* ── Populära kurser ───────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Populära kurser</h2>
            <Link to="/certifieringar" className="btn btn-ghost btn-sm">Visa alla →</Link>
          </div>

          {loading ? <Spinner /> : (
            <div className="grid grid-3">
              {courses.filter(c => c.is_active).slice(0, 3).map((course) => (
                <Card key={course.id} className="course-card">
                  <div className="course-card-header">
                    <LevelBadge level={course.level} />
                    <span className="course-duration">{course.duration} dag{course.duration > 1 ? 'ar' : ''}</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', margin: '0.5rem 0 0' }}>{course.name}</h3>
                  <p className="course-desc">{course.description}</p>
                  <div className="course-footer">
                    <span className="course-price">{parseFloat(course.price).toLocaleString('sv-SE')} kr</span>
                    <Link to="/bokning" className="btn btn-primary btn-sm">Boka</Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Varför Dykgaraget ────────────────────────────── */}
      <section style={{ background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderBottom: '1px solid var(--gray-200)', padding: '3.5rem 0' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center' }}>Så fungerar det</h2>
          <div className="grid grid-4" style={{ marginTop: '1.5rem' }}>
            {[
              { icon: '🏊', title: 'Välj kurs', desc: 'Från nybörjarkurs till avancerade specialkurser för erfarna dykare.' },
              { icon: '📅', title: 'Boka enkelt', desc: 'Välj datum och antal platser direkt online. Bekräftelse via e-post.' },
              features.equipment && { icon: '🤿', title: 'Utrustning', desc: 'Vi tillhandahåller all utrustning du behöver under kurserna.' },
              { icon: '🎓', title: 'Certifikat', desc: 'PADI-certifiering som gäller livet ut och accepteras världen över.' },
            ].filter(Boolean).map(item => (
              <div key={item.title} style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>{item.title}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="cta-section">
            <div className="cta-inner">
              <h2>{t('home_cta_title', 'Redo att börja dyka?')}</h2>
              <p>{t('home_cta_subtitle', 'Boka din kurs idag och ta första steget ut i det blå.')}</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
