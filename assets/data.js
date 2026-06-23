/* Shared Timbercrest data.
   The static data below is the safe fallback for GitHub Pages. When the
   Cloudflare Worker is connected, assets/guesty-client.js replaces
   window.TC.PROPERTIES with live Guesty-normalized data. */
(function () {
  const DEFAULT_WORKER_BASE = "https://timbercrest.bookings-e2d.workers.dev";

  const fallbackProperties = [
    { id: "the-timbercrest", listingId: "68725a6736508a0012b410e1",
      name: "The Timbercrest", bedrooms: 12, guests: 32, baths: 12.5,
      nightlyFrom: 2450, minNights: 2, pets: "allowed", rating: 4.97, reviews: 86,
      city: "West Dover, Vermont", g1: "#3a3f49", g2: "#16181d",
      href: "stays/the-timbercrest.html",
      blurb: "12BR · Sleeps 32 · Indoor pool · Hot tub" },
    { id: "the-myrtle", listingId: "68725adcd80f8000131efe3f",
      name: "The Myrtle", bedrooms: 7, guests: 18, baths: 4,
      nightlyFrom: 1280, minNights: 2, pets: "fee", rating: 4.92, reviews: 64,
      city: "Dover, Vermont", g1: "#6e5840", g2: "#372a1d",
      href: "stays/the-myrtle.html",
      blurb: "7BR · Sleeps 18 · Hot tub · Pool" },
    { id: "the-birch", listingId: "68725ada8df7060012c68ab0",
      name: "The Birch", bedrooms: 13, guests: 32, baths: 11,
      nightlyFrom: 2300, minNights: 2, pets: "no", rating: 4.95, reviews: 71,
      city: "Dover, Vermont", g1: "#54687a", g2: "#26333e",
      href: "stays/the-birch.html",
      blurb: "13BR · Sleeps 32 · 2 min to lifts" },
    { id: "the-mahogany", listingId: "68725a69d70161000fb43b07",
      name: "The Mahogany", bedrooms: 9, guests: 22, baths: 9.5,
      nightlyFrom: 1750, minNights: 2, pets: "allowed", rating: 4.94, reviews: 58,
      city: "Dover, Vermont", g1: "#7a4a3a", g2: "#37201a",
      href: "stays/the-mahogany.html",
      blurb: "9BR · Sleeps 22 · Hot tub · Pool" }
  ];

  const workerBase = (window.TC_WORKER_BASE || DEFAULT_WORKER_BASE || "").replace(/\/$/, "");
  const endpoints = {
    listings: "/api/listings",
    availability: "/api/availability",
    calendar: "/api/calendar",
    images: "/api/images",
    quote: "/api/quote",
    book: "/api/book",
    config: "/config",
    paymentProvider: "/payment-provider"
  };

  window.TC = Object.assign(window.TC || {}, {
    WORKER_BASE: workerBase,
    WORKER_ENDPOINTS: endpoints,
    WORKER_URL: workerBase ? workerBase + endpoints.book : "",

    apiUrl(name) {
      if (!this.WORKER_BASE || !this.WORKER_ENDPOINTS[name]) return "";
      return this.WORKER_BASE + this.WORKER_ENDPOINTS[name];
    },

    PROPERTIES_FALLBACK: fallbackProperties,
    PROPERTIES: fallbackProperties.slice(),
    PROPERTIES_LIVE: false,

    PETS_LABEL: { allowed: "Pets welcome", fee: "Pets welcome (fee applies)", no: "No pets" },

    ACTIVITIES: [
      { name: "Mount Snow Resort", season: "winter", q: "skiing snow mountain lifts" },
      { name: "Carinthia Parks", season: "winter", q: "terrain park freestyle" },
      { name: "Snowmobile & dog sledding", season: "winter", q: "snowmobile dog sled" },
      { name: "Snow tubing", season: "winter", q: "tubing kids" },
      { name: "Bluebird Express foliage rides", season: "fall", q: "foliage chairlift leaves" },
      { name: "Mt. Olga fire tower", season: "fall", q: "hike view foliage" },
      { name: "Valley Trail", season: "summer", q: "bike walk wilmington" },
      { name: "Lake & summer adventure", season: "summer", q: "lake swim paddle golf" },
      { name: "Adams Family Farm", season: "all", q: "farm animals kids maple" },
      { name: "Wilmington village", season: "all", q: "shops galleries brewery restaurants" },
      { name: "Dot's Restaurant", season: "all", q: "diner food" }
    ],

    EVENTS: [
      { name: "Weddings", hint: "Ceremonies, carriage-barn receptions, whole-hillside buyouts" },
      { name: "Family reunions", hint: "26-year traditions start here" },
      { name: "Corporate retreats", hint: "Ballrooms, libraries, breakout spaces" },
      { name: "Milestones & parties", hint: "Anniversaries, galas, big birthdays" }
    ],

    CLEANING_PER_HOUSE: 650
  });

  const assetPrefix = /\/stays\//.test(location.pathname) ? "../" : "";

  if (!document.querySelector('link[data-schedule-popup]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = assetPrefix + "assets/schedule-popup.css?v=5";
    css.dataset.schedulePopup = "1";
    document.head.appendChild(css);
  }

  function loadScriptOnce(src, attrName) {
    if (document.querySelector(`script[${attrName}]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute(attrName, "1");
    document.body.appendChild(script);
  }

  if (/\/stays\//.test(location.pathname)) {
    loadScriptOnce("../assets/property-images.js?v=2", "data-property-images");
  }

  // Single source of truth: this includes Fletschhorn-style date modal + routing interception.
  loadScriptOnce(assetPrefix + "assets/schedule-popup.js?v=6", "data-schedule-popup");
})();