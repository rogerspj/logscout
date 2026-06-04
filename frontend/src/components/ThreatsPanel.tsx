import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ScannerAlert } from '../types'

function fmtTime(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch {
    return iso
  }
}

function windowDuration(start: string, end: string) {
  try {
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
    return secs < 60 ? `${secs}s window` : `${Math.round(secs / 60)}m window`
  } catch {
    return ''
  }
}

export default function ThreatsPanel() {
  const [data, setData] = useState<ScannerAlert[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.scanners()
      setData(d)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Threat Detection</div>
          <div className="panel-subtitle">IPs with 5+ 404s in any 60-second window</div>
        </div>
        <div className="panel-actions">
          {updatedAt && <span className="updated-at">Updated {updatedAt.toLocaleTimeString()}</span>}
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <div className="state-box">Analyzing logs…</div>}
      {error && <div className="state-box error">Error: {error}</div>}
      {!loading && !error && data?.length === 0 && (
        <div className="state-box clean">
          No scanner signatures detected in the last 5,000 requests. Your server is clean.
        </div>
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="scanner-list">
          {data.map(alert => (
            <div key={alert.ip} className="scanner-card">
              <div className="scanner-card-head">
                <span className="scanner-ip">{alert.ip}</span>
                <span className="scanner-count">
                  {alert.count} hits · {windowDuration(alert.window_start, alert.window_end)}
                  {alert.total_404s > alert.count && ` · ${alert.total_404s} total 404s`}
                </span>
              </div>
              <div className="scanner-meta">
                {fmtTime(alert.window_start)} → {fmtTime(alert.window_end)}
              </div>
              <div className="scanner-paths">
                {alert.paths.map(p => (
                  <span key={p} className="path-tag">{p}</span>
                ))}
              </div>
              {alert.agents.length > 0 && (
                <div className="scanner-agents">
                  UA: {alert.agents[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
