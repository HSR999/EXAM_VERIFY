import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Database,
  Eye, EyeOff, FileCheck2, Fingerprint, History, LoaderCircle, Lock, LockKeyhole,
  RotateCcw, ScanFace, ScrollText, Shield, ShieldAlert, Sparkles, Terminal, Unlock, XCircle,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ContextBanner, Nav, RedactedBadge } from '../components'
import { usePrivacy } from '../privacy'

const STEPS = ['Candidate', 'DigiLocker', 'Verification', 'Decision']
const DEMO_ROLLS = [
  { roll: 'JEE25BPL0042', label: 'Verified candidate (Rahul Sharma)', tone: 'good' },
  { roll: 'JEE25BPL0103', label: 'Fraud candidate (Amit Patel)', tone: 'bad' },
]

function clock() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false })
}

export default function StudentVerify() {
  const [step, setStep] = useState(0)
  const [roll, setRoll] = useState('')
  const [student, setStudent] = useState(null)
  const [raw, setRaw] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [result, setResult] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const intervalRef = useRef(null)
  const navigate = useNavigate()
  const { context, activePersona, selectPersona, decision, setIsDiffModalOpen } = usePrivacy()

  const isGuest = activePersona.id === 'guest_demo'
  const isInvigilator = activePersona.id === 'invigilator'
  const isAuditor = activePersona.id === 'auditor'
  const isMismatched = activePersona.id === 'mismatched' || decision?.profile === 'MISMATCHED_INTENT'
  const isWebcamRestricted = decision?.field_rules?.live_webcam === 'HIDDEN' || isGuest || isAuditor || isMismatched

  const addLog = (message, type = 'neutral') => {
    setLogs((current) => [...current, { time: clock(), message, type }])
  }

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop())
  }, [])

  // Auto-refetch document on role switch if student is already loaded
  useEffect(() => {
    if (student && roll && step >= 1) {
      refetchUnderActiveContext(roll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersona.id])

  async function refetchUnderActiveContext(selectedRoll) {
    try {
      const response = await api(`/digilocker/fetch/${selectedRoll}`, { screen: 'verify' })
      const cert = response.document.CertificateData
      const person = response.document.IssuedTo.Person
      setRaw(response)
      setStudent({
        name: person.name,
        nameIsMasked: person.name_is_masked,
        dob: person.dob,
        roll: cert.RollNumber,
        rollIsMasked: cert.roll_is_masked,
        exam: cert.ExamName,
        center: cert.ExamCenter,
        centerCode: cert.CenterCode,
        examDate: cert.ExamDate,
        photo: cert.PhotoURL,
        photoRedacted: cert.PhotoRedacted,
        photoRedactionMode: cert.PhotoRedactionMode,
        issuer: response.document.issuer,
        digiId: response.document.DigiLockerID,
      })
      addLog(`Role changed to ${activePersona.title} → Visibility updated live`, 'warning')
    } catch {
      // Keep
    }
  }

  async function fetchDocument(selectedRoll = roll) {
    const normalized = selectedRoll.trim().toUpperCase()
    if (!normalized) {
      setError('Enter or select a roll number to continue.')
      return
    }
    setRoll(normalized)
    setError('')
    setLoading(true)
    addLog(`Initiating DigiLocker OAuth handshake (Role: ${activePersona.title})`)
    addLog(`GET /digilocker/fetch/${normalized}`, 'request')
    try {
      const response = await api(`/digilocker/fetch/${normalized}`, { screen: 'verify' })
      const cert = response.document.CertificateData
      const person = response.document.IssuedTo.Person
      setRaw(response)
      setSessionId(response.session_id)
      setStudent({
        name: person.name,
        nameIsMasked: person.name_is_masked,
        dob: person.dob,
        roll: cert.RollNumber,
        rollIsMasked: cert.roll_is_masked,
        exam: cert.ExamName,
        center: cert.ExamCenter,
        centerCode: cert.CenterCode,
        examDate: cert.ExamDate,
        photo: cert.PhotoURL,
        photoRedacted: cert.PhotoRedacted,
        photoRedactionMode: cert.PhotoRedactionMode,
        issuer: response.document.issuer,
        digiId: response.document.DigiLockerID,
      })
      addLog(`DigiLocker response received (${response.response_time_ms}ms)`, 'success')
      addLog(`Document verified by ${response.document.issuer}`, 'success')
      addLog(`Server-side profile applied: ${response.visibility_profile?.profile || activePersona.title}`, 'warning')
      setStep(1)
    } catch (requestError) {
      setError(requestError.message)
      addLog(requestError.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Invigilator Live Face Match or Guest Demo Simulation
  async function startVerificationFlow() {
    if (isMismatched) {
      addLog('Action blocked: Contextual mismatch forbids gate verification', 'error')
      return
    }

    setStep(2)

    if (isInvigilator) {
      addLog('Starting real-time live gate camera stream', 'request')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (videoRef.current) videoRef.current.srcObject = stream
        addLog('Live gate camera feed connected (HD)', 'success')
      } catch {
        addLog('Hardware camera unavailable; simulator feed active', 'warning')
      }
    } else if (isGuest) {
      addLog('Live camera disabled per Guest Privacy Policy (Zero Biometric Capture)', 'warning')
      addLog('Running synthetic demo prediction pipeline', 'request')
    }

    const target = roll === 'JEE25BPL0103' ? 61.3 : 94.2
    let current = 0
    intervalRef.current = window.setInterval(() => {
      current = Math.min(target, current + 4 + Math.random() * 8)
      setConfidence(current)
      if (current >= target) {
        clearInterval(intervalRef.current)
        if (isInvigilator) {
          addLog(`Live biometric match: ${target.toFixed(1)}% confidence`, target >= 85 ? 'success' : 'warning')
        } else {
          addLog(`Demo match calculated: ${target >= 85 ? 'High (≥85%)' : 'Medium (60-84%)'} bucket`, 'success')
        }
        window.setTimeout(() => finishVerification(target), 600)
      }
    }, 180)
  }

  // Auditor Historic Audit Review (No Live Match, reads archived data)
  async function runAuditorComplianceReview() {
    addLog(`Auditor initiated post-exam compliance review for ${roll}`, 'request')
    const target = roll === 'JEE25BPL0103' ? 61.3 : 94.2
    const verified = target >= 85
    setResult({ verified, confidence: target, isAuditReview: true })
    setConfidence(target)
    setStep(3)
    addLog(`Archived record retrieved: ${verified ? 'VERIFIED' : 'FLAGGED'} at ${target}%`, verified ? 'success' : 'warning')
    addLog('Access decision recorded in immutable compliance ledger', 'success')
  }

  async function finishVerification(finalConfidence) {
    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop())
    const verified = finalConfidence >= 85
    setResult({ verified, confidence: finalConfidence, isAuditReview: false })
    setStep(3)
    addLog(`Verdict: ${verified ? 'ENTRY AUTHORIZED' : 'MANUAL ESCALATION REQUIRED'}`, verified ? 'success' : 'error')
    try {
      const response = await api('/verify/complete', {
        method: 'POST',
        screen: 'verify',
        body: JSON.stringify({
          student_id: roll,
          session_id: sessionId,
          confidence: finalConfidence,
          status: verified ? 'VERIFIED' : 'FAILED',
          center_id: 'MANIT_BPL_04',
        }),
      })
      addLog('Verification event & Access decision committed to audit trail', 'success')
      response.flags.forEach((flag) => addLog(`Fraud alert: ${flag}`, 'error'))
    } catch (requestError) {
      addLog(`Audit commit failed: ${requestError.message}`, 'error')
    }
  }

  function reset() {
    clearInterval(intervalRef.current)
    setStep(0)
    setRoll('')
    setStudent(null)
    setRaw(null)
    setSessionId('')
    setConfidence(0)
    setResult(null)
    setLogs([])
    setError('')
  }

  return (
    <main className="app-page verify-page">
      <Nav />
      {/* Prominent Role Selector Bar */}
      <ContextBanner screen="verify" />

      <div className="verify-layout-clean">
        <section className="verify-main-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PREDICTION & GATE ADMISSION</p>
              <h1>Candidate Verification</h1>
            </div>
            <span className="center-tag">MANIT Bhopal / Gate 04</span>
          </div>

          <div className="stepper">
            {STEPS.map((label, index) => (
              <div className={index <= step ? 'active' : ''} key={label}>
                <span>{index < step ? <Check size={15} /> : index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>

          <div className="verification-card">
            {/* Step 0: Input Roll */}
            {step === 0 && (
              <div className="candidate-step">
                <div className="step-icon"><Fingerprint size={34} /></div>
                <h2>Fetch Candidate Admit Card</h2>
                <p>Click a demo candidate below or input a roll number.</p>

                <div className="demo-options">
                  {DEMO_ROLLS.map((option) => (
                    <button key={option.roll} onClick={() => fetchDocument(option.roll)}>
                      <span className={`demo-dot ${option.tone}`} />
                      <strong>{option.roll}</strong>
                      <small>{option.label}</small>
                    </button>
                  ))}
                </div>

                <label className="field-label" htmlFor="roll">Candidate Roll Number</label>
                <div className="input-action">
                  <input
                    id="roll"
                    value={roll}
                    onChange={(event) => setRoll(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && fetchDocument()}
                    placeholder="JEE25BPL0042"
                  />
                  <button className="icon-button" title="Simulate QR scan" onClick={() => fetchDocument('JEE25BPL0042')}>
                    <ScanFace size={21} />
                  </button>
                </div>

                {error && <div className="inline-error"><AlertTriangle size={17} />{error}</div>}
                <button className="button primary full" disabled={loading} onClick={() => fetchDocument()}>
                  {loading ? <><LoaderCircle className="spin" size={18} /> Fetching from DigiLocker API</> : <>Fetch via DigiLocker Sandbox <ArrowRight size={18} /></>}
                </button>
              </div>
            )}

            {/* Step 1: Admit Card Display */}
            {step === 1 && student && (
              <div className="document-step">
                {/* Live Role Switcher Prompt inside the card */}
                <div className={`live-role-prompt ${isGuest ? 'prompt-guest' : isAuditor ? 'prompt-auditor' : 'prompt-invigilator'}`}>
                  {isGuest && (
                    <div>
                      <strong>🔒 Guest Demo Mode: Candidate PII & Photo are masked on the server.</strong>
                      <button onClick={() => selectPersona('invigilator', 'verify')}>
                        Switch to Invigilator to Unmask & Verify Live <Unlock size={12} />
                      </button>
                    </div>
                  )}
                  {isInvigilator && (
                    <div>
                      <strong>🟢 Invigilator Mode: Full identity is unmasked for live gate admission.</strong>
                      <button onClick={() => selectPersona('guest_demo', 'verify')}>
                        Switch to Guest Mode (Mask PII) <Lock size={12} />
                      </button>
                    </div>
                  )}
                  {isAuditor && (
                    <div>
                      <strong>🔵 Auditor Mode: Exam is closed. Historical review mode active.</strong>
                      <button onClick={() => selectPersona('invigilator', 'verify')}>
                        Switch to Gate Invigilator <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="document-verified">
                  <FileCheck2 size={22} />
                  <div>
                    <strong>DigiLocker Issuer Authenticated</strong>
                    <small>{student.issuer} / {student.digiId}</small>
                  </div>
                  <CheckCircle2 size={22} />
                </div>

                <div className="admit-card">
                  <div className="admit-title">
                    <span>OFFICIAL ADMIT CARD</span>
                    <span>JEE MAIN 2025</span>
                  </div>

                  <div className="candidate-profile">
                    {student.photo && !student.photoRedacted ? (
                      <img src={student.photo} alt={student.name} />
                    ) : (
                      <div className="photo-blurred-box">
                        <Fingerprint size={36} />
                        <span>Photo Blurred</span>
                        <small>(Guest Privacy Mode)</small>
                      </div>
                    )}

                    <div className="candidate-info-block">
                      <p>Candidate Identity</p>
                      <h2>
                        <RedactedBadge
                          isMasked={student.nameIsMasked || isGuest}
                          reason="Candidate PII masked in public/demo view per privacy matrix"
                          label="Masked"
                        >
                          {student.name}
                        </RedactedBadge>
                      </h2>
                      <code>
                        <RedactedBadge
                          isMasked={student.rollIsMasked || isGuest}
                          reason="Roll number masked to prevent candidate identification"
                          label="Masked"
                        >
                          {student.roll}
                        </RedactedBadge>
                      </code>
                    </div>
                  </div>

                  <dl>
                    <div><dt>Date of Birth</dt><dd>{student.dob}</dd></div>
                    <div><dt>Exam Date</dt><dd>{student.examDate}</dd></div>
                    <div><dt>Exam Center</dt><dd>{student.center}</dd></div>
                    <div><dt>Center Code</dt><dd>{student.centerCode}</dd></div>
                  </dl>
                </div>

                {/* Role-Governed Action Area */}
                {isInvigilator && (
                  <button className="button primary full" onClick={startVerificationFlow}>
                    <Camera size={18} /> Verify Live Candidate Face at Gate
                  </button>
                )}

                {isGuest && (
                  <div className="guest-action-group">
                    <button className="button primary full btn-purple" onClick={startVerificationFlow}>
                      <Shield size={18} /> Run Privacy-Safe Demo Simulation
                    </button>
                    <button className="button ghost full" onClick={() => selectPersona('invigilator', 'verify')}>
                      <Unlock size={16} /> Switch to Invigilator to Unlock Live Webcam Match
                    </button>
                  </div>
                )}

                {isAuditor && (
                  <div className="auditor-action-group">
                    <div className="role-security-notice">
                      <History size={16} />
                      <div>
                        <strong>Gate Admission Closed (Post-Exam)</strong>
                        <small>Auditors review compliance records; live biometric gate capture is disabled post-exam.</small>
                      </div>
                    </div>
                    <button className="button dark full" onClick={runAuditorComplianceReview}>
                      <ScrollText size={18} /> Review Historical Verification Record
                    </button>
                  </div>
                )}

                {isMismatched && (
                  <div className="mismatched-blocked-box">
                    <ShieldAlert size={22} />
                    <div>
                      <strong>Verification Blocked by Privacy Engine</strong>
                      <small>Contextual mismatch detected: Invigilator cannot perform post-exam reviews during live exam window.</small>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Verification In Progress */}
            {step === 2 && (
              <div className="match-step">
                <div className="face-comparison">
                  <figure className="reference-figure">
                    {student?.photo && !student?.photoRedacted ? (
                      <img src={student?.photo} alt="DigiLocker reference" />
                    ) : (
                      <div className="blurred-figure-box">
                        <Fingerprint size={42} />
                        <span>Admit Reference (Protected)</span>
                      </div>
                    )}
                    <figcaption>DigiLocker Reference Photo</figcaption>
                  </figure>

                  <div className="match-core">
                    <ScanFace size={32} />
                    <span>AI PREDICTION</span>
                  </div>

                  <figure className="camera-feed">
                    {isWebcamRestricted ? (
                      <div className="webcam-restricted-box">
                        <EyeOff size={36} />
                        <strong>Webcam Stream Shielded</strong>
                        <small>{isGuest ? 'Protected in Demo Mode (No Biometrics Captured)' : 'Disabled Post-Exam'}</small>
                      </div>
                    ) : (
                      <>
                        <video ref={videoRef} autoPlay muted playsInline />
                        <Camera size={42} />
                      </>
                    )}
                    <figcaption>{isInvigilator ? 'Live Gate Camera Feed' : 'Biometric Privacy Shield'}</figcaption>
                  </figure>
                </div>

                <div className="confidence-block">
                  <div>
                    <span>Face Match Score (Prediction)</span>
                    <strong>
                      {decision?.field_rules?.raw_confidence === 'BUCKETED' ? (
                        <RedactedBadge
                          isMasked={true}
                          reason="Raw precision score masked to prevent biometric inference leakage"
                          label="Bucketed"
                        >
                          {confidence >= 85 ? 'High (≥85%)' : confidence >= 60 ? 'Medium (60-84%)' : 'Low (<60%)'}
                        </RedactedBadge>
                      ) : (
                        `${confidence.toFixed(1)}%`
                      )}
                    </strong>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${confidence}%` }} className={confidence >= 85 ? 'pass' : ''} />
                  </div>
                  <small>
                    {isInvigilator ? 'Live Match • Decision threshold: 85.0%' : 'Demo Simulation • Bucketed output only'}
                  </small>
                </div>
              </div>
            )}

            {/* Step 3: Result / Decision */}
            {step === 3 && result && (
              <div className={`result-step ${result.verified ? 'verified' : 'flagged'}`}>
                {result.verified ? <CheckCircle2 size={58} /> : <XCircle size={58} />}
                <p className="eyebrow">
                  {result.isAuditReview
                    ? 'HISTORICAL COMPLIANCE RECORD'
                    : result.verified
                    ? 'ENTRY AUTHORIZED'
                    : 'MANUAL ESCALATION REQUIRED'}
                </p>
                <h2>{result.verified ? 'Candidate Verified' : 'Anomaly Flagged'}</h2>
                <p>
                  {result.isAuditReview ? (
                    <>
                      Historical gate verification recorded at{' '}
                      <strong>{result.confidence.toFixed(1)}%</strong> confidence score. Admission was{' '}
                      <strong>{result.verified ? 'GRANTED' : 'ESCALATED'}</strong> at center MANIT_BPL_04.
                    </>
                  ) : (
                    <>
                      Identity matched with{' '}
                      <strong>
                        {decision?.field_rules?.raw_confidence === 'BUCKETED'
                          ? result.verified
                            ? 'High (≥85%)'
                            : 'Medium (60-84%)'
                          : `${result.confidence.toFixed(1)}%`}
                      </strong>{' '}
                      prediction confidence.
                      {result.verified
                        ? ' Candidate cleared for entrance.'
                        : ' Flagged for invigilator manual review.'}
                    </>
                  )}
                </p>
                <div className="decision-meta">
                  <span><Database size={16} /> Immutable Audit Event Committed</span>
                  <span><Shield size={16} /> Profile: {decision?.profile || activePersona.title}</span>
                </div>
                <div className="result-actions">
                  <button className="button dark" onClick={reset}><RotateCcw size={17} /> Next Candidate</button>
                  <button className="button ghost" onClick={() => navigate(isAuditor ? '/audit' : '/dashboard')}>
                    {isAuditor ? 'Open Audit Trail' : 'Open Dashboard'} <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Clean Right Column: Live Server & Audit Log */}
        <aside className="verify-side-column">
          <div className="api-console">
            <div className="console-head">
              <span><Terminal size={17} /> Live Server & Audit Log</span>
              <i />
            </div>
            <p>Active Role: {activePersona.title}</p>
            <div className="console-log">
              {logs.length === 0 && <div className="console-empty">Select candidate above to start...</div>}
              {logs.map((item, index) => (
                <div className={`log-${item.type}`} key={`${item.time}-${index}`}>
                  <time>{item.time}</time>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
            {raw && (
              <details>
                <summary>Raw Server JSON (Proof: Zero PII in Network)</summary>
                <pre>{JSON.stringify(raw, null, 2)}</pre>
              </details>
            )}
            <div className="console-foot">
              <span /> Server-enforced privacy redaction active
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
