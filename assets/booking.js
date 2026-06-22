/* Booking page logic — runs only on booking.html. */
(function () {
  const D = window.TC;
  const root = document.getElementById("booking-root");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const state = {
    ids: (params.get("ids") || D.PROPERTIES[0].id).split(",").filter(Boolean),
    isEvent: false,
    checkIn: "", checkOut: "",
    adults: 2, children: 0, pets: 0,
    email: "", eventType: "Wedding", message: "",
  };

  /* flatpickr instances — recreated when selected properties change */
  let fpIn = null, fpOut = null;

  const fmt = (n) => "$" + n.toLocaleString();
  const nights = () => {
    if (!state.checkIn || !state.checkOut) return 0;
    return Math.max(0, Math.round((new Date(state.checkOut) - new Date(state.checkIn)) / 86400000));
  };
  const selected = () => D.PROPERTIES.filter((p) => state.ids.includes(p.id));
  const capacity = () => selected().reduce((n, p) => n + p.guests, 0);
  const minNights = () => Math.max(...selected().map((p) => p.minNights), 2);
  const lodging = () => nights() * selected().reduce((n, p) => n + p.nightlyFrom, 0);
  const cleaning = () => D.CLEANING_PER_HOUSE * selected().length;
  const total = () => lodging() + cleaning();
  const emailOk = () => /\S+@\S+\.\S+/.test(state.email);
  const ready = () => selected().length && nights() >= minNights() && emailOk();

  function render() {
    const n = nights();
    root.innerHTML = `
      <a href="index.html" class="inline-flex items-center gap-2 text-sm py-3" style="text-decoration:none">&larr; Back</a>
      <h1 class="font-serif" style="font-size:2rem;margin:.2rem 0">${state.isEvent ? "Plan your celebration" : "Confirm and book"}</h1>
      ${state.isEvent ? `<p style="color:#57534e;font-size:.95rem;max-width:40rem">One house for an intimate weekend — or all four side-by-side mansions, so every guest wakes up on the same hillside.</p>` : ""}
      <div class="bk-grid">
        <div>
          <section class="bk-sec">
            <h2>1 &middot; Your mansion${state.ids.length > 1 ? "s" : ""}</h2>
            <div class="bk-props">
              ${D.PROPERTIES.map((p) => {
                const on = state.ids.includes(p.id);
                return `<button class="bk-prop ${on ? "on" : ""}" data-id="${p.id}">
                  <span class="photo" style="--g1:${p.g1};--g2:${p.g2};height:54px;border-radius:.5rem;display:block"></span>
                  <span class="bk-prop-row"><span><b>${p.name}</b><small> · sleeps ${p.guests}</small></span>
                  <span class="check">${on ? "&#10003;" : ""}</span></span>
                </button>`;
              }).join("")}
            </div>
            ${state.ids.length > 1 ? `<p class="note">${state.ids.length} mansions, one booking — combined capacity ${capacity()} guests, all on the same hillside.</p>` : ""}
          </section>

          <section class="bk-sec">
            <h2>2 &middot; Your dates ${n ? `<small>· ${n} nights</small>` : ""}</h2>
            <div class="bk-dates">
              <label>Check-in<input type="text" id="ci" placeholder="Select date" value="${state.checkIn}" readonly style="cursor:pointer"></label>
              <label>Checkout<input type="text" id="co" placeholder="Select date" value="${state.checkOut}" readonly style="cursor:pointer"></label>
            </div>
            <div id="avail-status" class="avail-status"></div>
            ${n > 0 && n < minNights() ? `<p class="warn">This selection requires a minimum stay of ${minNights()} nights.</p>` : ""}
          </section>

          <section class="bk-sec">
            <h2>3 &middot; Who's coming</h2>
            <div class="bk-guests">
              ${stepper("Adults", "adults", 1)}
              ${stepper("Children", "children", 0)}
              ${stepper("Pets", "pets", 0)}
              <label class="bk-email">Email
                <input type="email" id="email" placeholder="you@email.com" value="${state.email}">
                <small>Confirmation and door codes go here.</small>
              </label>
            </div>
          </section>

          ${state.isEvent ? `
          <section class="bk-sec">
            <h2>4 &middot; Your occasion</h2>
            <div class="bk-occ">
              ${["Wedding", "Family reunion", "Corporate retreat", "Milestone"].map((t) =>
                `<button class="chip ${state.eventType === t ? "on" : ""}" data-occ="${t}">${t}</button>`).join("")}
            </div>
            <textarea id="msg" rows="4" placeholder="A September wedding for 60 — ceremony in the garden, dinner in the barn, families staying the whole weekend…">${state.message}</textarea>
          </section>` : `
          <div class="bk-nearby-nudge">
            <span>More guests?</span> The Myrtle, Birch &amp; Mahogany sit side by side —
            <a href="events.html">rent a property nearby &rarr;</a>
          </div>
          `}
        </div>

        <aside>
          <div class="bk-summary">
            <h3>${state.isEvent ? "Your celebration" : "Your stay"}</h3>
            <div class="bk-lines">
              ${selected().map((p) => `<div class="line"><span>${p.name}${n ? ` × ${n} nights` : ""}</span><span>${n ? fmt(p.nightlyFrom * n) : fmt(p.nightlyFrom) + "/n"}</span></div>`).join("")}
              ${n >= minNights() && selected().length ? `
                <div class="line"><span>Cleaning (${selected().length} house${selected().length > 1 ? "s" : ""})</span><span>${fmt(cleaning())}</span></div>
                <div class="line total"><span>Total before taxes</span><span>${fmt(total())}</span></div>` : ""}
              ${selected().length ? `<p class="cap ${state.adults + state.children <= capacity() ? "ok" : "over"}">${state.adults + state.children <= capacity() ? `✓ Sleeps ${capacity()} — room for your ${state.adults + state.children}.` : `Sleeps ${capacity()} — add a mansion for ${state.adults + state.children} guests.`}</p>` : ""}
            </div>
            <button class="btn btn-primary bk-submit" id="submit" ${ready() ? "" : "disabled"}>${state.isEvent ? "Reserve your weekend" : "Book now"}</button>
            <p class="fine">You won't be charged yet · Best rates booking direct</p>
            <p class="fine">By continuing, you agree to our <a href="#policy">cancellation policy and rental agreement</a>.</p>
          </div>
        </aside>
      </div>`;

    wire();
    initDates();
  }

  function stepper(label, key, min) {
    return `<div class="step"><span>${label}</span>
      <span class="step-ctrl">
        <button data-dec="${key}" ${state[key] <= min ? "disabled" : ""}>&minus;</button>
        <b>${state[key]}</b>
        <button data-inc="${key}">+</button>
      </span></div>`;
  }

  function wire() {
    root.querySelectorAll("[data-id]").forEach((b) => b.onclick = () => {
      const id = b.dataset.id;
      state.ids = state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id];
      render();
    });
    root.querySelectorAll("[data-inc]").forEach((b) => b.onclick = () => { state[b.dataset.inc]++; render(); });
    root.querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => { state[b.dataset.dec] = Math.max(0, state[b.dataset.dec] - 1); render(); });
    root.querySelectorAll("[data-occ]").forEach((b) => b.onclick = () => { state.eventType = b.dataset.occ; render(); });
    const em = root.querySelector("#email"); if (em) em.oninput = (e) => { state.email = e.target.value; document.getElementById("submit").disabled = !ready(); };
    const msg = root.querySelector("#msg"); if (msg) msg.oninput = (e) => { state.message = e.target.value; };
    const sb = root.querySelector("#submit"); if (sb) sb.onclick = submit;
  }

  /* ---- Availability-aware date picker ---- */
  async function initDates() {
    if (fpIn) { try { fpIn.destroy(); } catch (e) {} fpIn = null; }
    if (fpOut) { try { fpOut.destroy(); } catch (e) {} fpOut = null; }

    const ciEl = root.querySelector("#ci");
    const coEl = root.querySelector("#co");
    if (!ciEl || !coEl) return;

    /* Fetch blocked dates for all selected properties */
    let blockedDates = [];
    if (D.api) {
      const statusEl = root.querySelector("#avail-status");
      if (statusEl) { statusEl.textContent = "Checking availability…"; statusEl.className = "avail-status loading"; }

      const today = new Date();
      const far = new Date(today); far.setFullYear(far.getFullYear() + 1);
      const fromStr = today.toISOString().slice(0, 10);
      const toStr = far.toISOString().slice(0, 10);

      const listingIds = selected().map((p) => p.listingId).filter(Boolean);
      const results = await Promise.all(listingIds.map((lid) => D.api.getCalendar(lid, fromStr, toStr)));
      const blocked = new Set(results.flat());
      blockedDates = Array.from(blocked);

      if (statusEl) {
        statusEl.textContent = blockedDates.length ? "Booked dates are shown in grey." : "";
        statusEl.className = "avail-status" + (blockedDates.length ? " ok" : "");
      }
    }

    if (window.flatpickr) {
      const common = {
        minDate: "today",
        disable: blockedDates,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "M j, Y",
        disableMobile: false,
      };
      fpIn = flatpickr(ciEl, {
        ...common,
        onChange: ([, dateStr]) => {
          state.checkIn = dateStr;
          if (fpOut) fpOut.set("minDate", dateStr);
          renderSummary();
        },
      });
      fpOut = flatpickr(coEl, {
        ...common,
        minDate: state.checkIn || "today",
        onChange: ([, dateStr]) => {
          state.checkOut = dateStr;
          renderSummary();
        },
      });
      if (state.checkIn) fpIn.setDate(state.checkIn, false);
      if (state.checkOut) fpOut.setDate(state.checkOut, false);
    } else {
      ciEl.type = "date"; coEl.type = "date";
      ciEl.min = new Date().toISOString().slice(0, 10);
      ciEl.value = state.checkIn; coEl.value = state.checkOut;
      ciEl.onchange = (e) => { state.checkIn = e.target.value; coEl.min = e.target.value; renderSummary(); };
      coEl.onchange = (e) => { state.checkOut = e.target.value; renderSummary(); };
    }
  }

  /* Partial re-render: update the summary panel without destroying flatpickr */
  function renderSummary() {
    const n = nights();
    const sumEl = root.querySelector(".bk-lines");
    if (!sumEl) return;

    root.querySelectorAll(".warn").forEach((w) => w.remove());

    sumEl.innerHTML = `
      ${selected().map((p) => `<div class="line"><span>${p.name}${n ? ` × ${n} nights` : ""}</span><span>${n ? fmt(p.nightlyFrom * n) : fmt(p.nightlyFrom) + "/n"}</span></div>`).join("")}
      ${n >= minNights() && selected().length ? `
        <div class="line"><span>Cleaning (${selected().length} house${selected().length > 1 ? "s" : ""})</span><span>${fmt(cleaning())}</span></div>
        <div class="line total"><span>Total before taxes</span><span>${fmt(total())}</span></div>` : ""}
      ${selected().length ? `<p class="cap ${state.adults + state.children <= capacity() ? "ok" : "over"}">${state.adults + state.children <= capacity() ? `✓ Sleeps ${capacity()} — room for your ${state.adults + state.children}.` : `Sleeps ${capacity()} — add a mansion for ${state.adults + state.children} guests.`}</p>` : ""}`;

    const sb = root.querySelector("#submit");
    if (sb) sb.disabled = !ready();

    if (n > 0 && n < minNights()) {
      const el = root.querySelector(".bk-dates");
      if (el) {
        const w = document.createElement("p");
        w.className = "warn";
        w.textContent = `This selection requires a minimum stay of ${minNights()} nights.`;
        el.insertAdjacentElement("afterend", w);
      }
    }
  }

  async function submit() {
    const payload = {
      propertyIds: state.ids,
      listingIds: selected().map((p) => p.listingId).filter(Boolean),
      checkIn: state.checkIn, checkOut: state.checkOut,
      guests: { adults: state.adults, children: state.children, pets: state.pets },
      email: state.email, isEvent: state.isEvent,
      eventType: state.isEvent ? state.eventType : null,
      message: state.message || null, totalQuoted: total(),
    };
    let live = false;
    if (D.WORKER_URL) {
      try {
        const r = await fetch(D.WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        live = r.ok;
      } catch (e) {}
    }
    done(live);
  }

  function done(live) {
    const heads = selected().map((p) => p.name).join(state.isEvent ? ", " : " + ");
    root.innerHTML = `
      <div class="bk-done">
        <div class="check-big">&#10003;</div>
        <h1 class="font-serif">${state.isEvent ? "Your event will be wonderful." : "See you in Vermont."}</h1>
        <p>${state.isEvent
          ? `We can already picture it — the veranda at golden hour, one long table, ${selected().length > 1 ? `everyone you love spread across ${selected().length} houses` : "everyone you love under one roof"}. We'll confirm availability for ${heads} and reach out at ${state.email} within one business day.`
          : `Your request for ${heads} (${nights()} nights) was sent. We'll confirm at ${state.email} within 24 hours.`}</p>
        <p class="fine">${live ? "Submitted via your Cloudflare Worker." : "Demo mode — Worker not connected yet."}</p>
        <div class="policy" id="policy">
          <h2>Cancellation policy &amp; rental agreement</h2>
          <p>Free cancellation up to 60 days before check-in; 50% refund up to 30 days before. Full terms in your confirmation email.</p>
        </div>
        <a href="index.html" class="btn btn-primary" style="display:inline-block;padding:.8rem 1.5rem;text-decoration:none;margin-top:1.5rem">Back to the mansions</a>
      </div>`;
  }

  render();
})();
