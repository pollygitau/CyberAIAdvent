/* Shared helpers for the calendar and the supplier toolkit.
   Security notes (see SECURITY.md):
   - h() only ever sets text via textContent / text nodes — never innerHTML (OWASP A05:2025).
   - safeUrl() lets through https: links only, so a malicious content change cannot inject
     javascript:, data: or http: links.
   - Everything here runs under a CSP with script-src/style-src 'self'; dynamic styling uses CSSOM. */
"use strict";
(function () {
  const SVGNS = "http://www.w3.org/2000/svg";
  const STAR = "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z";
  /* Garland icons: cyber = shield, AI = sparkle, privacy = padlock (drawn with even-odd holes). */
  const GARLAND = [
    ["cyber", "M12 2.5l8 3v6.2c0 4.9-3.4 8.4-8 9.8-4.6-1.4-8-4.9-8-9.8V5.5z"],
    ["ai", STAR],
    ["privacy", "M7 10V7.5a5 5 0 0 1 10 0V10h1.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-13C4.7 21 4 20.3 4 19.5v-8c0-.8.7-1.5 1.5-1.5zM9.5 10h5V7.5a2.5 2.5 0 0 0-5 0zM12 13.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"]
  ];

  function svg(d, cls, label) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    if (label) { s.setAttribute("role", "img"); s.setAttribute("aria-label", label); } else s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    s.append(p);
    return s;
  }

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      /* Handlers are only ever attached as functions; an "on…" string is dropped, never set as an attribute. */
      else if (k.startsWith("on")) { if (typeof v === "function") el.addEventListener(k.slice(2), v); }
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      el.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function safeUrl(u) {
    try {
      const url = new URL(String(u));
      return url.protocol === "https:" ? url.href : null;
    } catch (e) { return null; }
  }

  function extLink(u, cls, ...kids) {
    const href = safeUrl(u);
    if (!href) return h("span", { class: cls }, ...kids);
    return h("a", { class: cls, href, target: "_blank", rel: "noopener noreferrer" }, ...kids);
  }

  async function getJSON(path) {
    const res = await fetch(path, { cache: "no-cache", credentials: "same-origin" });
    if (!res.ok) throw new Error(path + " → HTTP " + res.status);
    return res.json();
  }

  /* Re-rendering replaces buttons, so remember which control had focus (its data-k) and move focus to
     its replacement — otherwise keyboard and screen-reader users are thrown back to the top of the page. */
  function focusKey() {
    const a = document.activeElement;
    return a && a.dataset && a.dataset.k ? a.dataset.k : null;
  }
  function refocus(key, fallback) {
    if (!key) return;
    const pick = (k) => { const t = k ? document.querySelector(`[data-k="${CSS.escape(k)}"]`) : null; return t && !t.disabled ? t : null; };
    const t = pick(key) || pick(fallback ? fallback(key) : null);
    if (t && t !== document.activeElement) t.focus({ preventScroll: true });
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function festive(snowId, lightsId, count) {
    const snow = document.getElementById(snowId);
    if (snow && !reducedMotion()) {
      for (let i = 0; i < count; i++) {
        const f = document.createElement("span");
        const sz = 2 + ((i * 7) % 5);
        f.className = "flake" + (i % 2 ? "" : " b");
        f.style.left = ((i * 37) % 100) + "%";
        f.style.width = f.style.height = sz + "px";
        f.style.opacity = String(0.45 + ((i * 11) % 5) / 10);
        f.style.animationDuration = (9 + ((i * 13) % 9)) + "s";
        f.style.animationDelay = (-((i * 29) % 15)) + "s";
        snow.append(f);
      }
    }
    /* The garland: instead of plain bulbs, little glowing cyber (shield), AI (sparkle) and privacy
       (padlock) icons in the four bulb colours, hanging along the wire's curve. */
    const lights = lightsId && document.getElementById(lightsId);
    if (lights) {
      const cols = ["#FF6B6B", "#F5C451", "#9EE6C4", "#F8F3E9"];
      for (let i = 0; i < 26; i++) {
        const [kind, d] = GARLAND[i % GARLAND.length], col = cols[i % 4];
        const b = document.createElement("span");
        const x = (2 * i) / 25 - 1;
        b.className = "bulb " + kind;
        b.style.marginTop = (Math.round(30 * (1 - x * x)) + 4) + "px";
        b.style.color = col;
        b.style.filter = "drop-shadow(0 0 4px " + col + ")";
        b.style.animationDuration = (1.4 + (i % 4) * 0.35).toFixed(2) + "s";
        b.style.animationDelay = (i * 0.13).toFixed(2) + "s";
        b.append(svg(d));
        lights.append(b);
      }
    }
  }

  /* Clickjacking defence-in-depth: GitHub Pages can't send frame-ancestors / X-Frame-Options,
     so if we are framed by another origin, warn and stop interactivity. */
  function guardFraming() {
    let framed = false;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (framed) {
      document.body.prepend(h("div", { class: "framed-warning", role: "alert", text: "This calendar is being shown inside another website. Open it directly to use it safely." }));
      document.querySelectorAll("button, select").forEach((b) => { b.disabled = true; });
    }
    return framed;
  }

  /* Snow falling around the Winterwatch house, and warm lights with red and gold baubles hung along the
     garland over the calendar wall (31 hangings across 10 swags, dipping with the curve). */
  function houseFestive(snowId, eaveId) {
    const eave = document.getElementById(eaveId);
    if (eave && !eave.childElementCount) {
      for (let i = 0; i < 31; i++) {
        const b = document.createElement("span");
        const dip = Math.round(8 * Math.pow(Math.sin((Math.PI * i) / 3), 2));
        if (i % 3 === 1) { b.className = "bb" + (i % 2 ? "" : " g"); b.style.marginTop = (dip + 7) + "px"; }
        else {
          b.className = "wl";
          b.style.marginTop = (dip + 3) + "px";
          b.style.animationDuration = (1.3 + (i % 5) * 0.3).toFixed(2) + "s";
          b.style.animationDelay = (i * 0.11).toFixed(2) + "s";
        }
        eave.append(b);
      }
    }
    const snow = document.getElementById(snowId);
    if (snow && !reducedMotion() && !snow.childElementCount) {
      for (let i = 0; i < 46; i++) {
        const f = document.createElement("span");
        const sz = 2 + ((i * 5) % 4);
        f.className = "flake";
        f.style.left = ((i * 41 + 7) % 100) + "%";
        f.style.width = f.style.height = sz + "px";
        f.style.opacity = String(0.5 + ((i * 3) % 5) / 10);
        f.style.animationDuration = (14 + ((i * 7) % 12)) + "s";
        f.style.animationDelay = (-((i * 31) % 26)) + "s";
        snow.append(f);
      }
    }
  }

  /* Progress storage shared by the calendar and the briefing pages. Whatever comes back from
     localStorage is rebuilt from scratch, keeping only well-formed values (SECURITY.md #3). */
  const store = {
    get(key) { try { return JSON.parse(window.localStorage.getItem(key)); } catch (e) { return null; } },
    set(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable: play continues in memory */ } }
  };
  const AUDS = ["simple", "technical", "business"];
  function sanitize(saved, data) {
    const out = { opened: {}, answers: {}, acts: {}, team: "", mode: null, aud: "simple", country: null, follow: null };
    if (!saved || typeof saved !== "object") return out;
    const days = data.days.length;
    const day = (k) => { const n = Number(k); return Number.isInteger(n) && n >= 1 && n <= days ? n : 0; };
    if (saved.opened && typeof saved.opened === "object") for (const k of Object.keys(saved.opened)) { const n = day(k); if (n) out.opened[n] = 1; }
    if (saved.answers && typeof saved.answers === "object") for (const [k, v] of Object.entries(saved.answers)) { const n = day(k); if (n && [0, 1, 2].includes(v)) out.answers[n] = v; }
    if (saved.acts && typeof saved.acts === "object") {
      for (const [k, v] of Object.entries(saved.acts)) {
        const m = /^([0-9]{1,2})-([0-3])$/.exec(k);
        if (m && day(m[1]) && v === 1) out.acts[Number(m[1]) + "-" + m[2]] = 1;
      }
    }
    if (typeof saved.team === "string" && Object.prototype.hasOwnProperty.call(data.stakeholders, saved.team)) out.team = saved.team;
    if (saved.mode === "advent" || saved.mode === "full") out.mode = saved.mode;
    if (AUDS.includes(saved.aud)) out.aud = saved.aud;
    if (saved.follow === true || saved.follow === false) out.follow = saved.follow;
    if (Array.isArray(data.countries) && data.countries.some((c) => c.id === saved.country)) out.country = saved.country;
    return out;
  }

  function todayFor(data) {
    const now = new Date();
    return now.getFullYear() > data.year ? 99 : (now.getFullYear() === data.year && now.getMonth() === data.month - 1 ? now.getDate() : 0);
  }

  /* Verbatim excerpts from regulations and standards for a door (ids resolved against data.quotes). */
  function quotesFor(data, d) {
    return (d.quotes || []).map((id) => data.quotes && data.quotes[id]).filter(Boolean);
  }

  function activitiesBlock(o) {
    const { data, n, d, acts, gamified, onToggle, P, note } = o;
    const done = (i) => !!acts[n + "-" + i];
    const count = (d.activities || []).filter((_, i) => done(i)).length;
    return h("section", { class: "acts", "aria-label": "Today’s activities" },
      h("div", { class: "ahead" },
        h("h3", { class: "h3", text: "TODAY’S ACTIVITIES · ONE FOR EVERY AUDIENCE" }),
        gamified ? h("span", { class: "acount", text: `${count}/4 done · +5 pts each` }) : null),
      note && note.text ? h("p", { class: "act-note" + (note.good ? " good" : ""), text: note.text }) : null,
      (d.activities || []).map((a, i) => {
        const aud = (data.audiences || []).find((x) => x.id === a.audience), on = done(i);
        return h("button", { type: "button", class: "act" + (on ? " done" : ""), "aria-pressed": String(on), "data-k": "act-" + i, onclick: () => onToggle(i, !on) },
          h("span", { class: "box", "aria-hidden": "true" }, on ? svg(P.check) : null),
          h("span", { class: "abody" },
            h("span", { class: "atags" },
              h("span", { class: "aud-name", text: (aud ? aud.name : a.audience).toUpperCase() }),
              h("span", { class: "hyg " + (["c", "a", "p"].includes(a.type) ? a.type : "c"), text: String((data.hygiene || {})[a.type] || "").toUpperCase() })),
            h("span", { class: "atext", text: a.text })));
      }));
  }

  /* Clinker, the grumpy lump of coal who turns up on wrong answers (an original character). */
  function art(viewBox, shapes, cls) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    shapes.forEach(([tag, attrs]) => {
      const e = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      s.append(e);
    });
    return s;
  }
  const COAL = [
    ["circle", { cx: 10, cy: 22, r: 5, fill: "#6B6B72", opacity: ".5" }], ["circle", { cx: 4, cy: 11, r: 3, fill: "#6B6B72", opacity: ".35" }], ["circle", { cx: 80, cy: 74, r: 4, fill: "#6B6B72", opacity: ".4" }],
    ["path", { d: "M14 52L22 34L40 28L60 32L74 46L76 66L64 82L42 88L22 82L10 68Z", fill: "#232326" }],
    ["path", { d: "M22 34L40 28L44 46L26 52Z", fill: "#36363C" }], ["path", { d: "M60 32L74 46L58 54L44 46Z", fill: "#2D2D32" }],
    ["path", { d: "M10 68L26 52L36 70L22 82Z", fill: "#1A1A1D" }], ["path", { d: "M58 54L76 66L64 82L50 70Z", fill: "#2A2A2F" }],
    ["path", { d: "M30 40l3-2M64 42l2 2M18 64l2-1", stroke: "#9A9AA4", "stroke-width": 1.5, "stroke-linecap": "round" }],
    ["ellipse", { cx: 34, cy: 57, rx: 8, ry: 9, fill: "#FFFFFF" }], ["ellipse", { cx: 54, cy: 57, rx: 8, ry: 9, fill: "#FFFFFF" }],
    ["circle", { cx: 37.5, cy: 59, r: 3.6, fill: "#111" }], ["circle", { cx: 57.5, cy: 59, r: 3.6, fill: "#111" }],
    ["path", { d: "M25 46L41 51M63 46L47 51", stroke: "#111", "stroke-width": 3.2, "stroke-linecap": "round" }],
    ["path", { d: "M36 73Q46 77 57 68", fill: "none", stroke: "#E8E2D6", "stroke-width": 2.6, "stroke-linecap": "round" }],
    ["path", { d: "M24 34Q36 8 66 10Q58 18 60 30Z", fill: "#C8202F" }],
    ["path", { d: "M66 10Q78 6 76 18", fill: "none", stroke: "#C8202F", "stroke-width": 6, "stroke-linecap": "round" }],
    ["circle", { cx: 76, cy: 21, r: 5, fill: "#F4EFE6" }],
    ["path", { d: "M20 37Q42 25 64 31", fill: "none", stroke: "#F4EFE6", "stroke-width": 8, "stroke-linecap": "round" }]
  ];
  const QUIPS = ["Ho-ho-NO! Clinker grabbed that one.", "A lump of coal for that answer — but the explainer below is a proper gift.", "Clinker loves that answer. So do attackers.", "Soot happens. Read why, then try the next door.", "That one goes in Clinker’s stocking. Yours gets the lesson below."];
  function clinker(seed, line) {
    return h("div", { class: "clinker" }, art("0 0 86 92", COAL, "coal"),
      h("div", { class: "bubble" }, h("span", { class: "who", text: "CLINKER · THE GRUMPY LUMP OF COAL" }), QUIPS[Math.abs(seed) % QUIPS.length],
        line ? h("span", { class: "naughty-line", text: line }) : null));
  }

  /* Santa's list. Nice: a right answer, or all four activities on a door. Naughty: a wrong answer,
     until all four of that door's activities redeem it. Computed only from sanitised progress. */
  function santaState(data, total, answers, acts) {
    const all4 = (n) => [0, 1, 2, 3].every((i) => acts[n + "-" + i] === 1);
    const right = (n) => answers[n] !== undefined && answers[n] === data.days[n - 1].quiz.answer;
    const wrong = (n) => answers[n] !== undefined && !right(n);
    const nice = [], naughty = [];
    data.days.filter((d) => d.day <= total).forEach((d) => {
      const n = d.day, full = all4(n);
      if (right(n)) nice.push({ n, t: `Door ${n} · ${d.title} — right answer` });
      else if (wrong(n)) { if (full) nice.push({ n, t: `Door ${n} · ${d.title} — redeemed` }); else naughty.push({ n, t: `Door ${n} · ${d.title} — wrong answer.` }); }
      if (full && !wrong(n)) nice.push({ n, t: `Door ${n} · ${d.title} — all four activities` });
    });
    const status = (n) => {
      if (wrong(n) && all4(n)) return { line: `Redeemed — Door ${n} is back on the Nice list.`, note: { text: `Redeemed — Clinker has crossed Door ${n} off the Naughty list.`, good: true } };
      if (wrong(n)) return { line: `Door ${n} is on the Naughty list. Tick off all four activities below to redeem it.`, note: { text: `Door ${n} is on the Naughty list. Tick off all four activities to get back on the Nice list.`, good: false } };
      if (all4(n)) return { line: "", note: { text: "All four done — that’s a Nice-list deed.", good: true } };
      return { line: "", note: null };
    };
    const verdict = !nice.length && !naughty.length ? ["Santa hasn’t checked his list yet", ""] : !naughty.length ? ["You’re on the Nice list ✓", "nice"] : nice.length >= naughty.length * 2 ? ["Mostly nice — a door or two to redeem", "mostly"] : ["Naughty list — Clinker is delighted", "naughty"];
    return { nice, naughty, status, verdict };
  }



  /* Ready-made summaries of a door for five channels. `link` is this site's own URL for the door. */
  function shareKit(data, d, total, link) {
    const enc = encodeURIComponent;
    const firstSentence = (t) => { const m = String(t).match(/^.+?[.!?](?=\s|$)/); return m ? m[0] : String(t); };
    const dot = (t) => (/[.!?]$/.test(t) ? t : t + ".");
    const cut = (t, n) => (t.length <= n ? t : t.slice(0, Math.max(0, t.lastIndexOf(" ", n - 1))) + "…");
    const qs = quotesFor(data, d), shortRef = (q) => q.src + " " + q.ref.split(" · ").pop();
    const acts = (d.activities || []).map((a) => a.text);
    const c0 = d.cases[0], ai = d.track !== "cyber", n = d.day;
    const tags = ["#Cybersecurity", ai ? "#AI" : "", (d.activities || []).some((a) => a.type === "p") ? "#Privacy" : "", "#CyberHygiene", (d.owasp || []).length ? "#OWASP" : ""].filter(Boolean).join(" ");
    const q0 = qs[0];
    const li = `🎄 Door ${n} of ${total}: ${d.title}\n\n${dot(d.topic)}\n\n✅ DO: ${d.do}\n❌ DON’T: ${d.dont}\n\n📌 Lesson learnt: ${c0.name} (${c0.when}). ${firstSentence(c0.text)}\n\n` +
      (q0 ? `📜 ${shortRef(q0)}: “${cut(q0.text, 180)}”\n\n` : "") +
      `Try today’s 20-second challenge and read the full briefing: ${link}\n\n${tags}\n\nAI-assisted · reviewed by [YOUR NAME] · an independent initiative by an ENISA Ambassador`;
    const wa = `*Door ${n}/${total} · ${d.title}*\n✅ ${d.do}\n❌ ${d.dont}\n🏠 Try today: ${acts[0] || ""}\n👉 ${link}`;
    const subj = `Door ${n}: ${d.title} — a two-minute security habit`;
    const body = `Hi all,\n\nToday’s habit: ${d.do}\nPlease avoid: ${d.dont}\n\nWhy it matters for us: ${d.explain.business}\n\nOne thing to do at work today: ${acts[1] || ""}\n\nThe full briefing, with the case study and what the rules say: ${link}\n\nThanks,\n[YOUR NAME]`;
    const nl = `${d.title}\n\n${d.explain.simple}\n\nDo this: ${d.do}\nAvoid this: ${d.dont}\n\nWhat happened: ${c0.name} (${c0.when}, ${c0.location}). ${c0.text}\n\n` +
      `What the rules say: ${qs.map(shortRef).join("; ")}.\n\nToday’s activities\n• At home — ${acts[0]}\n• At work — ${acts[1]}\n• Leaders — ${acts[2]}\n• Tech teams — ${acts[3]}\n\n` +
      `Read more: ${d.readMore.map((m) => m.org + " — " + m.ref).join(" · ")}\nFull briefing: ${link}`;
    const xHead = `Door ${n}: ${d.title}\n✅ `, xTail = `\n${link} #Cybersecurity${ai ? " #AI" : ""}`;
    const x = xHead + cut(d.do, 270 - xHead.length - xTail.length) + xTail;
    return [
      { id: "li", name: "LinkedIn", hint: "Long-form post · paste into a new post", text: li, links: [{ label: "Share the link on LinkedIn ↗", url: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(link) }] },
      { id: "wa", name: "WhatsApp · Signal", hint: "Short chat message · *bold* works in WhatsApp and Signal", text: wa, links: [{ label: "Open in WhatsApp ↗", url: "https://wa.me/?text=" + enc(wa) }] },
      { id: "em", name: "Email · Teams", hint: "Team email or Teams post · subject line included", text: "Subject: " + subj + "\n\n" + body, links: [{ label: "Open in your email app ↗", mailto: "mailto:?subject=" + enc(subj) + "&body=" + enc(body) }] },
      { id: "nl", name: "Intranet · newsletter", hint: "A short article for an intranet page or newsletter", text: nl, links: [] },
      { id: "x", name: "X · Bluesky", hint: "Under 280 characters, link included", text: x, links: [{ label: "Post on X ↗", url: "https://x.com/intent/post?text=" + enc(x) }, { label: "Post on Bluesky ↗", url: "https://bsky.app/intent/compose?text=" + enc(x) }] }
    ];
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  window.Advent = { svg, h, safeUrl, extLink, getJSON, festive, houseFestive, guardFraming, reducedMotion, STAR, store, sanitize, todayFor, quotesFor, activitiesBlock, clinker, santaState, shareKit, copyText, art, focusKey, refocus };
})();
