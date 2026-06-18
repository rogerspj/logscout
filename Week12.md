# Week 12 - Vulnerability Scanning Exercise and Live Attack Log Analysis

## What I Did

### Scanning Classmates' Projects

Ran nmap, nikto, and curl against two classmates' deployed projects as a vulnerability scanning exercise.

**LabWatch (auxcon.dev):** Minimal findings. The site was  behind Cloudflare, so nmap only fingerprinted Cloudflare's edge infrastructure rather than the actual origin server, and nikto was blocked outright. TLS 1.3 with a post-quantum key exchange was in use, which seemed more advanced than most production setups. One low-risk finding: a `/dashboard` endpoint loads with no authentication. It currently only displays public data (Google, Cloudflare DNS), so the exposure is minimal today, but it would need access control before any internal or sensitive services get added to that dashboard.

**Kanji app:** Both the Render backend and the Netlify frontend were offline during the scan window (backend returned 503 suspend-by-user, frontend returned 404), so I couldn't meaningfully test anything.

No critical or high severity findings on either project.

### Watching Real Attack Traffic Hit My Own Server

Spent time reviewing live traffic hitting my EC2 in real time, captured by logscout's logging, partially monitored from my phone. Two attack patterns stood out on June 8.

The first was a scattered series of `.env` credential harvesting probes from various IPs throughout the day, automated bots checking for exposed environment files containing API keys or secrets.

The second was a more sophisticated, multi-stage attack from a single IP that chained together several known CVE exploit attempts in sequence: PHPUnit RCE path fuzzing (CVE-2017-9841), Apache path traversal attempts (CVE-2021-41773 and CVE-2021-42013), PHP-CGI ini injection, ThinkPHP RCE probing, an attempt at PEAR log poisoning to drop a webshell, and a Docker API probe.

logscout's burst detector correctly flagged this attacker's activity as a 41-request burst within 5 seconds. The `libredtail-http` user agent was visible in the captured logs, confirming the header-level logging was capturing useful detail beyond just the request path.

---

## Why I Did It This Way

**Investigating before assuming the worst:** The Docker API probe returned an HTTP 200, which on first glance looks like a serious finding, an exposed Docker socket would be a critical vulnerability. Rather than report it as such, I investigated further and confirmed it was nginx's single-page-app catch-all serving linkscout's `index.html`, not an actual exposed Docker API. I verified server-side that only nginx (port 80) and three uvicorn processes were running, with no Docker ports actually exposed. A 200 response means something responded, not that the thing the attacker was probing for exists.

**Assessing real risk rather than reacting to every probe:** Every PHP-targeted exploit attempt in the multi-stage attack landed on a Python/FastAPI stack with no PHP interpreter present, so all of them correctly returned 404. Given this is a student project with no sensitive production data, the honest risk assessment is that none of these attempts posed real danger, but watching them unfold in the logs is still valuable for understanding what automated and semi-automated reconnaissance actually looks like against a real, internet-facing server.

**Scanning with awareness of what's actually being measured:** When scanning LabWatch and the Kanji app, the goal was an honest assessment, not finding something to report for its own sake. A scan behind Cloudflare that comes back mostly empty wasn't a bad scan, but that the deployment is well protected at the edge.

---

## What I Learned

**Scanning behind a CDN or PaaS gives you the edge, not the origin.** Both nmap and nikto against LabWatch only ever touched Cloudflare's infrastructure, never the actual server. Ports like 53 and 5060 appeared during the scan and looked like open services worth flagging, but they belonged to shared proxy infrastructure rather than anything specific to the project being scanned. This is an easy mistake to make without realizing it: a scanner can return what looks like meaningful data about a target when it's actually just fingerprinting the hosting layer everyone behind that CDN shares. The lesson carries directly into how I read my own EC2's logs, where I know there's no CDN in front of linkscout or Bristle, so what I'm seeing actually is the origin server being probed directly.

**A multi-stage attack chaining several CVEs together is a real, observable thing, not just a textbook concept.** Watching one IP work through PHPUnit RCE, Apache path traversal, PHP-CGI injection, and ThinkPHP probing in sequence made concrete what "an attacker enumerating known exploits against a target" actually looks like in raw log lines. None of it worked here because the stack underneath doesn't match what any of those exploits target, but the attempt sequence itself was a useful, low-stakes way to see real adversary behavior rather than a simulated one.

**A 200 status code is not automatically a finding, and a 404 is not automatically nothing.** The Docker API probe returning 200 needed investigation before it meant anything, and turned out to be benign. Conversely, the sheer volume and structure of repeated 404s (the credential harvesting probes, the multi-stage CVE attempts) is itself informative even though every individual request failed, it shows scanning behavior and intent that a single 404 in isolation wouldn't reveal. This is the same principle behind why the log aggregator's burst detection matters: the pattern across many requests carries more signal than any single request's result code.