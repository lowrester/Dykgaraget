import { Link } from 'react-router-dom'
import { useSettingsStore } from '../../store/index.js'

export default function Footer() {
  const features = useSettingsStore((s) => s.features)
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">

          {/* Brand */}
          <div className="footer-brand">
            <p className="footer-desc">
              PADI-certifierad dykskola driven av passion för havet.
              Kurser för alla nivåer — från nybörjare till divemaster.
            </p>
          </div>

          {/* Utbildning */}
          <div>
            <h4>Utbildning</h4>
            <ul className="footer-links">
              <li><Link to="/certifieringar">Alla certifieringar</Link></li>
              <li><Link to="/certifieringar">PADI Open Water Diver</Link></li>
              <li><Link to="/certifieringar">Advanced Open Water</Link></li>
              <li><Link to="/certifieringar">Rescue Diver</Link></li>
              <li><Link to="/certifieringar">Divemaster</Link></li>
            </ul>
          </div>

          {/* Säkerhet & Regelefterlevnad */}
          <div>
            <h4>Säkerhet & Compliance</h4>
            <ul className="footer-links compliance-list">
              <li>
                <span className="compliance-badge">ISO 27001</span>
                <span className="compliance-text">Information Security</span>
              </li>
              <li>
                <span className="compliance-badge">GDPR</span>
                <span className="compliance-text">Data Protection</span>
              </li>
              <li>
                <span className="compliance-badge">SOC 2 TYPE II</span>
                <span className="compliance-text">Trust Services</span>
              </li>
            </ul>
          </div>

          {/* Quick links för kontakt/bokning */}
          <div>
            <h4>Snabblänkar</h4>
            <ul className="footer-links">
              <li><Link to="/bokning" style={{ fontWeight: 600, color: 'var(--white)' }}>Boka nu</Link></li>
              <li><Link to="/integritetspolicy">Integritetspolicy (GDPR)</Link></li>
              <li><Link to="/kontakt">Support & Kontakt</Link></li>
              <li><Link to="/loggain">Mina sidor</Link></li>
            </ul>
          </div>

        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Dykgaraget · Daniel PADI 546513</span>
          <span>Professionell dykutbildning sedan 2012</span>
        </div>
      </div>
    </footer>
  )
}
