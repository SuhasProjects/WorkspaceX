# Billing and subscriptions

WorkspaceZero is prepared for subscriptions, but no payment processing is
connected yet. This document describes what exists, what is enforced, and the
exact steps to connect the AWS monetization service.

## Plans

| | Free | Pro | Team |
| --- | --- | --- | --- |
| Price | $0/mo | $12/mo | $50/mo for 10 members, +$25/mo per additional 10 members |
| AI generations / month | 3 | 20 | 100 |
| Active tools | 3 | Unlimited | Unlimited |
| Team members | 1 | 1 | Unlimited |
| Workspaces | 1 | 3 | Unlimited |
| Edit existing widgets with AI | Limited | ✓ | ✓ |
| Shared team widgets | ✗ | ✗ | ✓ |
| Workspace permissions | ✗ | ✗ | Admin + Member |

Defined once in `src/lib/billing/plans.ts` (client-safe) and used by the pricing
page, the dashboard usage line, and every server-side check.

What is enforced today:

- **Active tools** and **AI generations / month** are always enforced on the
  server (`createWidget`, `POST /api/generate`). Generations are counted per
  calendar month in `workspaces.generationUsage["YYYY-MM"]`; edits count too,
  which is what "Limited" editing on Free means in practice.
- **Shared team widgets** and **Workspace permissions (member logins)** are
  enforced only when `BILLING_ENFORCE_FEATURES=true`, so the free demo
  workspace keeps working until billing is live. When on, `/api/storage` and
  member sign-in return `PLAN_FEATURE_REQUIRED` below Team.
- **Team members** and **Workspaces** are display-only: the app has no user
  accounts, so there is nothing to count yet.

Team pricing is seat-based: `monthlyPriceFor(plan, members)` in `plans.ts`
computes the charge, and the checkout call must send the seat count to the
billing service once accounts make it countable. Until then checkout uses the
10-member base price.

## Ownership

Subscriptions and generation usage belong to the paying **user account**
(`users.subscription`, `users.generationUsage`), not to a workspace. A
workspace's effective plan is its owner's active plan. Consequences:

- Free accounts own one workspace, Pro three, Team unlimited. Joined
  workspaces never count against the allowance.
- Only workspaces owned by an active Team subscriber may invite members.
- Team seats are the unique accepted users across every workspace the
  subscriber owns, counting the owner once. Pending invitations do not count.
- Generations triggered by an invited admin are charged to the owner's quota.
- Widget limits apply to each owned workspace independently.
- Checkout metadata carries `userId` (and `seats` for Team); webhooks update
  the user record.

## Data model

`users` documents carry the optional `subscription` field:

```
subscription: {
  plan: "free" | "pro" | "team",
  status: "none" | "pending" | "active" | "past_due" | "canceled",
  externalId?: string,   // billing provider's subscription or checkout id
  updatedAt: Date
}
```

An account with no `subscription` is Free. The plan a workspace is *entitled
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

## Operations: resetting application data

Accounts replaced the old shared-password model; legacy records are not migrated.
To clear every WorkspaceZero collection and recreate indexes, run, deliberately,
in the intended environment:

```
RESET_CONFIRM=yes npm run db:reset
```

The script prints the database name and the collections it will drop first. If
the target looks like production (database name containing prod/live/main, or a
production NODE_ENV/VERCEL_ENV), it also requires `RESET_PRODUCTION_CONFIRM=yes`.
It never logs credentials and is never run by startup, build, tests, or deploys.
