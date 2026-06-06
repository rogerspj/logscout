from collections import defaultdict, deque
from datetime import datetime

WINDOW_SECONDS = 60
MIN_404S = 5
MIN_SENSITIVE_PATTERNS = 3

SENSITIVE_PATTERNS = [
    # Secrets / credentials
    '.env', '.aws', 'credentials', 'passwd', '.htpasswd',
    # Source control
    '.git', '.svn', '.htaccess',
    # WordPress / CMS
    'wp-admin', 'wp-login', 'wp-config', 'xmlrpc', 'phpmyadmin', '/pma',
    # Framework / infra probes
    'actuator', 'phpinfo', 'cgi-bin',
    # Admin / management consoles
    'admin', 'manager', 'console',
    # Sensitive file extensions and names
    'backup', '.bak', '.sql', '.db', '.dump', 'docker-compose',
    '.log', '.save', 'config',
    # Attack tool paths
    'cmd', 'shell', 'debug', 'eval', 'c99', 'r57', 'webshell',
    # Setup / install pages
    'setup', 'install',
]


def detect_burst_scanners(nginx_entries: list[dict]) -> list[dict]:
    """Flag IPs with 5+ 404s in any 60-second window."""
    by_ip: dict[str, list[tuple[datetime, dict]]] = defaultdict(list)
    for entry in nginx_entries:
        if entry.get('status') == 404:
            try:
                t = datetime.fromisoformat(entry['time'])
                by_ip[entry['ip']].append((t, entry))
            except (ValueError, TypeError, KeyError):
                pass

    results = []
    for ip, hits in by_ip.items():
        hits.sort(key=lambda x: x[0])
        if len(hits) < MIN_404S:
            continue

        best: list[tuple[datetime, dict]] = []
        window: deque[tuple[datetime, dict]] = deque()
        for t, entry in hits:
            window.append((t, entry))
            while (t - window[0][0]).total_seconds() > WINDOW_SECONDS:
                window.popleft()
            if len(window) > len(best):
                best = list(window)

        if len(best) < MIN_404S:
            continue

        paths = list(dict.fromkeys(e['path'] for _, e in best))[:20]
        agents = list(dict.fromkeys(e['agent'] for _, e in best if e.get('agent')))[:5]
        results.append({
            'ip': ip,
            'detection_type': 'burst_404',
            'window_start': best[0][0].isoformat(),
            'window_end': best[-1][0].isoformat(),
            'count': len(best),
            'total_404s': len(hits),
            'paths': paths,
            'agents': agents,
            'patterns_matched': [],
        })

    results.sort(key=lambda x: x['count'], reverse=True)
    return results


def detect_sensitive_path_scanners(nginx_entries: list[dict]) -> list[dict]:
    """Flag IPs that hit 3+ distinct sensitive path patterns, regardless of status code."""
    # ip -> pattern -> [entries]
    ip_pattern_hits: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))

    for entry in nginx_entries:
        path_lower = entry.get('path', '').lower()
        for pattern in SENSITIVE_PATTERNS:
            if pattern in path_lower:
                ip_pattern_hits[entry['ip']][pattern].append(entry)

    results = []
    for ip, pattern_map in ip_pattern_hits.items():
        if len(pattern_map) < MIN_SENSITIVE_PATTERNS:
            continue

        all_entries = [e for entries in pattern_map.values() for e in entries]
        timed = []
        for e in all_entries:
            try:
                timed.append((datetime.fromisoformat(e['time']), e))
            except (ValueError, TypeError, KeyError):
                pass
        timed.sort(key=lambda x: x[0])

        paths = list(dict.fromkeys(e['path'] for _, e in timed))[:20]
        agents = list(dict.fromkeys(e['agent'] for _, e in timed if e.get('agent')))[:5]
        total_404s = sum(1 for _, e in timed if e.get('status') == 404)

        results.append({
            'ip': ip,
            'detection_type': 'sensitive_path',
            'window_start': timed[0][0].isoformat() if timed else '',
            'window_end': timed[-1][0].isoformat() if timed else '',
            'count': len(all_entries),
            'total_404s': total_404s,
            'paths': paths,
            'agents': agents,
            'patterns_matched': sorted(pattern_map.keys()),
        })

    results.sort(key=lambda x: len(x['patterns_matched']), reverse=True)
    return results


def detect_all(nginx_entries: list[dict]) -> list[dict]:
    burst = detect_burst_scanners(nginx_entries)
    sensitive = detect_sensitive_path_scanners(nginx_entries)

    # If an IP appears in both, keep both cards — different evidence, different story.
    return burst + sensitive
