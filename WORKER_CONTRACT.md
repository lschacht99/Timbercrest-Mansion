# Timbercrest Mansion Cloudflare Worker contract

The static GitHub Pages shell never talks to Guesty directly. Guesty credentials must stay inside the Cloudflare Worker.

## Connect the Worker

Set the Worker base before `assets/data.js` loads, or edit `assets/data.js` directly:

```html
<script>window.TC_WORKER_BASE = "https://YOUR-TIMBERCREST-WORKER.workers.dev";</script>
<script src="assets/data.js"></script>
<script src="assets/guesty-client.js?v=1"></script>
```

If `window.TC_WORKER_BASE` is empty, the site keeps the static fallback cards and booking demo behavior.

## GET `/api/listings`

The Worker can return any of these shapes:

```json
{ "properties": [] }
{ "listings": [] }
{ "data": { "listings": [] } }
[]
```

Recommended normalized listing fields:

```json
{
  "id": "the-timbercrest",
  "listingId": "Guesty listing id",
  "name": "The Timbercrest",
  "city": "West Dover, Vermont",
  "bedrooms": 12,
  "baths": 12.5,
  "guests": 32,
  "nightlyFrom": 2450,
  "minNights": 2,
  "pets": "allowed",
  "rating": 4.97,
  "reviews": 86,
  "image": "https://...",
  "href": "stays/the-timbercrest.html"
}
```

The frontend also accepts common raw Guesty-like fields such as `_id`, `nickname`, `title`, `address`, `accommodates`, `bathrooms`, `prices.basePrice`, `picture`, and `pictures`.

## POST `/api/book`

The booking page sends:

```json
{
  "source": "timbercrest-static-shell",
  "propertyIds": ["the-timbercrest"],
  "listingIds": ["Guesty listing id"],
  "checkIn": "2026-07-03",
  "checkOut": "2026-07-05",
  "guests": { "adults": 2, "children": 0, "pets": 0 },
  "email": "guest@example.com",
  "isEvent": false,
  "eventType": null,
  "message": null,
  "totalQuoted": 5550
}
```

The Worker may return `{ "redirectUrl": "https://..." }` to send guests to a hosted checkout or confirmation page. Without a redirect URL, the page shows the built-in success message.
