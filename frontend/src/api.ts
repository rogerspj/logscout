import type { NginxEntry, NginxError, JournalEntry, ScannerAlert, Summary } from './types'

async function get<T>(path: string): Promise<T> {
  const res = await fetch('/api' + path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  nginxAccess: () => get<NginxEntry[]>('/logs/nginx'),
  nginxErrors: () => get<NginxError[]>('/logs/nginx/errors'),
  linkscout: () => get<JournalEntry[]>('/logs/linkscout'),
  bristle: () => get<JournalEntry[]>('/logs/bristle'),
  scanners: () => get<ScannerAlert[]>('/scanners'),
  summary: () => get<Summary>('/summary'),
}
