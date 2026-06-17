# Timbercrest Mansions — Static Website (HTML)

A plain, crawlable **multi-page HTML website**. Every page is a real `.html` file — no build step required to view it, and search engines see full content on every URL (good for the SEO items in the audit). Same Airbnb-style layout and the same charcoal/bronze design as the app version.

## What's here

```
timbercrest-site/
├─ index.html              # Home — search, mansions grid, group buyout, why-book-direct
├─ concept.html            # The concept — image-led story
├─ events.html             # Weddings & events — 48+ multi-mansion buyout
├─ area.html               # Things to do — season filter + day itineraries
├─ booking.html            # Booking — 1, 2 or 3+ mansions in one request
├─ stays/
│  ├─ the-timbercrest.html
│  ├─ the-myrtle.html
│  ├─ the-birch.html
│  └─ the-mahogany.html
├─ assets/
│  ├─ styles.css           # brand styles
│  ├─ data.js              # property/activity data (shared by search + booking)
│  ├─ site.js              # universal search, menu
│  └─ booking.js           # booking page logic + Worker call
├─ worker/index.js         # Cloudflare Worker booking API (same as the app version)
├─ robots.txt
├─ sitemap.xml
├─ favicon.svg
└─ build.py                # regenerates all HTML pages (optional)
```

## View it

Just open `index.html` in a browser — it works with no server. For a local server (recommended, so the search and booking JS behave like production):

```bash
cd timbercrest-site
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Drag the folder onto **Cloudflare Pages**, **Netlify**, or any static host. No build command needed — set the output/publish directory to this folder.

## Connect bookings

1. Deploy `worker/index.js` to Cloudflare Workers (see the app repo's `docs/DEPLOY.md` for Guesty setup).
2. Put the Worker URL into `assets/data.js`:
   ```js
   WORKER_URL: "https://timbercrest-booking.YOUR-SUBDOMAIN.workers.dev/api/book",
   ```
   Empty = demo mode (booking simulates success and says so).

## Editing pages

Two ways:
- **Directly:** open any `.html` file and edit the markup. They're independent files.
- **Via the generator:** edit the data/content in `build.py`, then run `python3 build.py` to regenerate every page consistently (keeps headers, footers, and meta in sync). Use this if you change shared chrome.

## Tailwind note

Pages load Tailwind from its CDN for styling speed. For production you may want to compile Tailwind to a single CSS file to drop the CDN script (faster, and addresses the page-speed audit item). The custom brand styles already live in `assets/styles.css`.

## Before launch
- Swap the gradient `.photo` placeholders for real `<img>` photography (add `loading="lazy"`).
- Verify rates, the $650/house cleaning fee, cancellation terms, and nearby drive times.
- Submit `sitemap.xml` in Google Search Console; claim the Google Business Profile.
