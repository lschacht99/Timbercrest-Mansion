/* Guesty data via Cloudflare Worker — progressive enhancement.
   Pages load instantly with static fallback data; this hydrates
   real photos, prices, and blocked dates on top. */
(function () {
  const D = window.TC;
  if (!D || !D.WORKER_BASE) return;
  const BASE = D.WORKER_BASE;
  const _cache = {};

  async function apiFetch(path) {
    if (path in _cache) return _cache[path];
    try {
      const r = await fetch(BASE + path);
      _cache[path] = r.ok ? await r.json() : null;
    } catch (e) { _cache[path] = null; }
    return _cache[path];
  }

  /* Public API — used by booking.js and auto-hydration below */
  D.api = {
    /* Full listing detail: pictures, description, amenities, prices */
    getListing: (listingId) => apiFetch(`/api/listing/${listingId}`),

    /* Blocked dates for the given window (ISO yyyy-mm-dd strings).
       Returns an array of date strings that are unavailable. */
    getCalendar: async (listingId, from, to) => {
      const data = await apiFetch(
        `/api/calendar?listingId=${listingId}&startDate=${from}&endDate=${to}`
      );
      if (!data) return [];
      /* Normalise both common response shapes */
      if (Array.isArray(data.blocked)) return data.blocked;          // {blocked:[...]}
      if (Array.isArray(data.data)) {                                  // Guesty native shape
        return data.data
          .filter((d) => d.status && d.status !== "available")
          .map((d) => d.date);
      }
      if (Array.isArray(data)) {                                       // plain array
        return data
          .filter((d) => d.status && d.status !== "available")
          .map((d) => d.date);
      }
      return [];
    },
  };

  /* ----------------------------------------------------------------
     Auto-hydrate photos on any page that declares data-listing-id
     on the <body> (property detail pages).
  ---------------------------------------------------------------- */
  async function hydratePage() {
    const lid = document.body.dataset.listingId;
    if (!lid) return;
    const data = await D.api.getListing(lid);
    if (!data) return;
    injectPhotos(document, data.pictures || []);
    updatePrices(document, data);
    updateDescription(document, data);
  }

  /* ----------------------------------------------------------------
     Auto-hydrate photos on the home page: each property card carries
     a data-prop-id that maps back to PROPERTIES[].listingId.
  ---------------------------------------------------------------- */
  async function hydrateHomePage() {
    const cards = document.querySelectorAll("[data-prop-id]");
    if (!cards.length) return;
    for (const card of cards) {
      const prop = D.PROPERTIES.find((p) => p.id === card.dataset.propId);
      if (!prop || !prop.listingId) continue;
      const data = await D.api.getListing(prop.listingId);
      if (!data) continue;
      const photos = data.pictures || [];
      const photo = photos[0];
      if (photo) setPhotoEl(card.querySelector(".photo"), photo.large || photo.original);
      updatePrices(card, data);
    }
  }

  /* Replace a .photo gradient placeholder with a real image */
  function setPhotoEl(el, src) {
    if (!el || !src) return;
    const img = document.createElement("img");
    img.alt = el.getAttribute("aria-label") || "";
    img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s";
    img.onload = () => { img.style.opacity = "1"; };
    img.onerror = () => { img.remove(); };
    img.src = src;
    el.style.position = "relative";
    el.appendChild(img);
  }

  /* Fill photo slots that carry data-photo-idx */
  function injectPhotos(scope, pics) {
    if (!pics.length) return;
    scope.querySelectorAll(".photo[data-photo-idx]").forEach((el) => {
      const idx = parseInt(el.dataset.photoIdx, 10);
      const pic = pics[idx];
      if (pic) setPhotoEl(el, pic.large || pic.original);
    });
  }

  function updatePrices(scope, data) {
    const price = data.prices && (data.prices.basePrice || data.prices.monthlyPriceFactor);
    if (!price) return;
    scope.querySelectorAll && scope.querySelectorAll("[data-live-price]").forEach((el) => {
      el.textContent = "$" + Math.round(price).toLocaleString();
    });
  }

  function updateDescription(scope, data) {
    const desc = data.publicDescription;
    if (!desc) return;
    const summary = desc.summary || desc.space || "";
    if (!summary) return;
    const el = scope.querySelector("[data-live-desc]");
    if (el) el.textContent = summary;
  }

  document.addEventListener("DOMContentLoaded", () => {
    hydratePage();
    hydrateHomePage();
  });
})();
