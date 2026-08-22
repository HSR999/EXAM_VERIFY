import { useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react'
import { usePrivacy } from '../privacy'

const CANDIDATES = [
  {
    roll: 'JEE25BPL0042',
    name: 'Rahul Sharma',
    dob: '15-03-2005',
    score: 94.2,
    status: 'VERIFIED',
    photo: 'https://i.pravatar.cc/300?img=11',
    flags: [],
    caseType: 'Verified Standard Candidate',
  },
  {
    roll: 'JEE25BPL0103',
    name: 'Amit Patel',
    dob: '08-11-2004',
    score: 61.3,
    status: 'FLAGGED',
    photo: 'https://i.pravatar.cc/300?img=3',
    flags: ['LOW_CONFIDENCE', 'MULTIPLE_ATTEMPTS'],
    caseType: 'Flagged Anomaly Candidate',
  },
]

export function LiveDiffModal() {
  const { isDiffModalOpen, setIsDiffModalOpen } = usePrivacy()
  const [selectedRoll, setSelectedRoll] = useState('JEE25BPL0042')

  if (!isDiffModalOpen) return null

  const candidate = CANDIDATES.find((c) => c.roll === selectedRoll) || CANDIDATES[0]

  return (
    <div className="modal-backdrop" onClick={() => setIsDiffModalOpen(false)}>
      <div className="modal-container diff-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge"><Sparkles size={14} /> LIVE EVIDENCE COMPARATOR</span>
            <h2>Context-Aware Privacy: Before & After Split View</h2>
            <p>
              Compare identical candidate records served by the backend under <strong>Guest Mode</strong> vs <strong>Invigilator Mode</strong>.
            </p>
          </div>
          <button className="modal-close" onClick={() => setIsDiffModalOpen(false)}>
            <X size={20} />
          </button>
        </header>

        <div className="diff-candidate-selector">
          <span>Select candidate case:</span>
          {CANDIDATES.map((c) => (
            <button
              key={c.roll}
              className={c.roll === selectedRoll ? 'active' : ''}
              onClick={() => setSelectedRoll(c.roll)}
            >
              <strong>{c.roll}</strong>
              <small>{c.caseType}</small>
            </button>
          ))}
        </div>

        <div className="diff-grid">
          {/* LEFT: Guest / Public Demo */}
          <div className="diff-column diff-guest">
            <div className="diff-col-head">
              <div className="diff-pill guest">
                <EyeOff size={15} />
                <span>Guest / Public Demo</span>
              </div>
              <small>Zero-PII Defensive Minimization</small>
            </div>

            <div className="diff-card">
              <div className="diff-field">
                <span className="diff-label">Candidate Name</span>
                <div className="diff-value masked">
                  <code>R*** S***</code>
                  <span className="diff-tag amber"><Lock size={10} /> Masked</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Roll Number</span>
                <div className="diff-value masked">
                  <code>***0042</code>
                  <span className="diff-tag amber"><Lock size={10} /> Masked</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Admit Card Photo</span>
                <div className="diff-photo-wrapper masked">
                  <div className="blurred-photo-placeholder">
                    <Fingerprint size={32} />
                    <span>Photo Blurred</span>
                  </div>
                  <span className="diff-tag amber"><Lock size={10} /> Redacted</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Live Camera Stream</span>
                <div className="diff-value disabled-box">
                  <Camera size={18} />
                  <span>Stream Hidden (Privacy Protected)</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">AI Face Confidence (Prediction)</span>
                <div className="diff-value masked">
                  <strong className="bucket-value">{candidate.score >= 85 ? 'High (≥85%)' : 'Medium (60-84%)'}</strong>
                  <span className="diff-tag amber"><Lock size={10} /> Bucketed</span>
                </div>
                <small className="diff-hint">Exact raw confidence score {candidate.score}% is stripped by server</small>
              </div>

              <div className="diff-field">
                <span className="diff-label">Decision & Fraud Detail</span>
                <div className="diff-value">
                  <span className={`status status-${candidate.status.toLowerCase()}`}>{candidate.status}</span>
                  <span className="generic-flag">UNDER REVIEW</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Audit Log Actor</span>
                <div className="diff-value masked">
                  <code>REDACTED_ACTOR</code>
                  <span className="diff-tag amber"><Lock size={10} /> Masked</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Invigilator Live Verification */}
          <div className="diff-column diff-invigilator">
            <div className="diff-col-head">
              <div className="diff-pill invigilator">
                <Eye size={15} />
                <span>Invigilator @ Gate</span>
              </div>
              <small>Full Operational Admission Scope</small>
            </div>

            <div className="diff-card">
              <div className="diff-field">
                <span className="diff-label">Candidate Name</span>
                <div className="diff-value clear">
                  <strong>{candidate.name}</strong>
                  <span className="diff-tag green"><Unlock size={10} /> Clear</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Roll Number</span>
                <div className="diff-value clear">
                  <code>{candidate.roll}</code>
                  <span className="diff-tag green"><Unlock size={10} /> Clear</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Admit Card Photo</span>
                <div className="diff-photo-wrapper clear">
                  <img src={candidate.photo} alt={candidate.name} className="clear-photo" />
                  <span className="diff-tag green"><Unlock size={10} /> Shown</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Live Camera Stream</span>
                <div className="diff-value active-box">
                  <ScanFace size={18} />
                  <span>Real-time Webcam Active</span>
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">AI Face Confidence (Prediction)</span>
                <div className="diff-value clear">
                  <strong className="raw-score">{candidate.score.toFixed(1)}%</strong>
                  <span className="diff-tag green"><Unlock size={10} /> Full Precision</span>
                </div>
                <small className="diff-hint">Full precision Euclidean distance score available for gate officer</small>
              </div>

              <div className="diff-field">
                <span className="diff-label">Decision & Fraud Detail</span>
                <div className="diff-value">
                  <span className={`status status-${candidate.status.toLowerCase()}`}>{candidate.status}</span>
                  {candidate.flags.length > 0 ? (
                    <div className="flag-chips">
                      {candidate.flags.map((f) => (
                        <span key={f} className="flag-chip">{f.replace('_', ' ')}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="clear-tag"><CheckCircle2 size={13} /> Clean Gate Record</span>
                  )}
                </div>
              </div>

              <div className="diff-field">
                <span className="diff-label">Audit Log Actor</span>
                <div className="diff-value clear">
                  <code>AI_ENGINE / FRAUD_ENGINE</code>
                  <span className="diff-tag green"><Unlock size={10} /> Full</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <div className="assurance-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Server-Enforced Guarantee:</strong> Redaction is calculated in FastAPI backend payloads.
              Raw PII never traverses the network to unauthorized or guest clients.
            </span>
          </div>
          <button className="button dark" onClick={() => setIsDiffModalOpen(false)}>
            Close Diff View
          </button>
        </footer>
      </div>
    </div>
  )
}
