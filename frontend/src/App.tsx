import { useState, useEffect } from 'react'
import ThreatsPanel from './components/ThreatsPanel'
import HoneypotPanel from './components/HoneypotPanel'
import NginxPanel from './components/NginxPanel'
import JournalPanel from './components/JournalPanel'
import SummaryPanel from './components/SummaryPanel'
import { api } from './api'

type Tab = 'threats' | 'honeypot' | 'nginx' | 'errors' | 'linkscout' | 'bristle' | 'summary'

export default function App() {
  const [tab, setTab] = useState<Tab>('threats')
  const [scannerCount, setScannerCount] = useState<number | null>(null)
  const [honeypotCount, setHoneypotCount] = useState<number | null>(null)

  useEffect(() => {
    api.scanners().then(s => setScannerCount(s.length)).catch(() => {})
    api.honeypot().then(h => setHoneypotCount(h.length)).catch(() => {})
  }, [])

  const tabs: { id: Tab; label: string; badge?: number | null }[] = [
    { id: 'threats',  label: 'Threats',      badge: scannerCount },
    { id: 'honeypot', label: 'Honeypot',      badge: honeypotCount },
    { id: 'nginx',    label: 'Nginx Access' },
    { id: 'errors',   label: 'Nginx Errors' },
    { id: 'linkscout',label: 'LinkScout' },
    { id: 'bristle',  label: 'Bristle' },
    { id: 'summary',  label: 'Summary' },
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">Log<span className="logo-accent">Scout</span></span>
          <nav className="tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? ' tab-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className="badge">{t.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        {tab === 'threats'   && <ThreatsPanel />}
        {tab === 'honeypot'  && <HoneypotPanel />}
        {tab === 'nginx'     && <NginxPanel mode="access" />}
        {tab === 'errors'    && <NginxPanel mode="errors" />}
        {tab === 'linkscout' && <JournalPanel service="linkscout" />}
        {tab === 'bristle'   && <JournalPanel service="bristle" />}
        {tab === 'summary'   && <SummaryPanel />}
      </main>
    </div>
  )
}
