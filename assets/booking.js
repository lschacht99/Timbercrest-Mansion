/* Booking page logic — runs only on booking.html.
   Reads ?ids=the-birch,the-myrtle&event=1 from the URL, lets the user
   adjust the selection, dates, guests and email, then submits ONE request
   to the Cloudflare Worker. Single-mansion stays can request a live Guesty
   quote and complete instant booking when a GuestyPay ccToken is provided.

   Security rule: never collect or send raw card numbers from this file.
   The checkout only accepts a token returned by GuestyPay/tokenization. */
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
    email: params.get("email") || "",
    firstName: "",
    lastName: "",
    phone: "",
    eventType: "Wedding",
    message: "",
    acceptAgreement: false,
    paymentToken: "",
    quote: null,
    quoteKey: "",
    quoteLoading: false,
    quoteError: "",
    submitLoading: false,
    submitError: ""
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const fmt = (n, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n || 0));
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
  const staticTotal = () => lodging() + cleaning();
  const emailOk = () => /\S+@\S+\.\S+/.test(state.email);
  const selectedOne = () => selected()[0] || null;
  const isSingleBookable = () => !state.isEvent && selected().length === 1 && Boolean(selectedOne()?.listingId);
  const canGetQuote = () => isSingleBookable() && nights() >= minNights() && state.adults >= 1 && emailOk();
  const ready = () => selected().length && nights() >= minNights() && emailOk();
  const quoteTotal = () => Number(state.quote?.total || state.quote?.money?.total || 0);
  const displayTotal = () => quoteTotal() || staticTotal();
  const quoteCurrency = () => state.quote?.currency || selectedOne()?.currency || "USD";

  function currentQuoteKey() {
    const p = selectedOne();
    return [p?.listingId || "", state.checkIn, state.checkOut, state.adults, state.children, state.pets].join("|");
  }

  function clearQuote() {
    state.quote = null;
    state.quoteKey = "";
    state.quoteError = "";
  }

  function photoStyle(p, height) {
    const base = `height:${height};border-radius:.5rem;display:block`;
    if (p.image) {
      return `${base};background-image:url('${String(p.image).replace(/'/g, "%27")}');background-size:cover;background-position:center`;
    }
    return `${base};--g1:${p.g1 || "#3a3f49"};--g2:${p.g2 || "#16181d"}`;
  }

  function quotePayload() {
    const p = selectedOne();
    return {
      source: "timbercrest-static-shell",
      propertyId: p?.id || null,
      listingId: p?.listingId || null,
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      guestsCount: state.adults + state.children,
      guests: {
        adults: state.adults,
        children: state.children,
        pets: state.pets
      },
      numberOfGuests: {
        numberOfAdults: state.adults,
        numberOfChildren: state.children,
        numberOfInfants: 0,
        numberOfPets: state.pets
      }
    };
  }

  function inquiryPayload() {
    return {
      source: "timbercrest-static-shell",
      propertyIds: state.ids,
      listingIds: selected().map((p) => p.listingId).filter(Boolean),
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      guests: { adults: state.adults, children: state.children, pets: state.pets },
      email: state.email,
      firstName: state.firstName || null,
      lastName: state.lastName || null,
      phone: state.phone || null,
      isEvent: state.isEvent,
      eventType: state.isEvent ? state.eventType : null,
      message: state.message || null,
      totalQuoted: displayTotal()
    };
  }

  function instantBookPayload() {
    const p = selectedOne();
    return {
      ...quotePayload(),
      quoteId: state.quote?.quoteId,
      ratePlanId: state.quote?.ratePlanId,
      ccToken: state.paymentToken,
      paymentProviderId: state.quote?.paymentProviderId || undefined,
      acceptAgreement: state.acceptAgreement,
      guest: {
        firstName: state.firstName,
        lastName: state.lastName,
        email: state.email,
        phone: state.phone,
        note: state.message || ""
      },
      propertyIds: [p?.id].filter(Boolean),
      listingIds: [p?.listingId].filter(Boolean)
    };
  }

  function renderQuoteBox() {
    if (state.isEvent) {
      return `<div class="bk-paybox"><b>Event inquiry</b><p class="fine">Events and multi-mansion stays are sent as a direct inquiry so the team can confirm details manually.</p></div>`;
    }
    if (!isSingleBookable()) {
      return `<div class="bk-paybox"><b>Multi-mansion stay</b><p class="fine">For now, instant payment is available for one mansion at a time. Multi-mansion stays are sent as one direct inquiry.</p></div>`;
    }
    if (!canGetQuote()) {
      return `<div class="bk-paybox"><b>Live checkout</b><p class="fine">Choose one mansion, valid dates, guests, and email to request a live Guesty quote.</p></div>`;
    }
    if (state.quoteLoading) {
      return `<div class="bk-paybox"><b>Live quote</b><p class="fine">Getting the live price from Guesty…</p></div>`;
    }
    if (state.quoteError) {
      return `<div class="bk-paybox"><b>Live quote unavailable</b><p class="warn">${esc(state.quoteError)}</p><button class="btn btn-white" id="quote-btn" type="button" style="padding:.65rem 1rem">Try again</button></div>`;
    }
    if (!state.quote || state.quoteKey !== currentQuoteKey()) {
      return `<div class="bk-paybox"><b>Live checkout</b><p class="fine">Request the exact Guesty quote before payment.</p><button class="btn btn-white" id="quote-btn" type="button" style="padding:.65rem 1rem">Get live quote</button></div>`;
    }

    const total = quoteTotal();
    const ratePlan = state.quote.ratePlanId ? `<div class="fine">Rate plan: ${esc(state.quote.ratePlanId)}</div>` : "";
    return `<div class="bk-paybox">
      <b>Live Guesty quote</b>
      <div class="line total"><span>Total</span><span>${total ? fmt(total, quoteCurrency()) : "Quote received"}</span></div>
      ${state.quote.paymentDueNow ? `<div class="line"><span>Due now</span><span>${fmt(state.quote.paymentDueNow, quoteCurrency())}</span></div>` : ""}
      ${ratePlan}
      <p class="fine">Payment requires a GuestyPay token. Do not enter raw card numbers here.</p>
    </div>`;
  }

  function render() {
    ensureSelection();
    const n = nights();
    const one = selectedOne();
    const paymentEnabled = Boolean(state.quote && state.quoteKey === currentQuoteKey() && state.quote.quoteId && state.quote.ratePlanId);
    const canInstantBook = paymentEnabled && state.paymentToken && state.firstName && state.lastName && state.phone && state.acceptAgreement;

    root.innerHTML = `
      <a href="index.html" class="inline-flex items-center gap-2 text-sm py-3" style="text-decoration:none">&larr; Back</a>
      <h1 class="font-serif" style="font-size:2rem;margin:.2rem 0">${state.isEvent ? "Plan your celebration" : "Confirm and book"}</h1>
      ${D.PROPERTIES_LIVE ? `<p class="text-sm text-stone-500">Live Guesty data is connected.</p>` : `<p class="text-sm text-stone-500">Using Timbercrest Worker with static fallback data.</p>`}
      ${state.isEvent ? `<p style="color:#57534e;font-size:.95rem;max-width:40rem">One house for an intimate weekend — or all four side-by-side mansions, so every guest wakes up on the same hillside.</p>` : ""}
      <div class="bk-grid">
        <div>
          <section class="bk-sec">
            <h2>1 &middot; Your mansion${state.ids.length > 1 ? "s" : ""}</h2>
            <div class="bk-props">
              ${D.PROPERTIES.map((p) => {
                const on = state.ids.includes(p.id);
                return `<button class="bk-prop ${on ? "on" : ""}" data-id="${esc(p.id)}" type="button">
                  <span class="photo" style="${photoStyle(p, "54px")}"></span>
                  <span class="bk-prop-row"><span><b>${esc(p.name)}</b><small>${p.guests ? ` · sleeps ${p.guests}` : ""}</small></span>
                  <span class="check">${on ? "&#10003;" : ""}</span></span>
                </button>`;
              }).join("")}
            </div>
            ${state.ids.length > 1 ? `<p class="note">${state.ids.length} mansions, one booking — combined capacity ${capacity()} guests, all on the same hillside.</p>` : ""}
          </section>

          <section class="bk-sec">
            <h2>2 &middot; Your dates ${n ? `<small>· ${n} nights</small>` : ""}</h2>
            <div class="bk-dates">
              <label>Check-in<input type="date" id="ci" value="${esc(state.checkIn)}"></label>
              <label>Checkout<input type="date" id="co" value="${esc(state.checkOut)}"></label>
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
                <input type="email" id="email" placeholder="you@email.com" value="${esc(state.email)}">
                <small>Confirmation and door codes go here.</small>
              </label>
            </div>
          </section>

          ${state.isEvent ? `
          <section class="bk-sec">
            <h2>4 &middot; Your occasion</h2>
            <div class="bk-occ">
              ${["Wedding", "Family reunion", "Corporate retreat", "Milestone"].map((t) =>
                `<button class="chip ${state.eventType === t ? "on" : ""}" data-occ="${esc(t)}" type="button">${esc(t)}</button>`).join("")}
            </div>
            <textarea id="msg" rows="4" placeholder="A September wedding for 60 — ceremony in the garden, dinner in the barn, families staying the whole weekend…">${esc(state.message)}</textarea>
          </section>` : `
          <section class="bk-sec">
            <h2>4 &middot; Guest details</h2>
            <div class="bk-dates">
              <label>First name<input type="text" id="firstName" autocomplete="given-name" value="${esc(state.firstName)}"></label>
              <label>Last name<input type="text" id="lastName" autocomplete="family-name" value="${esc(state.lastName)}"></label>
            </div>
            <label class="bk-email">Phone
              <input type="tel" id="phone" autocomplete="tel" placeholder="+1 802…" value="${esc(state.phone)}">
            </label>
            <textarea id="msg" rows="3" placeholder="Anything the team should know?">${esc(state.message)}</textarea>
          </section>
          `}
        </div>

        <aside>
          <div class="bk-summary">
            <h3>${state.isEvent ? "Your celebration" : "Your stay"}</h3>
            <div class="bk-lines">
              ${selected().map((p) => `<div class="line"><span>${esc(p.name)}${n ? ` × ${n} nights` : ""}</span><span>${n && p.nightlyFrom ? fmt(p.nightlyFrom * n) : p.nightlyFrom ? fmt(p.nightlyFrom) + "/n" : "Quote"}</span></div>`).join("")}
              ${n >= minNights() && selected().length ? `
                <div class="line"><span>Cleaning (${selected().length} house${selected().length > 1 ? "s" : ""})</span><span>${fmt(cleaning())}</span></div>
                <div class="line total"><span>${quoteTotal() ? "Guesty quote total" : "Estimated total before taxes"}</span><span>${fmt(displayTotal(), quoteCurrency())}</span></div>` : ""}
              ${selected().length ? `<p class="cap ${state.adults + state.children <= capacity() ? "ok" : "over"}">${state.adults + state.children <= capacity() ? `✓ Sleeps ${capacity()} — room for your ${state.adults + state.children}.` : `Sleeps ${capacity()} — add a mansion for ${state.adults + state.children} guests.`}</p>` : ""}
            </div>
            ${renderQuoteBox()}
            ${paymentEnabled ? `
              <label class="bk-email" style="margin-top:1rem">GuestyPay payment token
                <input type="text" id="paymentToken" placeholder="ccToken from GuestyPay tokenization" value="${esc(state.paymentToken)}">
                <small>Never paste raw card numbers. Only paste the token returned by GuestyPay.</small>
              </label>
              <label class="fine" style="display:flex;gap:.5rem;align-items:flex-start;margin-top:.75rem">
                <input type="checkbox" id="acceptAgreement" ${state.acceptAgreement ? "checked" : ""} style="margin-top:.2rem">
                <span>I agree to the rental agreement, house rules, payment terms, and cancellation policy.</span>
              </label>` : ""}
            ${state.submitError ? `<p class="warn">${esc(state.submitError)}</p>` : ""}
            <button class="btn btn-primary bk-submit" id="submit" ${ready() && !state.submitLoading ? "" : "disabled"}>${state.submitLoading ? "Sending…" : canInstantBook ? "Pay and book" : state.isEvent ? "Reserve your weekend" : paymentEnabled ? "Send request without payment token" : "Continue"}</button>
            <p class="fine">${paymentEnabled ? "Payment is only sent after a GuestyPay token is present." : "You won't be charged yet · Best rates booking direct"}</p>
            <p class="fine">By continuing, you agree to our <a href="#policy">cancellation policy and rental agreement</a>. Full terms appear on your confirmation.</p>
          </div>
        </aside>
      </div>`;

    wire();
  }

  function stepper(label, key, min) {
    return `<div class="step"><span>${label}</span>
      <span class="step-ctrl">
        <button data-dec="${key}" ${state[key] <= min ? "disabled" : ""} type="button">&minus;</button>
        <b>${state[key]}</b>
        <button data-inc="${key}" type="button">+</button>
      </span></div>`;
  }

  function wire() {
    root.querySelectorAll("[data-id]").forEach((b) => b.onclick = () => {
      const id = b.dataset.id;
      state.ids = state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id];
      clearQuote();
      render();
    });
    root.querySelectorAll("[data-inc]").forEach((b) => b.onclick = () => { state[b.dataset.inc]++; clearQuote(); render(); });
    root.querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => {
      const min = b.dataset.dec === "adults" ? 1 : 0;
      state[b.dataset.dec] = Math.max(min, state[b.dataset.dec] - 1);
      clearQuote();
      render();
    });
    root.querySelectorAll("[data-occ]").forEach((b) => b.onclick = () => { state.eventType = b.dataset.occ; render(); });
    const ci = root.querySelector("#ci"); if (ci) ci.onchange = (e) => { state.checkIn = e.target.value; clearQuote(); render(); };
    const co = root.querySelector("#co"); if (co) co.onchange = (e) => { state.checkOut = e.target.value; clearQuote(); render(); };
    bindInput("#email", "email");
    bindInput("#firstName", "firstName");
    bindInput("#lastName", "lastName");
    bindInput("#phone", "phone");
    bindInput("#msg", "message");
    bindInput("#paymentToken", "paymentToken");
    const agreement = root.querySelector("#acceptAgreement"); if (agreement) agreement.onchange = (e) => { state.acceptAgreement = e.target.checked; };
    const quoteBtn = root.querySelector("#quote-btn"); if (quoteBtn) quoteBtn.onclick = fetchQuote;
    const sb = root.querySelector("#submit"); if (sb) sb.onclick = submit;
  }

  function bindInput(selector, key) {
    const el = root.querySelector(selector);
    if (!el) return;
    el.oninput = (e) => { state[key] = e.target.value; };
  }

  async function fetchQuote() {
    if (!canGetQuote()) return;
    const url = typeof D.apiUrl === "function" ? D.apiUrl("quote") : "";
    if (!url) {
      state.quoteError = "Worker quote endpoint is not configured.";
      render();
      return;
    }

    state.quoteLoading = true;
    state.quoteError = "";
    render();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(quotePayload())
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || `Quote failed (${response.status})`);
      state.quote = data.quote || data;
      state.quoteKey = currentQuoteKey();
      state.quoteError = "";
    } catch (error) {
      state.quote = null;
      state.quoteKey = "";
      state.quoteError = error.message || "Could not get quote.";
    } finally {
      state.quoteLoading = false;
      render();
    }
  }

  async function submit() {
    if (!ready() || state.submitLoading) return;
    state.submitLoading = true;
    state.submitError = "";
    render();

    try {
      if (canGetQuote() && (!state.quote || state.quoteKey !== currentQuoteKey())) {
        await fetchQuote();
      }

      const hasPaymentToken = Boolean(state.quote && state.quoteKey === currentQuoteKey() && state.paymentToken && state.acceptAgreement && state.firstName && state.lastName && state.phone);
      const url = typeof D.apiUrl === "function" ? D.apiUrl("book") : D.WORKER_URL;
      let payload = hasPaymentToken ? instantBookPayload() : inquiryPayload();
      let live = false;
      let redirectUrl = "";
      let confirmation = null;

      if (url) {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.ok) throw new Error(data.message || data.error || `Booking failed (${r.status})`);
        live = true;
        redirectUrl = data.redirectUrl || data.url || "";
        confirmation = data.reservation || data.received || null;
      }

      if (redirectUrl) {
        location.href = redirectUrl;
        return;
      }
      done(live, Boolean(hasPaymentToken), confirmation);
    } catch (error) {
      state.submitError = error.message || "Could not submit booking.";
      state.submitLoading = false;
      render();
    }
  }

  function done(live, paid, confirmation) {
    const heads = selected().map((p) => p.name).join(state.isEvent ? ", " : " + ");
    const reservationId = confirmation?.id || confirmation?.reservationId || confirmation?.confirmationCode || "";
    root.innerHTML = `
      <div class="bk-done">
        <div class="check-big">&#10003;</div>
        <h1 class="font-serif">${paid ? "Your booking was created." : state.isEvent ? "Your event inquiry was sent." : "Your request was sent."}</h1>
        <p>${paid
          ? `Your reservation for ${esc(heads)} was sent through Guesty${reservationId ? ` — confirmation ${esc(reservationId)}` : ""}.`
          : state.isEvent
            ? `The Timbercrest team will confirm availability for ${esc(heads)} and reach out at ${esc(state.email)} within one business day.`
            : `Your request for ${esc(heads)} (${nights()} nights) was sent. We'll confirm at ${esc(state.email)} within 24 hours.`}</p>
        <p class="fine">${live ? "Submitted via your Cloudflare Worker." : "Demo mode: the Worker is not connected, so this was simulated."}</p>
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