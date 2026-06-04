import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { Summary } from '../types'

export default function SummaryPanel() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.summary())
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const statusGroups = data
    ? Object.entries(data.status_counts)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .reduce((acc, [code, count]) => {
          const group = code[0] + 'xx'
          acc[group] = (acc[group] ?? 0) + count
          return acc
        }, {} as Record<string, number>)
    : {}

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Summary</div>
          <div className="panel-subtitle">Aggregated over last 5,000 nginx requests</div>
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
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Requests</div>
              <div className="stat-value">{data.total_requests.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Scanner IPs</div>
              <div className={`stat-value${data.scanner_count > 0 ? ' stat-danger' : ''}`}>
                {data.scanner_count}
              </div>
            </div>
            {Object.entries(statusGroups).map(([group, count]) => (
              <div className="stat-card" key={group}>
                <div className="stat-label">{group.toUpperCase()}</div>
                <div className="stat-value">{count.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="summary-cols">
            <div className="summary-table-wrap">
              <div className="summary-table-title">Top IPs</div>
              <table className="summary-table">
                <tbody>
                  {data.top_ips.map(row => (
                    <tr key={row.ip}>
                      <td>{row.ip}</td>
                      <td>{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="summary-table-wrap">
              <div className="summary-table-title">Top Paths</div>
              <table className="summary-table">
                <tbody>
                  {data.top_paths.map(row => (
                    <tr key={row.path}>
                      <td>{row.path}</td>
                      <td>{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
