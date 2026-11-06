/* Full briefing for one door: why it matters, verbatim rule excerpts, activities for every
   audience, all case studies, the whole incident lab, a share kit and further reading.
   Same security model as the calendar: textContent only, https-only links, validated input. */
"use strict";
(() => {
  const A = window.Advent;
  const { svg, h, extLink, getJSON, festive, guardFraming, store, sanitize } = A;
  const P = {
    star: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z",
    check: "M5 12.5l4.5 4.5L19 7.5", x: "M7 7l10 10M17 7L7 17",
    lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
    pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  };
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const TRACK = { ai: "AI", cyber: "CYBER", both: "AI + CYBER" };
  const WHY = [["simple", "SIMPLE · FOR EVERYONE"], ["technical", "TECHNICAL · FOR IT AND SECURITY"], ["business", "BUSINESS · FOR LEADERS"]];
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const root = () => document.getElementById("brief");

  const sec = (title, note, ...kids) => h("section", { class: "bf-sec", "aria-label": title },
    h("div", { class: "shead" }, h("h2", { class: "h3", text: title }), note ? h("span", { class: "note", text: note }) : null), ...kids);

  function shareKitBlock(channels) {
    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Channel" });
    const hint = h("span", {}), count = h("span", { class: "count" });
    const ta = h("textarea", { class: "kit-text", readonly: true, rows: "12", "aria-label": "Summary to share" });
    const copy = h("button", { type: "button", class: "copy", text: "Copy text" });
    const links = h("div", { class: "kit-links" });
    function show(i) {
      const c = channels[i];
      tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
      hint.textContent = c.hint;
      count.textContent = c.id === "x" ? `${c.text.length}/280 characters` : `${c.text.length} characters`;
      ta.value = c.text;
      copy.textContent = "Copy text";
      links.replaceChildren(...c.links.map((l) => (l.mailto ? h("a", { class: "share", href: l.mailto, text: l.label }) : extLink(l.url, "share", l.label))));
    }
    channels.forEach((c, i) => tabs.append(h("button", { type: "button", role: "tab", onclick: () => show(i) }, c.name)));
    copy.addEventListener("click", async () => {
      if (await A.copyText(ta.value)) copy.textContent = "Copied ✓";
      else { ta.focus(); ta.select(); copy.textContent = "Selected — press Ctrl+C or ⌘C"; }
    });
    show(0);
    return h("section", { class: "kit", id: "share", "aria-label": "Share kit" },
      h("div", { class: "shead" }, h("h2", { class: "h3", text: "SHARE KIT · A SUMMARY FOR EVERY CHANNEL" }), h("span", { class: "note", text: "Check the text and add your name before posting" })),
      tabs, h("div", { class: "meta2" }, hint, count), ta, h("div", { class: "kit-links" }, copy, links));
  }

  function labFull(d) {
    const L = d.lab, c0 = d.cases[0];
    return h("section", { class: "lab full", "aria-label": "Incident lab" },
      h("div", { class: "lhead" }, h("h2", { class: "h3", text: "INCIDENT LAB" }), h("span", { class: "basis", text: `Based on: ${c0.name} (${c0.when})` })),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "TIMELINE · WHAT HAPPENED" }),
        h("ol", { class: "timeline" }, L.timeline.map((e) => h("li", {}, h("span", { class: "when", text: e.when }), h("span", { class: "what", text: e.what }))))),
      h("div", { class: "lsec two" },
        h("div", { class: "stack" }, h("span", { class: "lk", text: "HOW IT COULD HAVE BEEN PREVENTED" }), L.prevent.map((t) => h("span", { class: "li" }, svg(P.shield), t))),
        h("div", { class: "stack" }, h("span", { class: "lk", text: "HOW IT COULD HAVE BEEN DETECTED" }), L.detect.map((t) => h("span", { class: "li" }, svg(P.eye), t)))),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "AFTER IT · TUNE DETECTION (ILLUSTRATIVE — ADAPT TO YOUR SIEM OR EDR)" }), L.tune.map((t) => h("code", { class: "rule", text: t }))),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "RESPONSE PLAYBOOK" }), h("ol", { class: "steps" }, L.playbook.map((t) => h("li", { text: t })))),
      h("div", { class: "lsec" },
        h("div", { class: "inject" }, h("span", { class: "lk", text: "TABLETOP · 20-MINUTE INJECT" }), h("p", { text: L.tabletop.inject })),
        h("span", { class: "lk", text: "DISCUSS" }), L.tabletop.questions.map((q) => h("span", { class: "q-item" }, h("b", { "aria-hidden": "true", text: "?" }), q)),
        h("span", { class: "roles", text: "Roles: incident lead · IT & security · legal & privacy · comms · business owner. Capture decisions, owners and gaps — then update the playbook." })),
      d.day === 22 || d.day === 23 ? h("a", { class: "cta", href: "supply.html" }, "Open the supplier toolkit →") : null);
  }

  function lens(data, d, state, persist, rerender) {
    const box = h("section", { class: "lens", "aria-label": "Country lens" });
    const sel = h("select", { id: "country", "data-k": "country" });
    data.countries.forEach((c) => sel.append(h("option", { value: c.id, text: c.name })));
    sel.value = state.country;
    sel.addEventListener("change", () => { if (data.countries.some((c) => c.id === sel.value)) { state.country = sel.value; persist(); rerender(); } });
    box.append(h("div", { class: "lhead" }, h("label", { class: "h3", for: "country", text: "COUNTRY LENS" }), sel));
    const nat = data.national[state.country];
    if (state.country === "eu" || !nat) box.append(h("span", { class: "title", text: "EU baseline" }), h("span", { class: "t", text: "NIS2, DORA, GDPR, the Cyber Resilience Act and the EU AI Act set the common floor. Pick a country to see national standards and authorities." }));
    else box.append(h("span", { class: "title", text: nat.auth }), h("span", { class: "t", text: nat[d.category] || nat.general }), extLink(nat.url, null, String(nat.url).replace("https://", "") + " ↗"));
    return box;
  }

  async function main() {
    festive("snow", "lights", 24);
    if (guardFraming()) return;
    let data, settings;
    try {
      [data, settings] = await Promise.all([getJSON("days.json"), getJSON("settings.json").catch(() => ({}))]);
      if (!data || !Array.isArray(data.days) || data.days.length !== 31 || !data.quotes) throw new Error("bad data");
      if (!settings || typeof settings !== "object") settings = {};
    } catch (err) {
      root().append(h("p", { text: "This briefing could not load. Please refresh the page." }));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview") === "all";
    const KEY = "cyber-advent:" + data.year;
    const saved = sanitize(store.get(KEY), data);
    const qMode = params.get("mode");
    const mode = qMode === "advent" || qMode === "full" ? qMode : (saved.mode || (settings.defaultMode === "advent" ? "advent" : "full"));
    const total = data.modes[mode].doors;
    const today = A.todayFor(data);
    let follow = saved.follow === null ? settings.lockFuture !== false : saved.follow;
    const isLocked = (n) => follow && !preview && n > today;
    const state = { ...saved, country: saved.country || (data.countries.some((c) => c.id === settings.defaultCountry) ? settings.defaultCountry : "eu") };
    /* Mode and the Follow switch belong to the calendar page: re-read them at save time so a stale copy
       from when this page loaded never overwrites a newer choice made in another tab. */
    const persist = () => {
      const cur = sanitize(store.get(KEY), data);
      store.set(KEY, { mode: cur.mode, opened: state.opened, answers: state.answers, acts: state.acts, team: state.team, aud: state.aud, country: state.country, follow: cur.follow });
    };
    const q = (n) => `?day=${n}${mode === "advent" ? "&mode=advent" : ""}${preview ? "&preview=all" : ""}`;

    let n = Number.parseInt(params.get("day") || "", 10);
    if (!Number.isInteger(n) || n < 1 || n > total) n = today >= 1 ? Math.min(today, total) : 1;
    const d = data.days[n - 1];

    function render() {
      const focused = A.focusKey();
      const r = root(); r.replaceChildren();
      const bar = h("nav", { class: "bf-bar", "aria-label": "Briefing navigation" },
        h("a", { class: "back", href: "index.html" + q(n) }, "← Back to the calendar"),
        h("span", { class: "grow" }),
        h("span", { class: "pos", text: `FULL BRIEFING · DOOR ${n} OF ${total}` }),
        n > 1 ? h("a", { class: "sq", href: "door.html" + q(n - 1), "aria-label": "Previous door" }, "←") : null,
        n < total && !isLocked(n + 1) ? h("a", { class: "sq", href: "door.html" + q(n + 1), "aria-label": "Next door" }, "→") : null,
        h("button", { type: "button", class: "ghost", onclick: () => window.print() }, "Print or save as PDF"));
      r.append(bar);
      if (isLocked(n)) {
        r.append(h("div", { class: "locked-msg" }, svg(P.lock), h("h1", { text: `Door ${n} opens on ${n} December` }), h("p", { text: "No peeking — the briefing unlocks on the day. To explore early, switch off “Follow December dates” on the calendar." })));
        return;
      }
      if (!state.opened[n]) { state.opened[n] = 1; persist(); } // write only when something changed
      document.title = `Door ${n}: ${d.title} · Winterwatch`;
      const dt = new Date(data.year, data.month - 1, n), occ = data.occasions[n], isAI = d.track !== "cyber";
      r.append(h("header", { class: "bf-hero" },
        h("div", { class: "ornament o" + (n % 4), "aria-hidden": "true" }, h("span", { class: "string" }), h("span", { class: "cap" }), h("span", { class: "ball" }, svg(data.icons[d.icon] || P.star)), h("span", { class: "shine" })),
        h("div", { class: "stack" },
          h("div", { class: "meta" }, h("span", { text: `DOOR ${pad(n)} OF ${total}` }), h("span", { "aria-hidden": "true", text: "·" }), h("span", { text: `${WD[dt.getDay()].toUpperCase()} ${n} DECEMBER ${data.year}${occ ? " · " + occ.toUpperCase() : ""}` })),
          h("h1", { text: d.title }),
          h("div", { class: "labels" }, h("span", { class: "track" + (isAI ? " ai" : "") }, isAI ? svg(P.star) : null, TRACK[d.track]), h("span", { class: "topic", text: d.topic })),
          h("div", { class: "for" }, h("span", { class: "k", text: "FOR" }), d.for.map((id) => h("span", { class: "who", text: data.stakeholders[id] }))))));
      r.append(h("div", { class: "two" },
        h("div", { class: "dd" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.check)), h("div", {}, h("span", { class: "lbl", text: "NICE LIST · DO" }), h("p", { text: d.do }))),
        h("div", { class: "dd dont" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.x)), h("div", {}, h("span", { class: "lbl", text: "NAUGHTY LIST · DON’T" }), h("p", { text: d.dont })))));
      r.append(sec("WHY IT MATTERS · THREE WAYS TO EXPLAIN IT", null,
        h("div", { class: "why" }, WHY.map(([k, label]) => h("div", {}, h("span", { class: "lk", text: label }), h("p", { text: d.explain[k] }))))));
      r.append(sec("WHAT THE RULES AND STANDARDS SAY", "Verbatim excerpts · […] marks a cut · not legal advice",
        A.quotesFor(data, d).map((qt) => h("figure", { class: "quote " + String(qt.src).replace(/[^A-Za-z0-9]/g, "") },
          h("div", { class: "qmeta" }, h("span", { class: "src", text: qt.src }), h("span", { class: "qref", text: qt.ref })),
          h("blockquote", { text: `“${qt.text}”` }),
          qt.note ? h("p", { class: "qnote", text: qt.note }) : null,
          extLink(qt.url, null, "Read the official text ↗")))));
      r.append(A.activitiesBlock({ data, n, d, acts: state.acts, gamified: settings.gamified !== false, P, note: A.santaState(data, total, state.answers, state.acts).status(n).note,
        onToggle: (i, on) => { const k = n + "-" + i; if (on) state.acts[k] = 1; else delete state.acts[k]; persist(); render(); } }));
      r.append(sec("CASE STUDIES · LESSONS LEARNT", null,
        h("div", { class: "cases-grid" }, d.cases.map((c) => h("article", { class: "case" },
          h("div", { class: "cmeta" }, h("span", { class: "kind " + String(c.kind).replace(/[^A-Za-z]/g, ""), text: String(c.kind).toUpperCase() }), h("span", { text: c.when }), h("span", { class: "loc" }, svg(P.pin), c.location)),
          h("h3", { class: "h4", text: c.name }), h("p", { text: c.text }), h("span", { class: "src", text: "Source: " + c.source }))))));
      r.append(labFull(d));
      /* The public link never carries ?preview=all: an organiser previewing in November must not hand
         everyone who clicks a shared post a way round the one-door-a-day lock. */
      const link = new URL(`index.html?day=${n}${mode === "advent" ? "&mode=advent" : ""}`, window.location.href).toString();
      r.append(shareKitBlock(A.shareKit(data, d, total, link)));
      r.append(sec("READ MORE AT THE SOURCE", null,
        d.readMore.map((m) => extLink(m.url, "rm", h("span", { class: "top2" }, h("span", { class: "org", text: m.org }), h("span", { class: "ref", text: m.ref })), h("span", { class: "t", text: m.text }), h("span", { class: "go", text: "Read at source ↗" })))));
      r.append(lens(data, d, state, persist, render));
      r.append(h("div", { class: "refs" }, h("span", { class: "k", text: "GROUNDED IN" }), h("span", { class: "txt", text: d.refs }),
        d.owasp.length ? h("div", { class: "codes" }, d.owasp.map((c) => h("span", { class: "code", text: "OWASP " + c }))) : null));
      r.append(h("a", { class: "brief-cta", href: "index.html" + q(n) },
        h("span", { class: "bt" }, h("strong", { text: "Take today’s 20-second challenge" }), h("span", { text: "+20 pts in the calendar — and Clinker is waiting for wrong answers" })),
        h("span", { class: "arr", "aria-hidden": "true", text: "→" })));
      if (window.location.hash === "#share" && !focused) { const s = document.getElementById("share"); if (s) s.scrollIntoView(); }
      A.refocus(focused);
    }
    /* Pick up progress saved in another tab (see app.js). */
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== KEY) return;
      const fresh = sanitize(store.get(KEY), data);
      Object.assign(state, { opened: fresh.opened, answers: fresh.answers, acts: fresh.acts, team: fresh.team, aud: fresh.aud, country: fresh.country || state.country });
      follow = fresh.follow === null ? settings.lockFuture !== false : fresh.follow;
      render();
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main); else main();
})();
