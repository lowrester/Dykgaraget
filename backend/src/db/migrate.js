import { pool } from './connection.js'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
dotenv.config()

async function run() {
  const client = await pool.connect()
  let createdAdmin = false
  let adminPw = null

  console.log('🔄 Running migrations...')

  try {
    await client.query('BEGIN')

    // ── Migration Tracking ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const runMigration = async (name, sql) => {
      const check = await client.query('SELECT 1 FROM migration_log WHERE name = $1', [name])
      if (check.rows.length > 0) return false
      console.log(`⏳ Applying: ${name}...`)
      if (typeof sql === 'string') {
        await client.query(sql)
      } else {
        await client.query(sql.text, sql.values)
      }
      await client.query('INSERT INTO migration_log (name) VALUES ($1)', [name])
      return true
    }
    await runMigration('001_initial_tables', `
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
      );

      CREATE TABLE IF NOT EXISTS settings (
        id          SERIAL PRIMARY KEY,
        key         VARCHAR(100) UNIQUE NOT NULL,
        value       TEXT        NOT NULL,
        category    VARCHAR(50) NOT NULL,
        description TEXT,
        created_at  TIMESTAMP   DEFAULT NOW(),
        updated_at  TIMESTAMP   DEFAULT NOW()
      );

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
      );

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
      );

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
      );

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
      );

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
      );

      CREATE TABLE IF NOT EXISTS booking_equipment (
        id           SERIAL PRIMARY KEY,
        booking_id   INT REFERENCES bookings(id)   ON DELETE CASCADE,
        equipment_id INT REFERENCES equipment(id)  ON DELETE SET NULL,
        quantity     INT           DEFAULT 1,
        price        NUMERIC(10,2) DEFAULT 0
      );

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
        is_archived    BOOLEAN       DEFAULT false,
        created_at     TIMESTAMP     DEFAULT NOW(),
        updated_at     TIMESTAMP     DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id           SERIAL PRIMARY KEY,
        invoice_id   INT REFERENCES invoices(id) ON DELETE CASCADE,
        description  TEXT          NOT NULL,
        quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
        total        NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at   TIMESTAMP     DEFAULT NOW()
      );

      CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
    `)

    // ── Update Migrations ─────────────────────────────────────
    await runMigration('002_add_sent_at', `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
    `)

    await runMigration('003_add_is_archived', `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
    `)

    await runMigration('004_gdpr_customer_updates', `
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMP;
    `)

    await runMigration('005_payments_table', `
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
      );
    `)

    await runMigration('006_multi_session_schedules', `
      ALTER TABLE course_schedules ADD COLUMN IF NOT EXISTS sessions JSONB DEFAULT '[]';
      
      -- Migrate existing single-day data to sessions array
      UPDATE course_schedules 
      SET sessions = jsonb_build_array(
        jsonb_build_object(
          'date', start_date,
          'time', start_time
        )
      )
      WHERE sessions = '[]' OR sessions IS NULL;
    `)

    await runMigration('007_audit_logs', `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          SERIAL PRIMARY KEY,
        user_id     INT REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id   INT,
        metadata    JSONB DEFAULT '{}',
        ip_address  VARCHAR(45),
        user_agent  TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `)

    await runMigration('008_invoice_compliance_updates', `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supply_date DATE;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_vat_number VARCHAR(100);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
    `)

    await runMigration('009_multi_vat_support', `
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4) DEFAULT 0.25;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_summary JSONB DEFAULT '{}';
    `)

    await runMigration('010_inventory_system', `
      CREATE TABLE IF NOT EXISTS suppliers (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(200) NOT NULL,
        contact_person VARCHAR(200),
        email       VARCHAR(200),
        phone       VARCHAR(50),
        address     TEXT,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id            SERIAL PRIMARY KEY,
        supplier_id   INT REFERENCES suppliers(id) ON DELETE SET NULL,
        po_number     VARCHAR(50) UNIQUE NOT NULL,
        status        VARCHAR(20) DEFAULT 'draft', -- draft, sent, received, cancelled
        total_amount  NUMERIC(10,2) DEFAULT 0,
        notes         TEXT,
        sent_at       TIMESTAMP,
        received_at   TIMESTAMP,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id                SERIAL PRIMARY KEY,
        purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
        equipment_id      INT REFERENCES equipment(id) ON DELETE SET NULL,
        description       TEXT NOT NULL,
        quantity_ordered  INT NOT NULL,
        quantity_received INT DEFAULT 0,
        unit_price        NUMERIC(10,2) DEFAULT 0,
        total_price       NUMERIC(10,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id              SERIAL PRIMARY KEY,
        equipment_id    INT REFERENCES equipment(id) ON DELETE CASCADE,
        type            VARCHAR(30) NOT NULL, -- inbound, outbound, return, adjustment
        quantity        INT NOT NULL,
        reference_type  VARCHAR(50), -- purchase_order, invoice, manual
        reference_id    INT,
        notes           TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        created_by      INT REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;
    `)

    await runMigration('011_course_vat_rate', `
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4) DEFAULT 0.06;
      UPDATE courses SET vat_rate = 0.06 WHERE vat_rate IS NULL;
    `)

    await runMigration('012_checkout_registration_mode', `
      INSERT INTO settings (key, value, category, description)
      VALUES ('checkout_registration_mode', 'optional', 'features', 'Registreringsläge i kassan (disabled, optional, mandatory)')
      ON CONFLICT (key) DO NOTHING;
    `)

    await runMigration('013_equipment_rent_sale_split', `
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS is_for_rent BOOLEAN DEFAULT true;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN DEFAULT false;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2) DEFAULT 0;

      INSERT INTO settings (key, value, category, description) VALUES
      ('feature_equipment_rent', 'true', 'features', 'Uthyrning av utrustning (vid bokning)'),
      ('feature_equipment_sale', 'true', 'features', 'Försäljning av utrustning (webshop)')
      ON CONFLICT (key) DO NOTHING;
    `)

    // ── Seed Migrations ───────────────────────────────────────
    await runMigration('seed_settings', `
      INSERT INTO settings (key,value,category,description) VALUES
      ('feature_equipment', 'true', 'features', 'Utrustningshantering'),
      ('feature_invoicing', 'true', 'features', 'Fakturering (PDF + email)'),
      ('feature_payment', 'false', 'features', 'Betalningar via Stripe (kräver invoicing)'),
      ('feature_email', 'true', 'features', 'Email-notifieringar'),
      ('company_name', 'Dykgaraget AB', 'company', 'Företagsnamn'),
      ('company_org_number', '556XXX-XXXX', 'company', 'Organisationsnummer'),
      ('company_vat_number', 'SE556XXXXXXX01', 'company', 'VAT-nummer'),
      ('company_address', 'Dykgatan 1, 123 45 Stockholm', 'company', 'Adress'),
      ('company_email', 'info@dykgaraget.se', 'company', 'E-post'),
      ('company_phone', '070-123 45 67', 'company', 'Telefon'),
      ('company_bank_account', '1234-5 678 901', 'company', 'Bankkontonummer'),
      ('company_f_skatt', 'true', 'company', 'Godkänd för F-skatt'),
      ('invoice_prefix', 'DYK', 'invoicing', 'Prefix för fakturanummer'),
      ('invoice_terms_days', '30', 'invoicing', 'Betalningsvillkor (dagar)'),
      ('invoice_vat_rate', '0.25', 'invoicing', 'Momssats (t.ex. 0.25)'),
      ('content_home_hero_eyebrow', '🤿 PADI-certifierad dykskola', 'content', 'Hem: Hero Eyebrow'),
      ('content_home_hero_title', 'Din guide till dykning i Sverige', 'content', 'Hem: Hero Titel'),
      ('content_home_hero_subtitle', 'Professionell dykutbildning med PADI-certifierade instruktörer. Oavsett nivå — från första dyket till divemaster.', 'content', 'Hem: Hero Undertitel'),
      ('content_home_stats_1_num', '500+', 'content', 'Hem: Statistik 1 Nummer'),
      ('content_home_stats_1_lbl', 'Nöjda elever', 'content', 'Hem: Statistik 1 Etikett'),
      ('content_home_stats_2_num', '12', 'content', 'Hem: Statistik 2 Nummer'),
      ('content_home_stats_2_lbl', 'År av erfarenhet', 'content', 'Hem: Statistik 2 Etikett'),
      ('content_home_stats_3_num', 'PADI', 'content', 'Hem: Statistik 3 Nummer'),
      ('content_home_stats_3_lbl', 'Certifierad', 'content', 'Hem: Statistik 3 Etikett'),
      ('content_home_stats_4_num', '546513', 'content', 'Hem: Statistik 4 Nummer'),
      ('content_home_stats_4_lbl', 'Instruktörsnr', 'content', 'Hem: Statistik 4 Etikett'),
      ('content_home_cta_title', 'Redo att börja dyka?', 'content', 'Hem: CTA Titel'),
      ('content_home_cta_subtitle', 'Boka din kurs idag och ta första steget ut i det blå.', 'content', 'Hem: CTA Undertitel'),
      ('content_courses_title', 'Certifieringar', 'content', 'Kurser: Sida Titel'),
      ('content_courses_subtitle', 'Vi erbjuder PADI-certifierade kurser för alla nivåer — från nybörjare till divemaster.', 'content', 'Kurser: Sida Undertitel'),
      ('content_contact_title', 'Kontakta oss', 'content', 'Kontakt: Sida Titel'),
      ('content_contact_info_title', 'Kontaktuppgifter', 'content', 'Kontakt: Info Titel'),
      ('content_contact_form_title', 'Skicka meddelande', 'content', 'Kontakt: Formulär Titel'),
      ('content_contact_hours_title', 'Öppettider', 'content', 'Kontakt: Öppettider Titel'),
      ('content_contact_hours_monfri', '09:00 – 18:00', 'content', 'Kontakt: Tid Mån-Fre'),
      ('content_contact_hours_sat', '09:00 – 15:00', 'content', 'Kontakt: Tid Lördag'),
      ('content_contact_hours_sun', 'Stängt', 'content', 'Kontakt: Tid Söndag'),
      ('email_sendgrid_key', '', 'email', 'SendGrid API Key'),
      ('email_from', 'info@dykgaraget.se', 'email', 'Avsändar-epost'),
      ('email_from_name', 'Dykgaraget', 'email', 'Avsändarnamn')
      ON CONFLICT (key) DO NOTHING;
    `)

    await runMigration('seed_courses', `
      INSERT INTO courses (name,level,duration,price,description,prerequisites,included_materials,max_participants,min_participants) VALUES
      ('Open Water Diver', 'Nybörjare', 3, 4500, 'Din första certifiering! Lär dig grunderna i dykning ned till 18 meter.', 'Minst 10 år, kunna simma', 'Kursbok, certifikat, utrustning under kurs', 10, 1),
      ('Advanced Open Water', 'Fortsättning', 2, 3500, 'Utveckla dina färdigheter med specialdyk inom navigation och djupdykning.', 'Open Water Diver-certifiering', 'Adventure dives, logbook, certifikat', 8, 1),
      ('Rescue Diver', 'Avancerad', 4, 5500, 'Lär dig hantera nödsituationer och bli en tryggare dykare.', 'Advanced OW + minst 20 loggade dyk', 'Rescue manual, certifikat', 6, 2),
      ('Divemaster', 'Professionell', 6, 8500, 'Ta första steget mot en professionell dykarkarriär.', 'Rescue Diver + minst 40 loggade dyk', 'Divemaster crew pack, certifikat', 4, 1)
      ON CONFLICT DO NOTHING;
    `)

    await runMigration('seed_equipment', `
      INSERT INTO equipment (name,category,size,quantity_total,quantity_available,rental_price) VALUES
      ('Wetsuit', 'Wetsuit', 'S', 10, 10, 100),
      ('Wetsuit', 'Wetsuit', 'M', 15, 15, 100),
      ('Wetsuit', 'Wetsuit', 'L', 12, 12, 100),
      ('Wetsuit', 'Wetsuit', 'XL', 8, 8, 100),
      ('BCD', 'BCD', 'S', 8, 8, 100),
      ('BCD', 'BCD', 'M', 12, 12, 100),
      ('BCD', 'BCD', 'L', 10, 10, 100),
      ('Mask & Fenor', 'Mask', '36-39', 10, 10, 100),
      ('Mask & Fenor', 'Mask', '40-43', 15, 15, 100),
      ('Mask & Fenor', 'Mask', '44-47', 12, 12, 100),
      ('Regulator', 'Regulator', 'OneSize', 20, 20, 100),
      ('Dykdator', 'Computer', 'OneSize', 15, 15, 100)
      ON CONFLICT DO NOTHING;
    `)

    await runMigration('seed_instructors', `
      INSERT INTO instructors (name,specialty,experience_years,certifications,bio,hourly_rate) VALUES
      ('Anna Andersson', 'Vrakdykning & Navigation', 12, 'PADI Master Instructor, SSI Instructor Trainer', 'Anna har 12 års erfarenhet och är specialist på vrakdykning.', 600),
      ('Erik Johansson', 'Teknisk dykning & Djupdykning', 8, 'PADI Tec Deep Instructor, SSI Extended Range', 'Erik är specialist på teknisk dykning och avancerad djupdykning.', 750),
      ('Maria Svensson', 'Undervattensfotografi & Nybörjare', 5, 'PADI OW Scuba Instructor, UW Photography', 'Maria kombinerar dykning med fotografi och älskar att undervisa nybörjare.', 500)
      ON CONFLICT DO NOTHING;
    `)

    // Seeding admin user safely
    const checkAdmin = await client.query('SELECT 1 FROM users WHERE username = $1', ['admin'])
    if (checkAdmin.rows.length === 0) {
      adminPw = process.env.ADMIN_PASSWORD || 'admin123'
      const adminHash = await bcrypt.hash(adminPw, 10)

      await runMigration('seed_admin', {
        text: `
          INSERT INTO users (username, email, password_hash, role, first_name, last_name)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (username) DO NOTHING
        `,
        values: ['admin', 'admin@dykgaraget.se', adminHash, 'admin', 'System', 'Administrator']
      })
      createdAdmin = true
    }

    await client.query('COMMIT')

    if (createdAdmin) {
      console.log('')
      console.log('✅ Migrations complete')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`🔐 Admin created!`)
      console.log(`👤 Username: admin`)
      console.log(`🔑 Password: ${adminPw}`)
      console.log('🌐 Admin URL:  /admin/login')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      console.log('')
      console.log('✅ Migrations complete (no new setup needed)')
    }
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
