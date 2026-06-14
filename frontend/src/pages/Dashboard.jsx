import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, Users } from 'lucide-react'
import { api } from '../api'
import { Loading, Nav, StatusBadge } from '../components'

const filters = ['ALL', 'VERIFIED', 'FLAGGED', 'PENDING']

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState('')

  async function refresh() {
    try {
      const [sessionData, statsData] = await Promise.all([api('/sessions'), api('/stats')])
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
  }, [])

  const visible = useMemo(() => sessions.filter((session) => {
    const matchesFilter = filter === 'ALL' || session.status === filter
    const needle = query.toLowerCase()
    const matchesQuery = session.student_name.toLowerCase().includes(needle) || session.student_id.toLowerCase().includes(needle)
    return matchesFilter && matchesQuery
  }), [filter, query, sessions])

  return (
    <main className="app-page">
      <Nav />
      <div className="page-container">
        <section className="dashboard-heading">
          <div><p className="eyebrow">COMMAND CENTER</p><h1>Invigilator dashboard</h1><p>JEE Main 2025 / MANIT Bhopal / Gate 04</p></div>
          <button className="refresh-button" onClick={refresh}><RefreshCw size={16} /> Updated {updated || 'now'}</button>
        </section>

        {loading ? <Loading /> : (
          <>
            <section className="metrics-row">
              <Metric icon={Users} label="Registered" value={stats.total} detail="Candidates at this gate" />
              <Metric icon={CheckCircle2} label="Verified" value={stats.verified} detail={`${stats.average_confidence}% avg. confidence`} tone="green" />
              <Metric icon={AlertTriangle} label="Flagged" value={stats.flagged} detail="Needs manual review" tone="red" />
              <Metric icon={Clock3} label="Pending" value={stats.pending} detail="Awaiting arrival" tone="amber" />
            </section>

            <section className="data-panel">
              <div className="data-toolbar">
                <div className="filter-tabs">
                  {filters.map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}
                </div>
                <label className="search-box"><Search size={17} /><input placeholder="Search candidate" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Candidate</th><th>Roll number</th><th>Time</th><th>Confidence</th><th>Decision</th><th>Fraud signals</th></tr></thead>
                  <tbody>
                    {visible.map((session) => (
                      <tr key={session.id}>
                        <td><strong>{session.student_name}</strong><small>{session.center_id}</small></td>
                        <td><code>{session.student_id}</code></td>
                        <td>{session.display_time}</td>
                        <td><Confidence value={session.confidence} /></td>
                        <td><StatusBadge status={session.status} /></td>
                        <td><div className="flag-list">{session.flags.length ? session.flags.map((flag) => <span key={flag}>{flag.replaceAll('_', ' ')}</span>) : <em>Clear</em>}</div></td>
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
  return <article className={`metric ${tone}`}><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><Icon size={24} /></article>
}

function Confidence({ value }) {
  if (!value) return <span className="muted">Not started</span>
  return <div className="confidence-cell"><span>{value.toFixed(1)}%</span><i><b style={{ width: `${value}%` }} className={value >= 85 ? 'pass' : ''} /></i></div>
}

