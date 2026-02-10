import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from './store/index.js'

// Layout
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'

// Public pages
import Home from './pages/public/Home.jsx'
import Courses from './pages/public/Courses.jsx'
import Instructors from './pages/public/Instructors.jsx'
import Equipment from './pages/public/Equipment.jsx'
import Booking from './pages/public/Booking.jsx'
import Contact from './pages/public/Contact.jsx'
import Register from './pages/public/Register.jsx'
import Login from './pages/public/Login.jsx'
import Account from './pages/public/Account.jsx'

// Admin pages
import AdminLogin from './pages/admin/Login.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import ManageCourses from './pages/admin/ManageCourses.jsx'
import ManageEquipment from './pages/admin/ManageEquipment.jsx'
import ManageInstructors from './pages/admin/ManageInstructors.jsx'
import ManageBookings from './pages/admin/ManageBookings.jsx'
import ManageInvoices from './pages/admin/ManageInvoices.jsx'
import FeatureSettings from './pages/admin/FeatureSettings.jsx'
import ManageContent from './pages/admin/ManageContent.jsx'
import ManageUsers from './pages/admin/ManageUsers.jsx'
import ManageCustomers from './pages/admin/ManageCustomers.jsx'

// Stripe redirect-sidor (inline — enkla)
function PaymentSuccess() {
  return (
    <div className="page container">
      <div className="booking-success">
        <div className="success-icon">💳</div>
        <h1>Betalning genomförd!</h1>
        <p>Tack! Din betalning har mottagits och fakturan är markerad som betald.</p>
        <p>En bekräftelse skickas till din e-postadress.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Tillbaka till startsidan</a>
      </div>
    </div>
  )
}

function PaymentCancelled() {
  return (
    <div className="page container">
      <div className="booking-success">
        <div className="success-icon">↩️</div>
        <h1>Betalning avbruten</h1>
        <p>Betalningen avbröts. Fakturan är fortfarande obetald.</p>
        <p>Kontakta oss om du behöver hjälp med betalningen.</p>
        <a href="/kontakt" className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Kontakta oss</a>
      </div>
    </div>
  )
}

import { ConfirmModal, ToastContainer } from './components/common/index.jsx'

// Skydda admin-routes - väntar på initAuth innan redirect
function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}

function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  )
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth)
  const fetchFeatures = useSettingsStore((s) => s.fetchFeatures)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Återställ session + ladda feature-flags parallellt
    Promise.all([
      initAuth(),
      fetchFeatures(),
    ]).finally(() => setReady(true))
  }, []) // eslint-disable-line

  // Visa ingenting tills auth-kontroll är klar (undviker flash-redirect)
  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/certifieringar" element={<PublicLayout><Courses /></PublicLayout>} />
        <Route path="/instruktorer" element={<PublicLayout><Instructors /></PublicLayout>} />
        <Route path="/utrustning" element={<PublicLayout><Equipment /></PublicLayout>} />
        <Route path="/bokning" element={<PublicLayout><Booking /></PublicLayout>} />
        <Route path="/kontakt" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/registrera" element={<PublicLayout><Register /></PublicLayout>} />
        <Route path="/loggain" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/konto" element={<PublicLayout><Account /></PublicLayout>} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/kurser" element={<ProtectedRoute><ManageCourses /></ProtectedRoute>} />
        <Route path="/admin/utrustning" element={<ProtectedRoute><ManageEquipment /></ProtectedRoute>} />
        <Route path="/admin/instruktorer" element={<ProtectedRoute><ManageInstructors /></ProtectedRoute>} />
        <Route path="/admin/bokningar" element={<ProtectedRoute><ManageBookings /></ProtectedRoute>} />
        <Route path="/admin/fakturor" element={<ProtectedRoute><ManageInvoices /></ProtectedRoute>} />
        <Route path="/admin/installningar" element={<ProtectedRoute><FeatureSettings /></ProtectedRoute>} />
        <Route path="/admin/innehall" element={<ProtectedRoute><ManageContent /></ProtectedRoute>} />
        <Route path="/admin/kunder" element={<ProtectedRoute><ManageCustomers /></ProtectedRoute>} />
        <Route path="/admin/anvandare" element={<ProtectedRoute><ManageUsers /></ProtectedRoute>} />

        {/* Stripe redirect-sidor */}
        <Route path="/betalning/bekraftad" element={<PublicLayout><PaymentSuccess /></PublicLayout>} />
        <Route path="/betalning/avbruten" element={<PublicLayout><PaymentCancelled /></PublicLayout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ConfirmModal />
      <ToastContainer />
    </BrowserRouter>
  )
}
