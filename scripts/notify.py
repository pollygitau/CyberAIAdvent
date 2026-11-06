#!/usr/bin/env python3
"""Send today's calendar door as a daily alert.

Channels
  * WhatsApp  – WhatsApp Business Platform (Cloud API), approved template, opted-in numbers only
  * LinkedIn  – a post on your profile or company page via the Posts API
  * GitHub    – one issue per door: an audit log, and the guard that stops double-sends

Standard library only: no third-party packages to pin, audit or get compromised
(OWASP A03:2025 Software Supply Chain Failures).

Environment (all optional; a channel without its secrets is skipped):
  WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_RECIPIENTS,
  WHATSAPP_RECIPIENTS_<STAKEHOLDER>   e.g. WHATSAPP_RECIPIENTS_FINANCE
  LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN   (urn:li:person:… or urn:li:organization:…)
  GITHUB_TOKEN, GITHUB_REPOSITORY             (provided by GitHub Actions)
  INPUT_DAY, INPUT_DRY_RUN, INPUT_FORCE, INPUT_MODE   (from workflow_dispatch)

Usage
  python3 scripts/notify.py --dry-run --day 7
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DAYS_FILE = ROOT / "site" / "days.json"
CONFIG_FILE = ROOT / "config" / "alerts.json"
UA = "cyber-advent-calendar-notifier"
PHONE_RE = re.compile(r"^\+?[1-9][0-9]{7,14}$")
LITTLE_RESERVED = re.compile(r"([\\|{}@\[\]()<>#*_~])")
failures: list[str] = []
summary: list[str] = []


def log(kind: str, msg: str) -> None:
    """GitHub Actions annotation when running in Actions, plain text otherwise."""
    if os.environ.get("GITHUB_ACTIONS") == "true" and kind in ("notice", "warning", "error"):
        print(f"::{kind}::{msg}")
    else:
        print(f"[{kind}] {msg}")


def secret(name: str) -> str:
    return os.environ.get(name, "").strip()


def mask(number: str) -> str:
    digits = number.lstrip("+")
    return "+" + "•" * max(len(digits) - 2, 0) + digits[-2:]


# Any run of 8–15 digits (optionally after "+") looks like a phone number.
PHONE_LIKE = re.compile(r"\+?\d{8,15}")


def scrub(text: str) -> str:
    """Mask anything that looks like a phone number before text reaches a log or the public
    GitHub issue. API error messages can echo the recipient; log masking would not cover the issue."""
    return PHONE_LIKE.sub(lambda m: mask(m.group(0)), str(text))


def http(method: str, url: str, headers: dict, body: dict | None = None, retries: int = 2):
    """JSON over HTTPS with timeouts and bounded retries. Never logs headers (they hold tokens).

    GET is retried on rate limits, server errors and network errors. POST (a WhatsApp message, a
    LinkedIn post) is retried only on HTTP 429 or when the connection was refused before anything was
    sent — a timeout or a 5xx may mean the message already went out, and a retry would send it twice."""
    if not url.startswith("https://"):
        raise ValueError("refusing non-HTTPS URL")
    safe_to_repeat = method == "GET"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"User-Agent": UA, "Accept": "application/json", **headers}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                parsed = json.loads(raw) if raw.strip()[:1] in ("{", "[") else raw
                return resp.status, {k.lower(): v for k, v in resp.headers.items()}, parsed
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8", errors="replace")[:600]
            retryable = (429, 500, 502, 503, 504) if safe_to_repeat else (429,)
            if err.code in retryable and attempt < retries:
                time.sleep(2 * (2 ** attempt))
                continue
            return err.code, {}, raw
        except (urllib.error.URLError, TimeoutError) as err:
            reason = getattr(err, "reason", err)
            never_sent = isinstance(reason, (ConnectionRefusedError, socket.gaierror))
            if attempt < retries and (safe_to_repeat or never_sent):
                time.sleep(2 * (2 ** attempt))
                continue
            return 0, {}, str(getattr(err, "reason", err))
    return 0, {}, "unreachable"


def load() -> tuple[dict, dict]:
    with DAYS_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    with CONFIG_FILE.open(encoding="utf-8") as f:
        cfg = json.load(f)
    return data, cfg


def pick_day(data: dict, mode: str, override: str) -> tuple[int | None, str]:
    total = data["modes"][mode]["doors"]
    if override:
        if not re.fullmatch(r"[0-9]{1,2}", override):
            raise SystemExit("INPUT_DAY must be a number from 1 to 31")
        n = int(override)
        if not 1 <= n <= total:
            raise SystemExit(f"Door {n} does not exist in {mode} mode (1–{total})")
        return n, f"Door {n} (chosen manually)"
    tz = ZoneInfo(data["timezone"])
    now = dt.datetime.now(tz)
    if now.year != data["year"] or now.month != data["month"]:
        return None, f"{now:%Y-%m-%d} in {data['timezone']} is outside December {data['year']} — nothing to send."
    if now.day > total:
        return None, f"Advent mode ends on {total} December — nothing to send today."
    return now.day, f"Door {now.day} ({now:%A %d %B %Y}, {data['timezone']})"


def lesson(day: dict) -> dict:
    """The headline case study for a door (the first one listed)."""
    return day["cases"][0]


def unfinished_config(cfg: dict) -> list[str]:
    """Settings that still hold a [PLACEHOLDER] or are unsafe to publish."""
    out = []
    site = str(cfg.get("siteUrl", ""))
    if "[" in site or not site.startswith("https://"):
        out.append("siteUrl (your https:// site address)")
    if "[" in str(cfg.get("reviewer", "[")):
        out.append("reviewer (your name)")
    return out


def door_url(cfg: dict, n: int, mode: str) -> str:
    base = cfg["siteUrl"].rstrip("/") + "/"
    return f"{base}?day={n}" + ("&mode=advent" if mode == "advent" else "")


# ---------- WhatsApp ----------
def whatsapp_recipients(day: dict) -> list[str]:
    raw = [secret("WHATSAPP_RECIPIENTS")]
    for sid in day["for"]:
        if re.fullmatch(r"[a-z]+", sid):
            raw.append(secret(f"WHATSAPP_RECIPIENTS_{sid.upper()}"))
    numbers, seen = [], set()
    for chunk in raw:
        for item in re.split(r"[,\s;]+", chunk):
            item = item.strip()
            if not item:
                continue
            if not PHONE_RE.fullmatch(item):
                log("warning", f"Skipping a recipient that is not in E.164 format ({mask(item)})")
                continue
            if item.lstrip("+") not in seen:
                seen.add(item.lstrip("+"))
                numbers.append(item)
    return numbers


def wa_param(text: str) -> str:
    """WhatsApp template parameters may not contain new lines, tabs or more than four spaces in a row."""
    return re.sub(r" {5,}", "    ", re.sub(r"[\r\n\t]+", " ", text)).strip()


def send_whatsapp(cfg: dict, day: dict, total: int, url: str, dry: bool) -> None:
    wc = cfg.get("whatsapp", {})
    token, phone_id = secret("WHATSAPP_TOKEN"), secret("WHATSAPP_PHONE_NUMBER_ID")
    if not wc.get("enabled"):
        summary.append("- WhatsApp: disabled in config/alerts.json")
        return
    # Recipient numbers are never printed in full: logs show only the last two digits (mask) and
    # API error text is scrubbed (scrub), so nothing needs ::add-mask:: — which would itself
    # mean writing each number to the output stream.
    numbers = whatsapp_recipients(day)
    if not (token and phone_id and numbers):
        summary.append("- WhatsApp: skipped (set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_RECIPIENTS)")
        return
    if not re.fullmatch(r"[0-9]{5,20}", phone_id):
        failures.append("WhatsApp: WHATSAPP_PHONE_NUMBER_ID is not numeric")
        return
    params = [str(day["day"]), str(total), day["title"], day["do"], day["dont"], url]
    body = lambda to: {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": wc["templateName"],
            "language": {"code": wc["templateLanguage"]},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": wa_param(p)} for p in params]}],
        },
    }
    if dry:
        log("notice", f"[dry-run] WhatsApp template '{wc['templateName']}' to {len(numbers)} recipient(s): "
                      + ", ".join(mask(n) for n in numbers))
        print(json.dumps(body("+00000000000")["template"], ensure_ascii=False, indent=2))
        summary.append(f"- WhatsApp: dry-run, {len(numbers)} recipient(s)")
        return
    endpoint = f"https://graph.facebook.com/{wc['graphApiVersion']}/{phone_id}/messages"
    ok = 0
    for num in numbers:
        status, _, resp = http("POST", endpoint, {"Authorization": f"Bearer {token}"}, body(num))
        if status in (200, 201):
            ok += 1
        else:
            detail = resp.get("error", {}).get("message", "") if isinstance(resp, dict) else str(resp)[:200]
            failures.append(f"WhatsApp to {mask(num)}: HTTP {status} {scrub(detail)}")
        time.sleep(0.2)
    summary.append(f"- WhatsApp: {ok}/{len(numbers)} delivered to the API")


# ---------- LinkedIn ----------
def little(text: str) -> str:
    """Escape LinkedIn 'little text' reserved characters in post commentary."""
    return LITTLE_RESERVED.sub(r"\\\1", text)


def linkedin_commentary(cfg: dict, data: dict, day: dict, total: int, url: str) -> str:
    lc = cfg.get("linkedin", {})
    lines = [
        little(f"Door {day['day']} of {total} · {day['title']}"),
        "",
        little(f"DO: {day['do']}"),
        little(f"DON’T: {day['dont']}"),
        "",
        little(f"Lesson learnt ({lesson(day)['name']}, {lesson(day)['when']}): {lesson(day)['text']}"),
        "",
        little("Take today’s 20-second challenge: ") + url,
        "",
        " ".join("{hashtag|\\#|" + re.sub(r"[^A-Za-z0-9]", "", t) + "}" for t in lc.get("hashtags", [])),
        "",
        little(f"AI-assisted, reviewed by {cfg.get('reviewer', '[YOUR NAME]')}."),
    ]
    return "\n".join(lines)


def send_linkedin(cfg: dict, data: dict, day: dict, total: int, url: str, dry: bool) -> None:
    lc = cfg.get("linkedin", {})
    token, author = secret("LINKEDIN_ACCESS_TOKEN"), secret("LINKEDIN_AUTHOR_URN")
    if not lc.get("enabled"):
        summary.append("- LinkedIn: disabled in config/alerts.json")
        return
    if not (token and author):
        summary.append("- LinkedIn: skipped (set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN)")
        return
    if not re.fullmatch(r"urn:li:(person|organization):[A-Za-z0-9_-]+", author):
        failures.append("LinkedIn: LINKEDIN_AUTHOR_URN must look like urn:li:person:… or urn:li:organization:…")
        return
    post = {
        "author": author,
        "commentary": linkedin_commentary(cfg, data, day, total, url),
        "visibility": lc.get("visibility", "PUBLIC"),
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    if dry:
        log("notice", "[dry-run] LinkedIn post as " + author.split(":")[2])
        print(post["commentary"])
        summary.append("- LinkedIn: dry-run")
        return
    status, headers, resp = http("POST", "https://api.linkedin.com/rest/posts", {
        "Authorization": f"Bearer {token}",
        "Linkedin-Version": lc.get("apiVersion", "202609"),
        "X-Restli-Protocol-Version": "2.0.0",
    }, post)
    if status == 201:
        summary.append(f"- LinkedIn: posted ({headers.get('x-restli-id', 'id not returned')})")
    else:
        hint = " — token expired? Member tokens last about 60 days." if status == 401 else ""
        hint = hint or (" — LINKEDIN_VERSION may be sunset; update apiVersion in config/alerts.json." if status in (400, 426) else "")
        failures.append(f"LinkedIn: HTTP {status} {str(resp)[:200]}{hint}")


# ---------- GitHub issue (log + idempotency) ----------
def gh(method: str, path: str, body: dict | None = None):
    return http(method, f"https://api.github.com/repos/{secret('GITHUB_REPOSITORY')}{path}", {
        "Authorization": f"Bearer {secret('GITHUB_TOKEN')}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }, body)


def issue_title(data: dict, day: dict) -> str:
    return f"[{data['year']}] Door {day['day']:02d} · {day['title']}"


def already_sent(cfg: dict, data: dict, day: dict) -> bool:
    if not (cfg.get("githubIssue", {}).get("enabled") and secret("GITHUB_TOKEN") and secret("GITHUB_REPOSITORY")):
        return False
    label = cfg["githubIssue"]["label"]
    status, _, resp = gh("GET", f"/issues?labels={label}&state=all&per_page=100")
    if status != 200 or not isinstance(resp, list):
        log("warning", f"Could not read the alert log (HTTP {status}); continuing without the double-send guard.")
        return False
    # Only count issues the workflow itself created: on a public repo anyone can open an issue,
    # and a look-alike title must not be able to silence the day's alert.
    return any(i.get("title") == issue_title(data, day)
               and (i.get("user") or {}).get("login") == "github-actions[bot]" for i in resp)


def log_issue(cfg: dict, data: dict, day: dict, url: str, mode: str) -> None:
    ic = cfg.get("githubIssue", {})
    if not (ic.get("enabled") and secret("GITHUB_TOKEN") and secret("GITHUB_REPOSITORY")):
        return
    gh("POST", "/labels", {"name": ic["label"], "color": "FF8A4C", "description": "Daily calendar alert log"})
    body = "\n".join([
        f"**DO:** {day['do']}", "", f"**DON’T:** {day['dont']}", "",
        f"**Lesson learnt** — {lesson(day)['kind']}, {lesson(day)['when']}, {lesson(day)['name']}: {lesson(day)['text']}", "",
        f"Open the door: {url}", "", f"Mode: `{mode}`", "", "### Delivery", *summary,
        *(["", "### Failures", *[f"- {scrub(f)}" for f in failures]] if failures else []),
    ])
    status, _, _ = gh("POST", "/issues", {"title": issue_title(data, day), "body": body, "labels": [ic["label"]]})
    if status != 201:
        log("warning", f"Could not write the alert log issue (HTTP {status}).")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--day", default=os.environ.get("INPUT_DAY", ""))
    ap.add_argument("--mode", default=os.environ.get("INPUT_MODE", ""), choices=["", "full", "advent"])
    ap.add_argument("--dry-run", action="store_true", default=os.environ.get("INPUT_DRY_RUN", "").lower() == "true")
    ap.add_argument("--force", action="store_true", default=os.environ.get("INPUT_FORCE", "").lower() == "true")
    args = ap.parse_args()

    data, cfg = load()
    mode = args.mode or cfg.get("mode", "full")
    if mode not in data["modes"]:
        raise SystemExit(f"Unknown mode {mode!r}")
    n, why = pick_day(data, mode, str(args.day).strip())
    log("notice", why)
    if n is None:
        return 0
    day = data["days"][n - 1]
    total = data["modes"][mode]["doors"]
    url = door_url(cfg, n, mode)
    # Never broadcast a broken link or "[YOUR NAME]" to every recipient and a public LinkedIn feed.
    unset = unfinished_config(cfg)
    if unset and not args.dry_run:
        log("error", "Not sending: fill in " + ", ".join(unset) + " in config/alerts.json first (a dry run still works).")
        return 1
    for item in unset:
        log("warning", f"{item} in config/alerts.json is still a placeholder.")

    if not args.dry_run and not args.force and already_sent(cfg, data, day):
        log("notice", f"Door {n} was already sent (issue exists). Use force to resend.")
        return 0

    send_whatsapp(cfg, day, total, url, args.dry_run)
    send_linkedin(cfg, data, day, total, url, args.dry_run)
    if not args.dry_run:
        log_issue(cfg, data, day, url, mode)

    step = os.environ.get("GITHUB_STEP_SUMMARY")
    if step:
        with open(step, "a", encoding="utf-8") as f:
            f.write(f"## {issue_title(data, day)}\n\n" + "\n".join(summary) + "\n")
            if failures:
                f.write("\n### Failures\n" + "\n".join(f"- {scrub(x)}" for x in failures) + "\n")
    for line in summary:
        print(line)
    for err in failures:
        log("error", scrub(err))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
