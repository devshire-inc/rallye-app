import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { VerifyEmailPage } from './pages/VerifyEmail/VerifyEmailPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    </Router>
  )
}

export default App
