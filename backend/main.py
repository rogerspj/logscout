import os
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from log_parsers import parse_nginx_access, parse_nginx_errors, parse_journald
from scanner_detection import detect_scanners

NGINX_ACCESS = os.environ.get('NGINX_ACCESS_LOG', '/var/log/nginx/access.log')
NGINX_ERROR = os.environ.get('NGINX_ERROR_LOG', '/var/log/nginx/error.log')

app = FastAPI(title='LogScout')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@app.get('/logs/nginx')
def nginx_access(lines: int = Query(2000, ge=100, le=10000)):
    return parse_nginx_access(NGINX_ACCESS, max_lines=lines)


@app.get('/logs/nginx/errors')
def nginx_errors(lines: int = Query(500, ge=50, le=5000)):
    return parse_nginx_errors(NGINX_ERROR, max_lines=lines)


@app.get('/logs/linkscout')
def linkscout(lines: int = Query(500, ge=50, le=5000)):
    return parse_journald('linkscout', max_lines=lines)


@app.get('/logs/bristle')
def bristle(lines: int = Query(500, ge=50, le=5000)):
    return parse_journald('bristle', max_lines=lines)


@app.get('/scanners')
def scanners(lines: int = Query(5000, ge=500, le=20000)):
    entries = parse_nginx_access(NGINX_ACCESS, max_lines=lines)
    return detect_scanners(entries)


@app.get('/summary')
def summary(lines: int = Query(5000, ge=500, le=20000)):
    entries = parse_nginx_access(NGINX_ACCESS, max_lines=lines)
    status_counts: dict[str, int] = {}
    for e in entries:
        k = str(e['status'])
        status_counts[k] = status_counts.get(k, 0) + 1

    ip_counts: dict[str, int] = {}
    for e in entries:
        ip_counts[e['ip']] = ip_counts.get(e['ip'], 0) + 1

    path_counts: dict[str, int] = {}
    for e in entries:
        path_counts[e['path']] = path_counts.get(e['path'], 0) + 1

    return {
        'total_requests': len(entries),
        'status_counts': status_counts,
        'scanner_count': len(detect_scanners(entries)),
        'top_ips': [{'ip': ip, 'count': c} for ip, c in sorted(ip_counts.items(), key=lambda x: -x[1])[:10]],
        'top_paths': [{'path': p, 'count': c} for p, c in sorted(path_counts.items(), key=lambda x: -x[1])[:10]],
    }


# Serve React SPA — must be last so /api/* routes take precedence
DIST = Path(__file__).parent.parent / 'frontend' / 'dist'

@app.get('/{full_path:path}')
def serve_spa(full_path: str):
    candidate = DIST / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(str(candidate))
    if (DIST / 'index.html').exists():
        return FileResponse(str(DIST / 'index.html'))
    return JSONResponse({'error': 'Frontend not built — run: cd frontend && npm run build'}, status_code=404)
