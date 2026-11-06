# Security

A calendar that teaches OWASP should follow OWASP itself. This file records how the repo maps to the **OWASP Top 10:2025**, the results of a security and logic review, and the limits that remain.

## Security & logic review (November 2026, second pass 6 November)

Every attack below was tried against the built site in a headless browser, or against the scripts, before release.

| # | Attack / weakness tried | Result | Fix in place |
|---|---|---|---|
| 1 | **XSS through content** — HTML or script in `days.json` / `supply.json` | Rendered as plain text | All DOM is built with `textContent`; no `innerHTML`, `eval` or inline handlers; CSP `script-src 'self'` |
| 2 | **Malicious links in a content PR** — `javascript:`, `data:`, look-alike phishing domains | Build fails | `validate.py` requires `https://` **and** an allow-listed official domain for every link; `common.js` also drops non-https links at runtime |
| 3 | **Tampered localStorage** — prototype-pollution keys, out-of-range doors, script strings, bogus team/mode | Ignored; score recomputed only from valid values | `sanitize()` rebuilds state from scratch, keeping only integers 1–31, answers 0–2 and known IDs |
| 4 | **Hostile URL parameters** — `?day=99`, `?mode="><script>` | Ignored | Strict allow-lists for `mode`; `day` must be an integer within the active mode and unlocked |
| 5 | **Clickjacking** — framing the calendar from another origin | Warning banner; all controls disabled | `guardFraming()` (GitHub Pages can't send `frame-ancestors`, so this is defence-in-depth) |
| 6 | **Reverse tabnabbing** via outbound links | Not possible | Every external link gets `rel="noopener noreferrer"` |
| 7 | **Personal data in sharing** — phone numbers, LinkedIn or other social identities, email addresses, contact lists | None collected, processed or stored | The automated WhatsApp and LinkedIn channels were removed (6 Nov 2026). Daily reminders come from a calendar file people add themselves; the share kit opens the visitor's own app with text and **no recipient**; the site has no forms, accounts, cookies or analytics, and game progress never leaves the visitor's browser |
| 8 | **Workflow script injection** | Not possible | No workflow takes free-text input; values reach scripts only through `env`, never interpolated into the shell; `SITE_REPO` must match `owner/repo` |
| 9 | **Supply-chain compromise of Actions** (the tj-actions lesson, Door 22) | Mitigated | Every Action is pinned to a full commit SHA; Dependabot proposes reviewed updates; `persist-credentials: false` |
| 10 | **Secret leakage in logs** | None | The only secret is the deploy token: it reaches git as a masked, one-off header and is never printed, written to a remote URL or stored in a file |
| 11 | **Fork pull requests reading secrets** | Not possible | `pages.yml` uses `pull_request` (not `pull_request_target`): fork PRs get a read-only token and no secrets |
| 12 | **Third-party tracking / IP leakage** | None | No CDNs, analytics or remote fonts; CSP `default-src 'none'` with `'self'` for scripts, styles, fonts, images and data |
| 13 | **Logic: Advent vs 31-day mode** | Correct | Doors 25–31 don't count in Advent mode; badges are winnable within doors 1–24 (checked by `validate.py`) |
| 14 | **Logic: re-answering for points** | Blocked in the UI | Answers lock after the first choice (a determined player can still edit their own browser storage — see limits) |
| 15 | **Tampered activity progress** — keys like `1-9`, `40-1`, `__proto__`, script strings as values | Ignored | `sanitize()` keeps only keys matching `^[0-9]{1,2}-[0-3]$` for a real door, with the value `1` |
| 16 | **Injection through the share kit** — HTML or links smuggled into a door's text | Shown as plain text | Summaries are built from validated content and placed with `textarea.value`; share links go through the https-only `safeUrl()`; the email link is built only from `encodeURIComponent` output |
| 17 | **Clipboard abuse** | Not possible | The page only *writes* to the clipboard, only after the visitor clicks **Copy**, and never reads it |
| 18 | **Hostile parameters on the briefing page** — `door.html?day=<script>&mode=evil` | Ignored | `day` must be an integer within the mode; unknown modes fall back to the saved or default mode; locked doors stay locked |
| 19 | **Faking a Naughty-list redemption** — activity values like `true`, `"1"` or `2` in storage | Still on the Naughty list | Only the exact value `1` survives `sanitize()`, and redemption requires all four activities for that door |
| 20 | **The “Follow December dates” switch** — storing `follow: "yes"` or other junk | Falls back to the site default | Only a real boolean survives `sanitize()`. The switch only changes what is shown; door content is public in `days.json` by design |
| 21 | **Preview flag leaking into shared links** — an organiser previews in November, then posts the share kit | Fixed: the link is clean | The share kit always builds the public link without `?preview=all`. A link copied from the address bar while previewing still carries it, so don't share those |
| 22 | **Lost progress with two tabs open** — the calendar and a briefing saving over each other | Fixed | Every tab listens for `storage` events and reloads sanitised progress; the briefing re-reads the mode and the Follow switch at save time and only writes when something changed |
| 23 | **DOM-XSS regression** — a future edit that adds `innerHTML` or a similar sink | Blocked by the browser | CSP `require-trusted-types-for 'script'; trusted-types 'none'` makes every HTML-string sink throw (Chromium-based browsers; others still have row 1); `h()` never sets `on…` attributes |
| 24 | **Placeholder links** — calendar reminders pointing at `[YOUR-GITHUB-USER]` | Not possible | `build_ics.py` falls back to the address GitHub Pages reports while `siteUrl` in `config/site.json` is a placeholder; `validate.py` warns on every build |
| 25 | **Retired with the alert channels** — duplicate sends, phone-number masking, the issue send-log and its double-send guard | Not applicable | Removed together with `notify.py` and `daily-alert.yml`, so no phone number or social identity is ever handled |
| 26 | **Calendar-file injection** — a carriage return in content starting a new `.ics` property | Not possible | `build_ics.py` drops CR characters before RFC 5545 escaping and folds long lines; titles, DO and DON'T are also checked by `validate.py` |
| 27 | **Accidental reset** — one click erased all points, answers and Santa's list | Fixed | **Reset my progress** needs a second click within five seconds |
| 28 | **Keyboard and screen-reader users losing their place** after every click | Fixed | Focus returns to the same control after each re-render, moves to the door's heading when a door opens and to the result after an answer; the briefing no longer re-announces the whole page |
| 29 | **A missing or broken `settings.json`** stopping the calendar | Falls back to the defaults | The settings fetch is caught; only `days.json` is required |
| 30 | **Wrong or tampered Action pins** | Verified 6 Nov 2026 | `checkout` v7.0.1, `configure-pages` v6.0.0, `upload-pages-artifact` v5.0.0 and `deploy-pages` v5.0.1 each match their release tag's commit |
| 31 | **Publishing from a private repo** — leaking the source, or the deploy token, through the public site repo | Only the built site is copied | `publish-site` copies `site/` alone, using `CYBERAI_DEPLOY_TOKEN` (fine-grained, one repo, *Contents* only). It runs only on pushes to `main`, never on pull requests; the token reaches git as a masked one-off header, never a remote URL or a file; commits in the public repo carry no source history |

## OWASP Top 10:2025 mapping

| Category | What this repo does |
|---|---|
| **A01 Broken Access Control** | Workflows start from `permissions: {}`; each job gets only what it needs. The single secret (the deploy token) is scoped to one public repo with *Contents* access only. |
| **A02 Security Misconfiguration** | Strict CSP, a referrer policy, no inline scripts or styles. **Limit:** GitHub Pages can't send custom headers (`frame-ancestors`, HSTS settings), hence the framing guard. Turn on *Enforce HTTPS*. |
| **A03 Software Supply Chain Failures** | Zero runtime dependencies (vanilla JS, Python standard library). SHA-pinned Actions, Dependabot, self-hosted fonts. |
| **A04 Cryptographic Failures** | No secrets in code; the deploy token lives in GitHub secrets and is used over HTTPS only. |
| **A05 Injection** | No `innerHTML`; Trusted Types; env-only workflow values; RFC 5545 escaping in the calendar files; link allow-listing (content links and quote sources); share-kit text set as plain values. |
| **A06 Insecure Design** | Privacy by design: no personal data is collected, so none can leak. Future doors lock by date; the public site repo receives only built files. |
| **A07 Authentication Failures** | No accounts on the site. Protect the operator's GitHub account with a passkey or MFA, and require 2FA in the organisation. |
| **A08 Software or Data Integrity Failures** | `validate.py` gates every deploy, including link integrity; Pages deploys only from `main` via OIDC. Recommended: branch protection with required review. |
| **A09 Security Logging and Alerting Failures** | Every build and publish runs in GitHub Actions with full logs; failures raise `::error::` with a plain-language cause and a non-zero exit, so GitHub reports the failed run. |
| **A10 Mishandling of Exceptional Conditions** | Loud, explained failures in the workflow and scripts; the site shows a clear message if content can't load; every storage call is wrapped in `try/catch`. |

## Known limits

- **Scores are client-side** and quiz answers are public in `days.json`. Fine for awareness; don't award prizes without a server-side check.
- **Future-door locking is UX, not access control** — the content is public by design, and anyone can switch off *Follow December dates*.
- **The game runs on trust.** Players can collect every point early with the switch off, pick the team that earns the bonus after answering, and redeem a Naughty-list door by ticking four boxes. That suits an awareness game; it would not suit prizes.
- **Static hosting can't set HTTP security headers.** If you need `frame-ancestors`, HSTS preload or `Permissions-Policy`, put the site behind a CDN or host that lets you set headers.

## Repository settings checklist (owner)

The code can't set these; they decide who can change what goes live and what gets broadcast.

- **Settings → Rules → Rulesets:** one ruleset, *Owner*, on the default branch only: restrict deletions, block force pushes, require a pull request (0 approvals for a sole maintainer, conversation resolution, squash merges), require the `build` status check with up-to-date branches, and require CodeQL results while the repo is public. Bypass: *Repository admin* only (choose *For pull requests only* to hold yourself to the same rule). Other branches have no rules, so Dependabot and Claude can open pull requests without being on the bypass list; only the owner merges. Anything merged is published.
- **Settings → Actions → General:** workflow permissions *Read repository contents and packages permissions*; leave *Allow GitHub Actions to create and approve pull requests* unticked; keep approval required for first-time contributors' workflows.
- **Settings → Advanced Security:** turn on private vulnerability reporting, secret scanning with push protection, and Dependabot alerts.
- **Settings → Environments:** keep `github-pages` limited to the default branch.
- **Accounts:** a passkey or MFA on GitHub; require 2FA in the aware-by-design organisation. Delete personal access tokens you no longer use.
- **Issues:** no workflow writes issues any more, so you can turn Issues off (Settings → General → Features) to reduce spam and phishing via issues.

## Reporting a vulnerability

Please report security issues privately through GitHub: open the **Security** tab of the public site repository, [aware-by-design/CyberAIAdvent2026](https://github.com/aware-by-design/CyberAIAdvent2026/security/advisories/new), and choose **Report a vulnerability**. You can also email **[SECURITY CONTACT]**. Please don't open a public issue for security problems.
