import { Link, NavLink } from 'react-router-dom'
import { Activity, Fingerprint, LayoutDashboard, ScrollText, ShieldCheck } from 'lucide-react'

export function Brand({ compact = false }) {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark"><ShieldCheck size={compact ? 20 : 24} /></span>
      <span>
        <strong>ExamVerify</strong>
        {!compact && <small>Identity intelligence</small>}
      </span>
    </Link>
  )
}

export function Nav() {
  return (
    <header className="topbar">
      <Brand compact />
      <nav>
        <NavLink to="/verify"><Fingerprint size={17} /> Verify</NavLink>
        <NavLink to="/dashboard"><LayoutDashboard size={17} /> Dashboard</NavLink>
        <NavLink to="/audit"><ScrollText size={17} /> Audit</NavLink>
      </nav>
      <div className="live-pill"><Activity size={14} /> Sandbox online</div>
    </header>
  )
}

export function StatusBadge({ status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status}</span>
}

export function Loading({ label = 'Loading secure records' }) {
  return <div className="loading"><span />{label}</div>
}

