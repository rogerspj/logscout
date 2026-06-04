import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { NginxEntry, NginxError } from '../types'

function fmtTime(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch { return iso }
}

function statusClass(s: number) {
  if (s < 300) return 's2xx'
  if (s < 400) return 's3xx'
  if (s < 500) return 's4xx'
  return 's5xx'
}

function methodClass(m: string) {
  const map: Record<string, string> = { GET: 'm-get', POST: 'm-post', PUT: 'm-put', DELETE: 'm-delete' }
  return map[m.toUpperCase()] ?? ''
}

function levelClass(l: string) {
  const danger = ['emerg', 'alert', 'crit', 'error']
  const warn   = ['warn']
  const lc = l.toLowerCase()
  if (danger.some(d => lc.includes(d))) return 's5xx'
  if (warn.some(w => lc.includes(w)))   return 's4xx'
  return ''
}

interface Props { mode: 'access' | 'errors' }

export default function NginxPanel({ mode }: Props) {
  const [data, setData] = useState<NginxEntry[] | NginxError[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = mode === 'access' ? await api.nginxAccess() : await api.nginxErrors()
      setData(d.slice().reverse())
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = filter.toLowerCase()
    if (!q) return data.slice(0, 500)
    return data.filter(row => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 500)
  }, [data, filter])

  const title = mode === 'access' ? 'Nginx Access Log' : 'Nginx Error Log'
  const subtitle = mode === 'access' ? 'HTTP requests (most recent first)' : 'Error and warning entries'

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          <div className="panel-subtitle">{subtitle}</div>
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

      {!loading && !error && data && (
        <div className="log-table-wrap">
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="Filter by IP, path, status…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <span className="count-label">{filtered.length} of {data.length}</span>
          </div>

          {mode === 'access' ? (
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Bytes</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {(filtered as NginxEntry[]).map((row, i) => (
                  <tr key={i}>
                    <td>{fmtTime(row.time)}</td>
                    <td>{row.ip}</td>
                    <td className={methodClass(row.method)}>{row.method}</td>
                    <td title={row.path}>{row.path}</td>
                    <td className={statusClass(row.status)}>{row.status}</td>
                    <td>{row.bytes}</td>
                    <td title={row.agent}>{row.agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {(filtered as NginxError[]).map((row, i) => (
                  <tr key={i}>
                    <td>{row.time}</td>
                    <td className={levelClass(row.level)}>{row.level}</td>
                    <td title={row.message}>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
