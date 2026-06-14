import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import StudentVerify from './pages/StudentVerify'
import Dashboard from './pages/Dashboard'
import AuditTrail from './pages/AuditTrail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify" element={<StudentVerify />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/audit" element={<AuditTrail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

