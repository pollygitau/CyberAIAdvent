/* One door a day — festive cybersecurity & AI calendar (vanilla JS, no dependencies).
   Security: no innerHTML; https-only links; strict validation of everything read from
   localStorage and the URL; progress is per-browser and never leaves the device. */
"use strict";
(() => {
  const A = window.Advent;
  const { svg, h, getJSON, festive, houseFestive, guardFraming, store, sanitize } = A;
  const P = {
    star: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z",
    check: "M5 12.5l4.5 4.5L19 7.5", x: "M7 7l10 10M17 7L7 17",
    lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
    badge: "M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.1l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z",
    left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6",
    pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
  };
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const TRACK = { ai: "AI", cyber: "CYBER", both: "AI + CYBER" };
  const AUD = [["simple", "Simple"], ["technical", "Technical"], ["business", "Business"]];
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const el = (id) => document.getElementById(id);
  const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;

  function looksValid(data) {
    return data && Array.isArray(data.days) && data.days.length === 31 && data.modes && data.stakeholders && data.icons && data.pins && data.quotes && data.audiences;
  }

  async function main() {
    festive("snow", "lights", 36);
    houseFestive("hsnow", "eave");
    if (guardFraming()) return;
    let data, settings;
    try {
      /* A missing or broken settings.json falls back to the defaults instead of stopping the calendar. */
      [data, settings] = await Promise.all([getJSON("days.json"), getJSON("settings.json").catch(() => ({}))]);
      if (!looksValid(data)) throw new Error("bad data");
      if (!settings || typeof settings !== "object") settings = {};
    } catch (err) {
      el("panel").append(h("p", { text: "The calendar could not load. Please refresh the page." }));
      return;
    }
    const DAYS = data.days, STK = data.stakeholders;
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview") === "all";
    const KEY = "cyber-advent:" + data.year;
    const saved = sanitize(store.get(KEY), data);
    const qMode = params.get("mode");
    const state = {
      mode: qMode === "advent" || qMode === "full" ? qMode : (saved.mode || (settings.defaultMode === "advent" ? "advent" : "full")),
      opened: saved.opened, answers: saved.answers, acts: saved.acts, team: saved.team, aud: saved.aud,
      country: saved.country || (data.countries.some((c) => c.id === settings.defaultCountry) ? settings.defaultCountry : "eu"),
      filter: "all", selected: 1, celebrate: false,
      follow: saved.follow === null ? settings.lockFuture !== false : saved.follow
    };
    const gamified = settings.gamified !== false;
    el("hud").hidden = !gamified;

    const today = A.todayFor(data);
    const total = () => data.modes[state.mode].doors;
    /* "Follow December dates" keeps future doors shut; switching it off opens every door for exploring.
       This is a convenience, not access control: all content is public in days.json (SECURITY.md). */
    const isLocked = (n) => state.follow && !preview && n > today;
    const correct = (n) => state.answers[n] !== undefined && state.answers[n] === DAYS[n - 1].quiz.answer;
    const wrong = (n) => state.answers[n] !== undefined && !correct(n);
    const persist = () => store.set(KEY, { mode: state.mode, opened: state.opened, answers: state.answers, acts: state.acts, team: state.team, aud: state.aud, country: state.country, follow: state.follow });
    /* Same-origin link to a door's full briefing; n is always a validated integer. */
    const briefHref = (n) => `door.html?day=${n}${state.mode === "advent" ? "&mode=advent" : ""}${preview ? "&preview=all" : ""}`;

    const asked = Number.parseInt(params.get("day") || "", 10);
    if (Number.isInteger(asked) && asked >= 1 && asked <= total() && !isLocked(asked)) state.selected = asked;
    else if (today >= 1) state.selected = Math.min(today, total()); // after Advent / after December: the last door
    if (!isLocked(state.selected)) state.opened[state.selected] = 1;

    function select(n, scroll) {
      if (!Number.isInteger(n) || n < 1 || n > total() || isLocked(n)) return;
      state.selected = n; state.opened[n] = 1; state.celebrate = false;
      persist();
      const url = new URL(window.location.href);
      url.searchParams.set("day", String(n));
      if (state.mode === "advent") url.searchParams.set("mode", "advent"); else url.searchParams.delete("mode");
      url.searchParams.delete("preview");
      if (preview) url.searchParams.set("preview", "all");
      window.history.replaceState(null, "", url);
      render();
      /* Let the doors swing open, then bring the door’s details into view below the house. */
      if (scroll) window.setTimeout(() => {
        el("panel").scrollIntoView({ behavior: A.reducedMotion() ? "auto" : "smooth", block: "start" });
        /* Move focus with the view, so keyboard and screen-reader users land on the door they opened. */
        const head = el("panel").querySelector("h2");
        if (head) { head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
      }, A.reducedMotion() ? 0 : 650);
    }

    function stats() {
      const days = DAYS.filter((d) => d.day <= total());
      let score = 0, opened = 0, top = 0;
      days.forEach((d) => {
        if (state.opened[d.day]) { opened++; score += 10; top = d.day; }
        if (correct(d.day)) { score += 20; if (state.team && d.for.includes(state.team)) score += 10; }
        for (let i = 0; i < 4; i++) if (state.acts[d.day + "-" + i]) score += 5;
      });
      let streak = 0;
      for (let n = top; n >= 1 && state.opened[n]; n--) streak++;
      const base = total() * 50; // open 10 + correct 20 + four activities × 5
      let ri = 0;
      data.ranks.forEach((r, i) => { if (score >= Math.ceil(r.share * base)) ri = i; });
      return { days, score, opened, streak, base, ri };
    }

    function renderTop(s) {
      document.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
      el("eyebrow").textContent = state.mode === "advent" ? `ADVENT CALENDAR · 1–24 DECEMBER ${data.year} · CYBERSECURITY & AI` : `31 DAYS · 1–31 DECEMBER ${data.year} · CYBERSECURITY & AI`;
      el("ics").setAttribute("href", state.mode === "advent" ? "advent-24.ics" : "days-31.ics");
      el("aicount").textContent = `${s.days.filter((d) => d.track !== "cyber").length} of ${total()} doors carry an AI lesson`;
    }

    function renderHUD(s) {
      el("score").textContent = String(s.score);
      el("opened").textContent = String(s.opened);
      el("total").textContent = String(total());
      el("streak").textContent = String(s.streak);
      el("streakunit").textContent = s.streak === 1 ? "day" : "days";
      const rank = data.ranks[s.ri], next = data.ranks[s.ri + 1];
      const lo = Math.ceil(rank.share * s.base), hi = next ? Math.ceil(next.share * s.base) : s.base;
      el("rank").textContent = rank.name;
      el("rankbar").style.width = (next ? Math.max(4, Math.round(((s.score - lo) / (hi - lo)) * 100)) : 100) + "%";
      el("rankline").textContent = next ? `${hi - s.score} pts to ${next.name}` : "Top rank reached";
      const list = el("badges"); list.replaceChildren();
      let got = 0;
      data.badges.forEach((b) => {
        let ok = false;
        if (b.first) ok = s.opened > 0; else if (b.days) ok = b.days.every(correct); else if (b.streak) ok = s.streak >= b.streak; else if (b.all) ok = s.opened === total();
        if (ok) got++;
        list.append(h("li", { class: "badge" + (ok ? " got" : ""), title: b.hint }, svg(P.badge), b.name, h("span", { class: "sr", text: ok ? " (earned)" : " (not yet earned)" })));
      });
      el("badgecount").textContent = String(got);
      renderSanta();
      const team = el("team");
      if (!team.options.length) {
        team.append(h("option", { value: "", text: "No team" }));
        Object.keys(STK).filter((id) => id !== "everyone").forEach((id) => team.append(h("option", { value: id, text: STK[id] })));
        team.addEventListener("change", () => { if (team.value === "" || Object.prototype.hasOwnProperty.call(STK, team.value)) { state.team = team.value; persist(); render(); } });
      }
      team.value = state.team;
    }

    function renderSanta() {
      const box = el("santa"); box.replaceChildren();
      const st = A.santaState(data, total(), state.answers, state.acts);
      const [verdict, tone] = st.verdict;
      box.append(
        h("div", { class: "shead2" }, h("span", { class: "stitle", text: "Santa’s list" }), h("span", { class: "verdict " + tone, text: verdict })),
        h("div", { class: "scol" }, h("span", { class: "sk nice", text: `NICE LIST · ${st.nice.length}` }),
          st.nice.slice(-4).reverse().map((e) => h("span", { class: "entry nice" }, h("b", { "aria-hidden": "true", text: "✓" }), e.t)),
          st.nice.length > 4 ? h("span", { class: "more", text: `+ ${st.nice.length - 4} more good ${st.nice.length - 4 === 1 ? "deed" : "deeds"}` }) : null,
          st.nice.length ? null : h("span", { class: "empty", text: "Nothing yet. Answer a challenge correctly or tick off all four activities on a door." })),
        h("div", { class: "scol" }, h("span", { class: "sk naughty", text: `NAUGHTY LIST · ${st.naughty.length} · KEPT BY CLINKER` }),
          st.naughty.slice(-3).reverse().map((e) => h("button", { type: "button", class: "entry naughty", "data-k": "naughty-" + e.n, onclick: () => select(e.n, true) }, h("b", { "aria-hidden": "true", text: "✗" }), h("span", {}, e.t + " ", h("span", { class: "redeem", text: "Redeem →" })))),
          st.naughty.length ? null : h("span", { class: "empty", text: "Empty. Clinker is sulking." })),
        h("p", { class: "how", text: "A correct answer, or all four activities on a door, puts you on the Nice list. A wrong answer goes on the Naughty list until you redeem it by ticking off all four of that door’s activities." }));
    }

    function renderChips(s) {
      const row = el("chips"); row.replaceChildren();
      [{ id: "all", name: "All", count: total() }].concat(Object.keys(STK).map((id) => ({ id, name: STK[id], count: s.days.filter((d) => d.for.includes(id)).length })))
        .filter((c) => c.count > 0)
        .forEach((c) => row.append(h("button", { type: "button", class: "chip", "aria-pressed": String(state.filter === c.id), "data-k": "chip-" + c.id, onclick: () => { state.filter = c.id; render(); } }, c.name, h("small", { text: String(c.count) }))));
    }

    /* Door cards on the calendar wall: double-leaf doors in a winter palette. Opening swings both
       leaves apart onto the explored card (title, who it is for, points and status). */
    const PAL = ["cream", "brick", "sage", "tan", "pine", "cream", "green", "sage", "brick", "cream", "pine", "tan"];
    const LOCK = "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3";
    function bow() {
      return A.art("0 0 40 24", [["path", { d: "M20 12L4 3Q0 2 1 7L3 18Q4 21 8 19Z M20 12L36 3Q40 2 39 7L37 18Q36 21 32 19Z", fill: "#B3202F" }], ["circle", { cx: 20, cy: 12, r: 4.5, fill: "#8E1622" }], ["path", { d: "M18 15L13 24M22 15L27 24", stroke: "#B3202F", "stroke-width": 3, "stroke-linecap": "round" }]], "bw");
    }
    function face(n, d, locked, big) {
      return h("span", { class: "face" },
        h("span", { class: "pl" }), h("span", { class: "pr" }), h("span", { class: "seam" }), h("span", { class: "kn" }), h("span", { class: "stt", text: "✦" }),
        locked ? svg(LOCK, "lk") : null, big ? bow() : null,
        h("span", { class: "mo", text: "DECEMBER" }), h("span", { class: "nu", text: pad(n) }),
        svg(data.icons[d.icon] || P.star, "ic"), h("span", { class: "tt", text: d.title }), h("span", { class: "ca", text: d.topic }));
    }
    function renderDoors() {
      const grid = el("doors"); grid.replaceChildren();
      grid.className = "cards" + (state.mode === "advent" ? " m-advent" : "");
      const big = data.modes[state.mode].big;
      DAYS.filter((d) => d.day <= total()).forEach((d) => {
        const n = d.day, open = !!state.opened[n], locked = isLocked(n), isBig = big.includes(n);
        const acts = [0, 1, 2, 3].filter((i) => state.acts[n + "-" + i]).length;
        const pts = (open ? 10 : 0) + (correct(n) ? 20 : 0) + acts * 5, done = pts >= 50;
        const cls = ["card", "p-" + PAL[(n - 1) % PAL.length], open && "open", done && "done", n === state.selected && "sel", locked && "locked", state.filter !== "all" && !d.for.includes(state.filter) && "dim"].filter(Boolean).join(" ");
        grid.append(h("button", { type: "button", class: cls, disabled: locked, "aria-pressed": String(n === state.selected), "data-k": "door-" + n,
          "aria-label": `Door ${n}: ${d.title}${locked ? ", locked until " + n + " December" : ""}${open ? ", opened" : ""}${d.track !== "cyber" ? ", AI label" : ""}`, onclick: () => select(n, true) },
          h("span", { class: "inside", "aria-hidden": "true" },
            done ? h("span", { class: "tick", text: "✓" }) : null, wrong(n) ? h("span", { class: "ntag", text: "NAUGHTY" }) : null,
            h("span", { class: "sp", text: "✦" }), h("span", { class: "it", text: d.title }),
            h("span", { class: "if", text: d.for.slice(0, 2).map((id) => STK[id]).join(" · ") }),
            h("span", { class: "is", text: done ? "50 pts · fully explored ✓" : `${pts} of 50 pts · Play the day →` })),
          h("span", { class: "leaf l", "aria-hidden": "true" }, face(n, d, locked, isBig)),
          h("span", { class: "leaf r", "aria-hidden": "true" }, face(n, d, locked, isBig))));
      });
      if (total() === 31) grid.append(h("div", { class: "spare", "aria-hidden": "true" }, h("span", { class: "a", text: "✦" }), h("span", { class: "b", text: "Merry, safe & secure" }), h("span", { class: "c", text: "2027 AWAITS" })));
      el("boardsub").textContent = `Cyber & AI · ${total()} days of cyber, AI & privacy hygiene`;
      const f = el("follow");
      f.setAttribute("aria-checked", String(state.follow));
      el("locknote").textContent = state.follow
        ? (today < 1 ? "Doors open one a day from 1 December. Switch off to explore early."
          : today > total() ? `All ${total()} doors are open — catch up on any you missed.` : `Following December dates · today is door ${today}.`)
        : (today < 1 ? "A little early? Explore freely — every door is open." : "Exploring freely — every door is open.");
    }

    /* The Naughty list Clinker keeps in the attic: doors answered wrongly and not yet redeemed. */
    function renderScroll() {
      const box = el("scroll"); box.replaceChildren();
      const naughty = A.santaState(data, total(), state.answers, state.acts).naughty;
      box.append(h("span", { class: "st", text: "NAUGHTY LIST" }), h("span", { class: "sh", text: naughty.length ? "DOORS TO REDEEM" : "CLINKER IS WATCHING FOR" }));
      if (naughty.length) naughty.slice(-3).reverse().forEach((e) => box.append(h("button", { type: "button", class: "si", "data-k": "scroll-" + e.n, onclick: () => select(e.n, true) }, h("b", { "aria-hidden": "true", text: "✗ " }), DAYS[e.n - 1].title)));
      else ["Password reuse", "Oversharing", "Blind AI trust"].forEach((t) => box.append(h("span", { class: "si", text: "☐ " + t })));
    }

    function renderMap() {
      const d = DAYS[state.selected - 1];
      const active = new Set(d.cases.map((c) => c.pin).filter(Boolean));
      const doorsAt = {};
      DAYS.filter((x) => x.day <= total()).forEach((x) => x.cases.forEach((c) => { if (c.pin && data.pins[c.pin]) { (doorsAt[c.pin] = doorsAt[c.pin] || new Set()).add(x.day); } }));
      const map = el("map");
      map.querySelectorAll(".pin").forEach((p) => p.remove());
      const places = el("places"); places.replaceChildren();
      Object.keys(data.pins).filter((id) => doorsAt[id]).forEach((id) => {
        const p = data.pins[id], on = active.has(id), list = [...doorsAt[id]].sort((a, b) => a - b);
        const pin = h("span", { class: "pin" + (on ? " on" : ""), "aria-hidden": "true" }, h("span", { class: "ring" }), h("span", { class: "dot" }), h("span", { class: "lbl", text: p.short }));
        pin.style.left = Number(p.left) + "%"; pin.style.top = Number(p.top) + "%";
        map.append(pin);
        places.append(h("button", { type: "button", class: "place" + (on ? " on" : ""), "data-k": "place-" + id, onclick: () => { const nxt = list.find((n) => n > state.selected && !isLocked(n)) || list.find((n) => !isLocked(n)); if (nxt) select(nxt, true); } },
          h("span", { class: "n", text: p.name }), h("span", { class: "d", text: (list.length > 1 ? "Doors " : "Door ") + list.join(" · ") })));
      });
    }

    function quiz(n, d) {
      const answered = state.answers[n] !== undefined, chosen = state.answers[n], ok = answered && chosen === d.quiz.answer;
      const box = h("div", { class: "quiz" + (answered && !ok && state.celebrate ? " shake" : "") },
        h("div", { class: "qhead" }, h("strong", { text: "CHALLENGE" }), h("span", { text: "+20 PTS" })),
        h("p", { class: "q", text: d.quiz.question }));
      const opts = h("div", { class: "opts", role: "group", "aria-label": "Answers" });
      d.quiz.options.forEach((text, i) => {
        const right = i === d.quiz.answer, mine = answered && i === chosen;
        const cls = ["opt", answered && right && "right", mine && !right && "mine", answered && !right && !mine && "faded"].filter(Boolean).join(" ");
        opts.append(h("button", { type: "button", class: cls, disabled: answered, "data-k": "opt-" + i, onclick: () => { if (state.answers[n] !== undefined) return; state.answers[n] = i; state.opened[n] = 1; state.celebrate = true; persist(); render(); } },
          h("span", { class: "letter", "aria-hidden": "true", text: "ABC"[i] }), h("span", { class: "txt", text }),
          answered && right ? svg(P.check, null, "Correct answer") : null, mine && !right ? svg(P.x, null, "Your answer") : null));
      });
      box.append(opts);
      if (ok && state.celebrate && !A.reducedMotion()) {
        const c = h("div", { class: "confetti", "aria-hidden": "true" });
        const cols = ["#F5C451", "#FF6B6B", "#9EE6C4", "#F8F3E9"], anims = ["confA", "confB", "confC", "confD"];
        for (let i = 0; i < 20; i++) {
          const piece = document.createElement("i");
          piece.style.width = (i % 3 ? 8 : 6) + "px"; piece.style.height = (i % 2 ? 12 : 8) + "px";
          piece.style.borderRadius = i % 4 === 0 ? "99px" : "2px"; piece.style.background = cols[i % 4];
          piece.style.animationName = anims[i % 4]; piece.style.animationDuration = (1.1 + (i % 5) * 0.12).toFixed(2) + "s"; piece.style.animationDelay = (i * 0.025).toFixed(3) + "s";
          c.append(piece);
        }
        c.append(h("span", { class: "plus", text: "+20" }));
        box.append(c);
      }
      if (answered) {
        const bonus = ok && state.team && d.for.includes(state.team);
        box.append(h("div", { class: "explain" },
          ok ? null : A.clinker(n + chosen, A.santaState(data, total(), state.answers, state.acts).status(n).line),
          h("p", { class: "res" + (ok ? " ok" : ""), tabindex: "-1", "data-k": "res", text: ok ? `Correct · +20 pts${bonus ? " · +10 team bonus" : ""}` : "Not quite — the safe move is marked. Here’s why, in the words that suit you." }),
          h("div", { class: "bar2" }, h("span", { class: "k", text: ok ? "WHY IT MATTERS" : "HERE’S WHY" }),
            h("div", { class: "aud", role: "group", "aria-label": "Explain it for" }, AUD.map(([id, name]) => h("button", { type: "button", "aria-pressed": String(state.aud === id), "data-k": "aud-" + id, onclick: () => { state.aud = id; state.celebrate = false; persist(); render(); } }, name)))),
          h("p", { class: "txt", text: d.explain[state.aud] || d.explain.simple }),
          h("div", { class: "further" }, h("span", { class: "k", text: "FURTHER READING" }), d.readMore.slice(0, 2).map((m) => A.extLink(m.url, null, `${m.org} — ${m.ref} ↗`)))));
      }
      return box;
    }

    function renderPanel() {
      const p = el("panel"); p.replaceChildren();
      const n = state.selected, d = DAYS[n - 1];
      if (isLocked(n)) {
        p.append(h("div", { class: "locked-msg" }, svg(P.lock), h("h2", { text: `Door ${n} opens on ${n} December` }), h("p", { text: "No peeking. Come back on the day — or add the calendar reminders (the link just below the house) and each door will tell you when it opens." })));
        return;
      }
      const dt = new Date(data.year, data.month - 1, n), occ = data.occasions[n], isAI = d.track !== "cyber";
      const c0 = d.cases[0], qs = A.quotesFor(data, d);
      p.append(
        h("div", { class: "head" },
          h("div", { class: "ornament o" + (n % 4), "aria-hidden": "true" }, h("span", { class: "string" }), h("span", { class: "cap" }), h("span", { class: "ball" }, svg(data.icons[d.icon] || P.star)), h("span", { class: "shine" })),
          h("div", { class: "stack" },
            h("div", { class: "meta" }, h("span", { text: `DOOR ${pad(n)} OF ${total()}` }), h("span", { "aria-hidden": "true", text: "·" }), h("span", { text: `${WD[dt.getDay()].toUpperCase()} ${n} DECEMBER${occ ? " · " + occ.toUpperCase() : ""}` })),
            h("h2", { text: d.title }),
            h("div", { class: "labels" }, h("span", { class: "track" + (isAI ? " ai" : "") }, isAI ? svg(P.star) : null, TRACK[d.track]), h("span", { class: "topic", text: d.topic })),
            h("div", { class: "for" }, h("span", { class: "k", text: "FOR" }), d.for.map((id) => h("span", { class: "who", text: STK[id] }))))),
        h("div", { class: "stack" },
          h("div", { class: "dd" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.check)), h("div", {}, h("span", { class: "lbl", text: "NICE LIST · DO" }), h("p", { text: d.do }))),
          h("div", { class: "dd dont" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.x)), h("div", {}, h("span", { class: "lbl", text: "NAUGHTY LIST · DON’T" }), h("p", { text: d.dont }))))
      );
      if (gamified) p.append(quiz(n, d));
      p.append(A.activitiesBlock({ data, n, d, acts: state.acts, gamified, P, note: gamified ? A.santaState(data, total(), state.answers, state.acts).status(n).note : null,
        onToggle: (i, on) => { const k = n + "-" + i; if (on) state.acts[k] = 1; else delete state.acts[k]; state.opened[n] = 1; state.celebrate = false; persist(); render(); } }));
      p.append(
        h("article", { class: "case headline" },
          h("div", { class: "cmeta" }, h("span", { class: "kind " + String(c0.kind).replace(/[^A-Za-z]/g, ""), text: "LESSON LEARNT" }), h("span", { text: c0.when }), h("span", { class: "loc" }, svg(P.pin), c0.location)),
          h("h4", { text: c0.name }), h("p", { class: "clamp", text: c0.text })),
        h("a", { class: "brief-cta", href: briefHref(n) },
          h("span", { class: "bt" }, h("strong", { text: "Open the full briefing" }),
            h("span", { text: `${plural(qs.length, "rule excerpt", "rule excerpts")} · ${plural(d.cases.length, "case study", "case studies")} · incident lab · share kit` })),
          h("span", { class: "arr", "aria-hidden": "true", text: "→" })),
        h("div", { class: "nav" },
          h("button", { type: "button", class: "sq", "aria-label": "Previous door", "data-k": "prev", disabled: n <= 1, onclick: () => select(n - 1) }, svg(P.left)),
          h("button", { type: "button", class: "sq", "aria-label": "Next door", "data-k": "next", disabled: n >= total() || isLocked(n + 1), onclick: () => select(n + 1) }, svg(P.right)),
          h("span", { class: "grow" }),
          h("a", { class: "share", href: briefHref(n) + "#share", text: "Share kit for 5 channels" }),
          h("button", { type: "button", class: "back-up", onclick: () => {
            el("house").scrollIntoView({ behavior: A.reducedMotion() ? "auto" : "smooth", block: "start" });
            const card = document.querySelector("#doors .card.sel");
            if (card) card.focus({ preventScroll: true });
          } }, "↑ Back to the house")));
    }

    /* After an answer the options are disabled, so focus moves to the result; at either end of the
       calendar the disabled arrow hands focus to the other one. */
    const FOCUS_FALLBACK = (k) => (k.startsWith("opt-") ? "res" : k === "next" ? "prev" : k === "prev" ? "next" : null);
    function render() {
      const focused = A.focusKey();
      if (state.selected > total()) state.selected = total();
      const s = stats();
      renderTop(s);
      if (gamified) renderHUD(s);
      renderChips(s);
      renderDoors();
      renderScroll();
      renderMap();
      renderPanel();
      A.refocus(focused, FOCUS_FALLBACK);
    }

    /* Keep several open tabs in step: progress saved in one tab is picked up by the others, instead of
       the next save in a stale tab silently overwriting it. */
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== KEY) return;
      const fresh = sanitize(store.get(KEY), data);
      Object.assign(state, { opened: fresh.opened, answers: fresh.answers, acts: fresh.acts, team: fresh.team, aud: fresh.aud, celebrate: false });
      if (fresh.country) state.country = fresh.country;
      if (fresh.follow !== null) state.follow = fresh.follow;
      render();
    });

    document.querySelectorAll("#mode button").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.mode !== "advent" && b.dataset.mode !== "full") return;
      state.mode = b.dataset.mode; state.celebrate = false; persist(); render();
    }));
    el("follow").addEventListener("click", () => { state.follow = !state.follow; state.celebrate = false; persist(); render(); });
    /* Resetting erases points, answers and Santa's list, so it takes a second click within five seconds. */
    const reset = el("reset"), RESET_LABEL = "Reset my progress";
    let armed = 0;
    reset.textContent = RESET_LABEL;
    reset.addEventListener("click", () => {
      if (!armed) {
        reset.textContent = "Click again to erase your points, answers and Santa’s list";
        armed = window.setTimeout(() => { armed = 0; reset.textContent = RESET_LABEL; }, 5000);
        return;
      }
      window.clearTimeout(armed); armed = 0; reset.textContent = RESET_LABEL;
      state.opened = {}; state.answers = {}; state.acts = {}; state.celebrate = false;
      state.selected = Math.min(Math.max(today, 1), total());
      persist(); render();
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main); else main();
})();
