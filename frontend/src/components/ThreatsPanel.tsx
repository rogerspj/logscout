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

function ScannerCard({ alert }: { alert: ScannerAlert }) {
  const isBurst = alert.detection_type === 'burst_404'

  return (
    <div className={`scanner-card ${isBurst ? 'scanner-card-burst' : 'scanner-card-sensitive'}`}>
      <div className="scanner-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="scanner-ip">{alert.ip}</span>
          <span className={`detection-badge ${isBurst ? 'badge-burst' : 'badge-sensitive'}`}>
            {isBurst ? '404 BURST' : 'SENSITIVE PATH'}
          </span>
        </div>
        <span className="scanner-count">
          {isBurst
            ? `${alert.count} hits · ${windowDuration(alert.window_start, alert.window_end)}`
            : `${alert.patterns_matched.length} patterns · ${alert.count} requests`}
          {alert.total_404s > 0 && !isBurst && ` · ${alert.total_404s} 404s`}
        </span>
      </div>

      <div className="scanner-meta">
        {fmtTime(alert.window_start)} → {fmtTime(alert.window_end)}
      </div>

      {!isBurst && alert.patterns_matched.length > 0 && (
        <div className="scanner-paths" style={{ marginBottom: 8 }}>
          {alert.patterns_matched.map(p => (
            <span key={p} className="path-tag pattern-tag">{p}</span>
          ))}
        </div>
      )}

      <div className="scanner-paths">
        {alert.paths.map(p => (
          <span key={p} className="path-tag">{p}</span>
        ))}
      </div>

      {alert.agents.length > 0 && (
        <div className="scanner-agents">UA: {alert.agents[0]}</div>
      )}
    </div>
  )
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
      setData(await api.scanners())
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const burst = data?.filter(a => a.detection_type === 'burst_404') ?? []
  const sensitive = data?.filter(a => a.detection_type === 'sensitive_path') ?? []

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Threat Detection</div>
          <div className="panel-subtitle">
            404 burst (5+ in 60s) · sensitive path probe (3+ distinct patterns)
          </div>
        </div>
        <div className="panel-actions">
          {updatedAt && <span className="updated-at">Updated {updatedAt.toLocaleTimeString()}</span>}
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <div className="state-box">Analyzing logs…</div>}
      {error   && <div className="state-box error">Error: {error}</div>}

      {!loading && !error && data?.length === 0 && (
        <div className="state-box clean">
          No scanner signatures detected in the last 5,000 requests.
        </div>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="scanner-list">
          {burst.length > 0 && (
            <>
              <div className="threat-section-label">404 Burst ({burst.length})</div>
              {burst.map(a => <ScannerCard key={`${a.ip}-burst`} alert={a} />)}
            </>
          )}
          {sensitive.length > 0 && (
            <>
              <div className="threat-section-label">Sensitive Path Probes ({sensitive.length})</div>
              {sensitive.map(a => <ScannerCard key={`${a.ip}-sensitive`} alert={a} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
