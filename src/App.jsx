import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import './lib/i18n'
import './App.css'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import Users from './pages/Users'
import Transactions from './pages/Transactions'
import Reports from './pages/Reports'
import Invoices from './pages/Invoices'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Rentals from './pages/Rentals'
import CustodySystem from './pages/CustodySystem'
import EmployeeDashboard from './pages/EmployeeDashboard' // NEW: Import the employee dashboard

// Layout
import Layout from './components/Layout'

// Protected Route Component - Only for Admins
function ProtectedRoute({ children, allowedRoles = ['admin'] }) {
  const { user, userRole, userStatus, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If the user's role is not in the allowed roles, redirect
  if (!allowedRoles.includes(userRole)) {
    // Redirect employees to their dashboard, others (or null role) to home (which will redirect to login if not admin)
    const redirectPath = userRole === 'employee' ? '/employee-dashboard' : '/'
    return <Navigate to={redirectPath} replace />
  }

  // Check for inactive status
  if (user && userStatus === 'inactive') {
    return <Navigate to="/login" replace />
  }

  // For Admins, wrap with the main layout
  return <Layout>{children}</Layout>
}

// Employee Route Component - Only for Employees
function EmployeeRoute({ children }) {
  const { user, userRole, userStatus, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If a non-employee tries to access this page, redirect them to the admin home
  if (userRole !== 'employee') {
    return <Navigate to="/" replace />
  }

  if (userStatus === 'inactive') {
    return <Navigate to="/login" replace />
  }

  // Employees get the page content directly, without the main Layout/Sidebar
  return children
}

// Public Route Component (redirect to role-specific dashboard if already logged in)
function PublicRoute({ children }) {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (user) {
    // Redirect based on role
    const redirectPath = userRole === 'employee' ? '/employee-dashboard' : '/'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

function AppRoutes() {
  const { userRole } = useAuth()

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />

      {/* Employee Route */}
      <Route
        path="/employee-dashboard"
        element={
          <EmployeeRoute>
            <EmployeeDashboard />
          </EmployeeRoute>
        }
      />

      {/* Admin Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties"
        element={
          <ProtectedRoute>
            <Properties />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rentals"
        element={
          <ProtectedRoute>
            <Rentals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />

      {/* المسار الجديد لنظام العهدة */}
      <Route
        path="/custody"
        element={
          <ProtectedRoute>
            <CustodySystem />
          </ProtectedRoute>
        }
      />

      {/* Catch all - Redirect to correct dashboard based on role */}
      <Route path="*" element={<Navigate to={userRole === 'employee' ? '/employee-dashboard' : '/'} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
