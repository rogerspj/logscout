import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { HoneypotHit } from '../types'

function fmtTime(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch { return iso }
}

export default function HoneypotPanel() {
  const [data, setData] = useState<HoneypotHit[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hits = await api.honeypot()
      setData(hits.slice().reverse())
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = filter.toLowerCase()
    if (!q) return data
    return data.filter(r => r.ip.includes(q) || r.path.toLowerCase().includes(q) || r.time.toLowerCase().includes(q))
  }, [data, filter])

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Honeypot</div>
          <div className="panel-subtitle">
            IPs that retrieved the fake <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>.env</code> — confirmed credential harvesters
          </div>
        </div>
        <div className="panel-actions">
          {updatedAt && <span className="updated-at">Updated {updatedAt.toLocaleTimeString()}</span>}
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <div className="state-box">Loading…</div>}
      {error   && <div className="state-box error">Error: {error}</div>}

      {!loading && !error && data?.length === 0 && (
        <div className="state-box">No honeypot hits recorded.</div>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="log-table-wrap">
          <div className="filter-bar">
            <div className="honeypot-total">
              <span className="honeypot-count">{data.length}</span>
              <span className="honeypot-count-label">
                {data.length === 1 ? 'confirmed hit' : 'confirmed hits'}
              </span>
            </div>
            <input
              className="filter-input"
              placeholder="Filter by IP or path…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            {filter && <span className="count-label">{filtered.length} shown</span>}
          </div>
          <table className="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>IP</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td>{fmtTime(row.time)}</td>
                  <td className="honeypot-ip">{row.ip}</td>
                  <td>{row.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
