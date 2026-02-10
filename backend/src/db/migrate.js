import { pool } from './connection.js'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
dotenv.config()

async function run() {
  const client = await pool.connect()
  console.log('🔄 Running migrations...')

  try {
    await client.query('BEGIN')

    // ── Tables ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(100) UNIQUE NOT NULL,
        email         VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        first_name    VARCHAR(100),
        last_name     VARCHAR(100),
        phone         VARCHAR(50),
        role          VARCHAR(20)  DEFAULT 'customer',
        is_active     BOOLEAN      DEFAULT true,
        created_at    TIMESTAMP    DEFAULT NOW(),
        updated_at    TIMESTAMP    DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id          SERIAL PRIMARY KEY,
        key         VARCHAR(100) UNIQUE NOT NULL,
        value       TEXT        NOT NULL,
        category    VARCHAR(50) NOT NULL,
        description TEXT,
        created_at  TIMESTAMP   DEFAULT NOW(),
        updated_at  TIMESTAMP   DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id                   SERIAL PRIMARY KEY,
        name                 VARCHAR(200)  NOT NULL,
        level                VARCHAR(50)   NOT NULL,
        duration             INT           NOT NULL,
        price                NUMERIC(10,2) NOT NULL,
        description          TEXT,
        prerequisites        TEXT,
        included_materials   TEXT,
        certification_agency VARCHAR(50)   DEFAULT 'PADI',
        max_participants     INT           DEFAULT 10,
        min_participants     INT           DEFAULT 1,
        is_active            BOOLEAN       DEFAULT true,
        created_at           TIMESTAMP     DEFAULT NOW(),
        updated_at           TIMESTAMP     DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id                 SERIAL PRIMARY KEY,
        name               VARCHAR(200)  NOT NULL,
        category           VARCHAR(100)  NOT NULL,
        size               VARCHAR(50),
        quantity_total     INT           DEFAULT 1,
        quantity_available INT           DEFAULT 1,
        rental_price       NUMERIC(10,2) DEFAULT 0,
        condition          VARCHAR(50)   DEFAULT 'god',
        is_active          BOOLEAN       DEFAULT true,
        created_at         TIMESTAMP     DEFAULT NOW(),
        updated_at         TIMESTAMP     DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS instructors (
        id                   SERIAL PRIMARY KEY,
        name                 VARCHAR(200)  NOT NULL,
        specialty            VARCHAR(200),
        experience_years     INT           DEFAULT 0,
        certifications       TEXT,
        bio                  TEXT,
        is_available         BOOLEAN       DEFAULT true,
        certification_number VARCHAR(100),
        photo_url            TEXT,
        certification_expiry DATE,
        hourly_rate          NUMERIC(10,2),
        insurance_valid      BOOLEAN       DEFAULT true,
        created_at           TIMESTAMP     DEFAULT NOW(),
        updated_at           TIMESTAMP     DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id            SERIAL PRIMARY KEY,
        user_id       INT REFERENCES users(id)       ON DELETE SET NULL,
        course_id     INT REFERENCES courses(id)     ON DELETE SET NULL,
        instructor_id INT REFERENCES instructors(id) ON DELETE SET NULL,
        booking_date  DATE      NOT NULL,
        booking_time  TIME      NOT NULL,
        participants  INT       DEFAULT 1,
        total_price   NUMERIC(10,2) DEFAULT 0,
        status        VARCHAR(50)   DEFAULT 'pending',
        first_name    VARCHAR(100),
        last_name     VARCHAR(100),
        email         VARCHAR(200),
        phone         VARCHAR(50),
        notes         TEXT,
        schedule_id   INT REFERENCES course_schedules(id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_equipment (
        id           SERIAL PRIMARY KEY,
        booking_id   INT REFERENCES bookings(id)   ON DELETE CASCADE,
        equipment_id INT REFERENCES equipment(id)  ON DELETE SET NULL,
        quantity     INT           DEFAULT 1,
        price        NUMERIC(10,2) DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS course_schedules (
        id               SERIAL PRIMARY KEY,
        course_id        INT REFERENCES courses(id) ON DELETE CASCADE,
        start_date       DATE NOT NULL,
        start_time       TIME NOT NULL,
        end_date         DATE,
        max_participants INT DEFAULT 10,
        current_participants INT DEFAULT 0,
        is_active        BOOLEAN DEFAULT true,
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id             SERIAL PRIMARY KEY,
        booking_id     INT REFERENCES bookings(id) ON DELETE SET NULL,
        user_id        INT REFERENCES users(id)    ON DELETE SET NULL,
        invoice_number VARCHAR(50) UNIQUE,
        invoice_date   DATE        DEFAULT CURRENT_DATE,
        due_date       DATE,
        buyer_name     VARCHAR(200),
        buyer_address  TEXT,
        buyer_email    VARCHAR(200),
        subtotal       NUMERIC(10,2) DEFAULT 0,
        vat_rate       NUMERIC(5,4)  DEFAULT 0.25,
        vat_amount     NUMERIC(10,2) DEFAULT 0,
        total_amount   NUMERIC(10,2) DEFAULT 0,
        status         VARCHAR(50)   DEFAULT 'unpaid',
        terms_days     INT           DEFAULT 30,
        pdf_path       VARCHAR(500),
        pdf_generated  BOOLEAN       DEFAULT false,
        emailed_at     TIMESTAMP,
        paid_at        TIMESTAMP,
        created_at     TIMESTAMP     DEFAULT NOW(),
        updated_at     TIMESTAMP     DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id           SERIAL PRIMARY KEY,
        invoice_id   INT REFERENCES invoices(id) ON DELETE CASCADE,
        description  TEXT          NOT NULL,
        quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
        total        NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at   TIMESTAMP     DEFAULT NOW()
      )
    `)

    // Add sent_at column if missing (alias for emailed_at used by invoice service)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='invoices' AND column_name='sent_at'
        ) THEN
          ALTER TABLE invoices ADD COLUMN sent_at TIMESTAMP;
        END IF;
      END $$;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                    SERIAL PRIMARY KEY,
        invoice_id            INT REFERENCES invoices(id) ON DELETE SET NULL,
        stripe_session_id     VARCHAR(500),
        stripe_payment_intent VARCHAR(500),
        amount                NUMERIC(10,2) NOT NULL,
        currency              VARCHAR(10)   DEFAULT 'sek',
        status                VARCHAR(50)   DEFAULT 'pending',
        payment_method        VARCHAR(50),
        created_at            TIMESTAMP     DEFAULT NOW(),
        updated_at            TIMESTAMP     DEFAULT NOW()
      )
    `)

    // ── Seed: settings ────────────────────────────────────────
    const settings = [
      ['feature_equipment', 'true', 'features', 'Utrustningshantering'],
      ['feature_invoicing', 'true', 'features', 'Fakturering (PDF + email)'],
      ['feature_payment', 'false', 'features', 'Betalningar via Stripe (kräver invoicing)'],
      ['feature_email', 'true', 'features', 'Email-notifieringar'],
      ['company_name', 'Dykgaraget AB', 'company', 'Företagsnamn'],
      ['company_org_number', '556XXX-XXXX', 'company', 'Organisationsnummer'],
      ['company_vat_number', 'SE556XXXXXXX01', 'company', 'VAT-nummer'],
      ['company_address', 'Dykgatan 1, 123 45 Stockholm', 'company', 'Adress'],
      ['company_email', 'info@dykgaraget.se', 'company', 'E-post'],
      ['company_phone', '070-123 45 67', 'company', 'Telefon'],
      ['company_bank', '1234-5 678 901', 'company', 'Bankkontonummer'],
      ['company_f_skatt', 'true', 'company', 'Godkänd för F-skatt'],
      ['invoice_prefix', 'DYK', 'invoicing', 'Prefix för fakturanummer'],
      ['invoice_terms_days', '30', 'invoicing', 'Betalningsvillkor (dagar)'],
      ['invoice_vat_rate', '0.25', 'invoicing', 'Momssats (t.ex. 0.25)'],

      // ── Site Content ──────────────────────────────────────────
      ['content_home_hero_eyebrow', '🤿 PADI-certifierad dykskola', 'content', 'Hem: Hero Eyebrow'],
      ['content_home_hero_title', 'Din guide till dykning i Sverige', 'content', 'Hem: Hero Titel'],
      ['content_home_hero_subtitle', 'Professionell dykutbildning med PADI-certifierade instruktörer. Oavsett nivå — från första dyket till divemaster.', 'content', 'Hem: Hero Undertitel'],
      ['content_home_stats_1_num', '500+', 'content', 'Hem: Statistik 1 Nummer'],
      ['content_home_stats_1_lbl', 'Nöjda elever', 'content', 'Hem: Statistik 1 Etikett'],
      ['content_home_stats_2_num', '12', 'content', 'Hem: Statistik 2 Nummer'],
      ['content_home_stats_2_lbl', 'År av erfarenhet', 'content', 'Hem: Statistik 2 Etikett'],
      ['content_home_stats_3_num', 'PADI', 'content', 'Hem: Statistik 3 Nummer'],
      ['content_home_stats_3_lbl', 'Certifierad', 'content', 'Hem: Statistik 3 Etikett'],
      ['content_home_stats_4_num', '546513', 'content', 'Hem: Statistik 4 Nummer'],
      ['content_home_stats_4_lbl', 'Instruktörsnr', 'content', 'Hem: Statistik 4 Etikett'],
      ['content_home_cta_title', 'Redo att börja dyka?', 'content', 'Hem: CTA Titel'],
      ['content_home_cta_subtitle', 'Boka din kurs idag och ta första steget ut i det blå.', 'content', 'Hem: CTA Undertitel'],

      ['content_courses_title', 'Certifieringar', 'content', 'Kurser: Sida Titel'],
      ['content_courses_subtitle', 'Vi erbjuder PADI-certifierade kurser för alla nivåer — från nybörjare till divemaster.', 'content', 'Kurser: Sida Undertitel'],

      ['content_contact_title', 'Kontakta oss', 'content', 'Kontakt: Sida Titel'],
      ['content_contact_info_title', 'Kontaktuppgifter', 'content', 'Kontakt: Info Titel'],
      ['content_contact_form_title', 'Skicka meddelande', 'content', 'Kontakt: Formulär Titel'],
      ['content_contact_hours_title', 'Öppettider', 'content', 'Kontakt: Öppettider Titel'],
      ['content_contact_hours_monfri', '09:00 – 18:00', 'content', 'Kontakt: Tid Mån-Fre'],
      ['content_contact_hours_sat', '09:00 – 15:00', 'content', 'Kontakt: Tid Lördag'],
      ['content_contact_hours_sun', 'Stängt', 'content', 'Kontakt: Tid Söndag'],
    ]
    for (const [key, value, category, description] of settings) {
      await client.query(
        `INSERT INTO settings (key,value,category,description)
         VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`,
        [key, value, category, description]
      )
    }

    // ── Seed: admin user ──────────────────────────────────────
    // Generera riktig bcrypt-hash vid körning (lösenord: Admin123!)
    const adminPw = process.env.ADMIN_PASSWORD || 'Admin123!'
    const adminHash = await bcrypt.hash(adminPw, 10)
    // Kolla om admin redan finns MED en riktig hash (dvs inte default-hashen)
    const existing = await client.query(
      "SELECT id, password_hash FROM users WHERE username = 'admin'"
    )
    if (existing.rows.length === 0) {
      // Ingen admin — skapa
      await client.query(
        `INSERT INTO users (username,email,password_hash,first_name,last_name,role)
         VALUES ($1,$2,$3,'Admin','Dykgaraget','admin')`,
        ['admin', 'admin@dykgaraget.se', adminHash]
      )
      console.log(`✅ Admin skapad: admin / ${adminPw}`)
    } else {
      // Admin finns — uppdatera alltid hash (migrate körs vid ny deploy)
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2',
        [adminHash, 'admin']
      )
      console.log(`✅ Admin-lösenord uppdaterat: admin / ${adminPw}`)
    }

    // ── Seed: courses ─────────────────────────────────────────
    const courses = [
      ['Open Water Diver', 'Nybörjare', 3, 4500, 'Din första certifiering! Lär dig grunderna i dykning ned till 18 meter.', 'Minst 10 år, kunna simma', 'Kursbok, certifikat, utrustning under kurs', 10, 1],
      ['Advanced Open Water', 'Fortsättning', 2, 3500, 'Utveckla dina färdigheter med specialdyk inom navigation och djupdykning.', 'Open Water Diver-certifiering', 'Adventure dives, logbook, certifikat', 8, 1],
      ['Rescue Diver', 'Avancerad', 4, 5500, 'Lär dig hantera nödsituationer och bli en tryggare dykare.', 'Advanced OW + minst 20 loggade dyk', 'Rescue manual, certifikat', 6, 2],
      ['Divemaster', 'Professionell', 6, 8500, 'Ta första steget mot en professionell dykarkarriär.', 'Rescue Diver + minst 40 loggade dyk', 'Divemaster crew pack, certifikat', 4, 1],
    ]
    for (const [name, level, duration, price, description, prerequisites, included, max, min] of courses) {
      await client.query(
        `INSERT INTO courses (name,level,duration,price,description,prerequisites,included_materials,max_participants,min_participants)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [name, level, duration, price, description, prerequisites, included, max, min]
      )
    }

    // ── Seed: equipment ───────────────────────────────────────
    const equipment = [
      ['Wetsuit', 'Wetsuit', 'S', 10, 100],
      ['Wetsuit', 'Wetsuit', 'M', 15, 100],
      ['Wetsuit', 'Wetsuit', 'L', 12, 100],
      ['Wetsuit', 'Wetsuit', 'XL', 8, 100],
      ['BCD', 'BCD', 'S', 8, 100],
      ['BCD', 'BCD', 'M', 12, 100],
      ['BCD', 'BCD', 'L', 10, 100],
      ['Mask & Fenor', 'Mask', '36-39', 10, 100],
      ['Mask & Fenor', 'Mask', '40-43', 15, 100],
      ['Mask & Fenor', 'Mask', '44-47', 12, 100],
      ['Regulator', 'Regulator', 'OneSize', 20, 100],
      ['Dykdator', 'Computer', 'OneSize', 15, 100],
    ]
    for (const [name, category, size, qty, price] of equipment) {
      await client.query(
        `INSERT INTO equipment (name,category,size,quantity_total,quantity_available,rental_price)
         VALUES ($1,$2,$3,$4,$4,$5) ON CONFLICT DO NOTHING`,
        [name, category, size, qty, price]
      )
    }

    // ── Seed: instructors ─────────────────────────────────────
    const instructors = [
      ['Anna Andersson', 'Vrakdykning & Navigation', 12, 'PADI Master Instructor, SSI Instructor Trainer', 'Anna har 12 års erfarenhet och är specialist på vrakdykning.', 600],
      ['Erik Johansson', 'Teknisk dykning & Djupdykning', 8, 'PADI Tec Deep Instructor, SSI Extended Range', 'Erik är specialist på teknisk dykning och avancerad djupdykning.', 750],
      ['Maria Svensson', 'Undervattensfotografi & Nybörjare', 5, 'PADI OW Scuba Instructor, UW Photography', 'Maria kombinerar dykning med fotografi och älskar att undervisa nybörjare.', 500],
    ]
    for (const [name, specialty, years, certs, bio, rate] of instructors) {
      await client.query(
        `INSERT INTO instructors (name,specialty,experience_years,certifications,bio,hourly_rate)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [name, specialty, years, certs, bio, rate]
      )
    }

    await client.query('COMMIT')
    console.log('')
    console.log('✅ Migrations complete')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`🔐 Admin login: admin / ${adminPw}`)
    console.log('🌐 Admin URL:   /admin/login')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
