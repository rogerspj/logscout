# Week 10.5 - LogScout: Log Aggregation and Anomaly Detection for My Own Infrastructure

## What I Did

### The Concept

A log aggregation and anomaly detection tool for the EC2 server that runs Bristle and LinkScout. The server generates logs continuously from three sources: nginx access and error logs, the LinkScout systemd service, and the Bristle systemd service. LogScout reads all three, parses them into a unified format, runs four anomaly detectors, and presents the results through a browser dashboard. Analysis is on-demand when the page is opened.

The EC2 was actively being scanned while I was building this. IP `137.184.222.119` hit the server at 4:47am requesting `/cmd.js`, `/error.save`, `/debug.bak`, `/cmd.log`, and `/docker-compose.rb` in a short burst, all returning 404. That IP and that pattern became the primary test case.

### Architecture

Followed the same pattern established by Bristle and LinkScout:

- Python backend using FastAPI, isolated to its own port (8002)
- React + Vite frontend, built to static files and served by nginx
- Dedicated systemd service (`logscout.service`) so it starts on boot and restarts on failure
- nginx proxies `/logscout-api/` to the FastAPI backend and serves the frontend at `/logscout/`
- No new AWS security group changes needed — the backend port is internal only, nginx handles all public traffic

The analyzer core is framework-agnostic. It reads logs from all three sources, normalizes them into a unified event format, runs the detectors, and returns a structured result dict. FastAPI calls it and hands the result back as JSON. The frontend calls the API and renders the panels.

### Four Detectors

- **IP burst detection**: flags any IP with 5 or more 404 responses in a 60-second window
- **Repeated 404s**: flags IPs with a high total 404 count across the full log window, surfaces the paths they probed
- **Unusual request rate**: buckets requests into 5-minute windows, flags any bucket running 3x above the median
- **Unexpected IPs**: surfaces IPs associated with error responses for human review

### Dashboard

Six tabs: a summary tab (total requests, unique IPs, scanner count, status code breakdown), a threats tab with one card per flagged IP showing the burst window and every path it probed, and per-source log tabs for nginx access, nginx errors, linkscout journal, and bristle journal. The nginx access table has client-side filtering by IP, path, and status code.

### Deployment Notes

The main technical friction was nginx routing. Serving a React SPA from a subpath (`/logscout/`) instead of the root requires `alias` instead of `root` in the nginx location block -- `root` appends the full URI to the directory path, so `/logscout/` resolves to `/opt/logscout/frontend/dist/logscout/` which doesn't exist. `alias` strips the location prefix first and maps correctly. The API block also needed the `^~` modifier to prevent the SPA location from matching `/logscout-api/` requests before the proxy block could handle them. On the backend side, FastAPI routes needed to match what nginx was actually forwarding -- after nginx strips the `/logscout-api/` prefix, uvicorn receives `/scanners`, not `/api/scanners`.

All work committed and pushed to github.com/rogerspj/logscout throughout the session. No secrets in the repo.

---

## Why I Did It This Way

- On-demand analysis instead of live polling keeps the implementation simple without giving anything up. The use case is "I want to see what's happening on my server right now." A button that triggers fresh analysis serves that use case and can be upgraded to auto-polling later with a frontend-only change.

- The analyzer core is separated from the web layer for the same reason the linkscout `check()` function was separated. A future CLI runner or scheduled job can call `analyze()` directly without touching FastAPI. Keeping concerns separate avoids a refactor later.

- The detector only blocks on confirmed evidence. The repeated 404 detector flags for human review rather than automatically taking action. DNS-level blocking based on weak evidence on LinkScout taught me this lesson. The google.com false positive from last week is a direct argument for surfacing information rather than acting on it automatically.

- Reusing the established service pattern (isolated user, systemd unit, nginx proxy) means LogScout fits cleanly into the existing server without touching Bristle or LinkScout. The server now runs three independent services behind one nginx instance, each isolated from the others.

---

## Connection to Learning Objectives

- **Unit 3**: Logs from three separate services are aggregated into one place for analysis. The tool applies the same principle as a SIEM at a small scale: centralize visibility, then look for patterns that no individual log source would reveal on its own.

- **Unit 1**: The scanner detections are a live demonstration of a threat. The server went live and was being actively probed within hours. Two of the three flagged IPs were running automated credential harvesting and vulnerability scanning against a server with no public reputation and no reason to be targeted except that it exists and has port 80 open. LogScout acts as a control, it doesn't prevent anything but it surfaces what's happening so a human can act on it.

---

## What I Learned

- The server is noisier than I expected. Of the last 5,000 requests in the nginx access log, 4,511 came from a single scanner IP. That's 90% of all logged traffic being automated probe traffic, not real users. Without the aggregator, this would be invisible to me. The server would most likely have been even noisier if I had used the default port 22.

- Three distinct scanner behaviors showed up on the first run. `137.184.222.119` was the noisy generalist, probing for every common misconfiguration it knew about. `34.182.202.165` was targeted specifically at `.env` files -- 13 requests in 2 seconds, all variations on `.env` paths, nothing else. That one was hunting for exposed API keys and credentials specifically. `155.133.4.185` found the LogScout API itself and started probing its endpoints within hours of deployment. A new service appeared on the server and something on the internet noticed and started poking it almost immediately.

- Hardening held. Every one of the 392 4xx responses was the server correctly rejecting a probe. The UFW rules, nginx configuration, and service isolation from the Bristle and LinkScout builds meant there was nothing to find.

- The original 404-burst detector missed 212.56.54.52 entirely. That IP hit 27 paths in 6 seconds and got 200 responses back on most of them because nginx serves the default page for unrecognized paths rather than a 404. The scanner tripped no threshold because it never got a 404. The fix was a second independent detector that matches against a list of sensitive path patterns regardless of status code: .env, .aws, credentials, admin, and similar. An IP hitting 3 or more of those patterns in any window gets flagged. The two detectors now cover different attacker profiles: the burst detector catches noisy volume-based scanners, the sensitive path detector catches targeted credential harvesters that probe quietly but deliberately. The 200 responses those scanners were receiving also pointed to a hardening gap. Nginx was serving the default page for paths like /.env and /.aws/credentials, which gives scanners false confirmation that the path exists. Added explicit nginx rules returning 404 for common scanner targets across the whole server, so future probes get an honest response and will trip the burst detector as well.