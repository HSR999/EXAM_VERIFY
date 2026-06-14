import { ArrowRight, CheckCircle2, Fingerprint, ScanFace, ShieldCheck, Timer, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components'

const proof = [
  { value: '4 sec', label: 'Target verification time', icon: Timer },
  { value: '85%', label: 'Confidence threshold', icon: ScanFace },
  { value: 'Rs 0', label: 'Special hardware cost', icon: WalletCards },
]

export default function Home() {
  return (
    <main className="home">
      <section className="hero-shell">
        <div className="hero-nav">
          <Brand />
          <span className="sandbox-chip"><span /> DigiLocker-ready sandbox</span>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">SECURE. FAIR. INTELLIGENT.</p>
            <h1>Identity checks that keep pace with exam day.</h1>
            <p className="hero-lede">
              Fetch an official admit card, match the candidate at the gate,
              and preserve every decision in a tamper-evident audit trail.
            </p>
            <div className="hero-actions">
              <Link className="button primary" to="/verify">Start verification <ArrowRight size={18} /></Link>
              <Link className="button ghost" to="/dashboard">Open command center</Link>
            </div>
            <div className="trust-row">
              <span><CheckCircle2 size={16} /> Privacy-first capture</span>
              <span><CheckCircle2 size={16} /> Automatic fraud flags</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="ExamVerify verification preview">
            <div className="scan-card">
              <div className="scan-card-head">
                <span>GATE 04</span>
                <span className="connected">LIVE</span>
              </div>
              <div className="portrait-placeholder"><Fingerprint size={70} /></div>
              <div className="scan-line" />
              <div className="scan-result">
                <ShieldCheck size={24} />
                <div><strong>Identity verified</strong><small>94.2% face confidence</small></div>
              </div>
            </div>
            <div className="float-note note-one">DigiLocker document authenticated</div>
            <div className="float-note note-two">Audit event #00842 written</div>
          </div>
        </div>

        <div className="proof-grid">
          {proof.map(({ value, label, icon: Icon }) => (
            <article key={label}>
              <Icon size={22} />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

