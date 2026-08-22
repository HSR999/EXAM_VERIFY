import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileClock, Filter, Lock, LockKeyhole, Shield, Sparkles } from 'lucide-react'
import { api } from '../api'
import { ContextBanner, Loading, Nav, RedactedBadge } from '../components'
import { usePrivacy } from '../privacy'

const filterTabs = [
  { key: 'ALL', label: 'All Events' },
  { key: 'ACCESS_DECISION', label: '🛡️ Access Decisions (Privacy)' },
  { key: 'OPERATIONAL', label: '⚡ Operational Events' },
  { key: 'CRITICAL', label: '🚨 Critical Fraud Flags' },
]

export default function AuditTrail() {
  const [events, setEvents] = useState([])
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const { context, decision, setIsDiffModalOpen } = usePrivacy()

  async function loadEvents() {
    setLoading(true)
    try {
      let url = '/audit'
      if (activeFilter === 'ACCESS_DECISION') {
        url = '/audit?event_type=ACCESS_DECISION'
      } else if (activeFilter === 'OPERATIONAL') {
        url = '/audit?event_type=OPERATIONAL'
      } else if (activeFilter === 'CRITICAL') {
        url = '/audit?severity=CRITICAL'
      }
      const data = await api(url, { screen: 'audit' })
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, context.role, context.intent, context.context])

  function exportCsv() {
    const rows = [
      ['ID', 'Timestamp', 'Session ID', 'Student Name', 'Roll Number', 'Action / Event', 'Actor', 'Severity', 'Context & Details'],
      ...events.map((event) => [
        event.id,
        event.timestamp,
        event.session_id,
        event.student_name,
        event.student_id,
        event.action,
        event.actor,
        event.severity,
        event.details || '',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `examverify-audit-chain-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-page">
      <Nav />
      <ContextBanner screen="audit" />

      <div className="page-container">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">CHAIN OF CUSTODY & EVIDENCE RECORD</p>
            <h1>Immutable Audit Trail & Access Log</h1>
            <p>
              Append-only ledger capturing biometric predictions, fraud escalations, and <strong>Access Decisions</strong> explaining who viewed what data.
            </p>
          </div>
          <div className="dash-actions">
            <button className="button ghost" onClick={() => setIsDiffModalOpen(true)}>
              <Sparkles size={15} /> ⚡ Live Privacy Diff
            </button>
            <button className="button dark" onClick={exportCsv}>
              <Download size={17} /> Export Audit CSV
            </button>
          </div>
        </section>

        <section className="audit-assurance">
          <LockKeyhole size={23} />
          <div>
            <strong>Tamper-Evident Privacy & Decision Trail</strong>
            <p>
              Every role switch, candidate lookup, and prediction inference creates an unalterable audit log entry verifying compliance.
            </p>
          </div>
          <span>{events.length} RECORDED EVENTS</span>
        </section>

        <section className="audit-panel">
          <div className="audit-filter">
            <Filter size={16} />
            {filterTabs.map((item) => (
              <button
                className={activeFilter === item.key ? 'active' : ''}
                key={item.key}
                onClick={() => setActiveFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Loading label="Querying append-only audit ledger..." />
          ) : (
            <div className="timeline">
              {events.map((event) => {
                const isAccessDecision = event.action === 'ACCESS_DECISION'
                return (
                  <article
                    key={event.id}
                    className={`event ${isAccessDecision ? 'event-access-decision' : `event-${event.severity.toLowerCase()}`}`}
                  >
                    <div className="event-icon">
                      {isAccessDecision ? <Shield size={17} /> : <FileClock size={17} />}
                    </div>
                    <div className="event-body">
                      <div className="event-top-line">
                        <strong>{event.action.replaceAll('_', ' ')}</strong>
                        <span className={`severity ${isAccessDecision ? 'severity-access' : `severity-${event.severity.toLowerCase()}`}`}>
                          {isAccessDecision ? 'PRIVACY POLICY' : event.severity}
                        </span>
                      </div>

                      <p className="event-subject">
                        {event.student_name !== '-' && (
                          <>
                            <strong>{event.student_name}</strong> • <code>{event.student_id}</code>
                          </>
                        )}
                        {event.student_name === '-' && <span>System Governance Event</span>}
                      </p>

                      {event.details && (
                        <div className="event-details-box">
                          <small>{event.details}</small>
                        </div>
                      )}

                      <div className="event-meta-line">
                        <small>Actor: <code>{event.actor}</code></small>
                        <small>Session: <code>{event.session_id}</code></small>
                      </div>
                    </div>
                    <time>{new Date(event.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}</time>
                  </article>
                )
              })}
              {!events.length && (
                <div className="empty-state">No audit events match the active filter criteria.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
