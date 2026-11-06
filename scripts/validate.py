#!/usr/bin/env python3
"""Validate site content before every deploy. Fails the build on any problem.

Checks
  * 31 doors numbered 1–31, every required field present, quiz answers in range
  * known stakeholders, icons, map pins and country-lens categories
  * every link is https:// AND on an allow-list of official domains — so a malicious
    pull request cannot slip phishing or javascript: links into the calendar (OWASP A05/A08)
  * WhatsApp template limits for the fields the daily alert sends
  * every door has 1+ verbatim quotes that exist in the quote library (each with an allow-listed
    official link) and exactly four activities — at home, at work, leaders, tech teams — each
    tagged cyber (c), AI (a) or privacy (p) hygiene
  * the coverage promise: all ten OWASP Top 10:2025 categories and all ten OWASP LLM Top 10
    (2025) risks appear within doors 1–24, so Advent mode is complete
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
ALLOWED_HOSTS = {
    "eur-lex.europa.eu", "www.enisa.europa.eu", "euvd.enisa.europa.eu", "cybersecuritymonth.eu",
    "owasp.org", "genai.owasp.org", "www.nist.gov", "csrc.nist.gov", "doi.org",
    "www.cisa.gov", "www.etsi.org", "www.bsi.bund.de", "cyber.gouv.fr", "www.acn.gov.it",
    "www.incibe.es", "ccb.belgium.be", "www.ncsc.nl", "www.ncsc.gov.ie", "www.ncsc.gov.uk",
    "ai-act-service-desk.ec.europa.eu",
}
REQUIRED = ("title", "topic", "track", "for", "icon", "category", "do", "dont", "cases", "lab", "readMore", "explain", "refs", "quiz", "quotes", "activities")
AUDIENCES = ["home", "work", "leaders", "tech"]
errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def check_url(u: str, where: str) -> None:
    p = urlparse(u or "")
    check(p.scheme == "https", f"{where}: link must be https:// ({u!r})")
    check(p.hostname in ALLOWED_HOSTS, f"{where}: link host {p.hostname!r} is not on the allow-list in scripts/validate.py")


def main() -> int:
    data = json.loads((ROOT / "site" / "days.json").read_text(encoding="utf-8"))
    supply = json.loads((ROOT / "site" / "supply.json").read_text(encoding="utf-8"))
    cfg = json.loads((ROOT / "config" / "alerts.json").read_text(encoding="utf-8"))
    settings = json.loads((ROOT / "site" / "settings.json").read_text(encoding="utf-8"))
    days, stk = data["days"], set(data["stakeholders"])

    check(len(days) == 31, f"expected 31 doors, found {len(days)}")
    check([d.get("day") for d in days] == list(range(1, 32)), "doors must be numbered 1–31 in order")
    check(sorted(data["order"]) == list(range(1, 32)), "order must list each door 1–31 exactly once")
    check(data["modes"]["advent"]["doors"] == 24 and data["modes"]["full"]["doors"] == 31, "modes must be 24 and 31 doors")
    check(settings.get("defaultMode") in ("advent", "full"), "settings.json defaultMode must be advent or full")
    check(settings.get("defaultCountry", "eu") in {c["id"] for c in data["countries"]}, "settings.json defaultCountry must be a known country id")
    check(cfg.get("mode") in ("advent", "full"), "alerts.json mode must be advent or full")
    for cid, nat in data["national"].items():
        check_url(nat.get("url", ""), f"national.{cid}")
        check(bool(nat.get("general")), f"national.{cid}: needs a 'general' entry as fallback")

    quotes = data.get("quotes", {})
    check([a.get("id") for a in data.get("audiences", [])] == AUDIENCES, "audiences must be home, work, leaders, tech in that order")
    check(set(data.get("hygiene", {})) == {"c", "a", "p"}, "hygiene must define c, a and p")
    for qid, q in quotes.items():
        for k in ("src", "ref", "text", "url"):
            check(bool(q.get(k)), f"quotes.{qid}: missing {k}")
        check_url(q.get("url", ""), f"quotes.{qid}")
        check(len(q.get("text", "")) <= 900, f"quotes.{qid}: excerpt is over 900 characters — quote less")

    for d in days:
        n = d.get("day")
        for key in REQUIRED:
            check(key in d and d[key] not in ("", None, [], {}), f"door {n}: missing {key}")
        check(d.get("track") in ("ai", "cyber", "both"), f"door {n}: track must be ai, cyber or both")
        check(set(d.get("for", [])) <= stk, f"door {n}: unknown stakeholder in {d.get('for')}")
        check(d.get("icon") in data["icons"], f"door {n}: unknown icon {d.get('icon')!r}")
        q = d.get("quiz", {})
        check(len(q.get("options", [])) == 3, f"door {n}: quiz needs exactly 3 options")
        check(isinstance(q.get("answer"), int) and 0 <= q["answer"] < 3, f"door {n}: quiz answer must be 0, 1 or 2")
        for c in d.get("cases", []):
            for k in ("kind", "when", "name", "location", "text", "source"):
                check(bool(c.get(k)), f"door {n}: a case is missing {k}")
            check(c.get("pin") is None or c["pin"] in data["pins"], f"door {n}: unknown map pin {c.get('pin')!r}")
        lab = d.get("lab", {})
        for k in ("timeline", "prevent", "detect", "tune", "playbook"):
            check(bool(lab.get(k)), f"door {n}: lab.{k} missing")
        check(bool(lab.get("tabletop", {}).get("inject")) and bool(lab.get("tabletop", {}).get("questions")), f"door {n}: lab.tabletop incomplete")
        for k in ("simple", "technical", "business"):
            check(bool(d.get("explain", {}).get(k)), f"door {n}: explain.{k} missing")
        for i, m in enumerate(d.get("readMore", [])):
            check(all(m.get(k) for k in ("org", "ref", "text", "url")), f"door {n}: readMore[{i}] incomplete")
            check_url(m.get("url", ""), f"door {n} readMore[{i}]")
        for field in ("title", "do", "dont"):
            val = d.get(field, "")
            check(not re.search(r"[\r\n\t]| {5,}", val), f"door {n}: {field} breaks WhatsApp parameter rules")
            check(len(val) <= 200, f"door {n}: {field} is over 200 characters")
        for qid in d.get("quotes", []):
            check(qid in quotes, f"door {n}: unknown quote id {qid!r}")
        acts = d.get("activities", [])
        check([a.get("audience") for a in acts] == AUDIENCES, f"door {n}: needs one activity each for {', '.join(AUDIENCES)}, in that order")
        for i, a in enumerate(acts):
            check(a.get("type") in ("c", "a", "p"), f"door {n}: activity {i} type must be c, a or p")
            check(0 < len(a.get("text", "")) <= 120, f"door {n}: activity {i} text must be 1–120 characters")
        for code in d.get("owasp", []):
            check(bool(re.fullmatch(r"(A(0[1-9]|10)|LLM(0[1-9]|10)):2025", code)), f"door {n}: bad OWASP code {code}")

    for i, law in enumerate(supply.get("laws", [])):
        check_url(law.get("url", ""), f"supply.laws[{i}]")
    for i, c in enumerate(supply.get("contacts", [])):
        check_url(c.get("url", ""), f"supply.contacts[{i}]")

    covered = {c.split(":")[0] for d in days if d["day"] <= 24 for c in d.get("owasp", [])}
    for i in range(1, 11):
        check(f"A{i:02d}" in covered, f"Advent doors miss OWASP A{i:02d}:2025")
        check(f"LLM{i:02d}" in covered, f"Advent doors miss OWASP LLM{i:02d}:2025")
    for b in data["badges"]:
        for n in b.get("days", []):
            check(1 <= n <= 24, f"badge '{b['name']}' uses door {n}; badges must be winnable in Advent mode")

    # Warnings don't block the site from publishing, but they flag settings that would reach the public.
    warnings: list[str] = []
    site_url = str(cfg.get("siteUrl", ""))
    if "[" in site_url or not site_url.startswith("https://"):
        warnings.append("config/alerts.json siteUrl is still a placeholder: the .ics files will use the Pages address, and real alerts will refuse to send")
    if "[" in str(cfg.get("reviewer", "[")):
        warnings.append("config/alerts.json reviewer is still a placeholder: real alerts will refuse to send")
    if cfg.get("mode") != settings.get("defaultMode"):
        warnings.append(f"alerts.json mode ({cfg.get('mode')}) differs from settings.json defaultMode ({settings.get('defaultMode')}): alerts and the site will count doors differently")
    for w in warnings:
        print(f"::warning::{w}" if os.environ.get("GITHUB_ACTIONS") == "true" else f"WARNING {w}")

    if errors:
        for e in errors:
            print(f"::error::{e}" if os.environ.get("GITHUB_ACTIONS") == "true" else f"ERROR {e}")
        return 1
    ai = sum(1 for d in days if d["track"] != "cyber")
    cases = sum(len(d["cases"]) for d in days)
    links = sum(len(d["readMore"]) for d in days)
    used = {q for d in days for q in d["quotes"]}
    print(f"OK · 31 doors · {ai} with an AI label · {cases} case studies · {links} source links · {len(used)} verbatim excerpts · "
          f"{sum(len(d['activities']) for d in days)} activities (all links https, allow-listed) · "
          "OWASP Top 10:2025 and LLM Top 10 fully covered in doors 1–24")
    return 0


if __name__ == "__main__":
    sys.exit(main())
