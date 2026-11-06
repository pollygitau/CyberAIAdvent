#!/usr/bin/env python3
"""Check every external link the site uses, plus the published site itself.

Runs in GitHub Actions (.github/workflows/links.yml): on pull requests that touch the site, by hand,
and weekly. Standard library only. Results:
  * OK       2xx/3xx after redirects
  * BLOCKED  the site refuses automated checks (401, 403, 405, 429, 999). Reported as a warning;
             check these by hand in a browser.
  * BROKEN   404/410, unknown host, TLS failure, or a server error after retries. Fails the run.
A summary goes to the job summary page and to annotations on the run.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import os
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
UA = "Mozilla/5.0 (compatible; WinterwatchLinkCheck/1.0; +https://aware-by-design.github.io/CyberAIAdvent2026/)"
BLOCKED_CODES = {401, 403, 405, 406, 429, 999}
IN_ACTIONS = os.environ.get("GITHUB_ACTIONS") == "true"


def collect() -> dict[str, set[str]]:
    """url -> where it is used."""
    used: dict[str, set[str]] = {}

    def add(url: str, where: str) -> None:
        if isinstance(url, str) and url.startswith("https://"):
            used.setdefault(url, set()).add(where)

    data = json.loads((SITE / "days.json").read_text(encoding="utf-8"))
    for d in data["days"]:
        for m in d.get("readMore", []):
            add(m.get("url"), f"door {d['day']} read more")
    for qid, q in data.get("quotes", {}).items():
        add(q.get("url"), f"quote {qid}")
    for cid, nat in data.get("national", {}).items():
        add(nat.get("url"), f"country lens {cid}")
    supply = json.loads((SITE / "supply.json").read_text(encoding="utf-8"))
    for law in supply.get("laws", []):
        add(law.get("url"), "supplier toolkit: laws")
    for c in supply.get("contacts", []):
        add(c.get("url"), f"supplier toolkit: contacts ({c.get('country', '')})")
    for page in sorted(SITE.glob("*.html")):
        for url in re.findall(r'href="(https://[^"]+)"', page.read_text(encoding="utf-8")):
            add(url, page.name)
    # The published site itself: every page and the files it loads.
    site_url = json.loads((ROOT / "config" / "site.json").read_text(encoding="utf-8")).get("siteUrl", "")
    if site_url.startswith("https://") and "[" not in site_url:
        base = site_url.rstrip("/") + "/"
        for path in ("", "door.html?day=1", "supply.html", "days.json", "supply.json", "settings.json", "styles.css",
                     "common.js", "app.js", "door.js", "supply.js", "europe-map.svg", "favicon.svg",
                     "advent-24.ics", "days-31.ics"):
            add(base + path, "published site")
    return used


def check(url: str) -> tuple[str, str, int]:
    """(verdict, detail, status code)."""
    last = ""
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                                                   "Accept-Language": "en"})
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                resp.read(2048)
                return "OK", f"{resp.status}", resp.status
        except urllib.error.HTTPError as err:
            if err.code in BLOCKED_CODES:
                return "BLOCKED", f"HTTP {err.code} (the site refuses automated checks)", err.code
            if err.code in (404, 410):
                return "BROKEN", f"HTTP {err.code}", err.code
            last = f"HTTP {err.code}"
            if err.code < 500:
                return "BROKEN", last, err.code
        except urllib.error.URLError as err:
            reason = err.reason
            if isinstance(reason, socket.gaierror):
                return "BROKEN", "unknown host", 0
            if isinstance(reason, ssl.SSLError):
                return "BROKEN", f"TLS error: {reason}", 0
            last = f"network error: {reason}"
        except (TimeoutError, socket.timeout):
            last = "timed out"
        except Exception as err:  # noqa: BLE001 — report anything else as a failure, never crash the run
            last = f"{type(err).__name__}: {err}"
        time.sleep(3 * (attempt + 1))
    return "BROKEN", last, 0


def main() -> int:
    used = collect()
    urls = sorted(used)
    results: dict[str, tuple[str, str, int]] = {}
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for url, res in zip(urls, pool.map(check, urls)):
            results[url] = res
    broken = [u for u in urls if results[u][0] == "BROKEN"]
    blocked = [u for u in urls if results[u][0] == "BLOCKED"]
    ok = len(urls) - len(broken) - len(blocked)

    line = f"{len(urls)} links checked · {ok} OK · {len(blocked)} blocked automated checks · {len(broken)} broken"
    print(line)
    for u in broken:
        print(f"BROKEN  {results[u][1]:<40} {u}  ({'; '.join(sorted(used[u]))})")
    for u in blocked:
        print(f"BLOCKED {results[u][1]:<40} {u}  ({'; '.join(sorted(used[u]))})")

    if IN_ACTIONS:
        # GitHub shows at most 10 error and 10 warning annotations per step: list the first nine, then group the rest.
        def annotate(kind: str, items: list[str]) -> None:
            for u in items[:9]:
                print(f"::{kind}::{results[u][1]} — {u} — used in {'; '.join(sorted(used[u]))}")
            if len(items) > 9:
                print(f"::{kind}::{len(items) - 9} more: " + " | ".join(f"{results[u][1]} {u}" for u in items[9:]))
        print(f"::notice::{line}")
        annotate("error", broken)
        annotate("warning", blocked)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as f:
                f.write(f"## Link check\n\n{line}\n\n| Result | Detail | Link | Used in |\n|---|---|---|---|\n")
                for u in broken + blocked + [u for u in urls if results[u][0] == "OK"]:
                    f.write(f"| {results[u][0]} | {results[u][1]} | {u} | {'; '.join(sorted(used[u]))} |\n")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
