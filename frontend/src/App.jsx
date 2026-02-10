import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from './store/index.js'

// Layout
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'

// Public pages
import Home        from './pages/public/Home.jsx'
import Courses     from './pages/public/Courses.jsx'
import Instructors from './pages/public/Instructors.jsx'
import Equipment   from './pages/public/Equipment.jsx'
import Booking     from './pages/public/Booking.jsx'
import Contact     from './pages/public/Contact.jsx'

// Admin pages
import AdminLogin      from './pages/admin/Login.jsx'
import AdminDashboard  from './pages/admin/Dashboard.jsx'
import ManageCourses   from './pages/admin/ManageCourses.jsx'
import ManageEquipment from './pages/admin/ManageEquipment.jsx'
import ManageInstructors from './pages/admin/ManageInstructors.jsx'
import ManageBookings  from './pages/admin/ManageBookings.jsx'
import ManageInvoices  from './pages/admin/ManageInvoices.jsx'
import FeatureSettings from './pages/admin/FeatureSettings.jsx'

function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}

function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}

export default function App() {
  const fetchFeatures = useSettingsStore((s) => s.fetchFeatures)

  useEffect(() => {
    fetchFeatures()
  }, [fetchFeatures])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/certifieringar" element={<PublicLayout><Courses /></PublicLayout>} />
        <Route path="/instruktorer"   element={<PublicLayout><Instructors /></PublicLayout>} />
        <Route path="/utrustning"     element={<PublicLayout><Equipment /></PublicLayout>} />
        <Route path="/bokning"        element={<PublicLayout><Booking /></PublicLayout>} />
        <Route path="/kontakt"        element={<PublicLayout><Contact /></PublicLayout>} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/kurser"       element={<ProtectedRoute><ManageCourses /></ProtectedRoute>} />
        <Route path="/admin/utrustning"   element={<ProtectedRoute><ManageEquipment /></ProtectedRoute>} />
        <Route path="/admin/instruktorer" element={<ProtectedRoute><ManageInstructors /></ProtectedRoute>} />
        <Route path="/admin/bokningar"    element={<ProtectedRoute><ManageBookings /></ProtectedRoute>} />
        <Route path="/admin/fakturor"     element={<ProtectedRoute><ManageInvoices /></ProtectedRoute>} />
        <Route path="/admin/installningar" element={<ProtectedRoute><FeatureSettings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
