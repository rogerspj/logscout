from collections import defaultdict, deque
from datetime import datetime

WINDOW_SECONDS = 60
MIN_404S = 5


def detect_scanners(nginx_entries: list[dict]) -> list[dict]:
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

        # Sliding window: find the densest burst
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
            'window_start': best[0][0].isoformat(),
            'window_end': best[-1][0].isoformat(),
            'count': len(best),
            'total_404s': len(hits),
            'paths': paths,
            'agents': agents,
        })

    results.sort(key=lambda x: x['count'], reverse=True)
    return results
