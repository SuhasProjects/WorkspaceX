# Billing and subscriptions

WorkspaceZero is prepared for subscriptions, but no payment processing is
connected yet. This document describes what exists, what is enforced, and the
exact steps to connect the AWS monetization service.

## Plans

| Plan | Price | Tools |
| --- | --- | --- |
| Free | $0/month | 3 |
| Pro | $5/month | 20 |
| Team | $15/month | unlimited |

Defined once in `src/lib/billing/plans.ts` (client-safe) and used by the pricing
page, the dashboard usage line, and the server-side limit check.

## Data model

`workspaces` documents gain an optional `subscription` field:

```
subscription: {
  plan: "free" | "pro" | "team",
  status: "none" | "pending" | "active" | "past_due" | "canceled",
  externalId?: string,   // billing provider's subscription or checkout id
  updatedAt: Date
}
```

A workspace with no `subscription` is Free. The plan a workspace is *entitled
to* is computed by `effectivePlan()`: a paid plan counts only while `status`
is `"active"`. Pending, past-due, and canceled subscriptions fall back to Free
limits automatically; nothing has to run on a timer.

`GET /api/workspaces/current` now returns `plan` and `subscription`.
`GET /api/billing` returns plan, subscription, widget limit, widget count, and
whether checkout is available.

## Enforcement

`createWidget()` in `src/lib/db/repository.ts` counts the workspace's widgets
and refuses to insert past the plan's limit with `PLAN_LIMIT_REACHED`, which
`POST /api/widgets` returns as HTTP 403. This runs for every save regardless
of what the UI shows. The builder displays usage ("2 of 3 tools used") and a
link to `/pricing`, but that is a courtesy, not the control.

## Provider boundary

`src/lib/billing/provider.ts` defines `BillingProvider`:

- `createCheckoutSession({ workspaceId, plan, returnUrl })` → `{ url, sessionId }`
- `parseWebhook(request)` → verified `SubscriptionEvent` or throws

The current implementation is a placeholder with `available: false`. It
throws on both methods, so no checkout can start and no event can be produced.
Consequently there is no path that sets `status: "active"` today.

Routes that use the boundary:

- `POST /api/billing/checkout` (admin): asks the provider for a checkout URL,
  records `{ plan, status: "pending", externalId: sessionId }`, returns the URL.
  With the placeholder it returns 503 before touching the database.
- `POST /api/billing/webhook` (no session; called by the provider): verifies
  the request through the provider, then records the new status. Only this
  route can set `"active"`. With the placeholder it returns 501.

## Connecting the AWS monetization service

1. **Implement `awsProvider`** in `src/lib/billing/aws-provider.ts` satisfying
   `BillingProvider`, and select it in `getBillingProvider()` when
   `BILLING_PROVIDER=aws`. Keep every AWS-specific detail (SDK calls, request
   signing, event names) inside that file.
2. **Checkout:** call the service's "create checkout/subscription session" API
   with our `workspaceId` and plan as metadata, our `returnUrl`, and the price
   identifier for the plan. Return the hosted payment URL and the session id.
   Never mark anything active here; the admin has not paid yet.
3. **Webhook verification:** in `parseWebhook`, read the raw body, verify the
   signature header with `BILLING_WEBHOOK_SECRET` (HMAC or the service's
   SDK), reject stale timestamps, and map the service's event types to
   `activated | renewed | past_due | canceled`. Pull `workspaceId` and `plan`
   from the metadata we attached at checkout, never from untrusted fields.
4. **Idempotency:** store processed `eventId`s (a `billingEvents` collection
   with a unique index) and return 200 without changes for repeats. Providers
   retry webhooks; double-processing must be harmless.
5. **Register the webhook URL** `https://<domain>/api/billing/webhook` with the
   service and set `BILLING_WEBHOOK_SECRET` in Vercel. The route must stay
   exempt from the same-origin check (it is: it does not call `checkOrigin`).
6. **Return page:** the pricing page is the return URL. After payment the
   status flips to `"active"` only when the webhook arrives; the page should
   poll `GET /api/billing` for a few seconds and show "Payment confirmed" or
   "Still confirming your payment" rather than assuming success.
7. **Downgrades and failures:** a `canceled` event keeps `plan` for the record
   but the effective plan becomes Free immediately. Decide whether a workspace
   over the Free limit after a downgrade keeps its existing tools (recommended:
   yes, read-only beyond the limit; block only new creation, which is already
   how the check behaves).
8. **Customer portal (optional):** add `createPortalSession(workspaceId)` to the
   interface if the service offers one, for cancellations and invoices.

## Testing checklist before launch

- New workspace: Free, 3 tools allowed, 4th save returns `PLAN_LIMIT_REACHED`.
- Checkout for Pro sets `pending` and never changes limits by itself.
- A forged webhook (bad signature) returns 4xx and changes nothing.
- A valid `activated` event sets `active`; the 4th tool now saves.
- A duplicate event is ignored; a `canceled` event drops the limit back to 3.
- Members cannot call `/api/billing/checkout` (403).
