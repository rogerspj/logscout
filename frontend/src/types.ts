export interface NginxEntry {
  ip: string
  time: string
  method: string
  path: string
  status: number
  bytes: string
  referer: string
  agent: string
}

export interface NginxError {
  time: string
  level: string
  message: string
}

export interface JournalEntry {
  time: string
  priority: string
  message: string
  pid: string
}

export interface ScannerAlert {
  ip: string
  detection_type: 'burst_404' | 'sensitive_path'
  window_start: string
  window_end: string
  count: number
  total_404s: number
  paths: string[]
  agents: string[]
  patterns_matched: string[]
}

export interface HoneypotHit {
  time: string
  ip: string
  path: string
}

export interface Summary {
  total_requests: number
  status_counts: Record<string, number>
  scanner_count: number
  top_ips: { ip: string; count: number }[]
  top_paths: { path: string; count: number }[]
}
