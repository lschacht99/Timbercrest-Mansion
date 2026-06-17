/* Shared behavior for every page: mobile menu toggle, universal search. */
(function () {
  // ---- Mobile menu ----
  document.addEventListener("click", function (e) {
    const t = e.target.closest("[data-toggle]");
    if (t) {
      const el = document.getElementById(t.getAttribute("data-toggle"));
      if (el) el.classList.toggle("hidden");
    }
    // close search panel when clicking outside
    const sp = document.getElementById("search-panel");
    if (sp && !sp.classList.contains("hidden") && !e.target.closest("#search-wrap")) {
      sp.classList.add("hidden");
    }
  });

  // ---- Universal search (home) ----
  const input = document.getElementById("usearch");
  if (input) {
    const panel = document.getElementById("search-panel");
    const results = document.getElementById("search-results");
    const D = window.TC;
    const render = (q) => {
      q = q.trim().toLowerCase();
      if (!q) { panel.classList.add("hidden"); return; }
      const stays = D.PROPERTIES.filter((p) => (p.name + p.blurb + p.city).toLowerCase().includes(q));
      const evts = D.EVENTS.filter((e) => (e.name + e.hint).toLowerCase().includes(q));
      const acts = D.ACTIVITIES.filter((a) => (a.name + a.q).toLowerCase().includes(q));
      let html = "";
      if (stays.length) {
        html += group("Stays") + stays.map((p) =>
          `<a href="stays/${p.id}.html" class="srow"><span class="sdot" style="--g1:${p.g1};--g2:${p.g2}"></span><span><b>${p.name}</b><small>${p.blurb}</small></span></a>`).join("");
      }
      if (evts.length) {
        html += group("Events & weddings") + evts.map((e) =>
          `<a href="events.html" class="srow"><span class="sdot" style="--g1:#92400e;--g2:#451a03"></span><span><b>${e.name}</b><small>${e.hint}</small></span></a>`).join("");
      }
      if (acts.length) {
        html += group("Things to do · where to go") + acts.map((a) =>
          `<a href="area.html" class="srow"><span class="sdot" style="--g1:#57534e;--g2:#292524"></span><span><b>${a.name}</b><small>${a.season}</small></span></a>`).join("");
      }
      if (!html) html = `<div style="padding:1rem;color:#78716c;font-size:.9rem">No matches — try "pool", "wedding", "skiing".</div>`;
      results.innerHTML = html;
      panel.classList.remove("hidden");
    };
    const group = (t) => `<div class="sgroup">${t}</div>`;
    input.addEventListener("input", (e) => render(e.target.value));
    input.addEventListener("focus", (e) => render(e.target.value));
  }
})();

/* Isolated fast-book toolbar behavior. */
(() => {
  if (window.__FS_TOOLBAR_BEHAVIOR__) return;
  window.__FS_TOOLBAR_BEHAVIOR__ = true;
  const toolbar = document.querySelector("[data-fs-toolbar]");
  if (!toolbar) return;
  const openBtn = toolbar.querySelector("[data-fs-toolbar-open]");
  const closeBtn = toolbar.querySelector("[data-fs-toolbar-close]");
  const tabs = toolbar.querySelectorAll("[data-fs-tab]");
  let isOpen = false;
  let ticking = false;
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;
  function updateCompactState() {
    toolbar.classList.toggle("is-compact", window.scrollY > 56);
  }
  function setOpen(value) {
    isOpen = value;
    toolbar.classList.toggle("is-open", isOpen);
    document.documentElement.classList.toggle("fs-toolbar-lock", isOpen && isMobile());
    if (!isOpen) { updateCompactState(); return; }
    const firstFocusable = toolbar.querySelector(".fs-toolbar-panel a, .fs-toolbar-panel button");
    if (firstFocusable) window.setTimeout(() => firstFocusable.focus({ preventScroll: true }), 80);
  }
  function requestCompactUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      if (!isOpen) updateCompactState();
      ticking = false;
    });
  }
  openBtn?.addEventListener("click", () => setOpen(true));
  closeBtn?.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
  }));
  window.addEventListener("scroll", requestCompactUpdate, { passive: true });
  window.addEventListener("resize", () => {
    document.documentElement.classList.toggle("fs-toolbar-lock", isOpen && isMobile());
    updateCompactState();
  });
  updateCompactState();
})();
