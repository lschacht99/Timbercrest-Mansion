/* Guesty/Cloudflare Worker adapter.
   Browser -> Cloudflare Worker only. Guesty credentials must stay inside the Worker. */
(function () {
  const D = window.TC;
  if (!D) return;

  const statusEl = document.querySelector("[data-guesty-status]");
  const listingsEl = document.querySelector("[data-guesty-listings]");
  const fallback = Array.isArray(D.PROPERTIES_FALLBACK) ? D.PROPERTIES_FALLBACK : [];

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  const slugify = (value) => String(value || "property")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "property";

  const toNumber = (...values) => {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };

  const firstString = (...values) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function apiUrl(name) {
    if (typeof D.apiUrl === "function") return D.apiUrl(name);
    if (!D.WORKER_BASE || !D.WORKER_ENDPOINTS || !D.WORKER_ENDPOINTS[name]) return "";
    return D.WORKER_BASE.replace(/\/$/, "") + D.WORKER_ENDPOINTS[name];
  }

  function listFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.properties)) return payload.properties;
    if (Array.isArray(payload?.listings)) return payload.listings;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.properties)) return payload.data.properties;
    if (Array.isArray(payload?.data?.listings)) return payload.data.listings;
    return [];
  }

  function pictureFrom(item) {
    const pic = item.picture || {};
    const firstPic = Array.isArray(item.pictures) ? item.pictures[0] : null;
    const firstImage = Array.isArray(item.images) ? item.images[0] : null;
    return firstString(
      item.image,
      item.imageUrl,
      pic.original,
      pic.regular,
      pic.thumbnail,
      pic.url,
      firstPic?.original,
      firstPic?.regular,
      firstPic?.thumbnail,
      firstPic?.url,
      firstImage?.url,
      firstImage?.src
    );
  }

  function matchFallback({ rawListingId, name }) {
    const normalizedName = slugify(name);
    return fallback.find((p) => p.listingId && p.listingId === rawListingId) ||
      fallback.find((p) => slugify(p.name) === normalizedName) ||
      fallback.find((p) => normalizedName.includes(slugify(p.name)) || slugify(p.name).includes(normalizedName));
  }

  function normalizeProperty(item) {
    const rawListingId = firstString(item.listingId, item._id, item.id, item.guestyId);
    const name = firstString(item.name, item.title, item.nickname, item.internalName, item.publicName, rawListingId);
    const matched = matchFallback({ rawListingId, name }) || {};
    const address = item.address || {};
    const city = firstString(
      item.city,
      item.location,
      [address.city, address.state || address.region].filter(Boolean).join(", "),
      matched.city,
      "Dover, Vermont"
    );
    const bedrooms = toNumber(item.bedrooms, item.bedroomsNumber, item.bedroomsCount, item.accommodations?.bedrooms, matched.bedrooms);
    const guests = toNumber(item.guests, item.maxGuests, item.accommodates, item.personCapacity, item.accommodations?.maxGuests, matched.guests);
    const baths = toNumber(item.baths, item.bathrooms, item.bathroomsNumber, item.accommodations?.bathrooms, matched.baths);
    const nightlyFrom = toNumber(
      item.nightlyFrom,
      item.nightly_from,
      item.basePrice,
      item.price,
      item.prices?.basePrice,
      item.rates?.basePrice,
      item.rates?.minNightly,
      matched.nightlyFrom
    );
    const rating = toNumber(item.rating, item.reviewScore, item.reviews?.rating, item.reviews?.average, item.stats?.rating, matched.rating);
    const reviews = toNumber(item.reviewsCount, item.reviewCount, item.reviews?.count, item.stats?.reviews, matched.reviews);
    const image = pictureFrom(item) || matched.image || "";
    const id = matched.id || slugify(item.slug || name || rawListingId);

    let pets = firstString(item.pets, item.petPolicy, matched.pets, "no").toLowerCase();
    if (item.petsAllowed === true || item.isPetsAllowed === true) pets = "allowed";
    if (item.petsAllowed === false || item.isPetsAllowed === false) pets = "no";
    if (!D.PETS_LABEL?.[pets]) pets = pets.includes("fee") ? "fee" : pets.includes("allow") || pets === "yes" ? "allowed" : "no";

    return {
      ...matched,
      id,
      listingId: rawListingId || matched.listingId || "",
      name: name || matched.name || "Timbercrest Mansion",
      bedrooms: bedrooms || matched.bedrooms || 0,
      guests: guests || matched.guests || 0,
      baths: baths || matched.baths || 0,
      nightlyFrom: nightlyFrom || matched.nightlyFrom || 0,
      minNights: toNumber(item.minNights, item.terms?.minNights, matched.minNights, 2) || 2,
      pets,
      rating: rating || matched.rating || 0,
      reviews: reviews || matched.reviews || 0,
      city,
      image,
      g1: item.g1 || matched.g1 || "#3a3f49",
      g2: item.g2 || matched.g2 || "#16181d",
      href: firstString(item.href, item.url, matched.href, `booking.html?ids=${encodeURIComponent(id)}`),
      blurb: firstString(item.blurb, item.summary, item.description, matched.blurb)
    };
  }

  function mergeWithFallback(liveProperties) {
    const seen = new Set();
    const merged = liveProperties.map((p) => {
      seen.add(p.id);
      return p;
    });
    fallback.forEach((p) => {
      if (!seen.has(p.id)) merged.push(p);
    });
    return merged;
  }

  function photoStyle(p) {
    const base = "aspect-ratio:4/3;border-radius:.9rem";
    if (p.image) {
      return `${base};background-image:url('${String(p.image).replace(/'/g, "%27")}');background-size:cover;background-position:center`;
    }
    return `${base};--g1:${p.g1};--g2:${p.g2}`;
  }

  function cardHTML(p) {
    const rating = p.rating ? `★ ${Number(p.rating).toFixed(2)}${p.reviews ? ` <span class="text-stone-400">(${Math.round(p.reviews)})</span>` : ""}` : "";
    const pets = D.PETS_LABEL?.[p.pets] && p.pets !== "no"
      ? `<span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:500;padding:.25rem .6rem;border-radius:99px;background:rgba(146,64,14,.1);color:#92400e">🐾 ${esc(D.PETS_LABEL[p.pets])}</span>`
      : "";
    const price = p.nightlyFrom
      ? `<span class="text-sm"><span class="font-semibold">$${Number(p.nightlyFrom).toLocaleString()}</span> <span class="text-stone-500">night</span></span>`
      : `<span class="text-sm text-stone-500">Request quote</span>`;

    return `<a href="${esc(p.href)}" class="block fade" style="text-decoration:none" data-property-id="${esc(p.id)}" data-listing-id="${esc(p.listingId)}">
      <div class="photo" style="${photoStyle(p)}" role="img" aria-label="${esc(p.name)}"></div>
      <div class="mt-3">
        <div class="flex justify-between gap-3">
          <span class="font-semibold text-[15px]">${esc(p.name)}${p.bedrooms ? ` — ${p.bedrooms}BR` : ""}</span>
          ${rating ? `<span class="text-sm shrink-0">${rating}</span>` : ""}
        </div>
        <div class="text-sm text-stone-500">${esc(p.city)}${p.guests ? ` · sleeps ${p.guests}` : ""}</div>
        <div class="flex items-center gap-2 mt-1">${price}${pets}</div>
      </div>
    </a>`;
  }

  function renderListings(properties) {
    if (!listingsEl || !properties.length) return;
    listingsEl.innerHTML = properties.map(cardHTML).join("");
  }

  async function loadLiveListings() {
    const url = apiUrl("listings");
    if (!url) {
      setStatus("Static preview · add window.TC_WORKER_BASE to use live Guesty data");
      return;
    }

    setStatus("Loading live Guesty data…");
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
      if (!response.ok) throw new Error(`Worker returned ${response.status}`);
      const payload = await response.json();
      const live = listFromPayload(payload).map(normalizeProperty).filter((p) => p.id && p.name);
      if (!live.length) throw new Error("Worker returned no listings");

      D.PROPERTIES = mergeWithFallback(live);
      D.PROPERTIES_LIVE = true;
      renderListings(D.PROPERTIES);
      setStatus("Live Guesty data connected");
      document.dispatchEvent(new CustomEvent("tc:properties-ready", { detail: { properties: D.PROPERTIES, source: "worker" } }));
    } catch (error) {
      D.PROPERTIES_LIVE = false;
      setStatus("Static preview · Worker not reachable yet");
      console.warn("Timbercrest Worker listings fallback:", error);
    }
  }

  loadLiveListings();
})();
