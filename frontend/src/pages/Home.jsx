import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  ScanFace,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Unlock,
  Users,
} from 'lucide-react'
import { Brand } from '../components'
import { usePrivacy } from '../privacy'

export default function Home() {
  const navigate = useNavigate()
  const { personas, selectPersona, setIsDiffModalOpen, setIsRulesModalOpen } = usePrivacy()

  const handleSelectRole = (personaId, targetRoute) => {
    selectPersona(personaId, 'verify')
    navigate(targetRoute)
  }

  return (
    <main className="home-gateway">
      {/* Top Navbar */}
      <header className="gateway-nav">
        <Brand />
        <div className="gateway-nav-actions">
          <button className="btn-tool" onClick={() => setIsDiffModalOpen(true)}>
            <Sparkles size={14} /> ⚡ Live Privacy Diff View
          </button>
          <button className="btn-tool" onClick={() => setIsRulesModalOpen(true)}>
            <Shield size={14} /> 🛡️ Privacy Policy Matrix
          </button>
          <span className="pill-online"><span /> Sandbox Online</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="gateway-hero">
        <div className="gateway-hero-content">
          <span className="hero-eyebrow">ROUND 2 UPGRADE • CONTEXT-AWARE PRIVACY CONTROL</span>
          <h1>Identity verification with role-aware privacy at the gate.</h1>
          <p className="hero-subtitle">
            ExamVerify matches candidates using AI face prediction, but dynamically restricts sensitive data
            based on <strong>Who is looking</strong> (Role), <strong>Why they are looking</strong> (Intent), and <strong>Exam Window State</strong>.
          </p>
        </div>

        {/* 3 Interactive Persona Portals */}
        <div className="personas-container">
          <div className="personas-header">
            <h3>Select a Viewer Persona to Enter the Application</h3>
            <p>Experience how the exact same candidate record dynamically adapts its visibility based on role.</p>
          </div>

          <div className="personas-grid">
            {/* 1. Invigilator Card */}
            <div className="persona-card card-invigilator">
              <div className="card-top">
                <div className="role-icon-box green">
                  <ScanFace size={24} />
                </div>
                <span className="role-tag green">FULL GATE ACCESS</span>
              </div>
              <h4>Invigilator @ Gate</h4>
              <p className="role-desc">
                Live gate officer admitting students during active exam window. Needs full candidate identity and real-time camera feeds.
              </p>
              <ul className="role-perks">
                <li><Unlock size={13} className="text-green" /> Full Candidate Name & Roll Number</li>
                <li><Camera size={13} className="text-green" /> Real-time Webcam Stream Active</li>
                <li><Sparkles size={13} className="text-green" /> Raw 94.2% Prediction Score Precision</li>
                <li><CheckCircle2 size={13} className="text-green" /> Full Fraud & Anomaly Flags</li>
              </ul>
              <button
                className="button primary full"
                onClick={() => handleSelectRole('invigilator', '/verify')}
              >
                Enter as Invigilator <ArrowRight size={16} />
              </button>
            </div>

            {/* 2. Public Demo / Guest Card */}
            <div className="persona-card card-guest featured-card">
              <div className="featured-badge">⭐️ JUDGE DEMO MODE</div>
              <div className="card-top">
                <div className="role-icon-box purple">
                  <EyeOff size={24} />
                </div>
                <span className="role-tag purple">ZERO-PII DEMO</span>
              </div>
              <h4>Public Demo / Guest</h4>
              <p className="role-desc">
                Public visitor or judge inspecting workflow mechanics. Server defensive minimization masks all PII to prevent data leakage.
              </p>
              <ul className="role-perks">
                <li><Lock size={13} className="text-purple" /> Masked Names (e.g. <code>R*** S***</code>)</li>
                <li><Lock size={13} className="text-purple" /> Masked Roll Number (e.g. <code>***0042</code>)</li>
                <li><Lock size={13} className="text-purple" /> Biometric Photos Blurred / Placeholder</li>
                <li><Lock size={13} className="text-purple" /> Bucketed Score: <code>High (≥85%)</code></li>
              </ul>
              <button
                className="button primary full btn-purple"
                onClick={() => handleSelectRole('guest_demo', '/verify')}
              >
                Enter as Demo Guest <ArrowRight size={16} />
              </button>
            </div>

            {/* 3. Auditor Card */}
            <div className="persona-card card-auditor">
              <div className="card-top">
                <div className="role-icon-box blue">
                  <ScrollText size={24} />
                </div>
                <span className="role-tag blue">POST-EXAM AUDIT</span>
              </div>
              <h4>Auditor / Compliance</h4>
              <p className="role-desc">
                Conducts post-exam compliance review. Full historical audit records with live gate camera feeds strictly disabled.
              </p>
              <ul className="role-perks">
                <li><CheckCircle2 size={13} className="text-blue" /> Full Historic Verification Records</li>
                <li><EyeOff size={13} className="text-blue" /> Live Gate Camera Streams Disabled</li>
                <li><CheckCircle2 size={13} className="text-blue" /> Immutable Access Decision Ledger</li>
                <li><CheckCircle2 size={13} className="text-blue" /> CSV Compliance Export</li>
              </ul>
              <button
                className="button dark full"
                onClick={() => handleSelectRole('auditor', '/audit')}
              >
                Enter as Auditor <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlight Cards */}
        <div className="feature-proof-strip">
          <div className="proof-box" onClick={() => setIsDiffModalOpen(true)}>
            <Sparkles size={20} className="text-lime" />
            <div>
              <strong>⚡ Live Split-Screen Diff View</strong>
              <small>Click to compare the same candidate record side-by-side in Guest vs Invigilator mode.</small>
            </div>
          </div>
          <div className="proof-box" onClick={() => setIsRulesModalOpen(true)}>
            <Shield size={20} className="text-lime" />
            <div>
              <strong>🛡️ Inspectable Privacy Matrix</strong>
              <small>Inspect the deterministic server-side lookup table and test sandbox combinations.</small>
            </div>
          </div>
          <div className="proof-box" onClick={() => handleSelectRole('mismatched', '/verify')}>
            <Lock size={20} className="text-lime" />
            <div>
              <strong>⚠️ Context Mismatch Defense</strong>
              <small>Simulate unauthorized post-exam review during active exams to trigger automatic minimization.</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
