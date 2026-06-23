/* Booking page logic — runs only on booking.html.
   Reads ?ids=the-birch,the-myrtle&event=1 from the URL, lets the user
   adjust the selection, dates, guests and email, then submits ONE request
   covering all chosen mansions to the Cloudflare Worker. */
(function () {
  const D = window.TC;
  const root = document.getElementById("booking-root");
  if (!D || !root) return;

  const params = new URLSearchParams(location.search);
  const toInt = (value, fallback) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const state = {
    ids: (params.get("ids") || (D.PROPERTIES[0]?.id || "")).split(",").filter(Boolean),
    isEvent: params.get("event") === "1",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    adults: toInt(params.get("adults"), 2),
    children: toInt(params.get("children"), 0),
    pets: toInt(params.get("pets"), 0),
    email: "", eventType: "Wedding", message: "",
  };

  const fmt = (n) => "$" + Number(n || 0).toLocaleString();
  const nights = () => {
    if (!state.checkIn || !state.checkOut) return 0;
    return Math.max(0, Math.round((new Date(state.checkOut) - new Date(state.checkIn)) / 86400000));
  };
  const ensureSelection = () => {
    const valid = new Set(D.PROPERTIES.map((p) => p.id));
    state.ids = state.ids.filter((id) => valid.has(id));
    if (!state.ids.length && D.PROPERTIES[0]) state.ids = [D.PROPERTIES[0].id];
  };
  const selected = () => D.PROPERTIES.filter((p) => state.ids.includes(p.id));
  const capacity = () => selected().reduce((n, p) => n + (p.guests || 0), 0);
  const minNights = () => Math.max(2, ...selected().map((p) => p.minNights || 2));
  const lodging = () => nights() * selected().reduce((n, p) => n + (p.nightlyFrom || 0), 0);
  const cleaning = () => D.CLEANING_PER_HOUSE * selected().length;
  const total = () => lodging() + cleaning();
  const emailOk = () => /\S+@\S+\.\S+/.test(state.email);
  const ready = () => selected().length && nights() >= minNights() && emailOk();

  function photoStyle(p, height) {
    const base = `height:${height};border-radius:.5rem;display:block`;
    if (p.image) {
      return `${base};background-image:url('${String(p.image).replace(/'/g, "%27")}');background-size:cover;background-position:center`;
    }
    return `${base};--g1:${p.g1 || "#3a3f49"};--g2:${p.g2 || "#16181d"}`;
  }

  function render() {
    ensureSelection();
    const n = nights();
    root.innerHTML = `
      <a href="index.html" class="inline-flex items-center gap-2 text-sm py-3" style="text-decoration:none">&larr; Back</a>
      <h1 class="font-serif" style="font-size:2rem;margin:.2rem 0">${state.isEvent ? "Plan your celebration" : "Confirm and book"}</h1>
      ${D.PROPERTIES_LIVE ? `<p class="text-sm text-stone-500">Live Guesty data is connected.</p>` : `<p class="text-sm text-stone-500">Static preview mode. Connect the Cloudflare Worker for live Guesty availability and booking.</p>`}
      ${state.isEvent ? `<p style="color:#57534e;font-size:.95rem;max-width:40rem">One house for an intimate weekend — or all four side-by-side mansions, so every guest wakes up on the same hillside.</p>` : ""}
      <div class="bk-grid">
        <div>
          <section class="bk-sec">
            <h2>1 &middot; Your mansion${state.ids.length > 1 ? "s" : ""}</h2>
            <div class="bk-props">
              ${D.PROPERTIES.map((p) => {
                const on = state.ids.includes(p.id);
                return `<button class="bk-prop ${on ? "on" : ""}" data-id="${p.id}">
                  <span class="photo" style="${photoStyle(p, "54px")}"></span>
                  <span class="bk-prop-row"><span><b>${p.name}</b><small>${p.guests ? ` · sleeps ${p.guests}` : ""}</small></span>
                  <span class="check">${on ? "&#10003;" : ""}</span></span>
                </button>`;
              }).join("")}
            </div>
            ${state.ids.length > 1 ? `<p class="note">${state.ids.length} mansions, one booking — combined capacity ${capacity()} guests, all on the same hillside.</p>` : ""}
          </section>

          <section class="bk-sec">
            <h2>2 &middot; Your dates ${n ? `<small>· ${n} nights</small>` : ""}</h2>
            <div class="bk-dates">
              <label>Check-in<input type="date" id="ci" value="${state.checkIn}"></label>
              <label>Checkout<input type="date" id="co" value="${state.checkOut}"></label>
            </div>
            ${n > 0 && n < minNights() ? `<p class="warn">This selection requires a minimum stay of ${minNights()} nights. Please choose at least ${minNights()} nights to continue.</p>` : ""}
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
              ${selected().map((p) => `<div class="line"><span>${p.name}${n ? ` × ${n} nights` : ""}</span><span>${n && p.nightlyFrom ? fmt(p.nightlyFrom * n) : p.nightlyFrom ? fmt(p.nightlyFrom) + "/n" : "Quote"}</span></div>`).join("")}
              ${n >= minNights() && selected().length ? `
                <div class="line"><span>Cleaning (${selected().length} house${selected().length > 1 ? "s" : ""})</span><span>${fmt(cleaning())}</span></div>
                <div class="line total"><span>Total before taxes</span><span>${fmt(total())}</span></div>` : ""}
              ${selected().length ? `<p class="cap ${state.adults + state.children <= capacity() ? "ok" : "over"}">${state.adults + state.children <= capacity() ? `✓ Sleeps ${capacity()} — room for your ${state.adults + state.children}.` : `Sleeps ${capacity()} — add a mansion for ${state.adults + state.children} guests.`}</p>` : ""}
            </div>
            <button class="btn btn-primary bk-submit" id="submit" ${ready() ? "" : "disabled"}>${state.isEvent ? "Reserve your weekend" : "Book now"}</button>
            <p class="fine">You won't be charged yet · Best rates booking direct</p>
            <p class="fine">By continuing, you agree to our <a href="#policy">cancellation policy and rental agreement</a>. Full terms appear on your confirmation.</p>
          </div>
        </aside>
      </div>`;

    wire();
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
    root.querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => {
      const min = b.dataset.dec === "adults" ? 1 : 0;
      state[b.dataset.dec] = Math.max(min, state[b.dataset.dec] - 1);
      render();
    });
    root.querySelectorAll("[data-occ]").forEach((b) => b.onclick = () => { state.eventType = b.dataset.occ; render(); });
    const ci = root.querySelector("#ci"); if (ci) ci.onchange = (e) => { state.checkIn = e.target.value; render(); };
    const co = root.querySelector("#co"); if (co) co.onchange = (e) => { state.checkOut = e.target.value; render(); };
    const em = root.querySelector("#email"); if (em) em.oninput = (e) => { state.email = e.target.value; document.getElementById("submit").disabled = !ready(); };
    const msg = root.querySelector("#msg"); if (msg) msg.oninput = (e) => { state.message = e.target.value; };
    const sb = root.querySelector("#submit"); if (sb) sb.onclick = submit;
  }

  async function submit() {
    const payload = {
      source: "timbercrest-static-shell",
      propertyIds: state.ids,
      listingIds: selected().map((p) => p.listingId).filter(Boolean),
      checkIn: state.checkIn, checkOut: state.checkOut,
      guests: { adults: state.adults, children: state.children, pets: state.pets },
      email: state.email, isEvent: state.isEvent,
      eventType: state.isEvent ? state.eventType : null,
      message: state.message || null, totalQuoted: total(),
    };

    let live = false;
    let redirectUrl = "";
    const url = typeof D.apiUrl === "function" ? D.apiUrl("book") : D.WORKER_URL;
    if (url) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await r.json().catch(() => ({}));
        live = r.ok;
        redirectUrl = data.redirectUrl || data.url || "";
      } catch (e) {
        live = false;
      }
    }
    if (redirectUrl) {
      location.href = redirectUrl;
      return;
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
          ? `We can already picture it — the veranda at golden hour, one long table, ${selected().length > 1 ? `everyone you love spread across ${selected().length} houses, a few steps apart` : "everyone you love under one roof"}. The Timbercrest team will confirm availability for ${heads} and reach out at ${state.email} within one business day.`
          : `Your request for ${heads} (${nights()} nights) was sent. We'll confirm at ${state.email} within 24 hours.`}</p>
        <p class="fine">${live ? "Submitted via your Cloudflare Worker." : "Demo mode: the Worker isn't connected yet, so this was simulated — the payload is ready to go live."}</p>
        <div class="policy" id="policy">
          <h2>Cancellation policy &amp; rental agreement</h2>
          <p>Free cancellation up to 60 days before check-in; 50% refund up to 30 days before. The full rental agreement and house rules are included in your confirmation email. Replace this placeholder with your actual terms before launch.</p>
        </div>
        <a href="index.html" class="btn btn-primary" style="display:inline-block;padding:.8rem 1.5rem;text-decoration:none;margin-top:1.5rem">Back to the mansions</a>
      </div>`;
  }

  document.addEventListener("tc:properties-ready", render);
  render();
})();
