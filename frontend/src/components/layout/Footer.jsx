import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <h3 className="footer-logo">🤿 Dykgaraget</h3>
          <p className="footer-tagline">Din partner för dykning i världsklass</p>
        </div>
        <div>
          <h4>Snabblänkar</h4>
          <ul className="footer-links">
            <li><Link to="/">Hem</Link></li>
            <li><Link to="/certifieringar">Certifieringar</Link></li>
            <li><Link to="/instruktorer">Instruktörer</Link></li>
            <li><Link to="/bokning">Boka kurs</Link></li>
            <li><Link to="/kontakt">Kontakt</Link></li>
          </ul>
        </div>
        <div>
          <h4>Kontakt</h4>
          <p>📍 Dykgatan 1, Stockholm</p>
          <p>📞 070-123 45 67</p>
          <p>✉️ info@dykgaraget.se</p>
        </div>
        <div>
          <h4>Öppettider</h4>
          <p>Mån–Fre: 09:00–18:00</p>
          <p>Lör: 09:00–15:00</p>
          <p>Sön: Stängt</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Dykgaraget AB – Org.nr 556XXX-XXXX</p>
      </div>
    </footer>
  )
}
