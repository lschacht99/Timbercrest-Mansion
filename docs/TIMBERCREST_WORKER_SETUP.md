# Timbercrest Guesty Worker setup

The Worker file is:

```txt
workers/timbercrest-guesty-worker.js
```

The Worker is the full long version with cache behavior preserved. The calendar/schedule cache is important because Guesty can return errors or rate-limit when the site refreshes availability too often.

## Important

Do not replace the full Worker with a shortened Worker unless you intentionally want to remove cache behavior.

The preserved Worker includes:

- Cached listing routes
- Cached image routes
- Stale calendar cache
- Calendar fallback behavior when Guesty errors
- Quote de-dupe cache
- OAuth token cache
- Live uncached booking route

## Cloudflare variables

Do not include `=` in variable names.

Correct:

```txt
GUESTY_CLIENT_ID
```

Wrong:

```txt
GUESTY_CLIENT_ID=
```

## Required variables

Plaintext variables:

```txt
ALLOWED_ORIGINS
CURRENCY
SITE_BASE_URL
TIMEZONE
TIMBERCREST_LISTINGS_JSON
```

Recommended values:

```txt
ALLOWED_ORIGINS=https://lschacht99.github.io,https://timbercrestmansions.com,https://www.timbercrestmansions.com
CURRENCY=USD
SITE_BASE_URL=https://lschacht99.github.io/Timbercrest-Mansion
TIMEZONE=America/New_York
```

Secrets:

```txt
GUESTY_OPEN_API_CLIENT_ID
GUESTY_OPEN_API_CLIENT_SECRET
GUESTY_CLIENT_ID
GUESTY_CLIENT_SECRET
```

Open API credentials are used for listings, images, and calendar.

Booking Engine credentials are used for quote and book.

## Listing IDs

Use this value for `TIMBERCREST_LISTINGS_JSON` if the Worker version supports JSON parsing from this variable:

```json
[
  {
    "siteId": "the-birch",
    "publicName": "The Birch",
    "guestyName": "The Birch house",
    "listingId": "68725ada8df7060012c68ab0",
    "match": [
      "The Birch house",
      "The Birch house 2",
      "The Birch 13BR Villa 2 min from Mt. Snow Hot Tub Pool",
      "The Birch 13BR Villa + 2 min from Mt. Snow + Hot Tub + Pool"
    ],
    "href": "stays/the-birch.html"
  },
  {
    "siteId": "the-mahogany",
    "publicName": "The Mahogany",
    "guestyName": "The Mahogany House",
    "listingId": "68725a69d70161000fb43b07",
    "match": [
      "The Mahogany House",
      "The Mahogany. House near Mt Snow Hot Tub Pool",
      "The Mahogany. House near Mt Snow + Hot Tub + Pool",
      "The Mahogny 2",
      "The Mohagony",
      "The Mohagony House",
      "9BR Luxury Mansion Indoor Pool Near Mt Snow",
      "9BR Luxury Mansion + Indoor Pool + Near Mt Snow"
    ],
    "href": "stays/the-mahogany.html"
  },
  {
    "siteId": "the-myrtle",
    "publicName": "The Myrtle",
    "guestyName": "The Myrtle House",
    "listingId": "68725adcd80f8000131efe3f",
    "match": [
      "The Myrtle House",
      "The Myrtle 2",
      "The Myrtle Villa Hot Tub Pool Near Mount Snow",
      "The Myrtle Villa + Hot Tub + Pool + Near Mount Snow"
    ],
    "href": "stays/the-myrtle.html"
  },
  {
    "siteId": "the-timbercrest",
    "publicName": "The Timbercrest",
    "guestyName": "The Rosewood House",
    "listingId": "68725a6736508a0012b410e1",
    "match": [
      "The Rosewood House",
      "12BR Villa Near Mount Snow Sleeps 32 Hot Tub & Indoor Pool",
      "12BR Villa Near Mount Snow + Sleeps 32 + Hot Tub & Indoor Pool"
    ],
    "href": "stays/the-timbercrest.html"
  }
]
```

## Safer current option

If the deployed Worker is still the restored full version and has not yet received the JSON-type parsing patch, set `TIMBERCREST_LISTINGS_JSON` as **Plaintext**, not Cloudflare JSON.

That keeps the full cache behavior and avoids JSON object parsing issues.

## Test order

```txt
https://YOUR-WORKER.workers.dev/health
https://YOUR-WORKER.workers.dev/debug
https://YOUR-WORKER.workers.dev/auth-test/open
https://YOUR-WORKER.workers.dev/api/listings
https://YOUR-WORKER.workers.dev/api/calendar?id=the-birch&from=2026-07-01&to=2026-07-31
https://YOUR-WORKER.workers.dev/auth-test/booking
```

Expected `/debug` status:

```json
{
  "baseConfigReady": true,
  "listingsConfigured": true,
  "openApiReady": true,
  "bookingApiReady": true
}
```
