/* Supplier toolkit page — renders supply.json with text-only DOM building and https-only links. */
"use strict";
(() => {
  const { svg, h, extLink, getJSON, festive, guardFraming } = window.Advent;
  const CHECK = "M5 12.5l4.5 4.5L19 7.5";
  const el = (id) => document.getElementById(id);

  async function main() {
    festive("snow", "lights", 24);
    if (guardFraming()) return;
    let s;
    try { s = await getJSON("supply.json"); } catch (e) { el("stages").append(h("p", { text: "The toolkit could not load. Please refresh the page." })); return; }

    s.stages.forEach((st, i) => {
      const card = h("article", { class: "stage" },
        h("div", { class: "ch" }, h("span", { class: "badge-n", text: String(i + 1) }), h("h3", { text: st.name })),
        h("ul", {}, st.qs.map((q) => h("li", {}, h("b", { "aria-hidden": "true", text: "?" }), q))));
      card.style.animationDelay = (i * 0.08).toFixed(2) + "s";
      el("stages").append(card);
    });
    s.laws.forEach((l) => el("laws").append(h("tr", {},
      h("th", { scope: "row" }, extLink(l.url, null, l.name), h("span", { class: "ref", text: l.ref })),
      h("td", { text: l.who }), h("td", { text: l.duty }), h("td", { class: "clock", text: l.clock }))));
    s.clock.forEach((c, i) => {
      const li = h("li", {}, h("span", { class: "t", text: c.t }), h("span", { class: "h", text: c.title }), h("span", { class: "x", text: c.text }));
      li.style.animationDelay = (i * 0.1).toFixed(2) + "s";
      el("clock").append(li);
    });
    s.examples.forEach((x) => el("examples").append(h("div", { class: "ex" }, h("span", { class: "w", text: x.when }), h("span", { class: "c", text: x.chain }), h("span", { class: "x", text: x.text }))));
    s.contacts.forEach((c) => el("contacts").append(h("tr", {},
      h("th", { scope: "row", text: c.country }), h("td", {}, extLink(c.url, null, c.csirt)), h("td", { text: c.dpa }), h("td", { text: c.fin }), h("td", { text: c.crime }))));
    s.tests.forEach((t) => el("tests").append(h("div", { class: "check" }, svg(CHECK), h("span", {}, h("b", { text: t.title }), h("span", { text: t.text })))));
    s.injects.forEach((x) => el("injects").append(h("li", {}, h("b", { text: x.t }), x.text)));
    s.discuss.forEach((q) => el("discuss").append(h("span", { class: "q-item" }, h("b", { "aria-hidden": "true", text: "?" }), q)));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main); else main();
})();
