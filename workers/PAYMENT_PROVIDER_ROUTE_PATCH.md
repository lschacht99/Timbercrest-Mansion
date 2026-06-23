# Timbercrest Worker payment-provider route patch

The live URL below currently returns 404 because the restored Timbercrest Worker does not include a `/payment-provider` route yet:

```txt
https://timbercrest.bookings-e2d.workers.dev/payment-provider?listingId=68725ada8df7060012c68ab0
```

The current Worker route list includes `/api/images`, `/api/calendar`, `/api/quote`, `/api/book`, etc., but not `/payment-provider`.

## What this route is for

`/payment-provider` is not the `ccToken`.

It is used once during setup to find the GuestyPay provider ID for a listing. After it is verified, save the returned ID in Cloudflare as:

```txt
GUESTY_PAYMENT_PROVIDER_ID
```

The `ccToken` is generated later in the browser by GuestyPay tokenization when the guest enters a card.

## Add the route

Inside `fetch()`, after `/auth-test/booking` and before cached listing/image routes, add:

```js
if ((path === "/payment-provider" || path === "/api/payment-provider") && request.method === "GET") {
  return cachedRoute(request, env, ctx, {
    cacheName: "payment-provider",
    ttlSeconds: 60 * 60 * 24 * 30,
    handler: () => safeGuestyRoute(env, () => handlePaymentProvider(url, env))
  });
}
```

Inside `publicRoutes()`, add:

```js
"GET /payment-provider?listingId=...",
"GET /api/payment-provider?listingId=...",
```

Add this handler near the other route handlers:

```js
async function handlePaymentProvider(url, env) {
  const forceApi = url.searchParams.get("force") === "1";
  const listingId =
    url.searchParams.get("listingId") ||
    url.searchParams.get("guestyListingId") ||
    resolveListingIdFromRequest(url, env);

  assertRequired(listingId, "Missing listingId");

  if (env.GUESTY_PAYMENT_PROVIDER_ID && !forceApi) {
    return json({
      ok: true,
      listingId,
      paymentProviderId: env.GUESTY_PAYMENT_PROVIDER_ID,
      source: "GUESTY_PAYMENT_PROVIDER_ID Cloudflare variable",
      note: "Add ?force=1 to call Guesty Open API again."
    }, 200, env);
  }

  const data = await getPaymentProviderByListing(env, listingId);
  const providerId = extractPaymentProviderId(data);

  return json({
    ok: true,
    listingId,
    paymentProviderId: providerId,
    source: "Guesty Open API provider-by-listing",
    paymentProvider: data,
    instructions: [
      "Copy paymentProviderId into Cloudflare as GUESTY_PAYMENT_PROVIDER_ID after verifying it.",
      "Use this provider ID when rendering GuestyPay tokenization."
    ]
  }, 200, env);
}
```

Add this helper near the Guesty Open API helpers:

```js
async function getPaymentProviderByListing(env, listingId) {
  assertRequired(listingId, "Missing listingId");

  const params = new URLSearchParams({
    listingId,
    includeInactiveProviders: "true",
    fields: "_id id name nickname key type processor status active paymentMethods supportedMethods providerId paymentProviderId"
  });

  return guestyOpenApi(
    env,
    "/payment-providers/provider-by-listing?" + params.toString(),
    { method: "GET" }
  );
}
```

Add this extractor near the normalizer/helper functions:

```js
function extractPaymentProviderId(data) {
  const candidates = [
    data && data.paymentProviderId,
    data && data.providerId,
    data && data._id,
    data && data.id,
    data && data.data && data.data.paymentProviderId,
    data && data.data && data.data.providerId,
    data && data.data && data.data._id,
    data && data.data && data.data.id,
    Array.isArray(data && data.data) && data.data[0] && (data.data[0].paymentProviderId || data.data[0].providerId || data.data[0]._id || data.data[0].id),
    Array.isArray(data && data.results) && data.results[0] && (data.results[0].paymentProviderId || data.results[0].providerId || data.results[0]._id || data.results[0].id)
  ];

  const providerId = candidates.find(Boolean);
  if (!providerId) {
    throw new PublicError("Could not find paymentProviderId in Guesty response", 502, { body: data });
  }
  return providerId;
}
```

## Test after deploy

```txt
https://timbercrest.bookings-e2d.workers.dev/payment-provider?listingId=68725ada8df7060012c68ab0&force=1
```

Then save the returned `paymentProviderId` in Cloudflare:

```txt
GUESTY_PAYMENT_PROVIDER_ID
```

After that, this should work without `force=1`:

```txt
https://timbercrest.bookings-e2d.workers.dev/payment-provider?listingId=68725ada8df7060012c68ab0
```
