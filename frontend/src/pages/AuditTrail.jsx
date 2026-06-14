import { useEffect, useMemo, useState } from 'react'
import { Download, FileClock, Filter, LockKeyhole } from 'lucide-react'
import { api } from '../api'
import { Loading, Nav } from '../components'

const severities = ['ALL', 'INFO', 'SUCCESS', 'WARNING', 'CRITICAL']

export default function AuditTrail() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/audit').then(setEvents).finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => filter === 'ALL' ? events : events.filter((event) => event.severity === filter), [events, filter])

  function exportCsv() {
    const rows = [
      ['ID', 'Timestamp', 'Session', 'Student', 'Action', 'Actor', 'Severity'],
      ...events.map((event) => [event.id, event.timestamp, event.session_id, event.student_name, event.action, event.actor, event.severity]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'examverify-audit.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-page">
      <Nav />
      <div className="page-container">
        <section className="dashboard-heading">
          <div><p className="eyebrow">CHAIN OF CUSTODY</p><h1>Immutable audit trail</h1><p>Every identity decision, system event, and fraud alert in one record.</p></div>
          <button className="button dark" onClick={exportCsv}><Download size={17} /> Export CSV</button>
        </section>

        <section className="audit-assurance">
          <LockKeyhole size={23} />
          <div><strong>Tamper-evident event stream</strong><p>Events are append-only and timestamped. Production deployment can anchor hashes to a government-controlled ledger.</p></div>
          <span>{events.length} EVENTS</span>
        </section>

        <section className="audit-panel">
          <div className="audit-filter"><Filter size={16} />{severities.map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          {loading ? <Loading label="Reading audit chain" /> : (
            <div className="timeline">
              {visible.map((event) => (
                <article key={event.id} className={`event event-${event.severity.toLowerCase()}`}>
                  <div className="event-icon"><FileClock size={17} /></div>
                  <div className="event-body">
                    <div><strong>{event.action.replaceAll('_', ' ')}</strong><span className={`severity severity-${event.severity.toLowerCase()}`}>{event.severity}</span></div>
                    <p>{event.student_name} / <code>{event.student_id}</code></p>
                    <small>{event.actor} / Session {event.session_id}</small>
                  </div>
                  <time>{new Date(event.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}</time>
                </article>
              ))}
              {!visible.length && <div className="empty-state">No events match this severity.</div>}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

