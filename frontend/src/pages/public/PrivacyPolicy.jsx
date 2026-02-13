import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
    return (
        <div className="page container" style={{ maxWidth: '800px' }}>
            <h1 className="page-title">integritetspolicy</h1>
            <p className="page-subtitle">Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}</p>

            <section className="section">
                <h3>1. Inledning</h3>
                <p>
                    Dykgaraget ("vi", "oss") värnar om din personliga integritet och strävar efter att skydda dina personuppgifter på bästa sätt. Denna policy beskriver hur vi samlar in och behandlar dina uppgifter i enlighet med GDPR, ISO 27001 och SOC 2 principer.
                </p>

                <h3>2. Vilka uppgifter samlar vi in?</h3>
                <p>
                    Vi samlar in uppgifter som namn, e-postadress, telefonnummer och adress när du skapar ett konto eller gör en bokning. Vi sparar även historik över dina kurser och fakturor.
                </p>

                <h3>3. Varför behandlar vi dina uppgifter?</h3>
                <ul>
                    <li>För att administrera dina bokningar och kurser.</li>
                    <li>För att kunna fakturera och bokföra enligt svensk lag.</li>
                    <li>För att skicka viktiga kursuppdateringar och säkerhetsinformation.</li>
                </ul>

                <h3>4. Dina rättigheter</h3>
                <p>
                    Du har rätt att när som helst begära utdrag av den data vi har om dig, eller begära att din data raderas ("rätten att bli glömd"). Du kan göra detta direkt via "Mina sidor" eller genom att kontakta oss.
                </p>

                <h3>5. Säkerhet</h3>
                <p>
                    Vi använder modern kryptering (SSL/TLS), strikta åtkomstkontroller (SOC 2 Type II) och regelbundna säkerhetsgranskningar för att hålla din data säker. All data lagras på säkrade servrar inom EU.
                </p>

                <h3>6. Kontakt</h3>
                <p>
                    Har du frågor om vår personuppgiftsbehandling? Kontakta oss på <a href="mailto:info@dykgaraget.se">info@dykgaraget.se</a>.
                </p>
            </section>

            <div style={{ marginTop: '2rem' }}>
                <Link to="/" className="btn btn-secondary">Tillbaka till start</Link>
            </div>
        </div>
    )
}
