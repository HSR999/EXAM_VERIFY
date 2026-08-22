import { useEffect, useState } from 'react'
import { Check, Database, Eye, Info, Lock, Shield, Sliders, X } from 'lucide-react'
import { api } from '../api'
import { CONTEXT_OPTIONS, INTENT_OPTIONS, ROLE_OPTIONS, usePrivacy } from '../privacy'

const DEFAULT_MATRIX = [
  {
    combination: 'Invigilator + Live Gate Verification (Exam in Progress)',
    role: 'invigilator',
    profile: 'INVIGILATOR_LIVE',
    candidate_name: 'Full Name (Rahul Sharma)',
    roll_number: 'Full Roll (JEE25BPL0042)',
    admit_photo: 'Full Admit Photo',
    raw_confidence: 'Exact Score (94.2%)',
    flag_reason_detail: 'Full Details (Multiple Attempts)',
    actor_identity: 'Full (AI_ENGINE)',
    justification: 'Invigilator at the gate needs full operational biometric visibility to admit students.',
  },
  {
    combination: 'Public Demo / Guest (Demo Walkthrough)',
    role: 'guest_demo',
    profile: 'GUEST_DEMO',
    candidate_name: 'Masked (R*** S***)',
    roll_number: 'Masked (***0042)',
    admit_photo: 'Blurred Placeholder',
    raw_confidence: 'Bucketed (High ≥85%)',
    flag_reason_detail: 'Generic (Under Review)',
    actor_identity: 'Redacted (REDACTED_ACTOR)',
    justification: 'Public demo viewers inspect workflow mechanics without accessing real student PII or raw biometric distances.',
  },
  {
    combination: 'Auditor + Post-Exam Review (Exam Closed)',
    role: 'auditor',
    profile: 'AUDITOR_COMPLIANCE',
    candidate_name: 'Full Name (Rahul Sharma)',
    roll_number: 'Full Roll (JEE25BPL0042)',
    admit_photo: 'Full Admit Photo',
    raw_confidence: 'Exact Score (94.2%)',
    flag_reason_detail: 'Full Details',
    actor_identity: 'Full (AI_ENGINE)',
    justification: 'Auditor reviewing historic records has need-to-know access; live gate camera streams disabled.',
  },
  {
    combination: 'Any Role + Mismatched Context (e.g. Invigilator post-exam during live exam)',
    role: 'mismatched',
    profile: 'MISMATCHED_INTENT',
    candidate_name: 'Masked + Reason Shown',
    roll_number: 'Masked + Reason Shown',
    admit_photo: 'Hidden',
    raw_confidence: 'Bucketed',
    flag_reason_detail: 'Generic (Under Review)',
    actor_identity: 'Redacted',
    justification: 'Stated role and intent do not match active exam window; automatic defensive minimization applied.',
  },
]

export function PrivacyRulesModal() {
  const { isRulesModalOpen, setIsRulesModalOpen } = usePrivacy()
  const [matrixList, setMatrixList] = useState(DEFAULT_MATRIX)
  const [testRole, setTestRole] = useState('guest_demo')
  const [testIntent, setTestIntent] = useState('demo_walkthrough')
  const [testContext, setTestContext] = useState('exam_in_progress')
  const [evaluation, setEvaluation] = useState({
    profile: 'GUEST_DEMO',
    reason: 'Guest / public demo context: PII masked, biometric photos blurred, confidence bucketed to preserve privacy.',
    fields_granted: ['decision'],
    fields_redacted: ['candidate_name', 'roll_number', 'dob', 'admit_photo', 'live_webcam', 'raw_confidence', 'flag_reason_detail', 'actor_identity', 'digilocker_id'],
  })

  useEffect(() => {
    if (isRulesModalOpen) {
      api('/context/rules')
        .then((res) => {
          if (res?.matrix_definition && res.matrix_definition.length > 0) {
            setMatrixList(res.matrix_definition)
          }
        })
        .catch(() => {})
      evaluateSandbox(testRole, testIntent, testContext)
    }
  }, [isRulesModalOpen, testRole, testIntent, testContext])

  async function evaluateSandbox(r, i, c) {
    try {
      const res = await api('/context/session', {
        method: 'POST',
        headers: {
          'X-Viewer-Role': r,
          'X-Viewer-Intent': i,
          'X-Viewer-Context': c,
          'X-Viewer-Screen': 'rules_sandbox',
        },
        body: JSON.stringify({ role: r, intent: i, context: c, screen: 'rules_sandbox' }),
      })
      if (res?.visibility_profile) {
        setEvaluation(res.visibility_profile)
      }
    } catch {
      // Keep
    }
  }

  if (!isRulesModalOpen) return null

  return (
    <div className="modal-backdrop" onClick={() => setIsRulesModalOpen(false)}>
      <div className="modal-container rules-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge"><Shield size={14} /> PRIVACY RULE MATRIX SPECIFICATION</span>
            <h2>How ExamVerify Determines Data Visibility</h2>
            <p>
              Data visibility is calculated dynamically: <code>Visibility = Role × Intent × Exam Window</code>.
            </p>
          </div>
          <button className="modal-close" onClick={() => setIsRulesModalOpen(false)}>
            <X size={20} />
          </button>
        </header>

        <section className="matrix-table-section">
          <h3>Deterministic Data Redaction Matrix (PRD Section 6)</h3>
          <div className="matrix-table-scroll">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Viewer Context</th>
                  <th>Candidate Name</th>
                  <th>Roll Number</th>
                  <th>Admit Photo</th>
                  <th>Confidence Score</th>
                  <th>Fraud Flags</th>
                  <th>Audit Actor</th>
                </tr>
              </thead>
              <tbody>
                {matrixList.map((row, idx) => {
                  const isFull = String(row.candidate_name).toLowerCase().includes('full')
                  return (
                    <tr key={idx}>
                      <td>
                        <strong>{row.combination}</strong>
                        <small>{row.justification}</small>
                      </td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.candidate_name}</span></td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.roll_number}</span></td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.admit_photo}</span></td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.raw_confidence}</span></td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.flag_reason_detail}</span></td>
                      <td><span className={`rule-tag ${isFull ? 'full' : 'masked'}`}>{row.actor_identity}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sandbox-evaluator">
          <div className="sandbox-heading">
            <Sliders size={18} />
            <div>
              <h4>Live Policy Simulator (Try Different Roles)</h4>
              <p>Select any Role, Intent, and Exam State to see what the server allows or masks in real time.</p>
            </div>
          </div>

          <div className="sandbox-controls">
            <label>
              Viewer Role
              <select value={testRole} onChange={(e) => setTestRole(e.target.value)}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              Declared Intent
              <select value={testIntent} onChange={(e) => setTestIntent(e.target.value)}>
                {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              Exam State
              <select value={testContext} onChange={(e) => setTestContext(e.target.value)}>
                {CONTEXT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          {evaluation && (
            <div className="sandbox-result">
              <div className="result-header">
                <div>
                  <span className="profile-pill">{evaluation.profile}</span>
                  {evaluation.is_mismatched && <span className="mismatch-pill">⚠️ MISMATCH DETECTED</span>}
                </div>
                <small>{evaluation.reason}</small>
              </div>

              <div className="sandbox-fields-grid">
                <div>
                  <strong className="granted-title"><Check size={14} /> Visible to Viewer ({evaluation.fields_granted?.length || 0})</strong>
                  <div className="pill-list">
                    {(evaluation.fields_granted || []).map((f) => (
                      <span key={f} className="field-pill granted">{f.replace('_', ' ')}</span>
                    ))}
                    {!evaluation.fields_granted?.length && <em>None</em>}
                  </div>
                </div>

                <div>
                  <strong className="redacted-title"><Lock size={14} /> Masked / Protected ({evaluation.fields_redacted?.length || 0})</strong>
                  <div className="pill-list">
                    {(evaluation.fields_redacted || []).map((f) => (
                      <span key={f} className="field-pill redacted">{f.replace('_', ' ')}</span>
                    ))}
                    {!evaluation.fields_redacted?.length && <em>None (Full Gate Access)</em>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="modal-footer">
          <button className="button dark" onClick={() => setIsRulesModalOpen(false)}>
            Close Rule Matrix
          </button>
        </footer>
      </div>
    </div>
  )
}
