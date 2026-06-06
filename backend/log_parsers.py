import re
import subprocess
import json
from datetime import datetime
from pathlib import Path

NGINX_ACCESS_RE = re.compile(
    r'(?P<ip>\S+) - (?P<user>\S+) \[(?P<time>[^\]]+)\] '
    r'"(?P<request>[^"]*)" '
    r'(?P<status>\d+) (?P<bytes>\S+)'
    r'(?: "(?P<referer>[^"]*)" "(?P<agent>[^"]*)")?'
)
NGINX_TIME_FMT = "%d/%b/%Y:%H:%M:%S %z"

NGINX_ERROR_RE = re.compile(
    r'(?P<time>\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) \[(?P<level>\w+)\] '
    r'\d+#\d+: (?P<message>.+)'
)


def parse_nginx_access(path: str, max_lines: int = 5000) -> list[dict]:
    entries = []
    try:
        lines = Path(path).read_text(errors='replace').splitlines()
        for line in lines[-max_lines:]:
            m = NGINX_ACCESS_RE.match(line)
            if not m:
                continue
            req = m.group('request').split(' ', 2)
            try:
                ts = datetime.strptime(m.group('time'), NGINX_TIME_FMT).isoformat()
            except ValueError:
                ts = m.group('time')
            entries.append({
                'ip': m.group('ip'),
                'time': ts,
                'method': req[0] if len(req) >= 1 else '-',
                'path': req[1] if len(req) >= 2 else '-',
                'status': int(m.group('status')),
                'bytes': m.group('bytes'),
                'referer': m.group('referer') or '',
                'agent': m.group('agent') or '',
            })
    except FileNotFoundError:
        pass
    return entries


def parse_nginx_errors(path: str, max_lines: int = 1000) -> list[dict]:
    entries = []
    try:
        lines = Path(path).read_text(errors='replace').splitlines()
        for line in lines[-max_lines:]:
            m = NGINX_ERROR_RE.match(line)
            if m:
                entries.append({'time': m.group('time'), 'level': m.group('level'), 'message': m.group('message')})
            elif line.strip():
                entries.append({'time': '', 'level': 'unknown', 'message': line})
    except FileNotFoundError:
        pass
    return entries


HONEYPOT_LOG_RE = re.compile(r'(?P<time>[^|]+) \| (?P<ip>[^|]+) \| (?P<request>.+)')


def parse_honeypot_log(path: str, max_lines: int = 10000) -> list[dict]:
    entries = []
    try:
        lines = Path(path).read_text(errors='replace').splitlines()
        for line in lines[-max_lines:]:
            m = HONEYPOT_LOG_RE.match(line.strip())
            if not m:
                continue
            time_str = m.group('time').strip()
            ip = m.group('ip').strip()
            request = m.group('request').strip()
            try:
                ts = datetime.strptime(time_str, NGINX_TIME_FMT).isoformat()
            except ValueError:
                ts = time_str
            req_parts = request.split(' ', 2)
            path_part = req_parts[1] if len(req_parts) >= 2 else request
            entries.append({'time': ts, 'ip': ip, 'path': path_part})
    except FileNotFoundError:
        pass
    return entries


def parse_journald(service: str, max_lines: int = 1000) -> list[dict]:
    entries = []
    try:
        result = subprocess.run(
            ['journalctl', '-u', f'{service}.service', '--no-pager',
             '-n', str(max_lines), '--output=json'],
            capture_output=True, text=True, timeout=15,
        )
        for line in result.stdout.splitlines():
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                ts_us = obj.get('__REALTIME_TIMESTAMP')
                ts = datetime.fromtimestamp(int(ts_us) / 1e6).isoformat() if ts_us else ''
                entries.append({
                    'time': ts,
                    'priority': obj.get('PRIORITY', '6'),
                    'message': obj.get('MESSAGE', ''),
                    'pid': obj.get('_PID', ''),
                })
            except (json.JSONDecodeError, ValueError):
                entries.append({'time': '', 'priority': '6', 'message': line, 'pid': ''})
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return entries
