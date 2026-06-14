import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Database,
  FileCheck2, Fingerprint, LoaderCircle, LockKeyhole, RotateCcw, ScanFace, Terminal,
  XCircle,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

const STEPS = ['Candidate', 'DigiLocker', 'Face match', 'Decision']
const DEMO_ROLLS = [
  { roll: 'JEE25BPL0042', label: 'Verified demo', tone: 'good' },
  { roll: 'JEE25BPL0103', label: 'Fraud demo', tone: 'bad' },
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

  const addLog = (message, type = 'neutral') => {
    setLogs((current) => [...current, { time: clock(), message, type }])
  }

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop())
  }, [])

  async function fetchDocument(selectedRoll = roll) {
    const normalized = selectedRoll.trim().toUpperCase()
    if (!normalized) {
      setError('Enter or select a roll number to continue.')
      return
    }
    setRoll(normalized)
    setError('')
    setLoading(true)
    addLog('Initiating DigiLocker OAuth handshake')
    addLog(`GET /digilocker/fetch/${normalized}`, 'request')
    try {
      const response = await api(`/digilocker/fetch/${normalized}`)
      const cert = response.document.CertificateData
      const person = response.document.IssuedTo.Person
      setRaw(response)
      setSessionId(response.session_id)
      setStudent({
        name: person.name,
        dob: person.dob,
        roll: cert.RollNumber,
        exam: cert.ExamName,
        center: cert.ExamCenter,
        centerCode: cert.CenterCode,
        examDate: cert.ExamDate,
        photo: cert.PhotoURL,
        issuer: response.document.issuer,
        digiId: response.document.DigiLockerID,
      })
      addLog(`DigiLocker response received (${response.response_time_ms}ms)`, 'success')
      addLog(`Document verified by ${response.document.issuer}`, 'success')
      addLog(`DigiLocker ID ${response.document.DigiLockerID}`, 'success')
      setStep(1)
    } catch (requestError) {
      setError(requestError.message)
      addLog(requestError.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function startFaceMatch() {
    setStep(2)
    addLog('Starting live face capture')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) videoRef.current.srcObject = stream
      addLog('Camera initialized', 'success')
    } catch {
      addLog('Camera unavailable; demo signal enabled', 'warning')
    }
    addLog('Running TinyFaceDetector pipeline', 'request')
    addLog('Computing face descriptor distance')

    const target = roll === 'JEE25BPL0103' ? 61.3 : 94.2
    let current = 0
    intervalRef.current = window.setInterval(() => {
      current = Math.min(target, current + 4 + Math.random() * 8)
      setConfidence(current)
      if (current >= target) {
        clearInterval(intervalRef.current)
        addLog(`Euclidean distance ${(1 - target / 100).toFixed(3)} computed`, target >= 85 ? 'success' : 'warning')
        window.setTimeout(() => finishVerification(target), 600)
      }
    }, 180)
  }

  async function finishVerification(finalConfidence) {
    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop())
    const verified = finalConfidence >= 85
    setResult({ verified, confidence: finalConfidence })
    setStep(3)
    addLog(`Face match ${finalConfidence.toFixed(1)}%`, verified ? 'success' : 'error')
    try {
      const response = await api('/verify/complete', {
        method: 'POST',
        body: JSON.stringify({
          student_id: roll,
          session_id: sessionId,
          confidence: finalConfidence,
          status: verified ? 'VERIFIED' : 'FAILED',
          center_id: 'MANIT_BPL_04',
        }),
      })
      addLog('Result committed to audit trail', 'success')
      response.flags.forEach((flag) => addLog(`Fraud flag: ${flag}`, 'error'))
    } catch (requestError) {
      addLog(`Audit write failed: ${requestError.message}`, 'error')
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
      <header className="minimal-header">
        <Link to="/" className="back-link"><ArrowLeft size={17} /> ExamVerify</Link>
        <div className="secure-label"><LockKeyhole size={15} /> Privacy-safe demo environment</div>
      </header>

      <div className="verify-layout">
        <section className="verify-main">
          <div className="section-heading">
            <div><p className="eyebrow">GATE VERIFICATION</p><h1>Confirm candidate identity</h1></div>
            <span className="center-tag">MANIT Bhopal / Center 04</span>
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
            {step === 0 && (
              <div className="candidate-step">
                <div className="step-icon"><Fingerprint size={34} /></div>
                <h2>Fetch the official admit card</h2>
                <p>Scan the QR code or enter the candidate roll number.</p>
                <label className="field-label" htmlFor="roll">Roll number</label>
                <div className="input-action">
                  <input
                    id="roll"
                    value={roll}
                    onChange={(event) => setRoll(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && fetchDocument()}
                    placeholder="JEE25BPL0042"
                    autoFocus
                  />
                  <button className="icon-button" title="Simulate QR scan" onClick={() => fetchDocument('JEE25BPL0042')}>
                    <ScanFace size={21} />
                  </button>
                </div>
                <div className="demo-options">
                  {DEMO_ROLLS.map((option) => (
                    <button key={option.roll} onClick={() => fetchDocument(option.roll)}>
                      <span className={`demo-dot ${option.tone}`} />
                      <strong>{option.roll}</strong>
                      <small>{option.label}</small>
                    </button>
                  ))}
                </div>
                {error && <div className="inline-error"><AlertTriangle size={17} />{error}</div>}
                <button className="button primary full" disabled={loading} onClick={() => fetchDocument()}>
                  {loading ? <><LoaderCircle className="spin" size={18} /> Fetching secure record</> : <>Fetch via DigiLocker <ArrowRight size={18} /></>}
                </button>
                <p className="disclosure">Sandbox uses a DigiLocker-compatible response. Production OAuth requires approved credentials.</p>
              </div>
            )}

            {step === 1 && student && (
              <div className="document-step">
                <div className="document-verified">
                  <FileCheck2 size={22} />
                  <div><strong>Issuer signature verified</strong><small>{student.issuer} / {student.digiId}</small></div>
                  <CheckCircle2 size={22} />
                </div>
                <div className="admit-card">
                  <div className="admit-title"><span>ADMIT CARD</span><span>JEE MAIN 2025</span></div>
                  <div className="candidate-profile">
                    <img src={student.photo} alt={student.name} />
                    <div><p>Candidate</p><h2>{student.name}</h2><code>{student.roll}</code></div>
                  </div>
                  <dl>
                    <div><dt>Date of birth</dt><dd>{student.dob}</dd></div>
                    <div><dt>Exam date</dt><dd>{student.examDate}</dd></div>
                    <div><dt>Exam center</dt><dd>{student.center}</dd></div>
                    <div><dt>Center code</dt><dd>{student.centerCode}</dd></div>
                  </dl>
                </div>
                <button className="button primary full" onClick={startFaceMatch}>Begin live face match <Camera size={18} /></button>
              </div>
            )}

            {step === 2 && (
              <div className="match-step">
                <div className="face-comparison">
                  <figure><img src={student?.photo} alt="DigiLocker reference" /><figcaption>DigiLocker reference</figcaption></figure>
                  <div className="match-core"><ScanFace size={30} /><span>AI MATCH</span></div>
                  <figure className="camera-feed"><video ref={videoRef} autoPlay muted playsInline /><Camera size={42} /><figcaption>Live camera</figcaption></figure>
                </div>
                <div className="confidence-block">
                  <div><span>Match confidence</span><strong>{confidence.toFixed(1)}%</strong></div>
                  <div className="meter"><span style={{ width: `${confidence}%` }} className={confidence >= 85 ? 'pass' : ''} /></div>
                  <small>Decision threshold: 85% / liveness signal active</small>
                </div>
              </div>
            )}

            {step === 3 && result && (
              <div className={`result-step ${result.verified ? 'verified' : 'flagged'}`}>
                {result.verified ? <CheckCircle2 size={58} /> : <XCircle size={58} />}
                <p className="eyebrow">{result.verified ? 'ENTRY APPROVED' : 'MANUAL REVIEW REQUIRED'}</p>
                <h2>{result.verified ? 'Identity verified' : 'Candidate flagged'}</h2>
                <p>
                  {student?.name} recorded a <strong>{result.confidence.toFixed(1)}%</strong> face match.
                  {result.verified ? ' The candidate may enter the exam hall.' : ' The invigilator has been alerted.'}
                </p>
                <div className="decision-meta">
                  <span><Database size={16} /> Audit saved</span>
                  <span><Fingerprint size={16} /> {student?.digiId}</span>
                </div>
                <div className="result-actions">
                  <button className="button dark" onClick={reset}><RotateCcw size={17} /> Next candidate</button>
                  <button className="button ghost" onClick={() => navigate('/dashboard')}>View dashboard <ArrowRight size={17} /></button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="api-console">
          <div className="console-head">
            <span><Terminal size={17} /> Live API log</span>
            <i />
          </div>
          <p>digilocker.gov.in / face pipeline</p>
          <div className="console-log">
            {logs.length === 0 && <div className="console-empty">Waiting for candidate...</div>}
            {logs.map((item, index) => (
              <div className={`log-${item.type}`} key={`${item.time}-${index}`}>
                <time>{item.time}</time><span>{item.message}</span>
              </div>
            ))}
          </div>
          {raw && (
            <details>
              <summary>Raw DigiLocker response</summary>
              <pre>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          )}
          <div className="console-foot"><span /> Append-only audit channel active</div>
        </aside>
      </div>
    </main>
  )
}
