/**
 * Timbercrest Mansions — Guesty Cloudflare Worker
 * Multi-listing version adapted from the working Fletschhorn worker.
 *
 * Purpose:
 * - GitHub Pages / Squarespace calls this Worker.
 * - This Worker calls Guesty.
 * - Guesty credentials stay only in Cloudflare.
 * - Supports The Mahogany, Myrtle, Birch, and the 12BR villa near Mount Snow
 *   (often shown in Guesty as The Rosewood House / 12BR Villa Near Mount Snow).
 *
 * Required Cloudflare variables / secrets:
 *
 * ALLOWED_ORIGINS = https://lschacht99.github.io,https://timbercrestmansions.com,https://www.timbercrestmansions.com
 * CURRENCY = USD
 * SITE_BASE_URL = https://lschacht99.github.io/Timbercrest-Mansion
 * TIMEZONE = America/New_York
 *
 * Required for Open API routes:
 * GUESTY_OPEN_API_CLIENT_ID
 * GUESTY_OPEN_API_CLIENT_SECRET
 *
 * Required for Booking Engine routes:
 * GUESTY_CLIENT_ID
 * GUESTY_CLIENT_SECRET
 *
 * Choose ONE listing configuration:
 *
 * Recommended:
 * TIMBERCREST_LISTINGS_JSON = [
 *   {"siteId":"the-birch","publicName":"The Birch","guestyName":"The Birch house","listingId":"...","href":"stays/the-birch.html"},
 *   {"siteId":"the-mahogany","publicName":"The Mahogany","guestyName":"The Mahogany House","listingId":"...","href":"stays/the-mahogany.html"},
 *   {"siteId":"the-myrtle","publicName":"The Myrtle","guestyName":"The Myrtle House","listingId":"...","href":"stays/the-myrtle.html"},
 *   {"siteId":"the-timbercrest","publicName":"The Timbercrest","guestyName":"The Rosewood House","match":["The Rosewood House","12BR Villa Near Mount Snow"],"listingId":"...","href":"stays/the-timbercrest.html"}
 * ]
 *
 * Or simple:
 * GUESTY_LISTING_IDS = id1,id2,id3,id4
 *
 * Optional:
 * GUESTY_PAYMENT_PROVIDER_ID
 * TM_IMAGES_JSON
 * TM_CONTENT_JSON
 * DEBUG_RAW = 1
 * DISABLE_CACHE = 1
 *
 * Routes:
 * GET  /
 * GET  /health
 * GET  /debug
 * GET  /config
 * GET  /auth-test/open
 * GET  /auth-test/booking
 * GET  /api/listings
 * GET  /api/discover-listings
 * GET  /api/listing?listingId=...
 * GET  /api/images?listingId=...
 * GET  /api/calendar?listingId=...&from=2026-07-01&to=2026-07-31
 * GET  /api/availability?listingId=...&from=2026-07-01&to=2026-07-31
 * POST /api/quote
 * POST /api/book
 * GET  /api/booking-status?reservationId=...
 *
 * Legacy aliases are also available without /api:
 * /listings, /listing, /images, /calendar, /availability, /quote, /book
 */

const OPEN_API_BASE = "https://open-api.guesty.com/v1";
const OPEN_API_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

const BOOKING_API_BASE = "https://booking.guesty.com/api";
const BOOKING_API_TOKEN_URL = "https://booking.guesty.com/oauth2/token";

const CACHE_VERSION = "tm-guesty-multi-v1";
const BUILD_VERSION = "tm-guesty-worker-v1";
const TOKEN_CACHE_VERSION = "tm-oauth-token-cache-v1";
const QUOTE_CACHE_VERSION = "tm-quote-dedupe-v1";

const LISTINGS_TTL_SECONDS = 60 * 60 * 6;
const IMAGES_TTL_SECONDS = 60 * 60 * 24 * 7;
const CALENDAR_FRESH_SECONDS = 60 * 10;
const CALENDAR_STALE_SECONDS = 60 * 60 * 12;
const QUOTE_DEDUPE_SECONDS = 60 * 3;
const TOKEN_CACHE_SAFETY_MS = 5 * 60 * 1000;

let openTokenCache = null;
let bookingTokenCache = null;

export default {
  async fetch(request, env = {}, ctx = {}) {
    try {
      env = {
        ...(env || {}),
        __REQUEST_ORIGIN: request.headers.get("Origin") || ""
      };

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (request.method === "OPTIONS") return corsResponse("", 204, env);

      if (path === "/" && request.method === "GET") return handleRoot(env);
      if (path === "/health" && request.method === "GET") return handleHealth(env);
      if (path === "/debug" && request.method === "GET") return handleDebug(env);
      if (path === "/config" && request.method === "GET") return handleConfig(env);

      if (path === "/auth-test/open" && request.method === "GET") {
        return safeGuestyRoute(env, () => handleOpenAuthTest(env));
      }

      if (path === "/auth-test/booking" && request.method === "GET") {
        return safeGuestyRoute(env, () => handleBookingAuthTest(env));
      }

      if ((path === "/api/discover-listings" || path === "/discover-listings") && request.method === "GET") {
        return cachedRoute(request, env, ctx, {
          cacheName: "discover-listings",
          ttlSeconds: LISTINGS_TTL_SECONDS,
          handler: () => safeGuestyRoute(env, () => handleDiscoverListings(url, env))
        });
      }

      if ((path === "/api/listings" || path === "/listings") && request.method === "GET") {
        return cachedRoute(request, env, ctx, {
          cacheName: "listings",
          ttlSeconds: LISTINGS_TTL_SECONDS,
          handler: () => safeGuestyRoute(env, () => handleListings(url, env))
        });
      }

      if ((path === "/api/listing" || path === "/listing") && request.method === "GET") {
        return cachedRoute(request, env, ctx, {
          cacheName: "listing",
          ttlSeconds: LISTINGS_TTL_SECONDS,
          handler: () => safeGuestyRoute(env, () => handleListing(url, env))
        });
      }

      if ((path === "/api/images" || path === "/images") && request.method === "GET") {
        return cachedRoute(request, env, ctx, {
          cacheName: "images",
          ttlSeconds: IMAGES_TTL_SECONDS,
          handler: () => safeGuestyRoute(env, () => handleImages(url, env))
        });
      }

      if ((path === "/api/calendar" || path === "/calendar" || path === "/api/availability" || path === "/availability") && request.method === "GET") {
        return staleCachedRoute(request, env, ctx, {
          cacheName: "calendar",
          freshSeconds: CALENDAR_FRESH_SECONDS,
          staleSeconds: CALENDAR_STALE_SECONDS,
          handler: () => safeGuestyRoute(env, () => handleCalendar(url, env))
        });
      }

      if ((path === "/api/calendar-raw" || path === "/calendar-raw") && request.method === "GET") {
        return liveRoute(env, () => safeGuestyRoute(env, () => handleCalendarRaw(url, env)));
      }

      if ((path === "/api/quote" || path === "/quote") && request.method === "POST") {
        return quoteDedupeRoute(request, env);
      }

      if ((path === "/api/book" || path === "/book") && request.method === "POST") {
        return liveRoute(env, () => safeGuestyRoute(env, () => handleBook(request, env)));
      }

      if ((path === "/api/booking-status" || path === "/booking-status") && request.method === "GET") {
        return liveRoute(env, () => safeGuestyRoute(env, () => handleBookingStatus(url, env)));
      }

      return json({
        ok: false,
        error: "Not found",
        path,
        routes: publicRoutes()
      }, 404, env);
    } catch (err) {
      return errorResponse(err, env);
    }
  }
};

/* ----------------------------- ROUTES ----------------------------- */

function publicRoutes() {
  return [
    "GET /health",
    "GET /debug",
    "GET /config",
    "GET /auth-test/open",
    "GET /auth-test/booking",
    "GET /api/listings",
    "GET /api/discover-listings",
    "GET /api/listing?listingId=...",
    "GET /api/images?listingId=...",
    "GET /api/calendar?listingId=...&from=2026-07-01&to=2026-07-31",
    "GET /api/availability?listingId=...&from=2026-07-01&to=2026-07-31",
    "POST /api/quote",
    "POST /api/book",
    "GET /api/booking-status?reservationId=..."
  ];
}

function handleRoot(env) {
  return json({
    ok: true,
    service: "timbercrest-guesty-worker",
    buildVersion: BUILD_VERSION,
    property: "Timbercrest Mansions",
    message: "Worker is running.",
    routes: publicRoutes()
  }, 200, env);
}

function handleHealth(env) {
  return json({
    ok: true,
    service: "timbercrest-guesty-worker",
    property: "Timbercrest Mansions",
    time: new Date().toISOString()
  }, 200, env);
}

function handleDebug(env) {
  const configuredListings = getListingConfigs(env);
  const vars = {
    ALLOWED_ORIGINS: Boolean(env.ALLOWED_ORIGINS),
    CURRENCY: Boolean(env.CURRENCY),
    SITE_BASE_URL: Boolean(env.SITE_BASE_URL),
    TIMEZONE: Boolean(env.TIMEZONE),
    GUESTY_LISTING_IDS: Boolean(env.GUESTY_LISTING_IDS),
    TIMBERCREST_LISTINGS_JSON: Boolean(env.TIMBERCREST_LISTINGS_JSON),
    GUESTY_OPEN_API_CLIENT_ID: Boolean(env.GUESTY_OPEN_API_CLIENT_ID),
    GUESTY_OPEN_API_CLIENT_SECRET: Boolean(env.GUESTY_OPEN_API_CLIENT_SECRET),
    GUESTY_CLIENT_ID_BOOKING: Boolean(env.GUESTY_CLIENT_ID),
    GUESTY_CLIENT_SECRET_BOOKING: Boolean(env.GUESTY_CLIENT_SECRET),
    GUESTY_PAYMENT_PROVIDER_ID_OPTIONAL: Boolean(env.GUESTY_PAYMENT_PROVIDER_ID),
    TM_CACHE_KV_BINDING: hasKV(env)
  };

  return json({
    ok: true,
    buildVersion: BUILD_VERSION,
    cacheVersion: CACHE_VERSION,
    tokenCacheVersion: TOKEN_CACHE_VERSION,
    quoteCacheVersion: QUOTE_CACHE_VERSION,
    cacheBackend: hasKV(env) ? "KV" : "NO KV BINDING - live fallback",
    variables: vars,
    configuredListings,
    status: {
      baseConfigReady: Boolean(env.ALLOWED_ORIGINS && env.CURRENCY && env.SITE_BASE_URL && env.TIMEZONE),
      listingsConfigured: configuredListings.length > 0 || Boolean(env.GUESTY_LISTING_IDS),
      openApiReady: Boolean(env.GUESTY_OPEN_API_CLIENT_ID && env.GUESTY_OPEN_API_CLIENT_SECRET),
      bookingApiReady: Boolean(env.GUESTY_CLIENT_ID && env.GUESTY_CLIENT_SECRET)
    },
    routes: publicRoutes()
  }, 200, env);
}

function handleConfig(env) {
  return json({
    ok: true,
    propertyName: "Timbercrest Mansions",
    currency: env.CURRENCY || "USD",
    timezone: env.TIMEZONE || "America/New_York",
    siteBaseUrl: env.SITE_BASE_URL || "https://lschacht99.github.io/Timbercrest-Mansion",
    allowedOrigins: env.ALLOWED_ORIGINS || null,
    paymentProviderId: env.GUESTY_PAYMENT_PROVIDER_ID || null,
    listingCount: getListingConfigs(env).length,
    bookingPage: "/booking.html",
    guestyPayScript: "https://pay.guesty.com/tokenization/v1/init.js"
  }, 200, env);
}

async function handleOpenAuthTest(env) {
  const tokenData = await getOpenApiTokenData(env, true);
  return json({
    ok: true,
    auth: "open-api",
    tokenReceived: Boolean(tokenData.token),
    scope: tokenData.scope,
    expiresAt: new Date(tokenData.expiresAt).toISOString(),
    message: "Open API credentials work."
  }, 200, env);
}

async function handleBookingAuthTest(env) {
  const tokenData = await getBookingApiTokenData(env, true);
  return json({
    ok: true,
    auth: "booking-api",
    tokenReceived: Boolean(tokenData.token),
    scope: tokenData.scope,
    expiresAt: new Date(tokenData.expiresAt).toISOString(),
    message: "Booking Engine credentials work."
  }, 200, env);
}

async function handleDiscoverListings(url, env) {
  const all = await getAllGuestyListings(env);
  const query = String(url.searchParams.get("q") || "").toLowerCase();
  const filtered = query
    ? all.filter((listing) => searchableListingText(listing).includes(query))
    : all;

  return json({
    ok: true,
    count: filtered.length,
    listings: filtered.map((listing) => ({
      id: listing._id || listing.id || null,
      name: listing.nickname || listing.title || listing.name || listing.publicName || "",
      title: listing.title || null,
      nickname: listing.nickname || null,
      publicName: listing.publicName || null,
      address: listing.address || listing.location || null,
      guests: listing.accommodates || listing.terms?.maxGuests || listing.maxGuests || null,
      bedrooms: listing.bedrooms || listing.bedroomsCount || null,
      raw: env.DEBUG_RAW === "1" ? listing : undefined
    }))
  }, 200, env);
}

async function handleListings(url, env) {
  const configs = getListingConfigs(env);
  let listings = [];

  if (configs.length && configs.some((config) => config.listingId)) {
    listings = await Promise.all(configs.map(async (config) => {
      const listing = await getGuestyListingById(config.listingId, env);
      return normalizeListing(listing, env, config);
    }));
  } else if (configs.length) {
    const all = await getAllGuestyListings(env);
    listings = configs.map((config) => {
      const match = findConfiguredListing(all, config);
      return match ? normalizeListing(match, env, config) : fallbackListingFromConfig(config, env);
    });
  } else if (env.GUESTY_LISTING_IDS) {
    const ids = parseCSV(env.GUESTY_LISTING_IDS);
    listings = await Promise.all(ids.map(async (listingId) => {
      const listing = await getGuestyListingById(listingId, env);
      return normalizeListing(listing, env, { listingId });
    }));
  } else {
    const all = await getAllGuestyListings(env);
    listings = all
      .filter((listing) => DEFAULT_NAME_MATCHERS.some((matcher) => searchableListingText(listing).includes(matcher.toLowerCase())))
      .map((listing) => normalizeListing(listing, env, matchDefaultConfig(listing)));
  }

  listings = listings
    .filter((listing) => listing && listing.listingId)
    .sort((a, b) => (a.sort || 99) - (b.sort || 99));

  return json({
    ok: true,
    source: configs.length ? "configured-listings" : env.GUESTY_LISTING_IDS ? "GUESTY_LISTING_IDS" : "auto-discovery",
    currency: env.CURRENCY || "USD",
    timezone: env.TIMEZONE || "America/New_York",
    properties: listings,
    listings,
    count: listings.length
  }, 200, env);
}

async function handleListing(url, env) {
  const listingId = resolveListingIdFromRequest(url, env);
  const config = findConfigByAnyId(listingId, env) || { listingId };
  const listing = await getGuestyListingById(listingId, env);
  return json({
    ok: true,
    listing: normalizeListing(listing, env, config),
    raw: env.DEBUG_RAW === "1" ? listing : undefined
  }, 200, env);
}

async function handleImages(url, env) {
  const listingId = resolveListingIdFromRequest(url, env);
  const config = findConfigByAnyId(listingId, env) || { listingId };
  const listing = await getGuestyListingById(listingId, env);
  return json({
    ok: true,
    listingId,
    siteId: config.siteId || null,
    source: "Guesty listing",
    images: normalizeImagesFromListing(listing, config),
    raw: env.DEBUG_RAW === "1" ? listing : undefined
  }, 200, env);
}

async function handleCalendar(url, env) {
  const calendar = await fetchCalendarFromGuesty(url, env);
  return buildCalendarResponse(calendar, url, env, "calendar");
}

async function handleCalendarRaw(url, env) {
  const listingId = resolveListingIdFromRequest(url, env);
  const calendar = await fetchCalendarFromGuesty(url, env);
  return json({
    ok: true,
    listingId,
    from: url.searchParams.get("from") || url.searchParams.get("startDate"),
    to: url.searchParams.get("to") || url.searchParams.get("endDate"),
    rawShape: describeShape(calendar),
    raw: calendar
  }, 200, env);
}

function buildCalendarResponse(calendar, url, env, routeName) {
  const listingId = resolveListingIdFromRequest(url, env);
  const days = normalizeCalendar(calendar);
  return json({
    ok: true,
    route: routeName,
    listingId,
    from: url.searchParams.get("from") || url.searchParams.get("startDate"),
    to: url.searchParams.get("to") || url.searchParams.get("endDate"),
    adults: toNumberOrNull(url.searchParams.get("adults")),
    children: toNumberOrNull(url.searchParams.get("children")),
    currency: env.CURRENCY || "USD",
    timezone: env.TIMEZONE || "America/New_York",
    days,
    daysCount: days.length,
    rawShape: describeShape(calendar),
    raw: env.DEBUG_RAW === "1" ? calendar : undefined
  }, 200, env);
}

async function fetchCalendarFromGuesty(url, env) {
  const listingId = resolveListingIdFromRequest(url, env);
  const from = url.searchParams.get("from") || url.searchParams.get("startDate");
  const to = url.searchParams.get("to") || url.searchParams.get("endDate");

  assertRequired(listingId, "Missing listingId. Use ?listingId=GuestyId or ?id=siteId.");
  assertDate(from, "Missing or invalid from date. Use YYYY-MM-DD.");
  assertDate(to, "Missing or invalid to date. Use YYYY-MM-DD.");

  const query = new URLSearchParams({
    startDate: from,
    endDate: to,
    includeAllotment: "true"
  });

  return guestyOpenApi(
    env,
    "/availability-pricing/api/calendar/listings/" + encodeURIComponent(listingId) + "?" + query.toString(),
    { method: "GET" }
  );
}

async function handleQuote(request, env) {
  const body = await readJson(request);
  return handleQuoteFromBody(body, env);
}

async function handleQuoteFromBody(body, env) {
  const payload = buildQuotePayloadFromBody(body, env);
  const quote = await guestyBookingApi(env, "/reservations/quotes", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return json({
    ok: true,
    quote: normalizeQuote(quote, env),
    raw: env.DEBUG_RAW === "1" ? quote : undefined
  }, 200, env);
}

function buildQuotePayloadFromBody(body, env) {
  const listingId = resolveListingIdFromBody(body, env);
  const checkInDateLocalized =
    body.checkInDateLocalized ||
    body.checkin ||
    body.checkIn ||
    body.startDate ||
    body.arrivalDate;
  const checkOutDateLocalized =
    body.checkOutDateLocalized ||
    body.checkout ||
    body.checkOut ||
    body.endDate ||
    body.departureDate;

  const guestsCount = Number(
    body.guestsCount ||
    body.guests ||
    body.guests?.adults ||
    body.adults ||
    1
  );

  assertRequired(listingId, "Missing listingId");
  assertDate(checkInDateLocalized, "Missing or invalid check-in date. Use YYYY-MM-DD.");
  assertDate(checkOutDateLocalized, "Missing or invalid check-out date. Use YYYY-MM-DD.");
  assertPositiveNumber(guestsCount, "Invalid guests count");

  const payload = {
    listingId,
    checkInDateLocalized,
    checkOutDateLocalized,
    guestsCount,
    numberOfGuests: normalizeNumberOfGuests(body.numberOfGuests || body.guests, guestsCount)
  };

  if (body.coupons) {
    payload.coupons = Array.isArray(body.coupons) ? body.coupons.join(",") : String(body.coupons);
  }

  return payload;
}

async function handleBook(request, env) {
  const body = await readJson(request);

  /*
   * Full Guesty booking path: requires quoteId, ratePlanId and GuestyPay ccToken.
   * Inquiry path: the current static shell can POST a reservation request without payment.
   */
  if (!body.quoteId && !body.quote_id) {
    return json({
      ok: true,
      mode: "inquiry",
      message: "Booking inquiry received by Worker. Add quoteId/ratePlanId/ccToken for instant Guesty booking.",
      received: {
        propertyIds: body.propertyIds || [],
        listingIds: body.listingIds || [],
        checkIn: body.checkIn || null,
        checkOut: body.checkOut || null,
        guests: body.guests || null,
        email: body.email || null,
        isEvent: Boolean(body.isEvent),
        eventType: body.eventType || null,
        message: body.message || null
      }
    }, 200, env);
  }

  const quoteId = body.quoteId || body.quote_id;
  const ratePlanId = body.ratePlanId || body.rateplan_id || body.ratePlanID;
  const ccToken = body.ccToken || body.guestypayToken || body.guestypay_token;
  const guest = body.guest || buildGuestFromFlatBody(body);

  assertRequired(quoteId, "Missing quoteId");
  assertRequired(ratePlanId, "Missing ratePlanId");
  assertRequired(ccToken, "Missing GuestyPay token / ccToken");
  validateGuest(guest);

  if (!body.acceptAgreement && !body.acceptRentalAgreement && !body.accept_agreement) {
    throw new PublicError("Rental agreement must be accepted", 400);
  }

  const paymentProviderId =
    body.paymentProviderId ||
    body.payment_provider_id ||
    env.GUESTY_PAYMENT_PROVIDER_ID ||
    null;

  const payload = {
    ratePlanId,
    ccToken,
    guest,
    policy: body.policy || buildPolicyFromBody(body)
  };

  if (paymentProviderId) payload.paymentProviderId = paymentProviderId;

  const reservation = await guestyBookingApi(
    env,
    "/reservations/quotes/" + encodeURIComponent(quoteId) + "/instant",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

  return json({
    ok: true,
    message: "Reservation created",
    paymentProviderId,
    reservation: normalizeReservation(reservation),
    raw: env.DEBUG_RAW === "1" ? reservation : undefined
  }, 200, env);
}

async function handleBookingStatus(url, env) {
  const reservationId = url.searchParams.get("reservationId") || url.searchParams.get("id");
  assertRequired(reservationId, "Missing reservationId");

  const reservation = await guestyOpenApi(
    env,
    "/reservations-v3/" + encodeURIComponent(reservationId),
    { method: "GET" }
  );

  return json({
    ok: true,
    reservation: normalizeReservation(reservation),
    raw: env.DEBUG_RAW === "1" ? reservation : undefined
  }, 200, env);
}

/* ----------------------------- LISTING CONFIG ----------------------------- */

const DEFAULT_CONFIGS = [
  {
    siteId: "the-birch",
    publicName: "The Birch",
    guestyName: "The Birch house",
    match: ["The Birch house", "The Birch house 2", "The Birch 13BR Villa"],
    href: "stays/the-birch.html",
    sort: 1,
    g1: "#54687a",
    g2: "#26333e"
  },
  {
    siteId: "the-mahogany",
    publicName: "The Mahogany",
    guestyName: "The Mahogany House",
    match: ["The Mahogany House", "The Mahogany 2", "The Mahogany. House", "9BR Luxury Mansion"],
    href: "stays/the-mahogany.html",
    sort: 2,
    g1: "#7a4a3a",
    g2: "#37201a"
  },
  {
    siteId: "the-myrtle",
    publicName: "The Myrtle",
    guestyName: "The Myrtle House",
    match: ["The Myrtle House", "The Myrtle 2", "The Myrtle Villa"],
    href: "stays/the-myrtle.html",
    sort: 3,
    g1: "#6e5840",
    g2: "#372a1d"
  },
  {
    siteId: "the-timbercrest",
    publicName: "The Timbercrest",
    guestyName: "The Rosewood House",
    match: ["The Rosewood House", "12BR Villa Near Mount Snow", "12BR Villa Near Mount Sn"],
    href: "stays/the-timbercrest.html",
    sort: 4,
    g1: "#3a3f49",
    g2: "#16181d"
  }
];

const DEFAULT_NAME_MATCHERS = DEFAULT_CONFIGS.flatMap((config) => [config.guestyName, ...(config.match || [])]);

function getListingConfigs(env) {
  const fromJson = parseJsonEnv(env.TIMBERCREST_LISTINGS_JSON, null);
  if (Array.isArray(fromJson) && fromJson.length) {
    return fromJson.map((item, index) => ({
      ...DEFAULT_CONFIGS.find((config) => config.siteId === item.siteId),
      ...item,
      sort: Number(item.sort || DEFAULT_CONFIGS.find((config) => config.siteId === item.siteId)?.sort || index + 1)
    }));
  }

  const ids = parseCSV(env.GUESTY_LISTING_IDS);
  if (ids.length) {
    return ids.map((listingId, index) => ({
      ...(DEFAULT_CONFIGS[index] || {}),
      listingId,
      sort: index + 1
    }));
  }

  return DEFAULT_CONFIGS;
}

function findConfiguredListing(all, config) {
  if (!Array.isArray(all) || !all.length) return null;
  if (config.listingId) {
    const byId = all.find((listing) => String(listing._id || listing.id) === String(config.listingId));
    if (byId) return byId;
  }

  const matchers = [
    config.guestyName,
    config.publicName,
    config.siteId,
    ...(Array.isArray(config.match) ? config.match : [])
  ].filter(Boolean).map((value) => String(value).toLowerCase());

  return all.find((listing) => {
    const text = searchableListingText(listing);
    return matchers.some((matcher) => text.includes(matcher));
  }) || null;
}

function matchDefaultConfig(listing) {
  const text = searchableListingText(listing);
  return DEFAULT_CONFIGS.find((config) => [config.guestyName, ...(config.match || [])]
    .filter(Boolean)
    .some((matcher) => text.includes(String(matcher).toLowerCase()))) || {};
}

function findConfigByAnyId(value, env) {
  if (!value) return null;
  const needle = String(value);
  return getListingConfigs(env).find((config) =>
    String(config.siteId || "") === needle ||
    String(config.listingId || "") === needle ||
    slugify(config.publicName || "") === needle ||
    slugify(config.guestyName || "") === needle
  ) || null;
}

function resolveListingIdFromRequest(url, env) {
  const direct = url.searchParams.get("listingId") || url.searchParams.get("guestyListingId");
  if (direct) return direct;

  const siteId = url.searchParams.get("id") || url.searchParams.get("propertyId") || url.searchParams.get("siteId");
  const config = findConfigByAnyId(siteId, env);
  if (config?.listingId) return config.listingId;

  const first = getListingConfigs(env).find((item) => item.listingId);
  return first?.listingId || "";
}

function resolveListingIdFromBody(body, env) {
  const direct = body.listingId || body.guestyListingId || body.listingIds?.[0];
  if (direct) return direct;

  const siteId = body.id || body.propertyId || body.propertyIds?.[0] || body.siteId;
  const config = findConfigByAnyId(siteId, env);
  if (config?.listingId) return config.listingId;

  const first = getListingConfigs(env).find((item) => item.listingId);
  return first?.listingId || "";
}

function fallbackListingFromConfig(config, env) {
  return {
    id: config.siteId || slugify(config.publicName || config.guestyName || "property"),
    listingId: config.listingId || "",
    name: config.publicName || config.guestyName || "Timbercrest Mansion",
    title: config.publicName || config.guestyName || "Timbercrest Mansion",
    city: "Dover, Vermont",
    state: "VT",
    country: "US",
    timezone: env.TIMEZONE || "America/New_York",
    currency: env.CURRENCY || "USD",
    guests: null,
    bedrooms: null,
    bathrooms: null,
    baths: null,
    nightlyFrom: null,
    minNights: 2,
    pets: "allowed",
    rating: null,
    reviews: null,
    image: "",
    images: [],
    href: config.href || "booking.html",
    g1: config.g1 || "#3a3f49",
    g2: config.g2 || "#16181d",
    sort: config.sort || 99
  };
}

/* ----------------------------- GUESTY API ----------------------------- */

async function getGuestyListingById(listingId, env) {
  assertRequired(listingId, "Missing listingId");
  return guestyOpenApi(
    env,
    "/listings/" + encodeURIComponent(listingId),
    { method: "GET" }
  );
}

async function getAllGuestyListings(env) {
  const query = new URLSearchParams({
    limit: "100",
    fields: "_id id title nickname name publicName address accommodates maxGuests bedrooms bedroomsCount bathrooms bathroomsCount pictures picture prices terms active listed"
  });

  const data = await guestyOpenApi(env, "/listings?" + query.toString(), { method: "GET" });
  return extractList(data);
}

async function guestyOpenApi(env, path, options = {}) {
  const token = await getOpenApiToken(env);

  const res = await fetch(OPEN_API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "authorization": "Bearer " + token,
      ...(options.headers || {})
    },
    body: options.body
  });

  return parseGuestyResponse(res, "Guesty Open API");
}

async function guestyBookingApi(env, path, options = {}) {
  const token = await getBookingApiToken(env);

  const res = await fetch(BOOKING_API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "authorization": "Bearer " + token,
      ...(options.headers || {})
    },
    body: options.body
  });

  return parseGuestyResponse(res, "Guesty Booking API");
}

async function getOpenApiToken(env) {
  const tokenData = await getOpenApiTokenData(env, false);
  return tokenData.token;
}

async function getOpenApiTokenData(env, forceRefresh = false) {
  if (!forceRefresh && openTokenCache && tokenStillValid(openTokenCache)) return openTokenCache;

  if (!forceRefresh) {
    const kvToken = await getTokenFromKV(env, "open-api");
    if (kvToken) {
      openTokenCache = kvToken;
      return kvToken;
    }
  }

  const tokenData = await requestToken({
    tokenUrl: OPEN_API_TOKEN_URL,
    clientId: env.GUESTY_OPEN_API_CLIENT_ID,
    clientSecret: env.GUESTY_OPEN_API_CLIENT_SECRET,
    scope: "open-api",
    label: "Guesty Open API",
    missingMessage: "Missing Open API credentials. Add GUESTY_OPEN_API_CLIENT_ID and GUESTY_OPEN_API_CLIENT_SECRET."
  });

  openTokenCache = tokenData;
  await putTokenToKV(env, "open-api", tokenData);
  return tokenData;
}

async function getBookingApiToken(env) {
  const tokenData = await getBookingApiTokenData(env, false);
  return tokenData.token;
}

async function getBookingApiTokenData(env, forceRefresh = false) {
  if (!forceRefresh && bookingTokenCache && tokenStillValid(bookingTokenCache)) return bookingTokenCache;

  if (!forceRefresh) {
    const kvToken = await getTokenFromKV(env, "booking-api");
    if (kvToken) {
      bookingTokenCache = kvToken;
      return kvToken;
    }
  }

  const tokenData = await requestToken({
    tokenUrl: BOOKING_API_TOKEN_URL,
    clientId: env.GUESTY_CLIENT_ID,
    clientSecret: env.GUESTY_CLIENT_SECRET,
    scope: "booking_engine:api",
    label: "Guesty Booking API",
    missingMessage: "Missing Booking Engine credentials. Add GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET."
  });

  bookingTokenCache = tokenData;
  await putTokenToKV(env, "booking-api", tokenData);
  return tokenData;
}

async function requestToken({ tokenUrl, clientId, clientSecret, scope, label, missingMessage }) {
  assertRequired(clientId, missingMessage || ("Missing client ID for " + label));
  assertRequired(clientSecret, missingMessage || ("Missing client secret for " + label));

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("scope", scope);
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const data = await parseGuestyResponse(res, label + " OAuth");

  return {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 86400) - 300) * 1000,
    scope
  };
}

async function parseGuestyResponse(res, label) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new PublicError(label + " error", res.status, {
      status: res.status,
      body: data
    });
  }

  return data;
}

/* ----------------------------- NORMALIZERS ----------------------------- */

function normalizeListing(listing, env, config = {}) {
  const id = config.siteId || slugify(config.publicName || listing.nickname || listing.title || listing.name || listing._id || listing.id);
  const publicName = config.publicName || listing.publicName || listing.nickname || listing.title || listing.name || "Timbercrest Mansion";
  const images = normalizeImagesFromListing(listing, config);
  const address = listing.address || listing.location || {};
  const nightlyFrom = extractNightlyPrice(listing);

  return {
    id,
    listingId: listing._id || listing.id || config.listingId || "",
    name: publicName,
    title: listing.title || publicName,
    guestyName: listing.nickname || listing.name || listing.publicName || publicName,
    city: [address.city, address.state || address.region].filter(Boolean).join(", ") || config.city || "Dover, Vermont",
    state: address.state || address.region || "VT",
    country: address.country || "US",
    timezone: listing.timezone || env.TIMEZONE || "America/New_York",
    currency: listing.currency || env.CURRENCY || "USD",
    guests: toNumberOrNull(listing.accommodates || listing.terms?.maxGuests || listing.maxGuests || listing.personCapacity),
    bedrooms: toNumberOrNull(listing.bedrooms || listing.bedroomsCount || listing.bedroomsNumber),
    bathrooms: toNumberOrNull(listing.bathrooms || listing.bathroomsCount || listing.bathroomsNumber),
    baths: toNumberOrNull(listing.bathrooms || listing.bathroomsCount || listing.bathroomsNumber),
    nightlyFrom,
    minNights: toNumberOrNull(listing.terms?.minNights || listing.minNights || config.minNights) || 2,
    pets: normalizePets(listing, config),
    rating: toNumberOrNull(listing.rating || listing.reviewScore || listing.reviews?.rating || listing.stats?.rating || config.rating),
    reviews: toNumberOrNull(listing.reviewsCount || listing.reviewCount || listing.reviews?.count || listing.stats?.reviews || config.reviews),
    image: images[0]?.url || "",
    images,
    description: listing.description || listing.publicDescription || listing.summary || "",
    amenities: listing.amenities || [],
    href: config.href || "booking.html?ids=" + encodeURIComponent(id),
    g1: config.g1 || "#3a3f49",
    g2: config.g2 || "#16181d",
    sort: config.sort || 99,
    raw: env.DEBUG_RAW === "1" ? listing : undefined
  };
}

function normalizeImagesFromListing(listing, config = {}) {
  const pictures = listing.pictures || listing.photos || listing.images || listing.picture || [];

  if (Array.isArray(pictures)) {
    return pictures.map((pic, index) => ({
      id: pic._id || pic.id || "image-" + (index + 1),
      url: pic.original || pic.regular || pic.url || pic.src || pic.thumbnail || pic.large,
      alt: pic.caption || pic.alt || (config.publicName || listing.title || "Timbercrest image") + " " + (index + 1),
      caption: pic.caption || ""
    })).filter((img) => img.url);
  }

  if (pictures && typeof pictures === "object") {
    const url = pictures.original || pictures.regular || pictures.url || pictures.src || pictures.thumbnail || pictures.large;
    return url ? [{ id: pictures._id || pictures.id || "image-1", url, alt: config.publicName || "Timbercrest image", caption: pictures.caption || "" }] : [];
  }

  return [];
}

function normalizeCalendar(calendar) {
  const sourceDays = extractCalendarDays(calendar);

  return sourceDays.map((day) => {
    const allotment = toNumberOrNull(day.allotment);
    const status = String(day.status || day.availability || "").toLowerCase();

    const available = allotment !== null
      ? allotment > 0
      : ["available", "open", "selectable"].includes(status) ||
        day.available === true ||
        day.isAvailable === true ||
        day.isAvailableForCheckIn === true;

    return {
      date: day.date || day.day || day.dateLocalized || day.localDate || day.startDate || day.from || null,
      available,
      status: day.status || day.availability || (available ? "available" : "unavailable"),
      price: extractPrice(day),
      currency: day.currency || day.pricing?.currency || day.price?.currency || null,
      minNights: toNumberOrNull(day.minNights || day.min_nights || day.minimumStay || day.minStay || day.minNightsForCheckIn),
      checkInAllowed: day.cta === false ? false : day.checkInAllowed !== false && day.checkinAllowed !== false && day.isCheckInAllowed !== false,
      checkOutAllowed: day.ctd === false ? false : day.checkOutAllowed !== false && day.checkoutAllowed !== false && day.isCheckOutAllowed !== false,
      allotment,
      reason: day.blockType || day.reason || day.note || day.blockReason || null
    };
  }).filter((day) => day.date);
}

function normalizeQuote(quote, env) {
  const quoteId = quote._id || quote.id || quote.quoteId || quote.quote?.id || quote.quote?._id;
  const ratePlans = quote.ratePlans || quote.rateplans || quote.rates || quote.availableRatePlans || [];
  const selectedRatePlan = ratePlans?.[0]?._id || ratePlans?.[0]?.id || quote.ratePlanId || quote.rateplanId || null;
  const money = quote.money || quote.financials || quote.price || quote.pricing || {};
  const total = money.total || money.totalPrice || quote.total || quote.totalPrice || quote.money?.hostPayout || null;

  return {
    quoteId,
    ratePlanId: selectedRatePlan,
    currency: quote.currency || money.currency || env.CURRENCY || "USD",
    total: toNumberOrNull(total),
    rent: toNumberOrNull(money.fareAccommodation || money.accommodationFare || money.rent || money.subtotal),
    taxes: toNumberOrNull(money.taxes || money.tax),
    fees: toNumberOrNull(money.fees || money.cleaningFee),
    paymentDueNow: toNumberOrNull(money.paymentDueNow || money.dueNow || money.deposit),
    ratePlans: normalizeRatePlans(ratePlans),
    breakdown: normalizeBreakdown(quote),
    expiresAt: quote.expiresAt || quote.expiration || null
  };
}

function normalizeRatePlans(ratePlans) {
  if (!Array.isArray(ratePlans)) return [];
  return ratePlans.map((plan) => ({
    id: plan._id || plan.id || plan.ratePlanId,
    name: plan.name || plan.title || "Rate plan",
    total: toNumberOrNull(plan.total || plan.price || plan.amount),
    currency: plan.currency || null
  })).filter((plan) => plan.id);
}

function normalizeBreakdown(quote) {
  const money = quote.money || quote.financials || quote.price || quote.pricing || {};
  const invoiceItems = quote.invoiceItems || money.invoiceItems || money.items || quote.items || [];

  if (Array.isArray(invoiceItems) && invoiceItems.length) {
    return invoiceItems.map((item) => ({
      label: item.title || item.name || item.type || item.label || "Item",
      type: item.type || null,
      amount: toNumberOrNull(item.amount || item.total || item.value || item.price)
    }));
  }

  const fallback = [];
  addBreakdownItem(fallback, "Accommodation", money.fareAccommodation || money.accommodationFare || money.rent || money.subtotal);
  addBreakdownItem(fallback, "Fees", money.fees || money.cleaningFee);
  addBreakdownItem(fallback, "Taxes", money.taxes || money.tax);
  addBreakdownItem(fallback, "Total", money.total || quote.total || quote.totalPrice);
  return fallback;
}

function normalizeReservation(reservation) {
  return {
    id: reservation._id || reservation.id || reservation.reservationId,
    confirmationCode: reservation.confirmationCode || reservation.confirmation_code || null,
    status: reservation.status || reservation.reservationStatus || null,
    checkIn: reservation.checkIn || reservation.checkInDateLocalized || reservation.checkin || null,
    checkOut: reservation.checkOut || reservation.checkOutDateLocalized || reservation.checkout || null,
    guest: reservation.guest || reservation.guestInfo || null,
    money: reservation.money || reservation.financials || null,
    payments: reservation.money?.payments || reservation.payments || null,
    createdAt: reservation.createdAt || null
  };
}

/* ----------------------------- DATA EXTRACTORS ----------------------------- */

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.listings)) return data.data.listings;
  return [];
}

function extractCalendarDays(calendar) {
  if (Array.isArray(calendar)) return calendar;
  if (!calendar || typeof calendar !== "object") return [];

  const directCandidates = [
    calendar.days,
    calendar.data,
    calendar.calendar,
    calendar.results,
    calendar.items,
    calendar.payload,
    calendar.response,
    calendar.availability,
    calendar.pricing,
    calendar.calendarDays,
    calendar.availableDates
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = extractCalendarDays(candidate);
      if (nested.length) return nested;
    }
  }

  const dateKeyItems = Object.keys(calendar)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .map((key) => {
      const value = calendar[key];
      return value && typeof value === "object" ? { date: key, ...value } : { date: key, value };
    });

  if (dateKeyItems.length) return dateKeyItems;

  const objectValues = Object.values(calendar).filter((value) => value && typeof value === "object");
  for (const value of objectValues) {
    const nested = extractCalendarDays(value);
    if (nested.length) return nested;
  }

  return [];
}

function extractPrice(day) {
  const candidates = [
    day.price,
    day.rate,
    day.amount,
    day.basePrice,
    day.nightlyPrice,
    day.pricing?.price,
    day.pricing?.nightly,
    day.pricing?.amount,
    day.rates?.rate,
    day.rates?.price,
    day.money?.price
  ];

  for (const value of candidates) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
    if (value && typeof value === "object") {
      const nested = value.amount || value.value || value.total || value.price;
      if (nested !== undefined && !Number.isNaN(Number(nested))) return Number(nested);
    }
  }

  return null;
}

function extractNightlyPrice(listing) {
  const candidates = [
    listing.nightlyFrom,
    listing.basePrice,
    listing.price,
    listing.prices?.basePrice,
    listing.prices?.base,
    listing.rates?.basePrice,
    listing.rates?.minNightly,
    listing.terms?.basePrice
  ];

  for (const value of candidates) {
    const n = toNumberOrNull(value);
    if (n !== null && n > 0) return n;
  }

  return null;
}

function normalizePets(listing, config = {}) {
  const text = String(
    listing.pets ||
    listing.petPolicy ||
    listing.terms?.pets ||
    config.pets ||
    ""
  ).toLowerCase();

  if (listing.petsAllowed === true || listing.isPetsAllowed === true || text.includes("allow") || text === "yes") return "allowed";
  if (text.includes("fee")) return "fee";
  if (listing.petsAllowed === false || listing.isPetsAllowed === false || text.includes("no")) return "no";
  return config.pets || "allowed";
}

function searchableListingText(listing) {
  return [
    listing._id,
    listing.id,
    listing.title,
    listing.nickname,
    listing.name,
    listing.publicName,
    listing.internalName,
    listing.address?.full,
    listing.address?.street,
    listing.address?.city,
    listing.address?.state
  ].filter(Boolean).join(" ").toLowerCase();
}

function describeShape(value) {
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      firstItemKeys: value[0] && typeof value[0] === "object" ? Object.keys(value[0]) : null
    };
  }

  if (!value || typeof value !== "object") return { type: typeof value };

  const keys = Object.keys(value);
  const sample = {};
  for (const key of keys.slice(0, 12)) {
    const v = value[key];
    sample[key] = Array.isArray(v)
      ? { type: "array", length: v.length, firstItemKeys: v[0] && typeof v[0] === "object" ? Object.keys(v[0]) : null }
      : v && typeof v === "object"
        ? { type: "object", keys: Object.keys(v).slice(0, 12) }
        : { type: typeof v, value: v };
  }
  return { type: "object", keys, sample };
}

/* ----------------------------- BOOKING HELPERS ----------------------------- */

function normalizeNumberOfGuests(numberOfGuests, guestsCount) {
  const fallbackAdults = Math.max(1, Number(guestsCount || 1));

  if (!numberOfGuests || typeof numberOfGuests !== "object" || Array.isArray(numberOfGuests)) {
    return {
      numberOfAdults: fallbackAdults,
      numberOfChildren: 0,
      numberOfInfants: 0,
      numberOfPets: 0
    };
  }

  return {
    numberOfAdults: Math.max(1, Number(numberOfGuests.numberOfAdults ?? numberOfGuests.adults ?? guestsCount ?? 1)),
    numberOfChildren: Math.max(0, Number(numberOfGuests.numberOfChildren ?? numberOfGuests.children ?? 0)),
    numberOfInfants: Math.max(0, Number(numberOfGuests.numberOfInfants ?? numberOfGuests.infants ?? 0)),
    numberOfPets: Math.max(0, Number(numberOfGuests.numberOfPets ?? numberOfGuests.pets ?? 0))
  };
}

function buildGuestFromFlatBody(body) {
  return {
    firstName: body.firstName || body.first_name,
    lastName: body.lastName || body.last_name,
    email: body.email,
    phone: body.phone,
    note: body.message || body.note || ""
  };
}

function buildPolicyFromBody(body) {
  return {
    privacy: Boolean(body.acceptPrivacy || body.accept_agreement || body.acceptAgreement),
    terms: Boolean(body.acceptTerms || body.accept_agreement || body.acceptAgreement),
    rentalAgreement: Boolean(body.acceptRentalAgreement || body.accept_rental_agreement || body.acceptAgreement)
  };
}

function validateGuest(guest) {
  assertRequired(guest, "Missing guest");
  assertRequired(guest.firstName || guest.first_name, "Missing guest first name");
  assertRequired(guest.lastName || guest.last_name, "Missing guest last name");
  assertRequired(guest.email, "Missing guest email");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(guest.email))) {
    throw new PublicError("Invalid guest email", 400);
  }

  assertRequired(guest.phone, "Missing guest phone");
}

/* ----------------------------- SAFE ERROR WRAPPER ----------------------------- */

async function safeGuestyRoute(env, fn) {
  try {
    return await fn();
  } catch (err) {
    const status = err instanceof PublicError ? err.status : 500;
    const details = err instanceof PublicError ? err.details : null;
    const body = details && details.body ? details.body : null;

    const isRateLimit =
      status === 429 ||
      body?.error?.code === "TOO_MANY_REQUESTS" ||
      body?.code === "TOO_MANY_REQUESTS";

    const isUnauthorized =
      status === 401 ||
      body?.error?.code === "UNAUTHORIZED" ||
      body?.code === "UNAUTHORIZED" ||
      body?.error === "invalid_client";

    return json({
      ok: false,
      error: safeError(err),
      status,
      rateLimited: isRateLimit,
      unauthorized: isUnauthorized,
      message: isRateLimit
        ? "Guesty is rate-limiting OAuth/API requests. Stop testing Guesty routes for 10-20 minutes, then test only one route."
        : isUnauthorized
          ? "Guesty rejected these credentials. Open API routes require GUESTY_OPEN_API_CLIENT_ID / GUESTY_OPEN_API_CLIENT_SECRET. Booking routes require GUESTY_CLIENT_ID / GUESTY_CLIENT_SECRET."
          : safeError(err),
      details,
      doNotRetestRapidly: isRateLimit ? true : undefined
    }, status, env);
  }
}

function errorResponse(err, env) {
  const status = err instanceof PublicError ? err.status : 500;

  return new Response(JSON.stringify({
    ok: false,
    error: "Worker caught exception",
    message: safeError(err),
    details: err instanceof PublicError ? err.details : undefined
  }, null, 2), {
    status,
    headers: {
      ...corsHeaders(env || {}),
      "content-type": "application/json; charset=utf-8"
    }
  });
}

/* ----------------------------- CACHE HELPERS ----------------------------- */

function hasKV(env = {}) {
  return Boolean(env && env.TM_CACHE && typeof env.TM_CACHE.get === "function" && typeof env.TM_CACHE.put === "function") ||
    Boolean(env && env.FH_CACHE && typeof env.FH_CACHE.get === "function" && typeof env.FH_CACHE.put === "function");
}

function getKV(env = {}) {
  return env.TM_CACHE || env.FH_CACHE || null;
}

async function staleCachedRoute(request, env, ctx, { cacheName, freshSeconds, staleSeconds, handler }) {
  const url = new URL(request.url);
  const bypass = url.searchParams.get("refresh") === "1" || url.searchParams.get("cache") === "0" || env.DISABLE_CACHE === "1";

  if (request.method !== "GET" || bypass || !hasKV(env)) {
    const response = await handler();
    return withCacheHeader(response, bypass ? "BYPASS" : "LIVE_NO_KV", env);
  }

  const cacheKey = buildCacheKey(request, cacheName);
  const cached = await kvGet(env, cacheKey);

  if (cached && cached.body) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(cached.createdAt || 0)) / 1000));

    if (ageSeconds <= freshSeconds) return responseFromKV(cached, env, "HIT_FRESH", freshSeconds, ageSeconds);

    if (ageSeconds <= staleSeconds) {
      ctx?.waitUntil?.(refreshKVRoute(request, env, { cacheName, staleSeconds, handler }));
      return responseFromKV(cached, env, "HIT_STALE_REFRESHING", staleSeconds, ageSeconds);
    }
  }

  const response = await handler();

  if (!response || response.status < 200 || response.status >= 300) {
    if (cached && cached.body) return responseFromKV(cached, env, "HIT_STALE_GUESTY_ERROR", staleSeconds, null);
    return withCacheHeader(response, "MISS_ERROR_NOT_CACHED", env);
  }

  return storeAndReturnKV(request, env, {
    cacheName,
    ttlSeconds: staleSeconds,
    browserSeconds: freshSeconds,
    response,
    cacheStatus: "MISS_STORED"
  });
}

async function cachedRoute(request, env, ctx, { cacheName, ttlSeconds, handler }) {
  const url = new URL(request.url);
  const bypass = url.searchParams.get("refresh") === "1" || url.searchParams.get("cache") === "0" || env.DISABLE_CACHE === "1";

  if (request.method !== "GET" || bypass || !hasKV(env)) {
    const response = await handler();
    return withCacheHeader(response, bypass ? "BYPASS" : "LIVE_NO_KV", env);
  }

  const cacheKey = buildCacheKey(request, cacheName);
  const cached = await kvGet(env, cacheKey);

  if (cached && cached.body) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(cached.createdAt || 0)) / 1000));
    if (ageSeconds <= ttlSeconds) return responseFromKV(cached, env, "HIT", ttlSeconds, ageSeconds);
  }

  const response = await handler();

  if (!response || response.status < 200 || response.status >= 300) {
    if (cached && cached.body) return responseFromKV(cached, env, "HIT_STALE_GUESTY_ERROR", ttlSeconds, null);
    return withCacheHeader(response, "MISS_ERROR_NOT_CACHED", env);
  }

  return storeAndReturnKV(request, env, {
    cacheName,
    ttlSeconds,
    browserSeconds: ttlSeconds,
    response,
    cacheStatus: "MISS_STORED"
  });
}

async function liveRoute(env, handler) {
  const response = await handler();

  if (!response) return json({ ok: false, error: "No response from live route handler" }, 500, env);

  const body = await response.text();
  const headers = new Headers(response.headers);

  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-tm-cache", "LIVE");

  const cors = corsHeaders(env);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);

  return new Response(body, { status: response.status, headers });
}

async function refreshKVRoute(request, env, { cacheName, staleSeconds, handler }) {
  try {
    if (!hasKV(env)) return;
    const response = await handler();
    if (!response || response.status < 200 || response.status >= 300) return;

    const body = await response.text();
    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";

    await getKV(env).put(buildCacheKey(request, cacheName), JSON.stringify({
      version: CACHE_VERSION,
      cacheName,
      status: response.status,
      contentType,
      createdAt: Date.now(),
      body
    }), { expirationTtl: Math.max(60, Number(staleSeconds || 60)) });
  } catch {
    /* Keep stale data if refresh fails. */
  }
}

async function storeAndReturnKV(request, env, { cacheName, ttlSeconds, browserSeconds, response, cacheStatus }) {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";
  const createdAt = Date.now();

  try {
    if (hasKV(env)) {
      await getKV(env).put(buildCacheKey(request, cacheName), JSON.stringify({
        version: CACHE_VERSION,
        cacheName,
        status: response.status,
        contentType,
        createdAt,
        body
      }), { expirationTtl: Math.max(60, Number(ttlSeconds || 60)) });
    }
  } catch {
    /* Cache write failure must never break booking/calendar. */
  }

  return new Response(body, {
    status: response.status,
    headers: {
      ...corsHeaders(env),
      "content-type": contentType,
      "cache-control": `public, max-age=${browserSeconds}`,
      "x-tm-cache": cacheStatus,
      "x-tm-cache-source": cacheName,
      "x-tm-cache-backend": hasKV(env) ? "KV" : "NONE",
      "x-tm-cache-created": new Date(createdAt).toISOString()
    }
  });
}

async function kvGet(env, key) {
  try {
    if (!hasKV(env)) return null;
    const text = await getKV(env).get(key, "text");
    if (!text) return null;
    const data = JSON.parse(text);
    if (!data || data.version !== CACHE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

function responseFromKV(cached, env, cacheStatus, browserSeconds, ageSeconds) {
  return new Response(cached.body, {
    status: cached.status || 200,
    headers: {
      ...corsHeaders(env),
      "content-type": cached.contentType || "application/json; charset=utf-8",
      "cache-control": `public, max-age=${browserSeconds}`,
      "x-tm-cache": cacheStatus,
      "x-tm-cache-source": cached.cacheName || "",
      "x-tm-cache-backend": "KV",
      "x-tm-cache-age": ageSeconds === null || ageSeconds === undefined ? "" : String(ageSeconds),
      "x-tm-cache-created": cached.createdAt ? new Date(Number(cached.createdAt)).toISOString() : ""
    }
  });
}

async function withCacheHeader(response, cacheStatus, env) {
  if (!response) return json({ ok: false, error: "No response from route handler" }, 500, env);

  const body = await response.text();
  const headers = new Headers(response.headers);
  headers.set("x-tm-cache", cacheStatus);
  headers.set("x-tm-cache-backend", hasKV(env) ? "KV" : "NONE");

  const cors = corsHeaders(env);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);

  return new Response(body, { status: response.status, headers });
}

function buildCacheKey(request, cacheName) {
  const url = new URL(request.url);
  url.searchParams.delete("_");
  url.searchParams.delete("t");
  url.searchParams.delete("refresh");
  url.searchParams.delete("cache");

  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sorted = new URLSearchParams();
  for (const [key, value] of entries) sorted.append(key, value);

  return [CACHE_VERSION, cacheName, url.pathname, sorted.toString()].join("::");
}

/* ----------------------------- QUOTE DE-DUPE CACHE ----------------------------- */

async function quoteDedupeRoute(request, env) {
  return safeGuestyRoute(env, async () => {
    const body = await readJson(request);
    const payload = buildQuotePayloadFromBody(body, env);
    const bypass = body.refresh === true || body.refresh === "1" || body.cache === "0" || env.DISABLE_CACHE === "1";
    const cacheKey = buildQuoteCacheKey(payload);

    if (!bypass && hasKV(env)) {
      const cached = await quoteKVGet(env, cacheKey);
      if (cached && cached.body) {
        const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(cached.createdAt || 0)) / 1000));
        return responseFromQuoteKV(cached, env, "QUOTE_HIT", ageSeconds);
      }
    }

    const response = await handleQuoteFromBody(body, env);
    if (!response || response.status < 200 || response.status >= 300) {
      return withNoStoreAndCacheHeader(response, bypass ? "QUOTE_BYPASS_ERROR" : "QUOTE_ERROR_NOT_CACHED", env);
    }

    const responseBody = await response.text();
    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";
    const createdAt = Date.now();

    if (!bypass && hasKV(env)) {
      await quoteKVPut(env, cacheKey, {
        version: QUOTE_CACHE_VERSION,
        cacheName: "quote-dedupe",
        status: response.status,
        contentType,
        createdAt,
        body: responseBody
      });
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders(env),
        "content-type": contentType,
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "x-tm-cache": bypass ? "QUOTE_BYPASS" : (hasKV(env) ? "QUOTE_MISS_STORED" : "QUOTE_LIVE_NO_KV"),
        "x-tm-cache-source": "quote-dedupe",
        "x-tm-cache-backend": hasKV(env) ? "KV" : "NONE",
        "x-tm-quote-dedupe-seconds": String(QUOTE_DEDUPE_SECONDS),
        "x-tm-cache-created": new Date(createdAt).toISOString()
      }
    });
  });
}

function buildQuoteCacheKey(payload) {
  const normalized = {
    listingId: payload.listingId,
    checkInDateLocalized: payload.checkInDateLocalized,
    checkOutDateLocalized: payload.checkOutDateLocalized,
    guestsCount: Number(payload.guestsCount || 1),
    numberOfGuests: {
      numberOfAdults: Number(payload.numberOfGuests?.numberOfAdults || 1),
      numberOfChildren: Number(payload.numberOfGuests?.numberOfChildren || 0),
      numberOfInfants: Number(payload.numberOfGuests?.numberOfInfants || 0),
      numberOfPets: Number(payload.numberOfGuests?.numberOfPets || 0)
    },
    coupons: payload.coupons || ""
  };

  return [QUOTE_CACHE_VERSION, "quote", hashString(stableStringify(normalized))].join("::");
}

async function quoteKVGet(env, key) {
  try {
    if (!hasKV(env)) return null;
    const text = await getKV(env).get(key, "text");
    if (!text) return null;
    const data = JSON.parse(text);
    if (!data || data.version !== QUOTE_CACHE_VERSION) return null;
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(data.createdAt || 0)) / 1000));
    if (ageSeconds > QUOTE_DEDUPE_SECONDS) return null;
    return data;
  } catch {
    return null;
  }
}

async function quoteKVPut(env, key, record) {
  try {
    if (!hasKV(env)) return;
    await getKV(env).put(key, JSON.stringify(record), {
      expirationTtl: Math.max(60, QUOTE_DEDUPE_SECONDS)
    });
  } catch {
    /* Quote de-dupe cache failure must never break checkout. */
  }
}

function responseFromQuoteKV(cached, env, cacheStatus, ageSeconds) {
  return new Response(cached.body, {
    status: cached.status || 200,
    headers: {
      ...corsHeaders(env),
      "content-type": cached.contentType || "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
      "x-tm-cache": cacheStatus,
      "x-tm-cache-source": "quote-dedupe",
      "x-tm-cache-backend": "KV",
      "x-tm-cache-age": String(ageSeconds || 0),
      "x-tm-quote-dedupe-seconds": String(QUOTE_DEDUPE_SECONDS),
      "x-tm-cache-created": cached.createdAt ? new Date(Number(cached.createdAt)).toISOString() : ""
    }
  });
}

async function withNoStoreAndCacheHeader(response, cacheStatus, env) {
  if (!response) return json({ ok: false, error: "No response from quote handler" }, 500, env);

  const body = await response.text();
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-tm-cache", cacheStatus);
  headers.set("x-tm-cache-backend", hasKV(env) ? "KV" : "NONE");

  const cors = corsHeaders(env);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);

  return new Response(body, { status: response.status, headers });
}

/* ----------------------------- TOKEN CACHE ----------------------------- */

function tokenStillValid(tokenData) {
  return Boolean(
    tokenData &&
    tokenData.token &&
    Number(tokenData.expiresAt || 0) > Date.now() + TOKEN_CACHE_SAFETY_MS
  );
}

function tokenCacheKey(name) {
  return [TOKEN_CACHE_VERSION, name].join("::");
}

async function getTokenFromKV(env, name) {
  try {
    if (!hasKV(env)) return null;
    const text = await getKV(env).get(tokenCacheKey(name), "text");
    if (!text) return null;
    const data = JSON.parse(text);
    if (!data || data.version !== TOKEN_CACHE_VERSION) return null;
    if (!tokenStillValid(data)) return null;
    return {
      token: data.token,
      expiresAt: Number(data.expiresAt),
      scope: data.scope || name
    };
  } catch {
    return null;
  }
}

async function putTokenToKV(env, name, tokenData) {
  try {
    if (!hasKV(env) || !tokenStillValid(tokenData)) return;
    const ttlSeconds = Math.max(60, Math.floor((Number(tokenData.expiresAt) - Date.now()) / 1000));
    await getKV(env).put(tokenCacheKey(name), JSON.stringify({
      version: TOKEN_CACHE_VERSION,
      name,
      token: tokenData.token,
      expiresAt: Number(tokenData.expiresAt),
      scope: tokenData.scope || name,
      createdAt: Date.now()
    }), { expirationTtl: ttlSeconds });
  } catch {
    /* Token cache failure must never break booking. */
  }
}

/* ----------------------------- GENERAL HELPERS ----------------------------- */

function json(data, status = 200, env = {}) {
  return corsResponse(JSON.stringify(data, null, 2), status, env, {
    "content-type": "application/json; charset=utf-8"
  });
}

function corsResponse(body, status = 200, env = {}, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(env || {}),
      ...extraHeaders
    }
  });
}

function corsHeaders(env = {}) {
  const DEFAULT_ALLOWED = [
    "https://lschacht99.github.io",
    "https://timbercrestmansions.com",
    "https://www.timbercrestmansions.com"
  ];
  const ALLOWED_SUFFIXES = [".squarespace.com"];

  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const allowAll = configured.includes("*");
  const allowList = new Set([...DEFAULT_ALLOWED, ...configured.filter((o) => o !== "*")]);

  const requestOrigin = env.__REQUEST_ORIGIN || "";
  let originHost = "";
  try { originHost = requestOrigin ? new URL(requestOrigin).hostname : ""; } catch (_) {}

  const originAllowed =
    allowList.has(requestOrigin) ||
    ALLOWED_SUFFIXES.some((suffix) => originHost.endsWith(suffix));

  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Max-Age": "86400"
  };

  if (originAllowed && requestOrigin) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else if (allowAll) {
    headers["Access-Control-Allow-Origin"] = requestOrigin || "*";
  }

  return headers;
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new PublicError("Invalid JSON body", 400); }
}

function parseJsonEnv(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseCSV(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function assertRequired(value, message) {
  if (value === undefined || value === null || value === "") throw new PublicError(message, 400);
}

function assertDate(value, message) {
  assertRequired(value, message);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new PublicError(message, 400);
}

function assertPositiveNumber(value, message) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) throw new PublicError(message, 400);
}

function normalizePath(pathname) {
  let path = pathname.replace(/\/+$/, "");
  if (!path) path = "/";
  return path;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function addBreakdownItem(list, label, amount) {
  const n = toNumberOrNull(amount);
  if (n !== null) list.push({ label, amount: n });
}

function slugify(value) {
  return String(value || "property")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "property";
}

function safeError(err) {
  if (err instanceof PublicError) return err.message;
  return err?.message || String(err) || "Unknown error";
}

class PublicError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.details = details;
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
}

function hashString(input) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
