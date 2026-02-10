import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">

          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img src="/logo.png" alt="Dykgaraget" className="footer-logo-img" />
              <span className="footer-logo-name">Dykgaraget</span>
            </div>
            <p className="footer-desc">
              PADI-certifierad dykskola driven av passion för havet.
              Kurser för alla nivåer — från nybörjare till divemaster.
            </p>
          </div>

          {/* Kurser */}
          <div>
            <h4>Utbildning</h4>
            <ul className="footer-links">
              <li><Link to="/certifieringar">Alla certifieringar</Link></li>
              <li><Link to="/certifieringar">Open Water Diver</Link></li>
              <li><Link to="/certifieringar">Advanced Open Water</Link></li>
              <li><Link to="/certifieringar">Rescue Diver</Link></li>
              <li><Link to="/certifieringar">Divemaster</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4>Info</h4>
            <ul className="footer-links">
              <li><Link to="/instruktorer">Instruktörer</Link></li>
              <li><Link to="/utrustning">Utrustning</Link></li>
              <li><Link to="/kontakt">Kontakt</Link></li>
              <li><Link to="/bokning">Boka kurs</Link></li>
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
