import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  LayoutDashboard,
  Lock,
  RotateCcw,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react'
import { usePrivacy } from './privacy'
export { RedactedBadge } from './components/RedactedBadge'
export { LiveDiffModal } from './components/LiveDiffModal'
export { PrivacyRulesModal } from './components/PrivacyRulesModal'

export function Brand({ compact = false }) {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark"><ShieldCheck size={compact ? 20 : 24} /></span>
      <span>
        <strong>ExamVerify</strong>
        {!compact && <small>Context-Aware Identity Verification</small>}
      </span>
    </Link>
  )
}

export function Nav() {
  const { setIsDiffModalOpen, setIsRulesModalOpen } = usePrivacy()

  return (
    <header className="topbar">
      <Brand compact />
      <nav>
        <NavLink to="/verify"><Fingerprint size={17} /> Gate Verify</NavLink>
        <NavLink to="/dashboard"><LayoutDashboard size={17} /> Dashboard</NavLink>
        <NavLink to="/audit"><ScrollText size={17} /> Audit Trail</NavLink>
      </nav>

      <div className="nav-actions">
        <button
          className="quick-diff-btn"
          onClick={() => setIsDiffModalOpen(true)}
          title="Open Side-by-Side Live Privacy Diff"
        >
          <Sparkles size={14} /> ⚡ Live Privacy Diff View
        </button>

        <button
          className="quick-rules-btn"
          onClick={() => setIsRulesModalOpen(true)}
          title="Inspect Privacy Matrix Rules"
        >
          <Shield size={14} /> 🛡️ Rule Matrix
        </button>

        <div className="live-pill"><Activity size={14} /> Sandbox Online</div>
      </div>
    </header>
  )
}

export function ContextBanner({ screen = 'verify' }) {
  const { activePersona, personas, selectPersona, decision, setIsDiffModalOpen } = usePrivacy()
  const isGuest = activePersona.id === 'guest_demo'
  const isInvigilator = activePersona.id === 'invigilator'
  const isAuditor = activePersona.id === 'auditor'

  return (
    <section className={`role-selector-bar theme-${activePersona.tone}`}>
      <div className="role-bar-container">
        <div className="role-tabs-wrap">
          <span className="role-bar-label">SELECT YOUR ACTIVE ROLE:</span>
          <div className="role-tabs">
            {personas.filter((p) => p.id !== 'mismatched').map((p) => {
              const isCurrent = activePersona.id === p.id
              return (
                <button
                  key={p.id}
                  className={`role-tab-btn tab-${p.tone} ${isCurrent ? 'active' : ''}`}
                  onClick={() => selectPersona(p.id, screen)}
                >
                  <span className="tab-icon">{p.icon}</span>
                  <span className="tab-text">
                    <strong>{p.title}</strong>
                    <small>{p.tag}</small>
                  </span>
                  {isCurrent && <Check size={14} className="tab-check" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dynamic Explainer Banner */}
        <div className="role-explanation-banner">
          <div className="explainer-content">
            {isGuest && (
              <>
                <div className="explainer-badge purple"><Lock size={13} /> GUEST DEMO MODE (PRIVACY ACTIVE)</div>
                <p>
                  You are viewing as a <strong>Public Demo Guest</strong>. Notice how candidate names are masked (<code>R*** S***</code>),
                  roll numbers are masked (<code>***0042</code>), photos are blurred, and prediction scores are bucketed to <code>High (≥85%)</code> to protect student privacy.
                </p>
                <button className="btn-switch-cta green" onClick={() => selectPersona('invigilator', screen)}>
                  Switch to Invigilator View (Unmask PII) <ArrowRight size={13} />
                </button>
              </>
            )}

            {isInvigilator && (
              <>
                <div className="explainer-badge green"><Unlock size={13} /> INVIGILATOR GATE MODE (FULL ACCESS)</div>
                <p>
                  You are viewing as an <strong>Authorized Gate Invigilator</strong>. You have full operational access to candidate names (<code>Rahul Sharma</code>),
                  clear admit card photos, live webcam stream, and exact raw face-match scores (<code>94.2%</code>).
                </p>
                <button className="btn-switch-cta purple" onClick={() => selectPersona('guest_demo', screen)}>
                  Switch to Guest Demo Mode (Mask PII) <ArrowRight size={13} />
                </button>
              </>
            )}

            {isAuditor && (
              <>
                <div className="explainer-badge blue"><ScrollText size={13} /> AUDITOR MODE (POST-EXAM COMPLIANCE)</div>
                <p>
                  You are viewing as an <strong>Auditor</strong>. You have access to historic candidate records, discrepancy logs, and immutable access decision trails. (Live gate webcam feeds are disabled).
                </p>
                <button className="btn-switch-cta purple" onClick={() => selectPersona('guest_demo', screen)}>
                  Switch to Guest Demo Mode <ArrowRight size={13} />
                </button>
              </>
            )}
          </div>

          <div className="explainer-tools">
            <button className="btn-mini-diff" onClick={() => setIsDiffModalOpen(true)}>
              <Sparkles size={13} /> Side-by-Side Diff View
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function StatusBadge({ status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status}</span>
}

export function Loading({ label = 'Loading secure records' }) {
  return <div className="loading"><span />{label}</div>
}
