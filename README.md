# Winterwatch · Cyber & AI — one door a day

A festive, gamified calendar of cybersecurity, AI and privacy do's and don'ts for every stakeholder, from the board to the kitchen table. Behind each door:

- one **DO** (the *Nice list*) and one **DON'T** (the *Naughty list*)
- **case studies** from real incidents (56 in total, many from Europe, including AI events such as the Hugging Face token and malicious-model cases)
- an **incident lab**: a timeline of what happened, how it could have been prevented and detected, detection-tuning ideas, a response playbook and a tabletop exercise
- **four activities**, one each for *At home*, *At work*, *Leaders* and *Tech teams*, tagged **cyber**, **AI** or **privacy hygiene** (+5 points each)
- a 20-second **challenge**; a wrong answer brings out **Clinker**, a grumpy lump of coal (an original character), and explains why in **Simple**, **Technical** or **Business** language with further reading
- a **full briefing** page (`door.html?day=N`): all three explanations side by side, **verbatim excerpts** from NIS2, DORA, GDPR, the EU AI Act, NIST SP 800-63B-4 and the OWASP Top 10 lists (45 excerpts, each linked to the official text and flagged where a text has been amended or a change is only proposed), every case study, the whole incident lab, and a **share kit** with ready-made summaries for LinkedIn, WhatsApp/Signal, email/Teams, an intranet or newsletter, and X/Bluesky (copy button and share links). Printable or savable as PDF
- **Read more** summaries of ENISA, OWASP, NIST, the EU AI Act, NIS2, DORA and GDPR, linked to the official texts
- a **country lens** with national standards and authorities (Germany's BSI, France's ANSSI, Italy's ACN and others)

Also included:

- **Two modes:** *Advent* (24 doors, 1–24 December) or *31 days* (1–31 December). Doors 1–24 stand alone; 25–31 are a bonus week.
- **Coverage:** every OWASP Top 10:2025 category and every OWASP Top 10 for LLM Applications (2025) risk appears within doors 1–24. `scripts/validate.py` checks this on every build.
- **AI labels:** 24 of 31 doors carry an AI label, and the site discloses that its content is AI-assisted and human-reviewed.
- **Around Europe:** an original map (Natural Earth, public domain) with a pin for each case study's location.
- **Supplier toolkit** (`supply.html`): what to ask suppliers at each stage, the NIS2, DORA, GDPR, Cyber Resilience Act and AI Act duties, what happens when a supplier's incident hits you, who to contact at the authorities by country, and a joint tabletop exercise.
- **The Winterwatch house:** a snowy house cut open like a doll's house. In the attic, Clinker keeps the Naughty list (it shows the player's own doors to redeem) beside a chest of presents, and smoke curls from the stone chimney. The calendar wall fills the middle floor: a Winterwatch sign, a **Follow December dates** switch (off = explore every door early), and door cards with *December*, a serif number, a line icon, the title and the topic, whose two leaves swing apart onto the explored card (points and status). The living room below has snow falling past the window, an armchair, a decorated tree and a fire burning under the CYBER / AI / PRIVACY stockings. Outside, a snowman waves in the falling snow. Everything is drawn in SVG and CSS; all motion switches off for visitors who ask their device to reduce motion.
- **Daily reminders without personal data:** a calendar subscription (`.ics`) reminds people each morning when a door opens. There's nothing to sign up for and no contact list. Each door's **share kit** opens WhatsApp, LinkedIn, email, X or Bluesky with ready-made text and no recipient filled in; the person sharing chooses where it goes.
- **No personal data:** no phone numbers, LinkedIn identities, email addresses or contact lists are collected, processed or stored, by the site or by its workflows.
- **Hosting:** a static site on **GitHub Pages**. No dependencies, no cookies, no analytics, no third-party requests. See `SECURITY.md` for the security and logic review.

> Independent awareness initiative by an ENISA Ambassador — not an official ENISA publication. Don't use ENISA's name or logo as branding without their permission. Not legal advice.

---

## What's in the repo

```
site/                    The website GitHub Pages serves
  index.html             Calendar page: the cut-open Winterwatch house, panel, map (strict CSP)
  door.html, door.js     Full briefing for one door (?day=N): excerpts, activities, lab, share kit
  supply.html            Supplier toolkit page
  common.js              Shared safe DOM helpers, https-only links, framing guard, snow and lights,
                         progress storage + sanitising, activities, Clinker, share-kit texts
  app.js, supply.js      Calendar game logic and toolkit rendering (vanilla JS, no innerHTML)
  styles.css             Festive design and animations (reduced-motion aware)
  stone.svg              Self-hosted stone texture for the house walls
  days.json              ← THE content: all 31 doors (single source of truth)
  supply.json            Supplier-toolkit content
  europe-map.svg         Original Europe map (Natural Earth, public domain)
  settings.json          defaultMode, defaultCountry, lockFuture, gamified
  fonts/                 Fraunces + IBM Plex (SIL OFL 1.1)
config/site.json         The public site address (used for the calendar reminders' links)
scripts/
  validate.py            Content checks; fails the build on any problem
  build_ics.py           Builds advent-24.ics and days-31.ics calendar reminders (generated on deploy, not committed)
  check_links.py         Checks every external link and the published site (run by links.yml)
.github/workflows/
  pages.yml              Validate → build → publish the site
  links.yml              Link check on GitHub: pull requests that touch the site, by hand, and weekly
.github/dependabot.yml   Keeps the SHA-pinned Actions current
SECURITY.md              How this repo itself maps to OWASP Top 10:2025
```

## 1. Publish the site (about 10 minutes)

1. **Create a repository** and push these files to `main`. GitHub Pages is free for public repositories; private repositories need GitHub Pro, Team or Enterprise.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Then tick **Enforce HTTPS**.
3. **Replace the placeholders:**
   - `site/index.html` and `site/door.html`: `[YOUR NAME]`, `[COUNTRY / ORGANISATION]` and `[REVIEW DATE]` (the header shows the site's own name, and the footers show the site address)
   - `config/site.json`: `siteUrl` (e.g. `https://your-user.github.io/your-repo/`). While it is a placeholder, every build shows a warning and the `.ics` reminders use the address GitHub Pages reports.
   - `site/settings.json`: `defaultMode` (`"full"` or `"advent"`) and `lockFuture` (the default for the *Follow December dates* switch; `true` keeps future doors shut until each visitor switches it off)
4. **Push to `main`.** The *Pages* workflow validates the content, builds the `.ics` files and deploys.
5. **Preview every door before December:** open `…/?preview=all`. The lock is a convenience, not a secret: all content is public in `days.json`. Share kits built while previewing link to the normal calendar, but a link copied from the address bar during a preview still contains `preview=all`, so don't post those.
6. **Lock down the repository:** follow the *Repository settings checklist* in `SECURITY.md` (protect `main`, read-only workflow permissions, secret scanning).

Useful links: `?day=7` opens door 7, `?mode=advent` forces Advent mode.

### Keep the source private (free plan)

GitHub Pages on the free plan only serves public repositories, so this repo can publish the **built website only** to a separate public repo, while everything else (scripts, workflows, settings, this README, `SECURITY.md`, the history) stays private. The website's own files — HTML, CSS, JavaScript and `days.json` — always reach visitors' browsers, so they are public either way.

| Repo | Visibility | Holds |
|---|---|---|
| this repo (`CyberAIAdvent`) | Private | All source, and the deploy token as an Actions secret |
| `aware-by-design/CyberAIAdvent2026` (set in `SITE_REPO` in `pages.yml`) | Public, in the free **aware-by-design** organisation | Only the built `site/` folder, served at `https://aware-by-design.github.io/CyberAIAdvent2026/` |

Do it in this order so the site never goes offline:

1. Create the free organisation **aware-by-design** and, inside it, the public repo **`CyberAIAdvent2026`** (no README). The repo name becomes the last part of the address.
2. Create a fine-grained token with **Resource owner: aware-by-design**, for **that repo only**, with **Contents: Read and write** and an expiry after the campaign (e.g. 31 Jan 2027).
3. Store it in **this** repo as an Actions secret named `CYBERAI_DEPLOY_TOKEN` (Settings → Secrets and variables → Actions). Never paste it anywhere else.
4. Push or merge anything to `main` (or run the *Pages* workflow by hand). The `publish-site` job copies the built site into the public repo, adding `.nojekyll` and a short README.
5. In the public repo: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. Check the site loads.
   If a GitHub Pages deployment in the public repo times out, run **Actions → Pages → Run workflow** here with **Republish even if nothing changed** ticked: it pushes an empty commit so Pages deploys again.
6. Before making this repo private, untick **Require code scanning results** in the ruleset (CodeQL needs a paid plan on private repos, so pull requests would be blocked). Then make this repo private (**Settings → General → Change visibility**). The old address goes offline; the new one carries on, and every merge to `main` republishes it.
7. In the public repo: turn on **private vulnerability reporting** (Settings → Advanced Security) — the workflow adds a `SECURITY.md` there that points to it — and protect `main` with a ruleset that blocks deletion and force pushes, bypass *Repository admin: Always*. Don't add a pull-request rule there: the workflow pushes to it directly.

## 2. Daily reminders and sharing — no personal data

This calendar collects, processes and stores **no personal data**: no phone numbers, no LinkedIn or other social-media identities, no email addresses, no contact lists. It has no sign-up and no mailing list.

- **Daily reminders:** the site offers calendar subscriptions (`advent-24.ics` and `days-31.ics`, built on every deploy). Each door is an 08:30 (Europe/Rome) event with a reminder, the DO and DON'T, and a link. People add it to their own calendar, and nothing about them reaches you.
- **Sharing:** every door's full briefing has a **share kit** with ready-made text for LinkedIn, WhatsApp/Signal, email/Teams, an intranet or newsletter, and X/Bluesky. Its buttons open the visitor's own app with the text filled in and **no recipient**. The person sharing picks where it goes, and nothing passes through this site.
- **Posting to a WhatsApp Channel or a LinkedIn page yourself:** copy the day's text from the share kit and post it by hand. WhatsApp Channels don't show followers' phone numbers to admins. No API tokens, member IDs or recipient lists are needed.

Once you click a share button, the platform you choose applies its own privacy terms; this site sends it only the text you see.

## 3. Edit the content

All calendar content lives in **`site/days.json`**. Each door has:

- `title`, `topic`, `icon` and `category` (which drives the country lens)
- `track`: `ai`, `cyber` or `both`, which drives the AI label
- `for`: stakeholder IDs
- `do` and `dont`
- `cases`: the first case is the headline lesson used in the share kit and the calendar reminders; add `pin` to show it on the map
- `lab`: `timeline`, `prevent`, `detect`, `tune`, `playbook` and `tabletop`
- `readMore`: official sources
- `explain`: `simple`, `technical` and `business` versions
- `refs`, `owasp` and `quiz`
- `quotes`: IDs from the top-level `quotes` library (each entry has `src`, `ref`, verbatim `text`, official `url` and an optional `note` for amendments or proposals). Quote word for word and mark cuts with […]
- `activities`: exactly four, in the order `home`, `work`, `leaders`, `tech`, each with a `type` of `c` (cyber), `a` (AI) or `p` (privacy hygiene) and a `text` of up to 120 characters

The supplier toolkit lives in `site/supply.json`; national standards are under `national` in `days.json`.

Push your changes and the build re-validates everything: numbering, quiz answers, map pins, quote IDs, the four activities per door, short single-line titles and DO/DON'T texts (for the share kit and reminders), OWASP coverage in doors 1–24, and **every link**. Links must be `https://` and on the allow-list in `scripts/validate.py`. To cite a new official source, add its domain to that list in the same pull request so a reviewer sees it.

Facts were checked in November 2026. Two excerpts carry a dated note: the EU AI Act Article 4 text is the version amended by the Digital Omnibus on AI (Commission AI Act Service Desk, consolidated as at 27 July 2026), and GDPR Article 33(1) notes the proposed 96-hour change, which is not law at the time of writing (Council position, 21 October 2026). Re-check both before December. Re-check any figure you change against its source, then update `[REVIEW DATE]`. The detection rules in the incident lab are illustrative starting points; adapt them to your SIEM or EDR before using them.

## Gamification

- +10 for opening a door, +20 for a correct answer, +5 for each of the four activities, +10 team bonus when the door is tagged for the team you play for.
- Ranks scale with the mode: Rookie → Watcher → Defender → Guardian → Cyber Ambassador.
- Eight badges (Phish finder, Deepfake detective, Prompt-proof, Agent wrangler, OWASP ten, 7-day streak…). All can be earned in Advent mode.
- **Santa's list:** a right answer, or all four activities on a door, goes on the *Nice list*. A wrong answer goes on the *Naughty list*, kept by Clinker, until the player redeems it by ticking off all four of that door's activities. The list shows a verdict ("You're on the Nice list ✓", "Mostly nice", "Naughty list — Clinker is delighted") and links each Naughty entry back to its door.
- **Scores stay in the player's browser.** Quiz answers are readable in `days.json`, so this is an awareness game, not a fair competition. A real team leaderboard needs a small backend with authenticated submissions.

## Privacy

- No cookies, analytics or third-party requests. Fonts are self-hosted. In 2022 a Munich court (LG München I, 3 O 17493/20) ruled that embedding Google Fonts dynamically, which sends visitors' IP addresses to Google, breached the GDPR.
- Game progress is stored in `localStorage` on the visitor's device only.
- No phone numbers, social-media identities, email addresses or contact lists are collected, processed or stored. Daily reminders come from a calendar file people add themselves, and the share kit hands text to the visitor's own app with no recipient.

## Credits and licences

Fonts: Fraunces and IBM Plex, SIL Open Font License 1.1 (`site/fonts/OFL.txt`).
