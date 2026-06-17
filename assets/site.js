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

// ---- Airbnb-style search bar
// Home page = use the existing hero search bar.
// Inner pages = inject ONE centered toolbar search and hide the old desktop nav.
(function () {
  if (document.documentElement.dataset.tcSearchReady === "1") return;
  document.documentElement.dataset.tcSearchReady = "1";

  const D = window.TC;
  const headerEl = document.querySelector("header");
  const header = document.querySelector("header > div");
  const hero = document.getElementById("hero-search");

  if (!D || !Array.isArray(D.PROPERTIES)) return;

  const state = {
    ids: [],
    checkIn: "",
    checkOut: "",
    adults: 2,
    children: 0,
    pets: 0
  };

  const fmtDate = (s) =>
    s
      ? new Date(s + "T00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric"
        })
      : "";

  function panelHTML() {
    return `
      <div class="tcsearch-panel" role="dialog" aria-label="Search">
        <div class="tcsearch-pane" data-pane="where">
          <h4>Which mansion?</h4>
          <div class="tcsearch-opts">
            ${D.PROPERTIES.map((p) => `
              <button class="tcsearch-opt" data-id="${p.id}">
                ${p.name} · sleeps ${p.guests}
              </button>
            `).join("")}
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

          ${[
            ["adults", "Adults", "Ages 13+"],
            ["children", "Children", "Ages 2–12"],
            ["pets", "Pets", "Bringing a friend?"]
          ].map(([k, t, s]) => `
            <div class="tcsearch-step">
              <span><b>${t}</b><small>${s}</small></span>
              <span class="ctrl">
                <button type="button" data-dec="${k}">−</button>
                <b data-c="${k}">${state[k]}</b>
                <button type="button" data-inc="${k}">+</button>
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function toolbarHTML() {
    return `
      <div class="tcsearch" role="search">
        <div class="tcsearch-seg" data-seg="where">
          <span class="lbl">Where</span>
          <span class="val placeholder" data-v="where">Any mansion</span>
          <span class="compact">Search</span>
        </div>

        <span class="tcsearch-div"></span>

        <div class="tcsearch-seg" data-seg="when">
          <span class="lbl">When</span>
          <span class="val placeholder" data-v="when">Add dates</span>
          <span class="compact">Dates</span>
        </div>

        <span class="tcsearch-div"></span>

        <div class="tcsearch-seg" data-seg="who">
          <span class="lbl">Who</span>
          <span class="val placeholder" data-v="who">Add guests</span>
          <span class="compact">Guests</span>
        </div>

        <button class="tcsearch-go" type="button" data-go aria-label="Search">
          🔎<span>Search</span>
        </button>
      </div>
    `;
  }

  let wrap;
  let bar;

  // HOME PAGE: use existing hero search. Do NOT inject another search into the header.
  if (hero) {
    hero.type = "button";
    hero.classList.add("hero-search-centered");

    wrap = document.createElement("div");
    wrap.className = "tcsearch-hero-wrap";

    hero.parentNode.insertBefore(wrap, hero);
    wrap.appendChild(hero);
    wrap.insertAdjacentHTML("beforeend", panelHTML());

    bar = hero;
    bar.setAttribute("role", "search");

    const segNames = ["where", "when", "who"];
    const segs = bar.querySelectorAll(".tcsearch-seg");
    const vals = bar.querySelectorAll(".tcsearch-seg .val");

    segs.forEach((seg, i) => {
      seg.dataset.seg = segNames[i];
      seg.style.pointerEvents = "auto";
    });

    vals.forEach((val, i) => {
      val.dataset.v = segNames[i];
    });

    const go = bar.querySelector(".tcsearch-go");
    if (go) {
      go.dataset.go = "";
      go.style.pointerEvents = "auto";
    }

    hero.style.marginLeft = "auto";
    hero.style.marginRight = "auto";
    hero.style.display = "flex";
  }

  // INNER PAGES: inject one centered toolbar search and hide old desktop nav.
  else {
    if (!header || !headerEl) return;

    headerEl.classList.add("tc-has-header-search");
    header.classList.add("tc-header-search-mode");

    const nav = header.querySelector("nav");
    if (nav) nav.classList.add("tc-nav-hidden-by-search");

    wrap = document.createElement("div");
    wrap.className = "tcsearch-wrap hidden md:block";
    wrap.innerHTML = toolbarHTML() + panelHTML();

    header.appendChild(wrap);
    bar = wrap.querySelector(".tcsearch");
  }

  const scrim =
    document.querySelector(".tcsearch-scrim") ||
    document.createElement("div");

  scrim.className = "tcsearch-scrim";
  if (!scrim.parentNode) document.body.appendChild(scrim);

  const panel = wrap.querySelector(".tcsearch-panel");
  const panes = wrap.querySelectorAll(".tcsearch-pane");
  const segs = wrap.querySelectorAll(".tcsearch-seg");

  function open(seg) {
    bar.classList.add("expanded");
    panel.classList.add("open");
    scrim.classList.add("open");

    segs.forEach((s) => {
      s.classList.toggle("on", s.dataset.seg === seg);
    });

    panes.forEach((p) => {
      p.classList.toggle("show", p.dataset.pane === seg);
    });
  }

  function close() {
    bar.classList.remove("expanded");
    panel.classList.remove("open");
    scrim.classList.remove("open");

    segs.forEach((s) => s.classList.remove("on"));
  }

  function refresh() {
    const where = wrap.querySelector('[data-v="where"]');
    const when = wrap.querySelector('[data-v="when"]');
    const who = wrap.querySelector('[data-v="who"]');

    const names = D.PROPERTIES
      .filter((p) => state.ids.includes(p.id))
      .map((p) => p.name);

    if (where) {
      where.textContent = names.length ? names.join(", ") : "Any mansion";
      where.classList.toggle("placeholder", !names.length);
    }

    const dates =
      state.checkIn && state.checkOut
        ? `${fmtDate(state.checkIn)} – ${fmtDate(state.checkOut)}`
        : "Add dates";

    if (when) {
      when.textContent = dates;
      when.classList.toggle("placeholder", !(state.checkIn && state.checkOut));
    }

    const guestCount = state.adults + state.children;
    const guestText = `${guestCount} guest${guestCount > 1 ? "s" : ""}`;
    const petText = state.pets
      ? `, ${state.pets} pet${state.pets > 1 ? "s" : ""}`
      : "";

    if (who) {
      who.textContent = guestCount ? guestText + petText : "Add guests";
      who.classList.toggle("placeholder", !guestCount);
    }
  }

  function goToBooking() {
    const params = new URLSearchParams();

    if (state.ids.length) params.set("ids", state.ids.join(","));

    const base = location.pathname.includes("/stays/")
      ? "../booking.html"
      : "booking.html";

    location.href = params.toString() ? `${base}?${params}` : base;
  }

  segs.forEach((seg) => {
    seg.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (seg.classList.contains("on")) {
        close();
        return;
      }

      open(seg.dataset.seg);
    });
  });

  bar.addEventListener("click", (e) => {
    if (e.target.closest("[data-go]")) return;
    if (e.target.closest(".tcsearch-seg")) return;

    e.preventDefault();
    open("where");
  });

  panel.addEventListener("click", (e) => e.stopPropagation());
  scrim.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  wrap.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;

      state.ids = state.ids.includes(id)
        ? state.ids.filter((x) => x !== id)
        : [...state.ids, id];

      btn.classList.toggle("on", state.ids.includes(id));
      refresh();
    });
  });

  wrap.querySelectorAll("[data-d]").forEach((input) => {
    input.addEventListener("change", (e) => {
      state[input.dataset.d] = e.target.value;
      refresh();
    });
  });

  wrap.querySelectorAll("[data-inc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.inc;
      state[key]++;

      const count = wrap.querySelector(`[data-c="${key}"]`);
      if (count) count.textContent = state[key];

      refresh();
    });
  });

  wrap.querySelectorAll("[data-dec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.dec;
      const min = key === "adults" ? 1 : 0;

      state[key] = Math.max(min, state[key] - 1);

      const count = wrap.querySelector(`[data-c="${key}"]`);
      if (count) count.textContent = state[key];

      refresh();
    });
  });

  const go = wrap.querySelector("[data-go]");
  if (go) {
    go.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!panel.classList.contains("open")) {
        open("where");
        return;
      }

      goToBooking();
    });
  }

  refresh();
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
