/* Shared behavior for every page: mobile menu toggle, universal search. */
(function () {
  // ---- Scroll-aware navbar ----
  (function () {
    const hdr = document.querySelector("header");
    if (!hdr) return;
    let last = 0, ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          const y = window.scrollY;
          hdr.classList.toggle("nav-scrolled", y > 10);
          if (y > 80) {
            hdr.classList.toggle("nav-hidden", y > last + 4);
            if (y < last - 4) hdr.classList.remove("nav-hidden");
          } else {
            hdr.classList.remove("nav-hidden");
          }
          last = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  })();

  // ---- Airbnb-style search bar (injected into the toolbar on every page) ----
  (function () {
    const D = window.TC;
    const header = document.querySelector("header > div");
    if (!header || !D || !D.PROPERTIES) return;

    const state = { ids: [], checkIn: "", checkOut: "", adults: 2, children: 0, pets: 0 };
    const fmtDate = (s) => s ? new Date(s + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

    const wrap = document.createElement("div");
    wrap.className = "tcsearch-wrap hidden md:block";
    wrap.innerHTML = `
      <div class="tcsearch" role="search">
        <div class="tcsearch-seg" data-seg="where">
          <span class="lbl">Where</span><span class="val placeholder" data-v="where">Any mansion</span>
          <span class="compact">Search</span>
        </div>
        <span class="tcsearch-div"></span>
        <div class="tcsearch-seg" data-seg="when">
          <span class="lbl">When</span><span class="val placeholder" data-v="when">Add dates</span>
          <span class="compact">Dates</span>
        </div>
        <span class="tcsearch-div"></span>
        <div class="tcsearch-seg" data-seg="who">
          <span class="lbl">Who</span><span class="val placeholder" data-v="who">Add guests</span>
          <span class="compact">Guests</span>
        </div>
        <button class="tcsearch-go" data-go aria-label="Search">🔎<span>Search</span></button>
      </div>
      <div class="tcsearch-panel" role="dialog" aria-label="Search">
        <div class="tcsearch-pane" data-pane="where">
          <h4>Which mansion?</h4>
          <div class="tcsearch-opts">
            ${D.PROPERTIES.map((p) => `<button class="tcsearch-opt" data-id="${p.id}">${p.name} · sleeps ${p.guests}</button>`).join("")}
          </div>
        </div>
        <div class="tcsearch-pane" data-pane="when">
          <h4>When's your stay?</h4>
          <div class="tcsearch-dates">
            <label>Check-in<input type="date" data-d="checkIn"></label>
            <label>Checkout<input type="date" data-d="checkOut"></label>
          </div>
        </div>
        <div class="tcsearch-pane" data-pane="who">
          <h4>Who's coming?</h4>
          ${[["adults", "Adults", "Ages 13+", 1], ["children", "Children", "Ages 2–12", 0], ["pets", "Pets", "Bringing a friend?", 0]]
            .map(([k, t, s]) => `<div class="tcsearch-step"><span><b>${t}</b><small>${s}</small></span>
              <span class="ctrl"><button data-dec="${k}">−</button><b data-c="${k}">${state[k]}</b><button data-inc="${k}">+</button></span></div>`).join("")}
        </div>
      </div>`;
    header.appendChild(wrap);

    const scrim = document.createElement("div");
    scrim.className = "tcsearch-scrim";
    document.body.appendChild(scrim);

    const bar = wrap.querySelector(".tcsearch");
    const panel = wrap.querySelector(".tcsearch-panel");
    const panes = wrap.querySelectorAll(".tcsearch-pane");
    const segs = wrap.querySelectorAll(".tcsearch-seg");

    function open(seg) {
      bar.classList.add("expanded");
      panel.classList.add("open");
      scrim.classList.add("open");
      segs.forEach((s) => s.classList.toggle("on", s.dataset.seg === seg));
      panes.forEach((p) => p.classList.toggle("show", p.dataset.pane === seg));
    }
    function close() {
      bar.classList.remove("expanded");
      panel.classList.remove("open");
      scrim.classList.remove("open");
      segs.forEach((s) => s.classList.remove("on"));
    }
    function refresh() {
      const w = wrap.querySelector('[data-v="when"]');
      const who = wrap.querySelector('[data-v="who"]');
      const where = wrap.querySelector('[data-v="where"]');
      const names = D.PROPERTIES.filter((p) => state.ids.includes(p.id)).map((p) => p.name);
      where.textContent = names.length ? names.join(", ") : "Any mansion";
      where.classList.toggle("placeholder", !names.length);
      const dates = state.checkIn && state.checkOut ? `${fmtDate(state.checkIn)} – ${fmtDate(state.checkOut)}` : "Add dates";
      w.textContent = dates;
      w.classList.toggle("placeholder", !(state.checkIn && state.checkOut));
      const g = state.adults + state.children;
      who.textContent = g ? `${g} guest${g > 1 ? "s" : ""}${state.pets ? `, ${state.pets} pet${state.pets > 1 ? "s" : ""}` : ""}` : "Add guests";
      who.classList.toggle("placeholder", !g);
    }

    segs.forEach((s) => s.addEventListener("click", (e) => {
      e.stopPropagation();
      if (s.classList.contains("on")) { close(); return; }
      open(s.dataset.seg);
    }));
    panel.addEventListener("click", (e) => e.stopPropagation());
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    wrap.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.id;
      state.ids = state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id];
      b.classList.toggle("on", state.ids.includes(id));
      refresh();
    }));
    wrap.querySelectorAll("[data-d]").forEach((i) => i.addEventListener("change", (e) => {
      state[i.dataset.d] = e.target.value; refresh();
    }));
    wrap.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => {
      state[b.dataset.inc]++; wrap.querySelector(`[data-c="${b.dataset.inc}"]`).textContent = state[b.dataset.inc]; refresh();
    }));
    wrap.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.dec;
      state[k] = Math.max(0, state[k] - 1);
      wrap.querySelector(`[data-c="${k}"]`).textContent = state[k]; refresh();
    }));

    wrap.querySelector("[data-go]").addEventListener("click", (e) => {
      e.stopPropagation();
      // If the panel isn't open yet, just open the "where" pane so the user can fill in details.
      if (!panel.classList.contains("open")) { open("where"); return; }
      // Only navigate once at least one field has been touched.
      const params = new URLSearchParams();
      if (state.ids.length) params.set("ids", state.ids.join(","));
      const base = location.pathname.includes("/stays/") ? "../booking.html" : "booking.html";
      location.href = params.toString() ? `${base}?${params}` : base;
    });

    // Hero search bar (home page) opens the toolbar search, or books on mobile.
    const hero = document.getElementById("hero-search");
    if (hero) hero.addEventListener("click", () => {
      if (getComputedStyle(wrap).display === "none") { location.href = "booking.html"; return; }
      window.scrollTo({ top: 0, behavior: "smooth" });
      open("where");
    });
  })();

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

})();
