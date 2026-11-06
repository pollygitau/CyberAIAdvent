#!/usr/bin/env python3
"""Build calendar-subscription files: site/advent-24.ics and site/days-31.ics.

Each door becomes an event at 08:30 Europe/Rome (written in UTC, so every
calendar app reads it the same way) with a reminder, the DO / DON'T and a link.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"


def esc(text: str) -> str:
    """RFC 5545 TEXT escaping. Carriage returns are dropped so content can never start a new property line."""
    return text.replace("\r", "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> str:
    """RFC 5545: lines over 75 octets are folded with CRLF + space."""
    out, buf = [], b""
    for ch in line:
        enc = ch.encode("utf-8")
        if len(buf) + len(enc) > (75 if not out else 74):
            out.append(buf.decode("utf-8"))
            buf = b""
        buf += enc
    out.append(buf.decode("utf-8"))
    return "\r\n ".join(out)


def build(data: dict, site_url: str, mode: str) -> str:
    tz = ZoneInfo(data["timezone"])
    total = data["modes"][mode]["doors"]
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = "Winterwatch · Cyber & AI (24 doors)" if mode == "advent" else "Winterwatch · Cyber & AI (31 days)"
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Winterwatch Cyber & AI//EN", "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH", f"X-WR-CALNAME:{esc(name)}", f"X-WR-TIMEZONE:{data['timezone']}",
    ]
    for day in data["days"][:total]:
        n = day["day"]
        start = dt.datetime(data["year"], data["month"], n, 8, 30, tzinfo=tz).astimezone(dt.timezone.utc)
        end = start + dt.timedelta(minutes=5)
        link = site_url.rstrip("/") + f"/?day={n}" + ("&mode=advent" if mode == "advent" else "")
        case = day["cases"][0]
        desc = (f"DO: {day['do']}\nDON’T: {day['dont']}\n\nLesson learnt ({case['name']}, "
                f"{case['when']}): {case['text']}\n\nOpen the door: {link}")
        lines += [
            "BEGIN:VEVENT",
            f"UID:door-{n:02d}-{mode}-{data['year']}@cyber-advent-calendar",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{start:%Y%m%dT%H%M%SZ}",
            f"DTEND:{end:%Y%m%dT%H%M%SZ}",
            "SUMMARY:" + esc("Door " + str(n) + ": " + day["title"]),
            f"DESCRIPTION:{esc(desc)}",
            f"URL:{link}",
            "TRANSP:TRANSPARENT",
            "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc('Door ' + str(n) + ' is open')}", "TRIGGER:PT0M", "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(fold(l) for l in lines) + "\r\n"


def main() -> int:
    data = json.loads((SITE / "days.json").read_text(encoding="utf-8"))
    cfg = json.loads((ROOT / "config" / "site.json").read_text(encoding="utf-8"))
    site_url = cfg["siteUrl"]
    # While siteUrl is still a placeholder, use the address GitHub Pages reports (set by pages.yml),
    # so calendar reminders never link to "https://[YOUR-GITHUB-USER]…".
    pages_url = os.environ.get("SITE_URL", "").strip()
    if "[" in site_url and pages_url.startswith("https://"):
        site_url = pages_url
    elif "[" in site_url:
        print("WARNING siteUrl is a placeholder and no SITE_URL was given: the .ics links will not work")
    (SITE / "advent-24.ics").write_text(build(data, site_url, "advent"), encoding="utf-8", newline="")
    (SITE / "days-31.ics").write_text(build(data, site_url, "full"), encoding="utf-8", newline="")
    print("Wrote site/advent-24.ics and site/days-31.ics")
    return 0


if __name__ == "__main__":
    sys.exit(main())
