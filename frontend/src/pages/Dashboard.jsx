import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, Lock, RefreshCw, Search, Shield, Users } from 'lucide-react'
import { api } from '../api'
import { ContextBanner, Loading, Nav, RedactedBadge, StatusBadge } from '../components'
import { usePrivacy } from '../privacy'

const filters = ['ALL', 'VERIFIED', 'FLAGGED', 'PENDING']

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState('')
  const { context, decision, setIsDiffModalOpen } = usePrivacy()

  async function refresh() {
    try {
      const [sessionData, statsData] = await Promise.all([
        api('/sessions', { screen: 'dashboard' }),
        api('/stats', { screen: 'dashboard' }),
      ])
      setSessions(sessionData)
      setStats(statsData)
      setUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 8000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.role, context.intent, context.context])

  const visible = useMemo(() => sessions.filter((session) => {
    const matchesFilter = filter === 'ALL' || session.status === filter
    const needle = query.toLowerCase()
    const matchesQuery =
      (session.student_name || '').toLowerCase().includes(needle) ||
      (session.student_id || '').toLowerCase().includes(needle)
    return matchesFilter && matchesQuery
  }), [filter, query, sessions])

  return (
    <main className="app-page">
      <Nav />
      <ContextBanner screen="dashboard" />

      <div className="page-container">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">COMMAND CENTER & IDENTITY INTELLIGENCE</p>
            <h1>Gate Verification Dashboard</h1>
            <p>JEE Main 2025 • MANIT Bhopal • Gate 04 • Active Profile: <strong>{decision?.profile || 'EVALUATING'}</strong></p>
          </div>
          <div className="dash-actions">
            <button className="button ghost" onClick={() => setIsDiffModalOpen(true)}>
              ⚡ Live Diff Mode
            </button>
            <button className="refresh-button" onClick={refresh}>
              <RefreshCw size={16} /> Refreshed {updated || 'now'}
            </button>
          </div>
        </section>

        {loading ? <Loading /> : (
          <>
            <section className="metrics-row">
              <Metric icon={Users} label="Registered" value={stats?.total ?? 0} detail="Candidates at this gate" />
              <Metric icon={CheckCircle2} label="Verified" value={stats?.verified ?? 0} detail={`${stats?.average_confidence ?? 0}% avg. confidence`} tone="green" />
              <Metric icon={AlertTriangle} label="Flagged" value={stats?.flagged ?? 0} detail="Escalated for manual review" tone="red" />
              <Metric icon={Shield} label="Access Decisions" value={stats?.access_decisions_logged ?? 0} detail="Immutable audit events" tone="amber" />
            </section>

            <section className="data-panel">
              <div className="data-toolbar">
                <div className="filter-tabs">
                  {filters.map((item) => (
                    <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>
                      {item}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    placeholder="Search candidate or roll..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Roll Number</th>
                      <th>Time</th>
                      <th>Prediction Score</th>
                      <th>Decision</th>
                      <th>Fraud Signals</th>
                      <th>Privacy Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <strong>
                            <RedactedBadge
                              isMasked={Boolean(session.name_masked)}
                              reason="Candidate identity masked per active viewer privacy profile"
                            >
                              {session.student_name}
                            </RedactedBadge>
                          </strong>
                          <small>{session.center_id}</small>
                        </td>
                        <td>
                          <code>
                            <RedactedBadge
                              isMasked={Boolean(session.roll_masked)}
                              reason="Roll number masked per active viewer privacy profile"
                            >
                              {session.student_id}
                            </RedactedBadge>
                          </code>
                        </td>
                        <td>{session.display_time}</td>
                        <td>
                          <ConfidenceCell
                            value={session.confidence}
                            bucket={session.confidence_bucket}
                            isBucketed={Boolean(session.raw_confidence_hidden)}
                          />
                        </td>
                        <td><StatusBadge status={session.status} /></td>
                        <td>
                          <div className="flag-list">
                            {session.flags.length ? (
                              session.flags.map((flag) => (
                                <span key={flag} className={flag === 'UNDER_REVIEW' ? 'flag-generic' : 'flag-specific'}>
                                  {flag === 'UNDER_REVIEW' && <Lock size={9} />} {flag.replaceAll('_', ' ')}
                                </span>
                              ))
                            ) : (
                              <em>Clear</em>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="profile-mini-chip">
                            {session.visibility_profile?.profile || decision?.profile || 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value, detail, tone = '' }) {
  return (
    <article className={`metric ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <Icon size={24} />
    </article>
  )
}

function ConfidenceCell({ value, bucket, isBucketed }) {
  if (isBucketed && bucket) {
    return (
      <RedactedBadge isMasked={true} reason="Raw score masked; bucketed range provided for privacy" label="Bucketed">
        <span className="bucket-pill">{bucket}</span>
      </RedactedBadge>
    )
  }
  if (!value) return <span className="muted">Not started</span>
  return (
    <div className="confidence-cell">
      <span>{value.toFixed(1)}%</span>
      <i><b style={{ width: `${value}%` }} className={value >= 85 ? 'pass' : ''} /></i>
    </div>
  )
}
