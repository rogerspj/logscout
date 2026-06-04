import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { JournalEntry } from '../types'

const LEVEL_NAMES: Record<string, string> = {
  '0': 'EMERG', '1': 'ALERT', '2': 'CRIT', '3': 'ERR',
  '4': 'WARN', '5': 'NOTICE', '6': 'INFO', '7': 'DEBUG',
}

function fmtTime(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch { return iso }
}

interface Props { service: 'linkscout' | 'bristle' }

export default function JournalPanel({ service }: Props) {
  const [data, setData] = useState<JournalEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = service === 'linkscout' ? await api.linkscout() : await api.bristle()
      setData(d.slice().reverse())
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = filter.toLowerCase()
    if (!q) return data.slice(0, 500)
    return data.filter(r => r.message.toLowerCase().includes(q) || r.time.toLowerCase().includes(q)).slice(0, 500)
  }, [data, filter])

  const title = service === 'linkscout' ? 'LinkScout' : 'Bristle'

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">{title} Journal</div>
          <div className="panel-subtitle">systemd journal · most recent first</div>
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
        <div className="journal-wrap">
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="Filter messages…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <span className="count-label">{filtered.length} of {data.length}</span>
          </div>
          {filtered.map((row, i) => {
            const lvl = row.priority || '6'
            return (
              <div key={i} className="journal-row">
                <span className="j-time">{fmtTime(row.time)}</span>
                <span className={`j-lvl lv${lvl}`}>{LEVEL_NAMES[lvl] ?? lvl}</span>
                <span className="j-msg">{row.message}</span>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="state-box">No entries match the filter.</div>
          )}
        </div>
      )}
    </div>
  )
}
